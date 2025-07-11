import { AvailableLocales, pairEventTranslations } from '../../../services/gamemaster-translator';
import { Domains, EventBlock, EventData, IEntry, IEventSource, IParsedEvent, IPokemonGoEventBlockParser, IPokemonGoHtmlParser, PokemonGoPost, PublicEvent } from '../../../types/events';
import { GameMasterPokemon } from '../../../types/pokemon';
import { parseEventDateRange } from '../../utils/normalization';
import { extractPokemonSpeciesIdsFromElements,PokemonMatcher } from '../../utils/pokemon-matcher';
import PokemonGoNewsParser from './news-parsers/NewsParser';
import PokemonGoPostParser from './news-parsers/PostParser';
import { PokemonGoFetcher } from './PokemongoFetcher';

/**
 * Constants for event section types.
 */
const EVENT_SECTION_TYPES = {
    BONUSES: ['Bonuses', 'Bônus', 'Event bonus', 'Event Bonus', 'Event bonuses', 'Event Bonuses', 'Bônus do evento', 'Bonuses'],
    WILD_ENCOUNTERS: ['Wild encounters', 'Wild Encounters', 'Event-themed Pokémon'],
    EGGS: ['Eggs'],
    LURES: ['Encounters from Lure Modules'],
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

/**
 * Constants for block level HTML elements.
 */
const BLOCK_LEVEL_ELEMENTS: Array<string> = [
  'P', 'DIV', 'LI', 'UL', 'OL', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'NAV', 'ASIDE', 'MAIN', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE', 'ADDRESS', 'DL', 'DT', 'DD', 'FIGURE', 'FIGCAPTION', 'HR', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD', 'FORM', 'FIELDSET', 'LEGEND'
];

/**
 * Returns all relevant domains (wild, raid, egg, research, incense) from the Game Master data.
 */
const getDomains = (gameMasterPokemon: Record<string, GameMasterPokemon>) => {
    const domain = Object.values(gameMasterPokemon).filter(p => !p.isShadow && !p.isMega && !p.aliasId);
    return {
        wildDomain: domain,
        raidDomain: domain,
        eggDomain: domain,
        researchDomain: domain,
        incenseDomain: domain,
        luresDomain: domain
    };
};

/**
 * Builds a unique event ID from the post URL and subevent index.
 */
const buildEventId = (post: PokemonGoPost, index: number): string => {
    const idBase = post.url.includes('/post/')
        ? post.url.split('/post/')[1]
        : post.url.split('/news/')[1];
    return idBase.replaceAll('/', '') + '-' + String(index);
};

/**
 * Determines if an event should be skipped based on date ranges and language.
 */
const shouldSkipEvent = (dateRanges: Array<{ start: number, end: number }>, url: string): boolean => {
    return dateRanges.length === 0 && extractLocaleFromPath(url) === AvailableLocales.en;
};

/**
 * Extracts the locale from the event's url path.
 */
const extractLocaleFromPath = (path: string): AvailableLocales => {
    const url = path.toLocaleLowerCase();
    const match = /\/([a-z_]{1,5})\/news\//.exec(url);
    if (match?.[1]) {
        return match[1] as AvailableLocales;
    }
    
    const parts = url.split('/');
    if (parts.length > 3 && parts[3] && parts[3] !== 'news' && parts[3] !== 'post') {
        return parts[3] as AvailableLocales;
    }
    return AvailableLocales.en;
}

/**
 * Builds the IParsedEvent object for a subevent.
 */
const buildEventObject = (
    post: PokemonGoPost,
    parser: IPokemonGoHtmlParser,
    subEvent: IPokemonGoEventBlockParser,
    startDate: number,
    endDate: number,
    dateRanges: Array<{ start: number, end: number }>,
    parsedContent: EventBlock,
    index: number
): IParsedEvent => {
    return {
        id: buildEventId(post, index),
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
        researches: parsedContent.researches,
        incenses: parsedContent.incenses,
        lures: parsedContent.lures,
        bonuses: parsedContent.bonuses.length > 0 ? parsedContent.bonuses : [],
        locale: extractLocaleFromPath(post.url),
    };
};

/**
 * Event source for parsing Pokémon GO events from the official website.
 * Implements the IEventSource interface.
 */
export class PokemonGoSource implements IEventSource {
    public name = 'pokemongo';
    private fetcher: PokemonGoFetcher;

    constructor() {
        this.fetcher = new PokemonGoFetcher();
    }

    /**
     * Parses all events from the provider using the given Game Master data.
     */
    public async parseEvents(gameMasterPokemon: Record<string, GameMasterPokemon>): Promise<Array<PublicEvent>> {
        try {
            const posts = await this.fetcher.fetchAllPosts();
            const postPromises = posts.map(async (post) => {
                try {
                    const individualPost = await this.fetcher.fetchSinglePost(post.url);
                    if (!individualPost) {
                        return [];
                    }
                    return this.parseSinglePost(individualPost, gameMasterPokemon);
                } catch {
                    return [];
                }
            });
            const allEventsArrays = await Promise.all(postPromises);
            return pairEventTranslations(allEventsArrays.flat());
        } catch {
            return [];
        }
    }

    /**
     * Parses a single post and returns all subevents as IParsedEvent objects.
     */
    private parseSinglePost = (post: PokemonGoPost, gameMasterPokemon: Record<string, GameMasterPokemon>): Array<IParsedEvent> => {
        const parser: IPokemonGoHtmlParser = post.type === 'post'
            ? new PokemonGoPostParser(post.html)
            : new PokemonGoNewsParser(post.html);

        const events: Array<IParsedEvent> = [];
        const subEvents = parser.getSubEvents();
        const domains = getDomains(gameMasterPokemon);

        for (let i = 0; i < subEvents.length; i++) {
            const subEvent: IPokemonGoEventBlockParser = subEvents[i];
            const dateRanges = parseEventDateRange(subEvent.dateString);
            if (shouldSkipEvent(dateRanges, post.url)) {
                continue;
            }

            const startDate = Math.min(...dateRanges.map(r => r.start));
            const endDate = Math.max(...dateRanges.map(r => r.end));
            const sectionElements = subEvent.getEventBlocks();
            const parsedContent = this.parseInnerEvent(sectionElements, gameMasterPokemon, domains.wildDomain, domains.raidDomain, domains.eggDomain, domains.researchDomain, domains.incenseDomain, domains.luresDomain);
            const event = buildEventObject(post, parser, subEvent, startDate, endDate, dateRanges, parsedContent, i);
           
            if (this.eventIsRelevant(event)) {
                events.push(event);
            }
        }
        return events;
    };

    private eventIsRelevant = (event: IParsedEvent) => {
      return event.locale !== AvailableLocales.en || ((
        (event.bonuses && event.bonuses.length > 0) ||
        (event.wild && event.wild.length > 0) ||
        (event.raids && event.raids.length > 0) ||
        (event.researches && event.researches.length > 0) ||
        (event.eggs && event.eggs.length > 0) ||
        (event.incenses && event.incenses.length > 0)
      ) && event.dateRanges && event.dateRanges.length > 0);
    };

    /**
     * Checks if a section is a bonus section by its type.
     */
    private isBonusSection = (sectionType: string): boolean => {
        return EVENT_SECTION_TYPES.BONUSES.some(bonusType => sectionType.includes(bonusType));
    };

    /**
     * Processes a section of the event and updates the eventData object accordingly.
     */
    private processEventSection = (
        sectionType: string,
        sectionBodies: Array<HTMLElement>,
        eventData: EventData,
        gameMasterPokemon: Record<string, GameMasterPokemon>,
        domains: Domains
    ): void => {
        if (EVENT_SECTION_TYPES.WILD_ENCOUNTERS.some(x => x === sectionType)) {
            eventData.wild.push(...extractPokemonSpeciesIdsFromElements(sectionBodies, new PokemonMatcher(gameMasterPokemon, domains.wildDomain)));
            return;
        }
        if (EVENT_SECTION_TYPES.EGGS.some(x => x === sectionType)) {
            eventData.eggs.push(...extractPokemonSpeciesIdsFromElements(sectionBodies, new PokemonMatcher(gameMasterPokemon, domains.eggDomain)));
            return;
        }
        if (EVENT_SECTION_TYPES.RESEARCH.some(x => x === sectionType)) {
            eventData.researches.push(...extractPokemonSpeciesIdsFromElements(sectionBodies, new PokemonMatcher(gameMasterPokemon, domains.researchDomain)));
            return;
        }
        if (EVENT_SECTION_TYPES.RAIDS.some(x => x === sectionType)) {
            eventData.raids.push(...extractPokemonSpeciesIdsFromElements(sectionBodies, new PokemonMatcher(gameMasterPokemon, domains.raidDomain)));
            return;
        }
        if (EVENT_SECTION_TYPES.INCENSE.some(x => x === sectionType)) {
            eventData.incenses.push(...extractPokemonSpeciesIdsFromElements(sectionBodies, new PokemonMatcher(gameMasterPokemon, domains.incenseDomain)));
        }
        if (EVENT_SECTION_TYPES.LURES.some(x => x === sectionType)) {
            eventData.lures.push(...extractPokemonSpeciesIdsFromElements(sectionBodies, new PokemonMatcher(gameMasterPokemon, domains.luresDomain)));
        }
    };

    /**
     * Parses all inner event sections and returns the aggregated EventBlock.
     */
    private parseInnerEvent = (
        sectionElements: Array<Element>,
        gameMasterPokemon: Record<string, GameMasterPokemon>,
        wildDomain: Array<GameMasterPokemon>,
        raidDomain: Array<GameMasterPokemon>,
        eggDomain: Array<GameMasterPokemon>,
        researchDomain: Array<GameMasterPokemon>,
        incenseDomain: Array<GameMasterPokemon>,
        luresDomain: Array<GameMasterPokemon>
    ): EventBlock => {
        const raids: Array<IEntry> = [];
        const wild: Array<IEntry> = [];
        const eggs: Array<IEntry> = [];
        const researches: Array<IEntry> = [];
        const incenses: Array<IEntry> = [];
        const lures: Array<IEntry> = [];
        const bonusesArr: Array<string> = [];
        for (const sectionElement of sectionElements) {
            const sectionTitle = sectionElement.children[0];
            const sectionType = (sectionTitle.textContent?.trim() ?? "");
            const sectionBodies = Array.from(sectionElement.children) as Array<HTMLElement>;
            if (!sectionType) {
                continue;
            }
            if (this.isBonusSection(sectionType)) {
                for (let j = 1; j < sectionBodies.length; j++) {
                    const bonusContainer = sectionBodies[j];
                    if (bonusContainer) {
                        const visualBonuses = this.extractBonusesVisualLines(bonusContainer);
                        bonusesArr.push(...visualBonuses);
                    }
                }
                continue;
            }
            this.processEventSection(sectionType, sectionBodies, { raids, wild, eggs, researches, incenses, lures }, gameMasterPokemon, { wildDomain, raidDomain, eggDomain, researchDomain, incenseDomain, luresDomain });
        }
        return {
            raids, wild, eggs, researches, incenses, lures, bonuses: bonusesArr
        };
    };

    /**
     * Extracts bonus lines from a bonus container element.
     */
    private extractBonusesVisualLines = (bonusContainer: Element): Array<string> => {
        const bonuses: Array<string> = [];
        let current = '';
        const pushLines = (text: string) => {
            text.split('\n').map(line => line.trim()).filter(Boolean).forEach(line => bonuses.push(line));
        };
        const processNode = (node: Node) => {
            if (node.nodeType === node.ELEMENT_NODE) {
                const el = node as Element;
                if (BLOCK_LEVEL_ELEMENTS.includes(el.tagName)) {
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
                    for (const childNode of Array.from(el.childNodes)) {
                        processNode(childNode);
                    }
                }
            } else if (node.nodeType === node.TEXT_NODE) {
                const text = node.textContent ?? '';
                current += text;
            }
        };
        if (bonusContainer.childNodes) {
            for (const childNode of Array.from(bonusContainer.childNodes)) {
                processNode(childNode);
            }
        }
        if (current.trim()) {
            pushLines(current.trim());
        }
        return bonuses.filter(Boolean);
    };
} 