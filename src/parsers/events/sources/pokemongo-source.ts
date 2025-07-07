import { IEventSource, IParsedEvent, EventCategory, IEntry } from '../../../types/events';
import { GameMasterPokemon } from '../../../types/pokemon';
import { parseEventDateRange } from '../utils/normalization';
import { PokemonGoFetcher, PokemonGoPost } from '../services/pokemongo-fetcher';
import { PokemonMatcher, extractPokemonSpeciesIdsFromElements } from '../utils/pokemon-matcher';
import { JSDOM } from 'jsdom';

// Constants for better maintainability
const DOM_SELECTORS = {
    BLOG_POST_BLOCKS: 'blogPost__post__blocks',
    CONTAINER_BLOCK_HEADLINE: '.ContainerBlock__headline',
    CONTAINER_BLOCK_BODY: '.ContainerBlock__body',
    CONTAINER_BLOCK: 'ContainerBlock',
    BLOG_POST_TITLE: 'blogPost__title',
    BLOG_POST_IMG: '.blogPost__post img'
} as const;

const EVENT_SECTION_TYPES = {
    BONUSES: ['Bonuses', 'Bônus'],
    WILD_ENCOUNTERS: ['Wild encounters', 'Wild Encounters', 'Event-themed Pokémon'],
    EGGS: ['Eggs'],
    RESEARCH: [
        'Field Research Task Rewards',
        'Field Research Task Encounters',
        'Field Research task encounters',
        'Field Research task rewards',
        'Field Research',
        'Timed Research'
    ],
    RAIDS: ['Raids', 'Shadow Raids', 'Shadow Raid debut'],
    INCENSE: ['Incense Encounters', 'Increased Incense encounters']
} as const;

const BLOCK_LEVEL_ELEMENTS: string[] = [
  'P', 'DIV', 'LI', 'UL', 'OL', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'NAV', 'ASIDE', 'MAIN', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE', 'ADDRESS', 'DL', 'DT', 'DD', 'FIGURE', 'FIGCAPTION', 'HR', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD', 'FORM', 'FIELDSET', 'LEGEND'
];
const UNKNOWN_EVENT_TITLE = 'Unknown Event';
const DATE_RANGE_REGEX = /\d{1,2}:\d{2}\s*(?:a\.m\.|p\.m\.)\s*–\s*\d{1,2}:\d{2}\s*(?:a\.m\.|p\.m\.)/;

// Define interfaces for eventData and domains used in processEventSection and parseInnerEvent.
interface EventData {
  raids: IEntry[];
  wild: IEntry[];
  eggs: IEntry[];
  research: IEntry[];
  incenses: IEntry[];
}
interface Domains {
  wildDomain: GameMasterPokemon[];
  raidDomain: GameMasterPokemon[];
  eggDomain: GameMasterPokemon[];
  researchDomain: GameMasterPokemon[];
  incenseDomain: GameMasterPokemon[];
}

interface EventBlock {
  title: string;
  date: string;
  imageUrl: string;
  raids: IEntry[];
  wild: IEntry[];
  eggs: IEntry[];
  research: IEntry[];
  incenses: IEntry[];
  bonuses: string[];
}

interface EventDataStructured {
  title: string;
  subtitle: string;
  imageUrl: string;
}

export class PokemonGoSource implements IEventSource {
    public name = 'pokemongo';
    public baseUrl = 'https://pokemongolive.com';
    private fetcher: PokemonGoFetcher;

    constructor() {
        this.fetcher = new PokemonGoFetcher();
    }

    public async parseEvents(html: string, gameMasterPokemon: Record<string, GameMasterPokemon>): Promise<IParsedEvent[]> {
        try {
            const posts = await this.fetcher.fetchAllPosts();
            
            const postPromises = posts
                .filter(post => post.type !== 'season' && post.type !== 'other')
                .map(async (post) => {
                    try {
                        const individualPost = await this.fetcher.fetchSinglePost(post.url);
                        if (individualPost) {
                            return this.parseSinglePost(individualPost, gameMasterPokemon);
                        }
                        return [];
                    } catch (error) {
                        return [];
                    }
                });

            const allEventsArrays = await Promise.all(postPromises);
            const allEvents = allEventsArrays.flat();

            const relevantEvents = this.filterRelevantEvents(allEvents);
            return relevantEvents;
        } catch (error) {
            return [];
        }
    }

