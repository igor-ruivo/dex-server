import { IEventSource, IParsedEvent, IEntry } from '../../../types/events';
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
    BONUSES: ['Bonuses', 'Bônus', 'Event bonus', 'Event Bonus', 'Event bonuses', 'Event Bonuses', 'Bônus do evento', 'Bonuses'],
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

export class PokemonGoSource implements IEventSource {
    public name = 'pokemongo';
    private fetcher: PokemonGoFetcher;

    constructor() {
        this.fetcher = new PokemonGoFetcher();
    }

    public async parseEvents(gameMasterPokemon: Record<string, GameMasterPokemon>): Promise<IParsedEvent[]> {
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
            
            return allEvents;
        } catch (error) {
            return [];
        }
    }

    private parseSinglePost(post: PokemonGoPost, gameMasterPokemon: Record<string, GameMasterPokemon>): IParsedEvent[] {
        console.log('Parsing post:', post.url, 'type:', post.type);
        if (post.url.includes('/news/')) {
            console.log('Forcing /news/ event structure for:', post.url);
            return this.parseNewsEvent(post, gameMasterPokemon);
        }
        const dom = new JSDOM(post.html);
        const document = dom.window.document;
        const blocks = this.extractContainerBlocks(document, false);
        const parsedContents = this.parseEventBlocks(blocks, document, gameMasterPokemon);
        const events: IParsedEvent[] = [];
        const hasChildEvents = parsedContents.some(content => content.title && content.title !== UNKNOWN_EVENT_TITLE);
        for (let i = 0; i < parsedContents.length; i++) {
            const parsedContent = parsedContents[i];
            if (hasChildEvents && (!parsedContent.title || parsedContent.title === UNKNOWN_EVENT_TITLE)) {
                continue;
            }
            let subtitle = '';
            let eventStartDate = 0;
            let eventEndDate = 0;
            let eventDateRanges: { start: number, end: number }[] = [];
            if (parsedContent.title && parsedContent.title !== UNKNOWN_EVENT_TITLE) {
                subtitle = parsedContent.title;
                if (parsedContent.date) {
                    const innerDateRanges = parseEventDateRange(parsedContent.date);
                    if (innerDateRanges.length > 0) {
                        eventDateRanges = innerDateRanges;
                        eventStartDate = Math.min(...innerDateRanges.map(r => r.start));
                        eventEndDate = Math.max(...innerDateRanges.map(r => r.end));
                    }
                }
            } else {
                if (eventDateRanges.length > 0) {
                    eventStartDate = Math.min(...eventDateRanges.map(r => r.start));
                    eventEndDate = Math.max(...eventDateRanges.map(r => r.end));
                }
            }
            if (parsedContent.title && parsedContent.title !== UNKNOWN_EVENT_TITLE && eventDateRanges.length === 0 && this.isEnglishVersion(post.url)) {
                continue;
            }
            const imageUrl = parsedContent.imageUrl || this.extractImageFromPost(post.html);

            const event: IParsedEvent = {
                id: (post.url.includes('/post/') ? post.url.split('/post/')[1] : post.url.split('/news/')[1]).replaceAll('/', '') + '-' + String(i),
                url: post.url,
                title: post.title,
                subtitle: this.extractEventDescription(subtitle),
                startDate: eventStartDate,
                endDate: eventEndDate,
                dateRanges: eventDateRanges,
                imageUrl,
                source: 'pokemongo' as const,
                wild: parsedContent.wild,
                raids: parsedContent.raids,
                eggs: parsedContent.eggs,
                research: parsedContent.research,
                incenses: parsedContent.incenses,
                bonuses: parsedContent.bonuses.length > 0 ? parsedContent.bonuses : undefined,
                isEnglishVersion: this.isEnglishVersion(post.url)
            };
            events.push(event);
        }
        return events;
    }

    private parseNewsEvent(post: PokemonGoPost, gameMasterPokemon: Record<string, GameMasterPokemon>): IParsedEvent[] {
        console.log('Parsing /news/ event:', post.url);
        const dom = new JSDOM(post.html);
        const document = dom.window.document;
        const blocks = this.extractContainerBlocks(document, true);
        const dateString = Array.from(blocks[0].children)[1].textContent?.trim() || '';

        if (!dateString) {
            return [];
        }

        const wildDomain = Object.values(gameMasterPokemon).filter(p => !p.isShadow && !p.isMega && !p.aliasId);
        const raidDomain = wildDomain;
        const eggDomain = wildDomain;
        const researchDomain = wildDomain;
        const incenseDomain = wildDomain;
        const subtitle = Array.from(document.querySelector('article[aria-labelledby=news-title]')?.querySelectorAll('*') || []).filter(a => Array.from(a.classList).some(c => c.includes('_containerBlock')))[0].querySelector('h2')?.textContent || '';
        const dateRanges = parseEventDateRange(dateString);

        const imageUrl = document.querySelector('article>div>div>picture>img')?.getAttribute('src') || '';
        const startDate = Math.min(...dateRanges.map(r => r.start));
        const endDate = Math.max(...dateRanges.map(r => r.end));

        const eventBlock = this.parseInnerEvent(blocks, gameMasterPokemon, wildDomain, raidDomain, eggDomain, researchDomain, incenseDomain, subtitle, dateString, imageUrl);
            
        const event: IParsedEvent = {
            id: (post.url.includes('/post/') ? post.url.split('/post/')[1] : post.url.split('/news/')[1]).replaceAll('/', ''),
            url: post.url,
            title: post.title,
            subtitle: subtitle,
            startDate,
            endDate,
            dateRanges,
            imageUrl,
            source: 'pokemongo',
            wild: eventBlock.wild,
            raids: eventBlock.raids,
            eggs: eventBlock.eggs,
            research: eventBlock.research,
            incenses: eventBlock.incenses,
            bonuses: eventBlock.bonuses.length > 0 ? eventBlock.bonuses : undefined,
            isEnglishVersion: this.isEnglishVersion(post.url)
        };
        return [event];
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

    private parseEventBlocks(blocks: Element[], document: Document, gameMasterPokemon: Record<string, GameMasterPokemon>): EventBlock[] {
        const allPokemon = Object.values(gameMasterPokemon);
        const wildDomain = allPokemon.filter(p => !p.isShadow && !p.isMega && !p.aliasId);
        const raidDomain = wildDomain;
        const eggDomain = wildDomain;
        const researchDomain = wildDomain;
        const incenseDomain = wildDomain;
        const events: EventBlock[] = [];
        for (const containerBlock of blocks) {
            const headlineEl = containerBlock.querySelector(DOM_SELECTORS.CONTAINER_BLOCK_HEADLINE) || containerBlock.querySelector('h2');
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
                } else if (child.tagName === 'DIV' && /\d{4}/.test(child.textContent || '') && /\d{1,2}:\d{2}/.test(child.textContent || '')) {
                    date = child.textContent?.trim().split("\n")[0].trim() || '';
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
            const eventBlock = this.parseInnerEvent(innerEntries, gameMasterPokemon, wildDomain, raidDomain, eggDomain, researchDomain, incenseDomain, subtitle, date, imageUrl);
            if (eventBlock) {
                events.push(eventBlock);
            }
        }
        return events;
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
            const kind = (title?.textContent?.trim() || title?.textContent?.trim() || "") as string;
            const contentBodies = Array.from(entry.children) as unknown as HTMLElement[];
            if (!kind) continue;
            if (this.isBonusSection(kind)) {
                for (let j = 1; j < contentBodies.length; j++) {
                    const bonusContainer = contentBodies[j] as unknown as Element;
                    if (bonusContainer) {
                        const visualBonuses = this.extractBonusesVisualLines(bonusContainer);
                        bonusesArr.push(...visualBonuses);
                    }
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

    private extractContainerBlocks(document: Document, isNews: boolean): Element[] {
        if (isNews) {
            const article = document.querySelector('article[aria-labelledby=news-title]');
            if (!article) return [];
            return Array.from(article.querySelectorAll('*')).filter(a => Array.from(a.classList).some(c => c.includes('_containerBlock')));
        } else {
            const blogPostBlocks = document.getElementsByClassName(DOM_SELECTORS.BLOG_POST_BLOCKS)[0];
            if (!blogPostBlocks) return [];
            return Array.from(blogPostBlocks.children).map(e => e.children[0]).filter(Boolean);
        }
    }

    private isEnglishVersion = (url: string) => !url.toLocaleLowerCase().includes('pt_br');
} 