import { AvailableLocales } from '../services/gamemaster-translator';
import { GameMasterPokemon } from '../types/pokemon';

export interface IEntry {
    speciesId: string;
    shiny: boolean;
    kind?: string;
    comment?: Partial<Record<AvailableLocales, string>>;
    shadow?: boolean;
}

export type IParsedEvent = EventBlock & {
    id: string;
    url: string;
    title: string;
    subtitle: string;
    startDate: number;
    endDate: number;
    dateRanges?: Array<{ start: number; end: number }>;
    imageUrl?: string;
    source: 'pokemongo' | 'leekduck';
    locale: AvailableLocales;
    isSeason?: boolean;
};

export type PublicEvent = Omit<IParsedEvent, 'title' | 'subtitle' | 'bonuses' | 'locale' | 'bonusSectionIndex'> & {
    title: Partial<Record<AvailableLocales, string>>;
    subtitle: Partial<Record<AvailableLocales, string>>;
    bonuses: Partial<Record<AvailableLocales, Array<string>>>;
};

export interface IEventSource {
    name: string;
    parseEvents(gameMasterPokemon: Record<string, GameMasterPokemon>): Promise<Array<PublicEvent>>;
}

export enum PokemonGoPostKind {
    News,
    Post,
}

export interface IPokemonGoEventBlockParser {
    subTitle: string;
    imgUrl: string;
    dateString: string;
    getEventBlocks: () => Array<Element>;
}

export interface IPokemonGoHtmlParser {
    getTitle: () => string;
    getImgUrl: () => string;
    getSubEvents: () => Array<IPokemonGoEventBlockParser>;
}

export interface Domains {
    wildDomain: Array<GameMasterPokemon>;
    raidDomain: Array<GameMasterPokemon>;
    eggDomain: Array<GameMasterPokemon>;
    researchDomain: Array<GameMasterPokemon>;
    incenseDomain: Array<GameMasterPokemon>;
    luresDomain: Array<GameMasterPokemon>;
}

export interface EventData {
    raids: Array<IEntry>;
    wild: Array<IEntry>;
    eggs: Array<IEntry>;
    researches: Array<IEntry>;
    incenses: Array<IEntry>;
    lures: Array<IEntry>;
}

export type EventBlock = EventData & {
    bonuses: Array<string>;
    bonusSectionIndex: number;
};

export type PokemonGoPost = ExtractedPostLink & {
    html: string;
    type: 'post' | 'news';
};

export interface ExtractedPostLink {
    url: string;
    locale: AvailableLocales;
}

export interface IRocketGrunt {
    trainerId: string;
    type: string | undefined;
    phrase: Partial<Record<AvailableLocales, string>>;
    tier1: Array<string>;
    tier2: Array<string>;
    tier3: Array<string>;
    catchableTiers: Array<number>;
}

// LeekDuck Spotlight Hour output DTO
export interface ISpotlightHourEvent {
    bonus: Partial<Record<AvailableLocales, string>>;
    pokemon: Array<string>;
    dateStart: number;
    dateEnd: number;
}

// LeekDuck 5-star and Mega Raid Bosses output DTO
export interface ILeekduckSpecialRaidBossEvent {
    dateStart: number;
    dateEnd: number;
    pokemon: Array<IEntry>;
    title: string;
}
