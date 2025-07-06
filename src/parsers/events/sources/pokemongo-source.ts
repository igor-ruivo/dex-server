import { IEventSource, IParsedEvent, IPostEntry, EventCategory } from '../../../types/events';
import { fetchDateFromString, fixDateString, removeLeadingAndTrailingAsterisks, parseEventDateRange } from '../utils/normalization';
import { WHITELIST_KEYWORDS, BLACKLISTED_KEYWORDS, CORS_PROXY_URL } from '../config/constants';
import { PokemonGoFetcher, PokemonGoPost } from '../services/pokemongo-fetcher';
import { PokemonMatcher } from '../utils/pokemon-matcher';
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
        try {
            // Fetch all posts from the news page
            const posts = await this.fetcher.fetchAllPosts();
            console.log(`Fetched ${posts.length} posts from Pokemon GO`);
            
            // Fetch all individual post content in parallel
            console.log('Fetching individual post content in parallel...');
            const postPromises = posts
                .filter(post => post.type !== 'season' && post.type !== 'other')
                .map(async (post) => {
                    try {
                        console.log(`Fetching individual post: ${post.title}`);
                        const individualPost = await this.fetcher.fetchSinglePost(post.url);
                        if (individualPost) {
                            return this.parseSinglePost(individualPost, gameMasterPokemon);
                        }
                        return [];
                    } catch (error) {
                        console.error(`Failed to fetch individual post ${post.url}:`, error);
                        return [];
                    }
                });

            const allEventsArrays = await Promise.all(postPromises);
            const allEvents = allEventsArrays.flat();
            
            console.log(`Successfully parsed ${allEvents.length} events from individual posts`);
            return allEvents;
        } catch (error) {
            console.error('Failed to parse Pokemon GO events:', error);
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
        // Use the first range for backward compatibility
        const { start, end } = dateRanges[0];
        
        // Extract all event details using structured DOM parsing
        const eventData = this.extractEventDataStructured(post.html);
        const imageUrl = eventData.imageUrl || this.extractImageFromPost(post.html);
        
        // Parse the post content following the user's algorithm
        const parsedContent = this.parseEventContent(post.html, gameMasterPokemon);
        
        const event: IParsedEvent = {
            id: `pokemongo-${Date.now()}`,
            title: eventData.title || post.title,
            subtitle: eventData.subtitle || 'Event details parsed from post',
            startDate: start,
            endDate: end,
            dateRanges,
            imageUrl,
            sourceUrl: post.url,
            source: 'pokemongo' as const,
            categories: this.determineCategories(parsedContent),
            pokemon: [
                ...parsedContent.wild.map((p: any) => ({ ...p, category: 'wild' })),
                ...parsedContent.raids.map((p: any) => ({ ...p, category: 'raid' })),
                ...parsedContent.eggs.map((p: any) => ({ ...p, category: 'egg' })),
                ...parsedContent.research.map((p: any) => ({ ...p, category: 'research' })),
                ...parsedContent.incenses.map((p: any) => ({ ...p, category: 'incense' }))
            ],
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

    // Extract all possible date strings from the post HTML
    private extractDateStringsFromPost(html: string): string[] {
        const dateStrings: string[] = [];
        const bodyMatch = html.match(/<div class="ContainerBlock__body">([\s\S]*?)<\/div>/i);
        if (bodyMatch) {
            const pMatch = bodyMatch[1].match(/<p>([\s\S]*?)<\/p>/i);
            if (pMatch) {
                const firstP = pMatch[1].replace(/<[^>]+>/g, '').trim();
                if (firstP && /\d{4}|\d{1,2}:\d{2}/.test(firstP)) {
                    dateStrings.push(firstP);
                }
            }
        }
        // Fallback: try to extract any date-like string
        const datePattern = /([A-Za-z]+day,? [A-Za-z]+ \d{1,2}(, \d{4})?[^<\n]*)/gi;
        let match;
        while ((match = datePattern.exec(html)) !== null) {
            if (match[1] && !dateStrings.includes(match[1])) {
                dateStrings.push(match[1]);
            }
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

            if (!hasToComputeInnerEntries) {
                if (entries.length === 0) {
                    return { raids, wild, eggs, research, incenses, bonuses: [bonus.trim()] };
                }

                // Process entries following the user's algorithm
                for (let i = 0; i < entries.length; i++) {
                    const entry = entries[i];
                    const title = entry.getElementsByClassName('ContainerBlock__headline')[0] as unknown as HTMLElement;
                    const kind = title?.innerText?.trim();
                    const contentBodies = Array.from(entry.children) as unknown as HTMLElement[];
                    
                    if (!kind) continue;
                    
                    if (kind.includes('Bonuses') || kind.includes('Bônus')) {
                        const contentWithNewlines = contentBodies[1]?.innerHTML?.trim().replace(/<br\s*\/?>/gi, '\n').trim();
                        if (contentWithNewlines) {
                            const tempElement = document.createElement('div');
                            tempElement.innerHTML = contentWithNewlines;
                            const plainText = tempElement.textContent || tempElement.innerText;
                            bonus += "\n\n" + removeLeadingAndTrailingAsterisks(plainText);
                        }
                        continue;
                    }
                    
                    switch(kind) {
                        case "Wild encounters":
                        case "Wild Encounters":
                        case "Event-themed Pokémon":
                            wild.push(...this.fetchPokemonFromElements(contentBodies, gameMasterPokemon, 'wild'));
                            break;
                        case "Eggs":
                            eggs.push(...this.fetchPokemonFromElements(contentBodies, gameMasterPokemon, 'egg'));
                            break;
                        case "Event bonus":
                        case "Event Bonus":
                        case "Event bonuses":
                        case "Event Bonuses":
                        case "Bônus do evento":
                        case "Bonuses":
                            const contentWithNewlines = contentBodies[1]?.innerHTML?.trim().replace(/<br\s*\/?>/gi, '\n').trim();
                            if (contentWithNewlines) {
                                const tempElement = document.createElement('div');
                                tempElement.innerHTML = contentWithNewlines;
                                const plainText = tempElement.textContent || tempElement.innerText;
                                bonus += "\n\n" + removeLeadingAndTrailingAsterisks(plainText);
                            }
                            break;
                        case "Field Research Task Rewards":
                        case "Field Research Task Encounters":
                        case "Field Research task encounters":
                        case "Field Research task rewards":
                        case "Field Research":
                        case "Timed Research":
                            research.push(...this.fetchPokemonFromElements(contentBodies, gameMasterPokemon, 'research'));
                            break;
                        case "Raids":
                        case "Shadow Raids":
                        case "Shadow Raid debut":
                            const result = this.fetchPokemonFromElements(contentBodies, gameMasterPokemon, 'raid');
                            raids.push(...result);
                            break;
                        case "Incense Encounters":
                        case "Increased Incense encounters":
                            const incenseResult = this.fetchPokemonFromElements(contentBodies, gameMasterPokemon, 'incense');
                            incenses.push(...incenseResult);
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

                    // Process inner entries following the user's algorithm
                    for (let i = 0; i < innerEntries.length; i++) {
                        const entry = innerEntries[i];
                        const title = !hasToComputeInnerEntries ? entry.children[0].getElementsByClassName('ContainerBlock__headline')[0] : entry.children[0] as unknown as HTMLElement;
                        const kind = (title as any)?.textContent?.trim() || (title as any)?.innerText?.trim();
                        const contentBodies = Array.from(!hasToComputeInnerEntries ? entry.children[0].children : entry.children) as unknown as HTMLElement[];
                        
                        if (!kind) continue;
                        
                        if (kind.includes('Bonuses') || kind.includes('Bônus')) {
                            const contentWithNewlines = contentBodies[1]?.innerHTML?.trim().replace(/<br\s*\/?>/gi, '\n').trim();
                            if (contentWithNewlines) {
                                const tempElement = document.createElement('div');
                                tempElement.innerHTML = contentWithNewlines;
                                const plainText = tempElement.textContent || tempElement.innerText;
                                bonus += "\n\n" + removeLeadingAndTrailingAsterisks(plainText);
                            }
                            continue;
                        }
                        
                        switch(kind) {
                            case "Wild encounters":
                            case "Wild Encounters":
                            case "Event-themed Pokémon":
                                wild.push(...this.fetchPokemonFromElements(contentBodies, gameMasterPokemon, 'wild'));
                                break;
                            case "Eggs":
                                eggs.push(...this.fetchPokemonFromElements(contentBodies, gameMasterPokemon, 'egg'));
                                break;
                            case "Event bonus":
                            case "Event Bonus":
                            case "Event bonuses":
                            case "Event Bonuses":
                            case "Bônus do evento":
                            case "Bonuses":
                                const contentWithNewlines = contentBodies[1]?.innerHTML?.trim().replace(/<br\s*\/?>/gi, '\n').trim();
                                if (contentWithNewlines) {
                                    const tempElement = document.createElement('div');
                                    tempElement.innerHTML = contentWithNewlines;
                                    const plainText = tempElement.textContent || tempElement.innerText;
                                    bonus += "\n\n" + removeLeadingAndTrailingAsterisks(plainText);
                                }
                                break;
                            case "Field Research Task Rewards":
                            case "Field Research Task Encounters":
                            case "Field Research task encounters":
                            case "Field Research task rewards":
                            case "Field Research":
                            case "Timed Research":
                                research.push(...this.fetchPokemonFromElements(contentBodies, gameMasterPokemon, 'research'));
                                break;
                            case "Raids":
                            case "Shadow Raids":
                            case "Shadow Raid debut":
                                const result = this.fetchPokemonFromElements(contentBodies, gameMasterPokemon, 'raid');
                                raids.push(...result);
                                break;
                            case "Incense Encounters":
                            case "Increased Incense encounters":
                                const incenseResult = this.fetchPokemonFromElements(contentBodies, gameMasterPokemon, 'incense');
                                incenses.push(...incenseResult);
                                break;
                            default:
                                break;
                        }
                    }
                }
            }
            
            return {
                raids,
                wild,
                eggs,
                research,
                incenses,
                bonuses: bonus.trim() ? [bonus.trim()] : []
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

    // Extract Pokémon from content bodies following the user's approach
    private fetchPokemonFromElements(contentBodies: HTMLElement[], gameMasterPokemon: Record<string, any>, domain: string): IEntry[] {
        const entries: IEntry[] = [];
        
        try {
            // Extract text content from the content bodies
            const textContent = contentBodies.map(body => {
                if (body.innerHTML) {
                    // Create a temporary element using JSDOM
                    const { JSDOM } = require('jsdom');
                    const tempDom = new JSDOM(`<div>${body.innerHTML}</div>`);
                    const tempElement = tempDom.window.document.querySelector('div');
                    return tempElement?.textContent || tempElement?.innerText || '';
                }
                return body.textContent || body.innerText || '';
            }).join(' ');
            
            // Use the existing PokemonMatcher to find Pokémon
            const wildDomain = Object.values(gameMasterPokemon).filter(p => !p.isShadow && !p.isMega && !p.aliasId);
            const matcher = new PokemonMatcher(gameMasterPokemon, wildDomain);
            
            // Split text into words and match Pokémon
            const words = textContent.split(/\s+/).filter(word => 
                word.length > 2 && 
                word.length <= 20 &&
                (WHITELIST_KEYWORDS.some(k => word.toLowerCase().includes(k)) || 
                 !BLACKLISTED_KEYWORDS.some(k => word.toLowerCase().includes(k)))
            );
            
            const matchedPokemon = matcher.matchPokemonFromText(words);
            
            // Convert to IEntry format
            return matchedPokemon.map(p => ({
                speciesId: p.speciesId,
                shiny: p.shiny,
                category: domain,
                raidLevel: domain === 'raid' ? this.extractRaidLevel(textContent) : undefined,
                comment: p.comment,
                source: domain
            }));
            
        } catch (error) {
            console.warn(`Failed to fetch Pokémon from elements for domain ${domain}:`, error);
            return [];
        }
    }

    // Extract raid level from text content
    private extractRaidLevel(textContent: string): number | undefined {
        const raidLevelMatch = textContent.match(/(\d+)-star|(\d+) star|tier (\d+)/i);
        if (raidLevelMatch) {
            return parseInt(raidLevelMatch[1] || raidLevelMatch[2] || raidLevelMatch[3]);
        }
        return undefined;
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
} 