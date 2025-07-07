import { IEventSource, IParsedEvent, IPostEntry, EventCategory } from '../../../types/events';
import { fetchDateFromString, fixDateString, removeLeadingAndTrailingAsterisks, parseEventDateRange } from '../utils/normalization';
import { WHITELIST_KEYWORDS, BLACKLISTED_KEYWORDS, CORS_PROXY_URL } from '../config/constants';
import { PokemonGoFetcher, PokemonGoPost } from '../services/pokemongo-fetcher';
import { PokemonMatcher, extractPokemonSpeciesIdsFromElements } from '../utils/pokemon-matcher';
import { JSDOM } from 'jsdom';

// JSDOM types for Node.js environment
interface DOMTokenList {
    includes(token: string): boolean;
    length: number;
    [index: number]: string;
}

interface HTMLElement {
    innerText?: string;
    innerHTML?: string;
    textContent?: string;
    classList?: DOMTokenList;
    children?: HTMLElement[];
    childNodes?: HTMLElement[];
    nodeType?: number;
    getElementsByClassName?: (className: string) => HTMLElement[];
    getElementsByTagName?: (tagName: string) => HTMLElement[];
    querySelector?: (selector: string) => HTMLElement | null;
}

interface HTMLImageElement extends HTMLElement {
    src?: string;
}

interface DOMParser {
    parseFromString(html: string, mimeType: string): Document;
}

interface Document {
    getElementsByClassName(className: string): HTMLElement[];
    querySelector(selector: string): HTMLElement | null;
}

