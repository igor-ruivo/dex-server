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
    title: string;
    subtitle?: string;
    description?: string;
    startDate: number;
    endDate: number;
    dateRanges?: Array<{ start: number; end: number }>;
    imageUrl?: string;
    sourceUrl?: string;
    source: 'pokemongo' | 'leekduck';
    categories: EventCategory[];
    wild?: IEntry[];
    raids?: IEntry[];
    eggs?: IEntry[];
    research?: IEntry[];
    incenses?: IEntry[];
    bonuses?: string[];
}

export enum EventCategory {
    RAID = 'raid',
    WILD = 'wild',
    RESEARCH = 'research',
    EGG = 'egg',
    INCENSE = 'incense',
    SPOTLIGHT = 'spotlight'
}

export interface IEventSource {
    name: string;
    baseUrl: string;
    parseEvents(html: string, gameMasterPokemon: Record<string, GameMasterPokemon>): Promise<IParsedEvent[]>;
}

export interface IEventMatcher {
    matchPokemon(pokemonName: string, gameMasterPokemon: Record<string, GameMasterPokemon>): string | null;
}

export interface IEventValidator {
    validateEvent(event: IParsedEvent): boolean;
}

export interface IEventAggregator {
    aggregateEvents(events: IParsedEvent[]): IParsedEvent[];
}

export interface IEventTransformer {
    transformEvent(event: IParsedEvent): IParsedEvent;
} 