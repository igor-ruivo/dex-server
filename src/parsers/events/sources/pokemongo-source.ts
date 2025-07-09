import { IEventSource, IParsedEvent, IEntry, IPokemonGoHtmlParser, EventData, Domains, EventBlock, PokemonGoPost } from '../../../types/events';
import { GameMasterPokemon } from '../../../types/pokemon';
import { parseEventDateRange } from '../utils/normalization';
import { PokemonGoFetcher } from '../services/pokemongo-fetcher';
import { PokemonMatcher, extractPokemonSpeciesIdsFromElements } from '../utils/pokemon-matcher';
import PokemonGoPostParser from '../html-parsers/PokemonGoPostParser';
import PokemonGoNewsParser from '../html-parsers/PokemonGoNewsParser';

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
        const parser: IPokemonGoHtmlParser = post.type === 'post' ?
            new PokemonGoPostParser(post.html):
            new PokemonGoNewsParser(post.html);

        const events: IParsedEvent[] = [];
        const subEvents = parser.getSubEvents();

        const wildDomain = Object.values(gameMasterPokemon).filter(p => !p.isShadow && !p.isMega && !p.aliasId);
        const raidDomain = wildDomain;
        const eggDomain = wildDomain;
        const researchDomain = wildDomain;
        const incenseDomain = wildDomain;

        for (let i = 0; i < subEvents.length; i++) {
            const subEvent = subEvents[i];

            const dateString = subEvent.dateString;

            const dateRanges = parseEventDateRange(dateString);

            if (dateRanges.length === 0 && this.isEnglishVersion(post.url)) {
                continue;
            }

            const startDate = Math.min(...dateRanges.map(r => r.start));
            const endDate = Math.max(...dateRanges.map(r => r.end));

            const eventBlocks = subEvent.getEventBlocks();
            const parsedContent = this.parseInnerEvent(eventBlocks, gameMasterPokemon, wildDomain, raidDomain, eggDomain, researchDomain, incenseDomain);
            
            const event: IParsedEvent = {
                id: (post.url.includes('/post/') ? post.url.split('/post/')[1] : post.url.split('/news/')[1]).replaceAll('/', '') + '-' + String(i),
                url: post.url,
                title: parser.getTitle(),
                subtitle: subEvent.subTitle,
                startDate,
                endDate,
                dateRanges,
                imageUrl: subEvent.imgUrl || parser.getImgUrl(),
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

    private parseInnerEvent(innerEntries: Element[], gameMasterPokemon: Record<string, GameMasterPokemon>, wildDomain: GameMasterPokemon[], raidDomain: GameMasterPokemon[], eggDomain: GameMasterPokemon[], researchDomain: GameMasterPokemon[], incenseDomain: GameMasterPokemon[]): EventBlock {
        const raids: IEntry[] = [];
        const wild: IEntry[] = [];
        const eggs: IEntry[] = [];
        const research: IEntry[] = [];
        const incenses: IEntry[] = [];
        const bonusesArr: string[] = [];

        for (const entry of innerEntries) {
            const title = entry.children[0];
            const kind = (title.textContent?.trim() || "");
            const contentBodies = Array.from(entry.children) as HTMLElement[];
            if (!kind) continue;
            if (this.isBonusSection(kind)) {
                for (let j = 1; j < contentBodies.length; j++) {
                    const bonusContainer = contentBodies[j];
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
        return bonuses.filter(Boolean);
    }

    private isEnglishVersion = (url: string) => !url.toLocaleLowerCase().includes('pt_br');
} 