interface IEntry {
    speciesId: string;
    shiny?: boolean;
    category?: string;
    raidLevel?: number;
    comment?: string;
    source?: string;
}

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
            return allEvents;
        } catch (error) {
            console.error(`[${now()}] [parseEvents] Failed to parse Pokemon GO events:`, error);
            return [];
        }
    }

    private parseSinglePost(post: PokemonGoPost, gameMasterPokemon: Record<string, any>): IParsedEvent[] {
        // Parse date from the post HTML using the new robust date parsing logic
        const dateStrings = this.extractDateStringsFromPost(post.html);
        const dateRanges = dateStrings.flatMap(ds => parseEventDateRange(ds));
        if (!dateRanges.length) {
            console.warn(`No valid date found for post: ${post.url}`);
            return [];
        }
        // Use the earliest start and latest end from all date ranges
        const startDate = Math.min(...dateRanges.map(r => r.start));
        const endDate = Math.max(...dateRanges.map(r => r.end));
        
        // Extract all event details using structured DOM parsing
        const eventData = this.extractEventDataStructured(post.html);
        const imageUrl = eventData.imageUrl || this.extractImageFromPost(post.html);
        
        // Parse the post content following the user's algorithm
        const parsedContent = this.parseEventContent(post.html, gameMasterPokemon);
        
        const event: IParsedEvent = {
            id: `pokemongo-${Date.now()}`,
            title: eventData.title || post.title,
            subtitle: eventData.subtitle || 'Event details parsed from post',
            startDate,
            endDate,
            dateRanges,
            imageUrl,
            sourceUrl: post.url,
            source: 'pokemongo' as const,
            categories: this.determineCategories(parsedContent),
            // Keep Pokémon separate by domain
            wild: parsedContent.wild,
            raids: parsedContent.raids,
            eggs: parsedContent.eggs,
            research: parsedContent.research,
            incenses: parsedContent.incenses,
            bonuses: parsedContent.bonuses.length > 0 ? parsedContent.bonuses : undefined,
            isRelevant: true,
            metadata: {
                originalPost: post,
                parsedAt: new Date().toISOString(),
                wildCount: parsedContent.wild.length,
                raidCount: parsedContent.raids.length,
                eggCount: parsedContent.eggs.length,
                researchCount: parsedContent.research.length,
                incenseCount: parsedContent.incenses.length
            }
        };
        return [event];
    }

    // Extract date strings using the user's DOM-based approach with detailed logs
    private extractDateStringsFromPost(html: string): string[] {
        const dateStrings: string[] = [];
        try {
            const dom = new JSDOM(html);
            const document = dom.window.document;
            const now = () => new Date().toISOString();
            console.log(`[${now()}] [extractDateStringsFromPost] Start`);

            const blogPostBlocks = document.getElementsByClassName("blogPost__post__blocks")[0];
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
                const innerEntries = containerBlock.getElementsByClassName("ContainerBlock");
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
    private parseEventContent(html: string, gameMasterPokemon: Record<string, any>): any {
        try {
            const dom = new JSDOM(html);
            const document = dom.window.document;
            
            const entries = Array.from(document.getElementsByClassName("blogPost__post__blocks")[0]?.children ?? []);
            let hasToComputeInnerEntries = true;

            if (!document.querySelector('.blogPost__post__blocks>.block.block--ContainerBlock>.ContainerBlock>.ContainerBlock__blocks>.block.block--ContainerBlock>.ContainerBlock>.ContainerBlock__headline')) {
                hasToComputeInnerEntries = false;
            }

            const raids: IEntry[] = [];
            const wild: IEntry[] = [];
            const eggs: IEntry[] = [];
            const research: IEntry[] = [];
            const incenses: IEntry[] = [];
            let bonus = "";

            const allPokemon = Object.values(gameMasterPokemon);
            const wildDomain = allPokemon.filter(p => !p.isShadow && !p.isMega && !p.aliasId);
            const raidDomain = wildDomain;
            const eggDomain = wildDomain;
            const researchDomain = wildDomain;
            const incenseDomain = wildDomain;

            if (!hasToComputeInnerEntries) {
                if (entries.length === 0) {
                    return { raids, wild, eggs, research, incenses, bonuses: [bonus.trim()] };
                }

                for (let i = 0; i < entries.length; i++) {
                    const entry = entries[i];
                    const title = entry.getElementsByClassName('ContainerBlock__headline')[0] as unknown as HTMLElement;
                    const kind = title?.innerText?.trim();
                    const contentBodies = Array.from(entry.children) as unknown as HTMLElement[];
                    if (!kind) continue;
                    if (kind.includes('Bonuses') || kind.includes('Bônus')) {
                        const bonusContainer = contentBodies[1] as unknown as Element;
                        if (bonusContainer) {
                            const visualBonuses = this.extractBonusesVisualLines(bonusContainer);
                            bonus += visualBonuses.map(b => "\n\n" + b).join('');
                        }
                        continue;
                    }
                    switch(kind) {
                        case "Wild encounters":
                        case "Wild Encounters":
                        case "Event-themed Pokémon":
                            wild.push(...extractPokemonSpeciesIdsFromElements(contentBodies, new PokemonMatcher(gameMasterPokemon, wildDomain)));
                            break;
                        case "Eggs":
                            eggs.push(...extractPokemonSpeciesIdsFromElements(contentBodies, new PokemonMatcher(gameMasterPokemon, eggDomain)));
                            break;
                        case "Field Research Task Rewards":
                        case "Field Research Task Encounters":
                        case "Field Research task encounters":
                        case "Field Research task rewards":
                        case "Field Research":
                        case "Timed Research":
                            research.push(...extractPokemonSpeciesIdsFromElements(contentBodies, new PokemonMatcher(gameMasterPokemon, researchDomain)));
                            break;
                        case "Raids":
                        case "Shadow Raids":
                        case "Shadow Raid debut":
                            raids.push(...extractPokemonSpeciesIdsFromElements(contentBodies, new PokemonMatcher(gameMasterPokemon, raidDomain)));
                            break;
                        case "Incense Encounters":
                        case "Increased Incense encounters":
                            incenses.push(...extractPokemonSpeciesIdsFromElements(contentBodies, new PokemonMatcher(gameMasterPokemon, incenseDomain)));
                            break;
                        default:
                            break;
                    }
                }
            } else {
                for (let k = 0; k < entries.length; k++) {
                    const containerBlock = entries[k].children[0];
                    const innerEntries = containerBlock.getElementsByClassName("ContainerBlock");
                    if (innerEntries.length === 0) {
                        continue;
                    }
                    for (let i = 0; i < innerEntries.length; i++) {
                        const entry = innerEntries[i];
                        const title = entry.children[0] as unknown as HTMLElement;
                        const kind = title?.textContent?.trim() || title?.innerText?.trim();
                        const contentBodies = Array.from(entry.children) as unknown as HTMLElement[];
                        if (!kind) continue;
                        if (kind.includes('Bonuses') || kind.includes('Bônus')) {
                            const bonusContainer = contentBodies[1] as unknown as Element;
                            if (bonusContainer) {
                                const visualBonuses = this.extractBonusesVisualLines(bonusContainer);
                                bonus += visualBonuses.map(b => "\n\n" + b).join('');
                            }
                            continue;
                        }
                        switch(kind) {
                            case "Wild encounters":
                            case "Wild Encounters":
                            case "Event-themed Pokémon":
                                wild.push(...extractPokemonSpeciesIdsFromElements(contentBodies, new PokemonMatcher(gameMasterPokemon, wildDomain)));
                                break;
                            case "Eggs":
                                eggs.push(...extractPokemonSpeciesIdsFromElements(contentBodies, new PokemonMatcher(gameMasterPokemon, eggDomain)));
                                break;
                            case "Field Research Task Rewards":
                            case "Field Research Task Encounters":
                            case "Field Research task encounters":
                            case "Field Research task rewards":
                            case "Field Research":
                            case "Timed Research":
                                research.push(...extractPokemonSpeciesIdsFromElements(contentBodies, new PokemonMatcher(gameMasterPokemon, researchDomain)));
                                break;
                            case "Raids":
                            case "Shadow Raids":
                            case "Shadow Raid debut":
                                raids.push(...extractPokemonSpeciesIdsFromElements(contentBodies, new PokemonMatcher(gameMasterPokemon, raidDomain)));
                                break;
                            case "Incense Encounters":
                            case "Increased Incense encounters":
                                incenses.push(...extractPokemonSpeciesIdsFromElements(contentBodies, new PokemonMatcher(gameMasterPokemon, incenseDomain)));
                                break;
                            default:
                                break;
                        }
                    }
                }
            }
            // Split bonuses into separate array elements (one per sentence/paragraph)
            const splitBonuses = bonus.trim() 
                ? bonus.trim()
                    .split(/\n\n+/)
                    .map(b => b.trim())
                    .filter(b => b.length > 0)
                : [];
            return {
                raids,
                wild,
                eggs,
                research,
                incenses,
                bonuses: splitBonuses
            };
        } catch (error) {
            console.warn('Failed to parse event content using structured DOM approach:', error);
            return {
                raids: [],
                wild: [],
                eggs: [],
                research: [],
                incenses: [],
                bonuses: []
            };
        }
    }

    // Extract event data using structured DOM parsing
    private extractEventDataStructured(html: string): any {
        try {
            const dom = new JSDOM(html);
            const document = dom.window.document;
            
            // Extract title from blogPost__title
            const titleElement = document.getElementsByClassName("blogPost__title")[0];
            const title = titleElement ? (titleElement as any)?.textContent?.trim() : '';
            
            // Extract subtitle from the first ContainerBlock__headline
            const firstHeadline = document.querySelector('.ContainerBlock__headline');
            const subtitle = firstHeadline ? (firstHeadline as any)?.textContent?.trim() : '';
            
            // Extract image from the first img tag in the post
            const firstImage = document.querySelector('.blogPost__post img');
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

    private determineCategories(parsedContent: any): EventCategory[] {
        const categories: EventCategory[] = [];
        
        if (parsedContent.wild.length > 0) categories.push(EventCategory.WILD);
        if (parsedContent.raids.length > 0) categories.push(EventCategory.RAID);
        if (parsedContent.eggs.length > 0) categories.push(EventCategory.EGG);
        if (parsedContent.research.length > 0) categories.push(EventCategory.RESEARCH);
        if (parsedContent.incenses.length > 0) categories.push(EventCategory.INCENSE);
        
        return categories;
    }

    // Utility: Extract bonuses as visual lines (browser-like)
    private extractBonusesVisualLines(bonusContainer: Element): string[] {
        const bonuses: string[] = [];
        let current = '';
        
        function processNode(node: Node) {
            if (node.nodeType === node.ELEMENT_NODE) {
                const el = node as Element;
                
                // Handle block-level elements that should start new bonuses
                if (["P", "DIV", "LI"].includes(el.tagName)) {
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
        }
        
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
            if (current.match(/\d{1,2}:\d{2}\s*(?:a\.m\.|p\.m\.)\s*–\s*\d{1,2}:\d{2}\s*(?:a\.m\.|p\.m\.)/)) {
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
} 