    private filterRelevantEvents(events: IParsedEvent[]): IParsedEvent[] {
        return events.filter(event => {
            return (event.bonuses && event.bonuses.length > 0)
                || (event.wild && event.wild.length > 0)
                || (event.raids && event.raids.length > 0)
                || (event.eggs && event.eggs.length > 0)
                || (event.research && event.research.length > 0)
                || (event.incenses && event.incenses.length > 0);
        });
    }

    private parseSinglePost(post: PokemonGoPost, gameMasterPokemon: Record<string, GameMasterPokemon>): IParsedEvent[] {
        const dateStrings = this.extractDateStringsFromPost(post.html);
        const dateRanges = dateStrings.flatMap(ds => parseEventDateRange(ds));
        
        const parsedContents = this.parseEventContent(post.html, gameMasterPokemon);
        
        const events: IParsedEvent[] = [];
        
        const hasChildEvents = parsedContents.some(content => content.title && content.title !== UNKNOWN_EVENT_TITLE);
        
        for (const parsedContent of parsedContents) {
            if (hasChildEvents && (!parsedContent.title || parsedContent.title === UNKNOWN_EVENT_TITLE)) {
                continue;
            }
            
            let eventTitle = post.title;
            let eventStartDate = 0;
            let eventEndDate = 0;
            let eventDateRanges: { start: number, end: number }[] = [];
            
            if (parsedContent.title && parsedContent.title !== UNKNOWN_EVENT_TITLE) {
                eventTitle = parsedContent.title;
                if (parsedContent.date) {
                    const innerDateRanges = parseEventDateRange(parsedContent.date);
                    if (innerDateRanges.length > 0) {
                        eventDateRanges = innerDateRanges;
                        eventStartDate = Math.min(...innerDateRanges.map(r => r.start));
                        eventEndDate = Math.max(...innerDateRanges.map(r => r.end));
                    }
                }
            } else {
                if (dateRanges.length > 0) {
                    eventDateRanges = dateRanges;
                    eventStartDate = Math.min(...dateRanges.map(r => r.start));
                    eventEndDate = Math.max(...dateRanges.map(r => r.end));
                }
            }
            
            if (parsedContent.title && parsedContent.title !== UNKNOWN_EVENT_TITLE && eventDateRanges.length === 0) {
                continue;
            }
            
            const imageUrl = parsedContent.imageUrl || this.extractImageFromPost(post.html);
            
            const categories = this.determineCategories([parsedContent]);
            
            const currentTime = Date.now();
            const isRelevant = eventEndDate > currentTime;
            
            const event: IParsedEvent = {
                id: this.generateEventId(),
                title: eventTitle,
                subtitle: this.extractEventDescription(eventTitle),
                startDate: eventStartDate,
                endDate: eventEndDate,
                dateRanges: eventDateRanges,
                imageUrl,
                sourceUrl: post.url,
                source: 'pokemongo' as const,
                categories,
                wild: parsedContent.wild,
                raids: parsedContent.raids,
                eggs: parsedContent.eggs,
                research: parsedContent.research,
                incenses: parsedContent.incenses,
                bonuses: parsedContent.bonuses.length > 0 ? parsedContent.bonuses : undefined,
                isRelevant,
                metadata: this.createEventMetadata(post, parsedContent)
            };
            
            events.push(event);
        }
        
        return events;
    }

    private generateEventId(): string {
        return `pokemongo-${Date.now()}-${Math.random()}`;
    }

    private createEventMetadata(post: PokemonGoPost, parsedContent: { wild: IEntry[]; raids: IEntry[]; eggs: IEntry[]; research: IEntry[]; incenses: IEntry[] }) {
        return {
            originalPost: post,
            parsedAt: new Date().toISOString(),
            wildCount: parsedContent.wild.length,
            raidCount: parsedContent.raids.length,
            eggCount: parsedContent.eggs.length,
            researchCount: parsedContent.research.length,
            incenseCount: parsedContent.incenses.length
        };
    }

