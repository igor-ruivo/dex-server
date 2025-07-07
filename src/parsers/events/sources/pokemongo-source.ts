import { IEventSource, IParsedEvent, EventCategory, IEntry } from '../../../types/events';
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

const BLOCK_LEVEL_ELEMENTS = ['P', 'DIV', 'LI'] as const;
const UNKNOWN_EVENT_TITLE = 'Unknown Event';
const DATE_RANGE_REGEX = /\d{1,2}:\d{2}\s*(?:a\.m\.|p\.m\.)\s*–\s*\d{1,2}:\d{2}\s*(?:a\.m\.|p\.m\.)/;

export class PokemonGoSource implements IEventSource {
    public name = 'pokemongo';
    public baseUrl = 'https://pokemongolive.com';
    private fetcher: PokemonGoFetcher;

    constructor() {
        this.fetcher = new PokemonGoFetcher();
    }

    public async parseEvents(html: string, gameMasterPokemon: Record<string, any>): Promise<IParsedEvent[]> {
        const now = () => new Date().toISOString();
        try {
            console.log(`[${now()}] [parseEvents] Fetching all posts...`);
            const posts = await this.fetcher.fetchAllPosts();
            console.log(`[${now()}] [parseEvents] Fetched ${posts.length} posts from Pokemon GO`);
            
            // Fetch all individual post content in parallel
            console.log(`[${now()}] [parseEvents] Fetching individual post content in parallel...`);
            const fetchStart = Date.now();
            const postPromises = posts
                .filter(post => post.type !== 'season' && post.type !== 'other')
                .map(async (post, idx) => {
                    const t0 = Date.now();
                    console.log(`[${now()}] [parseEvents] [${idx}] Fetching individual post: ${post.title}`);
                    try {
                        const individualPost = await this.fetcher.fetchSinglePost(post.url);
                        const t1 = Date.now();
                        console.log(`[${now()}] [parseEvents] [${idx}] Fetch complete (${t1-t0}ms): ${post.title}`);
                        if (individualPost) {
                            const parseT0 = Date.now();
                            const events = this.parseSinglePost(individualPost, gameMasterPokemon);
                            const parseT1 = Date.now();
                            console.log(`[${now()}] [parseEvents] [${idx}] Parse complete (${parseT1-parseT0}ms): ${post.title}`);
                            return events;
                        }
                        return [];
                    } catch (error) {
                        console.error(`[${now()}] [parseEvents] [${idx}] Failed to fetch individual post ${post.url}:`, error);
                        return [];
                    }
                });

            const allEventsArrays = await Promise.all(postPromises);
            const fetchEnd = Date.now();
            console.log(`[${now()}] [parseEvents] All fetches and parses complete. Total time: ${fetchEnd-fetchStart}ms`);
            const allEvents = allEventsArrays.flat();
            console.log(`[${now()}] [parseEvents] Successfully parsed ${allEvents.length} events from individual posts`);

            // Filter out non-relevant events
            const relevantEvents = this.filterRelevantEvents(allEvents);
            console.log(`[${now()}] [parseEvents] Filtered to ${relevantEvents.length} relevant events`);
            return relevantEvents;
        } catch (error) {
            console.error(`[${now()}] [parseEvents] Failed to parse Pokemon GO events:`, error);
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

    private parseSinglePost(post: PokemonGoPost, gameMasterPokemon: Record<string, any>): IParsedEvent[] {
        // Parse date from the post HTML using the new robust date parsing logic
        const dateStrings = this.extractDateStringsFromPost(post.html);
        const dateRanges = dateStrings.flatMap(ds => parseEventDateRange(ds));
        
        // Parse the post content following the user's algorithm
        const parsedContents = this.parseEventContent(post.html, gameMasterPokemon);
        
        const events: IParsedEvent[] = [];
        
        // Check if we have child events (events with specific titles)
        const hasChildEvents = parsedContents.some(content => content.title && content.title !== UNKNOWN_EVENT_TITLE);
        
        for (const parsedContent of parsedContents) {
            // If we have child events, only create events for the children, not the parent
            if (hasChildEvents && (!parsedContent.title || parsedContent.title === UNKNOWN_EVENT_TITLE)) {
                continue;
            }
            
            // For inner events, use the subtitle as title and extract date from the content
            let eventTitle = post.title;
            let eventStartDate = 0;
            let eventEndDate = 0;
            let eventDateRanges: { start: number, end: number }[] = [];
            
            if (parsedContent.title && parsedContent.title !== UNKNOWN_EVENT_TITLE) {
                // Use the child event's specific title
                eventTitle = parsedContent.title;
                // Try to parse date from the inner event
                if (parsedContent.date) {
                    const innerDateRanges = parseEventDateRange(parsedContent.date);
                    if (innerDateRanges.length > 0) {
                        eventDateRanges = innerDateRanges;
                        eventStartDate = Math.min(...innerDateRanges.map(r => r.start));
                        eventEndDate = Math.max(...innerDateRanges.map(r => r.end));
                    }
                }
            } else {
                // Use the main post dates only if no child events exist
                if (dateRanges.length > 0) {
                    eventDateRanges = dateRanges;
                    eventStartDate = Math.min(...dateRanges.map(r => r.start));
                    eventEndDate = Math.max(...dateRanges.map(r => r.end));
                }
            }
            
            // If this is a child event and has no valid date, skip it
            if (parsedContent.title && parsedContent.title !== UNKNOWN_EVENT_TITLE && eventDateRanges.length === 0) {
                continue;
            }
            
            // Extract image from the post or child event
            const imageUrl = parsedContent.imageUrl || this.extractImageFromPost(post.html);
            
            // Determine categories based on content
            const categories = this.determineCategories([parsedContent]);
            
            // Check if event is still relevant (hasn't ended yet)
            const currentTime = Date.now();
            const isRelevant = eventEndDate > currentTime;
            
            // Create the parsed event
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

    private createEventMetadata(post: PokemonGoPost, parsedContent: any) {
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

    // Extract date strings using the user's DOM-based approach with detailed logs
    private extractDateStringsFromPost(html: string): string[] {
        const dateStrings: string[] = [];
        try {
            const dom = new JSDOM(html);
            const document = dom.window.document;
            const now = () => new Date().toISOString();
            console.log(`[${now()}] [extractDateStringsFromPost] Start`);

            const blogPostBlocks = document.getElementsByClassName(DOM_SELECTORS.BLOG_POST_BLOCKS)[0];
            if (!blogPostBlocks) {
                console.log(`[${now()}] [extractDateStringsFromPost] blogPost__post__blocks not found`);
                return [];
            }
            const entries = Array.from(blogPostBlocks.children);
            console.log(`[${now()}] [extractDateStringsFromPost] entries.length:`, entries.length);
            if (entries.length === 0) {
                return [];
            }
            // Always try the default case first - look for ContainerBlock__body in entries[0]
            const bodyElements = entries[0].getElementsByClassName("ContainerBlock__body");
            if (bodyElements.length > 0) {
                const bodyElement = bodyElements[0] as unknown as HTMLElement;
                const date = bodyElement?.textContent?.trim().split("\n")[0].trim();
                if (date) {
                    console.log(`[${now()}] [extractDateStringsFromPost] Found date in entries[0]:`, date);
                    dateStrings.push(date);
                }
            }
            
            // Also check for innerEntries in all entries
            for (let k = 0; k < entries.length; k++) {
                const containerBlock = entries[k].children[0];
                if (!containerBlock) continue;
                const innerEntries = containerBlock.getElementsByClassName(DOM_SELECTORS.CONTAINER_BLOCK);
                if (innerEntries.length === 0) continue;
                
                // Look for ContainerBlock__body in the containerBlock
                const bodyElements = containerBlock.getElementsByClassName("ContainerBlock__body");
                if (bodyElements.length > 0) {
                    const bodyElement = bodyElements[0] as unknown as HTMLElement;
                    const dateInner = bodyElement?.textContent?.trim().split("\n")[0].trim();
                    if (dateInner) {
                        console.log(`[${now()}] [extractDateStringsFromPost] Found date in innerEntries at k=${k}:`, dateInner);
                        dateStrings.push(dateInner);
                    }
                }
            }
            // Remove duplicates
            const uniqueDates = Array.from(new Set(dateStrings));
            console.log(`[${now()}] [extractDateStringsFromPost] Final dateStrings:`, uniqueDates);
            return uniqueDates;
        } catch (error) {
            console.warn('Failed to extract date strings using DOM approach:', error);
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

    // Main parsing function following the user's algorithm
    private parseEventContent(html: string, gameMasterPokemon: Record<string, any>): any[] {
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
                // Original logic for single event
                const raids: IEntry[] = [];
                const wild: IEntry[] = [];
                const eggs: IEntry[] = [];
                const research: IEntry[] = [];
                const incenses: IEntry[] = [];
                let bonus = "";

                if (entries.length === 0) {
                    return [{
                        raids, wild, eggs, research, incenses, 
                        bonuses: [bonus.trim()].filter(b => b.length > 0)
                    }];
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
                            bonus += visualBonuses.map(b => "\n\n" + b).join('');
                        }
                        continue;
                    }
                    this.processEventSection(kind, contentBodies, { raids, wild, eggs, research, incenses }, gameMasterPokemon, { wildDomain, raidDomain, eggDomain, researchDomain, incenseDomain });
                }
                
                // Split bonuses into separate array elements
                const splitBonuses = bonus.trim() 
                    ? bonus.trim()
                        .split(/\n\n+/)
                        .map(b => b.trim())
                        .filter(b => b.length > 0)
                    : [];
                
                return [{
                    raids, wild, eggs, research, incenses, bonuses: splitBonuses
                }];
            } else {
                // Handle multiple inner events - each becomes a separate event
                const events: any[] = [];
                for (let k = 0; k < entries.length; k++) {
                    const containerBlock = entries[k].children[0];
                    if (!containerBlock) continue;
                    // Get the headline as the title
                    const headlineEl = containerBlock.querySelector(DOM_SELECTORS.CONTAINER_BLOCK_HEADLINE);
                    const subtitle = headlineEl && headlineEl.textContent ? headlineEl.textContent.trim() : '';
                    // Get the date from the first .ContainerBlock__body after the headline
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
                    // Find the first image after the date
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
                    // Only parse the ContainerBlock children under this containerBlock
                    const innerEntries = Array.from(containerBlock.getElementsByClassName(DOM_SELECTORS.CONTAINER_BLOCK));
                    // Parse this inner event as a separate event
                    const innerEvent = this.parseInnerEvent(innerEntries, gameMasterPokemon, wildDomain, raidDomain, eggDomain, researchDomain, incenseDomain, subtitle, date, imageUrl);
                    if (innerEvent) {
                        events.push(innerEvent);
                    }
                }
                return events;
            }
        } catch (error) {
            console.warn('Failed to parse event content using structured DOM approach:', error);
            return [{
                raids: [], wild: [], eggs: [], research: [], incenses: [], bonuses: []
            }];
        }
    }

    private isBonusSection(kind: string): boolean {
        return EVENT_SECTION_TYPES.BONUSES.some(bonusType => kind.includes(bonusType));
    }

    private processEventSection(kind: string, contentBodies: HTMLElement[], eventData: any, gameMasterPokemon: Record<string, any>, domains: any): void {
        if (EVENT_SECTION_TYPES.WILD_ENCOUNTERS.includes(kind as any)) {
            eventData.wild.push(...extractPokemonSpeciesIdsFromElements(contentBodies, new PokemonMatcher(gameMasterPokemon, domains.wildDomain)));
        } else if (EVENT_SECTION_TYPES.EGGS.includes(kind as any)) {
            eventData.eggs.push(...extractPokemonSpeciesIdsFromElements(contentBodies, new PokemonMatcher(gameMasterPokemon, domains.eggDomain)));
        } else if (EVENT_SECTION_TYPES.RESEARCH.includes(kind as any)) {
            eventData.research.push(...extractPokemonSpeciesIdsFromElements(contentBodies, new PokemonMatcher(gameMasterPokemon, domains.researchDomain)));
        } else if (EVENT_SECTION_TYPES.RAIDS.includes(kind as any)) {
            eventData.raids.push(...extractPokemonSpeciesIdsFromElements(contentBodies, new PokemonMatcher(gameMasterPokemon, domains.raidDomain)));
        } else if (EVENT_SECTION_TYPES.INCENSE.includes(kind as any)) {
            eventData.incenses.push(...extractPokemonSpeciesIdsFromElements(contentBodies, new PokemonMatcher(gameMasterPokemon, domains.incenseDomain)));
        }
    }

    private parseInnerEvent(innerEntries: Element[], gameMasterPokemon: Record<string, any>, wildDomain: any[], raidDomain: any[], eggDomain: any[], researchDomain: any[], incenseDomain: any[], subtitle: string, date: string, imageUrl?: string): any {
        const raids: IEntry[] = [];
        const wild: IEntry[] = [];
        const eggs: IEntry[] = [];
        const research: IEntry[] = [];
        const incenses: IEntry[] = [];
        let bonus = "";
        // Only parse content for this child event
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
                    bonus += visualBonuses.map(b => "\n\n" + b).join('');
                }
                continue;
            }
            this.processEventSection(kind, contentBodies, { raids, wild, eggs, research, incenses }, gameMasterPokemon, { wildDomain, raidDomain, eggDomain, researchDomain, incenseDomain });
        }
        // Split bonuses into separate array elements
        const splitBonuses = bonus.trim() 
            ? bonus.trim()
                .split(/\n\n+/)
                .map(b => b.trim())
                .filter(b => b.length > 0)
            : [];
        return {
            title: subtitle || UNKNOWN_EVENT_TITLE,
            date: date || "",
            imageUrl: imageUrl || '',
            raids, wild, eggs, research, incenses, bonuses: splitBonuses
        };
    }

