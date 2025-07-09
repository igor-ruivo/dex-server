import { GameMasterPokemon } from '../types/pokemon';

export interface IEntry {
    speciesId: string;
    shiny: boolean;
    kind?: string;
    comment?: { en: string; pt: string };
}

export type IParsedEvent = EventBlock & {
    id: string;
    url: string;
    title: string;
    subtitle?: string;
    startDate: number;
    endDate: number;
    dateRanges?: Array<{ start: number; end: number }>;
    imageUrl?: string;
    source: 'pokemongo' | 'leekduck';
    isEnglishVersion: boolean;
    isSeason?: boolean;
}

export type PublicEvent = Omit<IParsedEvent, 'title' | 'subtitle' | 'bonuses' | 'isEnglishVersion'> & {
  title: { en: string; pt: string };
  subtitle: { en: string | undefined; pt: string | undefined };
  bonuses: { en: string[] | undefined; pt: string[] | undefined };
};

export interface IEventSource {
    name: string;
    parseEvents(gameMasterPokemon: Record<string, GameMasterPokemon>): Promise<IParsedEvent[]>;
}

export enum PokemonGoPostKind {
    News,
    Post
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
  wildDomain: GameMasterPokemon[];
  raidDomain: GameMasterPokemon[];
  eggDomain: GameMasterPokemon[];
  researchDomain: GameMasterPokemon[];
  incenseDomain: GameMasterPokemon[];
}

export interface EventData {
  raids: IEntry[];
  wild: IEntry[];
  eggs: IEntry[];
  researches: IEntry[];
  incenses: IEntry[];
}

export type EventBlock = EventData & {
  bonuses: string[];
}

export interface PokemonGoPost {
    url: string;
    type: 'post' | 'news';
    html: string;
}

export interface IRocketGrunt {
    trainerId: string;
    type: string | undefined;
    phrase: string;
    tier1: string[];
    tier2: string[];
    tier3: string[];
    catchableTiers: number[];
}

// LeekDuck Spotlight Hour output DTO
export interface ISpotlightHourEvent {
    bonus: string;
    pokemon: string[];
    dateStart: number;
    dateEnd: number;
}

// LeekDuck 5-star and Mega Raid Bosses output DTO
export interface ILeekduckSpecialRaidBossEvent {
    dateStart: number;
    dateEnd: number;
    pokemon: IEntry[];
    title: string;
} 