    private extractDateStringsFromPost(html: string): string[] {
        const dateStrings: string[] = [];
        try {
            const dom = new JSDOM(html);
            const document = dom.window.document;

            const blogPostBlocks = document.getElementsByClassName(DOM_SELECTORS.BLOG_POST_BLOCKS)[0];
            if (!blogPostBlocks) {
                return [];
            }
            const entries = Array.from(blogPostBlocks.children);
            if (entries.length === 0) {
                return [];
            }
            const bodyElements = entries[0].getElementsByClassName("ContainerBlock__body");
            if (bodyElements.length > 0) {
                const bodyElement = bodyElements[0] as unknown as HTMLElement;
                const date = bodyElement?.textContent?.trim().split("\n")[0].trim();
                if (date) {
                    dateStrings.push(date);
                }
            }
            
            for (let k = 0; k < entries.length; k++) {
                const containerBlock = entries[k].children[0];
                if (!containerBlock) continue;
                const innerEntries = containerBlock.getElementsByClassName(DOM_SELECTORS.CONTAINER_BLOCK);
                if (innerEntries.length === 0) continue;
                
                const bodyElements = containerBlock.getElementsByClassName("ContainerBlock__body");
                if (bodyElements.length > 0) {
                    const bodyElement = bodyElements[0] as unknown as HTMLElement;
                    const dateInner = bodyElement?.textContent?.trim().split("\n")[0].trim();
                    if (dateInner) {
                        dateStrings.push(dateInner);
                    }
                }
            }
            const uniqueDates = Array.from(new Set(dateStrings));
            return uniqueDates;
        } catch (error) {
            // Intentionally empty: ignore errors and return dateStrings
        }
        return dateStrings;
    }

