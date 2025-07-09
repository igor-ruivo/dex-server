import { GameMasterPokemon } from '../types/pokemon';

export interface IEntry {
    speciesId: string;
    shiny: boolean;
    kind?: string;
    comment?: string;
}

export interface IPostEntry {
    title: string;
    subtitle?: string;
    imgUrl?: string;
    date: number;
    dateEnd?: number;
    raids?: IEntry[];
    wild?: IEntry[];
    incenses?: IEntry[];
    bonuses?: string;
    researches?: IEntry[];
    eggs?: IEntry[];
    isSeason?: boolean;
    comment?: string;
    spotlightPokemons?: IEntry[];
    spotlightBonus?: string;
    isRelevant?: boolean;
    rawUrl?: string;
}

export interface IParsedEvent {
    id: string;
    url: string;
    title: string;
    subtitle?: string;
    startDate: number;
    endDate: number;
    dateRanges?: Array<{ start: number; end: number }>;
    imageUrl?: string;
    source: 'pokemongo' | 'leekduck';
    wild?: IEntry[];
    raids?: IEntry[];
    eggs?: IEntry[];
    research?: IEntry[];
    incenses?: IEntry[];
    bonuses?: string[];
    isEnglishVersion: boolean;
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
  research: IEntry[];
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