    // Extract event data using structured DOM parsing
    private extractEventDataStructured(html: string): any {
        try {
            const dom = new JSDOM(html);
            const document = dom.window.document;
            
            // Extract title from blogPost__title
            const titleElement = document.getElementsByClassName(DOM_SELECTORS.BLOG_POST_TITLE)[0];
            const title = titleElement ? (titleElement as any)?.textContent?.trim() : '';
            
            // Extract subtitle from the first ContainerBlock__headline
            const firstHeadline = document.querySelector(DOM_SELECTORS.CONTAINER_BLOCK_HEADLINE);
            const subtitle = firstHeadline ? (firstHeadline as any)?.textContent?.trim() : '';
            
            // Extract image from the first img tag in the post
            const firstImage = document.querySelector(DOM_SELECTORS.BLOG_POST_IMG);
            const imageUrl = firstImage ? (firstImage as any)?.src : '';
            
            return {
                title,
                subtitle,
                imageUrl
            };
        } catch (error) {
            console.warn('Failed to extract event data using structured DOM approach:', error);
            return {
                title: '',
                subtitle: '',
                imageUrl: ''
            };
        }
    }

    private determineCategories(parsedContent: any[]): EventCategory[] {
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

    // Utility: Extract bonuses as visual lines (browser-like)
    private extractBonusesVisualLines(bonusContainer: Element): string[] {
        const bonuses: string[] = [];
        let current = '';
        
        const processNode = (node: Node) => {
            if (node.nodeType === node.ELEMENT_NODE) {
                const el = node as Element;
                
                // Handle block-level elements that should start new bonuses
                if (BLOCK_LEVEL_ELEMENTS.includes(el.tagName as any)) {
                    if (current.trim()) {
                        bonuses.push(current.trim());
                        current = '';
                    }
                    // Add the content of this block element
                    if (el.textContent?.trim()) {
                        bonuses.push(el.textContent.trim());
                    }
                } 
                // Handle <br> tags - only split if there's accumulated content
                else if (el.tagName === 'BR') {
                    if (current.trim()) {
                        bonuses.push(current.trim());
                        current = '';
                    }
                } 
                // For other elements, process their children
                else {
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
            bonuses.push(current.trim());
        }
        
        // Post-process to group related content
        return this.groupRelatedBonuses(bonuses.filter(Boolean));
    }
    
    // Group related bonuses (like date ranges with their bonuses)
    private groupRelatedBonuses(bonuses: string[]): string[] {
        const grouped: string[] = [];
        let i = 0;
        
        while (i < bonuses.length) {
            const current = bonuses[i];
            
            // Check if this looks like a date range
            if (current.match(DATE_RANGE_REGEX)) {
                // Group with the next bonus if it exists
                if (i + 1 < bonuses.length) {
                    grouped.push(`${current}\n\n${bonuses[i + 1]}`);
                    i += 2; // Skip the next item since we've grouped it
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
        // Extract a description from the title
        return title.replace(/[!?]/g, '').trim();
    }
} 