    private extractImageFromPost(html: string): string {
        const imgRegex = /<img[^>]+src="([^"]*)"[^>]*>/gi;
        const matches = html.match(imgRegex);
        if (matches && matches.length > 0) {
            const srcMatch = matches[0].match(/src="([^"]*)"/);
            if (srcMatch) {
                return srcMatch[1];
            }
        }
        return '';
    }

    private parseEventContent(html: string, gameMasterPokemon: Record<string, GameMasterPokemon>): EventBlock[] {
        try {
            const dom = new JSDOM(html);
            const document = dom.window.document;
            
            const entries = Array.from(document.getElementsByClassName(DOM_SELECTORS.BLOG_POST_BLOCKS)[0]?.children ?? []);
            let hasToComputeInnerEntries = true;

            if (!document.querySelector('.blogPost__post__blocks>.block.block--ContainerBlock>.ContainerBlock>.ContainerBlock__blocks>.block.block--ContainerBlock>.ContainerBlock>.ContainerBlock__headline')) {
                hasToComputeInnerEntries = false;
            }

            const allPokemon = Object.values(gameMasterPokemon);
            const wildDomain = allPokemon.filter(p => !p.isShadow && !p.isMega && !p.aliasId);
            const raidDomain = wildDomain;
            const eggDomain = wildDomain;
            const researchDomain = wildDomain;
            const incenseDomain = wildDomain;

            if (!hasToComputeInnerEntries) {
                const raids: IEntry[] = [];
                const wild: IEntry[] = [];
                const eggs: IEntry[] = [];
                const research: IEntry[] = [];
                const incenses: IEntry[] = [];
                const bonusesArr: string[] = [];

                if (entries.length === 0) {
                    return [{ title: '', date: '', imageUrl: '', raids, wild, eggs, research, incenses, bonuses: bonusesArr }];
                }

                for (let i = 0; i < entries.length; i++) {
                    const entry = entries[i];
                    const title = entry.getElementsByClassName('ContainerBlock__headline')[0] as unknown as HTMLElement;
                    const kind = title?.innerText?.trim();
                    const contentBodies = Array.from(entry.children) as unknown as HTMLElement[];
                    if (!kind) continue;
                    if (this.isBonusSection(kind)) {
                        const bonusContainer = contentBodies[1] as unknown as Element;
                        if (bonusContainer) {
                            const visualBonuses = this.extractBonusesVisualLines(bonusContainer);
                            bonusesArr.push(...visualBonuses);
                        }
                        continue;
                    }
                    this.processEventSection(kind, contentBodies, { raids, wild, eggs, research, incenses }, gameMasterPokemon, { wildDomain, raidDomain, eggDomain, researchDomain, incenseDomain });
                }
                
                return [{ title: '', date: '', imageUrl: '', raids, wild, eggs, research, incenses, bonuses: bonusesArr }];
            } else {
                const events: EventBlock[] = [];
                for (let k = 0; k < entries.length; k++) {
                    const containerBlock = entries[k].children[0];
                    if (!containerBlock) continue;
                    const headlineEl = containerBlock.querySelector(DOM_SELECTORS.CONTAINER_BLOCK_HEADLINE);
                    const subtitle = headlineEl && headlineEl.textContent ? headlineEl.textContent.trim() : '';
                    let date = '';
                    let foundDate = false;
                    for (const child of Array.from(containerBlock.children)) {
                        if (foundDate) break;
                        if (child.classList && Array.from(child.classList).includes('ContainerBlock__body')) {
                            if (child.textContent) {
                                date = child.textContent.trim().split("\n")[0].trim();
                            }
                            foundDate = true;
                        }
                    }
                    let imageUrl = '';
                    let foundImg = false;
                    for (const child of Array.from(containerBlock.children)) {
                        if (foundImg) break;
                        if (child.tagName && child.tagName.toUpperCase() === 'IMG') {
                            imageUrl = child.getAttribute('src') || '';
                            foundImg = true;
                        } else if (child.querySelector) {
                            const img = child.querySelector('img');
                            if (img && img.getAttribute) {
                                imageUrl = img.getAttribute('src') || '';
                                foundImg = true;
                            }
                        }
                    }
                    const innerEntries = Array.from(containerBlock.getElementsByClassName(DOM_SELECTORS.CONTAINER_BLOCK));
                    const innerEvent = this.parseInnerEvent(innerEntries, gameMasterPokemon, wildDomain, raidDomain, eggDomain, researchDomain, incenseDomain, subtitle, date, imageUrl);
                    if (innerEvent) {
                        events.push(innerEvent);
                    }
                }
                return events;
            }
        } catch (error) {
            return [{ title: '', date: '', imageUrl: '', raids: [], wild: [], eggs: [], research: [], incenses: [], bonuses: [] }];
        }
    }

    private isBonusSection(kind: string): boolean {
        return EVENT_SECTION_TYPES.BONUSES.some(bonusType => kind.includes(bonusType));
    }

    private processEventSection(kind: string, contentBodies: HTMLElement[], eventData: EventData, gameMasterPokemon: Record<string, GameMasterPokemon>, domains: Domains): void {
        if (EVENT_SECTION_TYPES.WILD_ENCOUNTERS.some(x => x === kind)) {
            eventData.wild.push(...extractPokemonSpeciesIdsFromElements(contentBodies, new PokemonMatcher(gameMasterPokemon, domains.wildDomain)));
        } else if (EVENT_SECTION_TYPES.EGGS.some(x => x === kind)) {
            eventData.eggs.push(...extractPokemonSpeciesIdsFromElements(contentBodies, new PokemonMatcher(gameMasterPokemon, domains.eggDomain)));
        } else if (EVENT_SECTION_TYPES.RESEARCH.some(x => x === kind)) {
            eventData.research.push(...extractPokemonSpeciesIdsFromElements(contentBodies, new PokemonMatcher(gameMasterPokemon, domains.researchDomain)));
        } else if (EVENT_SECTION_TYPES.RAIDS.some(x => x === kind)) {
            eventData.raids.push(...extractPokemonSpeciesIdsFromElements(contentBodies, new PokemonMatcher(gameMasterPokemon, domains.raidDomain)));
        } else if (EVENT_SECTION_TYPES.INCENSE.some(x => x === kind)) {
            eventData.incenses.push(...extractPokemonSpeciesIdsFromElements(contentBodies, new PokemonMatcher(gameMasterPokemon, domains.incenseDomain)));
        }
    }

    private parseInnerEvent(innerEntries: Element[], gameMasterPokemon: Record<string, GameMasterPokemon>, wildDomain: GameMasterPokemon[], raidDomain: GameMasterPokemon[], eggDomain: GameMasterPokemon[], researchDomain: GameMasterPokemon[], incenseDomain: GameMasterPokemon[], subtitle: string, date: string, imageUrl?: string): EventBlock {
        const raids: IEntry[] = [];
        const wild: IEntry[] = [];
        const eggs: IEntry[] = [];
        const research: IEntry[] = [];
        const incenses: IEntry[] = [];
        const bonusesArr: string[] = [];
        for (let i = 0; i < innerEntries.length; i++) {
            const entry = innerEntries[i];
            const title = entry.children[0] as unknown as HTMLElement;
            const kind = (title?.textContent?.trim() || title?.innerText?.trim() || "") as string;
            const contentBodies = Array.from(entry.children) as unknown as HTMLElement[];
            if (!kind) continue;
            if (this.isBonusSection(kind)) {
                const bonusContainer = contentBodies[1] as unknown as Element;
                if (bonusContainer) {
                    const visualBonuses = this.extractBonusesVisualLines(bonusContainer);
                    bonusesArr.push(...visualBonuses);
                }
                continue;
            }
            this.processEventSection(kind, contentBodies, { raids, wild, eggs, research, incenses }, gameMasterPokemon, { wildDomain, raidDomain, eggDomain, researchDomain, incenseDomain });
        }
        return {
            title: subtitle || UNKNOWN_EVENT_TITLE,
            date: date || "",
            imageUrl: imageUrl || '',
            raids, wild, eggs, research, incenses, bonuses: bonusesArr
        };
    }

    private extractEventDataStructured(html: string): EventDataStructured {
        try {
            const dom = new JSDOM(html);
            const document = dom.window.document;
            
            const titleElement = document.getElementsByClassName(DOM_SELECTORS.BLOG_POST_TITLE)[0];
            const title = titleElement && 'textContent' in titleElement ? (titleElement.textContent?.trim() ?? '') : '';
            
            const firstHeadline = document.querySelector(DOM_SELECTORS.CONTAINER_BLOCK_HEADLINE);
            const subtitle = firstHeadline && 'textContent' in firstHeadline ? (firstHeadline.textContent?.trim() ?? '') : '';
            
            const firstImage = document.querySelector(DOM_SELECTORS.BLOG_POST_IMG);
            const imageUrl = firstImage && 'src' in firstImage ? (firstImage.src as string) : '';
            
            return {
                title,
                subtitle,
                imageUrl
            };
        } catch (error) {
            return {
                title: '',
                subtitle: '',
                imageUrl: ''
            };
        }
    }

    private determineCategories(parsedContent: EventBlock[]): EventCategory[] {
        const categories: EventCategory[] = [];
        
        parsedContent.forEach(content => {
            if (content.wild.length > 0) categories.push(EventCategory.WILD);
            if (content.raids.length > 0) categories.push(EventCategory.RAID);
            if (content.eggs.length > 0) categories.push(EventCategory.EGG);
            if (content.research.length > 0) categories.push(EventCategory.RESEARCH);
            if (content.incenses.length > 0) categories.push(EventCategory.INCENSE);
        });
        
        return categories;
    }

    private extractBonusesVisualLines(bonusContainer: Element): string[] {
        const bonuses: string[] = [];
        let current = '';
        const pushLines = (text: string) => {
            text.split('\n').map(line => line.trim()).filter(Boolean).forEach(line => bonuses.push(line));
        };
        const processNode = (node: Node) => {
            if (node.nodeType === node.ELEMENT_NODE) {
                const el = node as Element;
                if (BLOCK_LEVEL_ELEMENTS.includes(el.tagName as string)) {
                    if (current.trim()) {
                        pushLines(current.trim());
                        current = '';
                    }
                    if (el.textContent?.trim()) {
                        pushLines(el.textContent.trim());
                    }
                } else if (el.tagName === 'BR') {
                    if (current.trim()) {
                        pushLines(current.trim());
                        current = '';
                    }
                } else {
                    for (let j = 0; j < el.childNodes.length; j++) {
                        processNode(el.childNodes[j]);
                    }
                }
            } else if (node.nodeType === node.TEXT_NODE) {
                const text = node.textContent ?? '';
                current += text;
            }
        };
        if (bonusContainer.childNodes) {
            for (let i = 0; i < bonusContainer.childNodes.length; i++) {
                processNode(bonusContainer.childNodes[i]);
            }
        }
        if (current.trim()) {
            pushLines(current.trim());
        }
        return this.groupRelatedBonuses(bonuses.filter(Boolean));
    }
    
    private groupRelatedBonuses(bonuses: string[]): string[] {
        const grouped: string[] = [];
        let i = 0;
        
        while (i < bonuses.length) {
            const current = bonuses[i];
            
            if (current.match(DATE_RANGE_REGEX)) {
                if (i + 1 < bonuses.length) {
                    grouped.push(`${current}\n\n${bonuses[i + 1]}`);
                    i += 2;
                } else {
                    grouped.push(current);
                    i++;
                }
            } else {
                grouped.push(current);
                i++;
            }
        }
        
        return grouped;
    }

    private extractEventDescription(title: string): string {
        return title.replace(/[!?]/g, '').trim();
    }
} 