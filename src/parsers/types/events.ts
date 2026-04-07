import type { AvailableLocales } from '../services/gamemaster-translator';
import type { GameMasterData } from '../types/pokemon';

export interface IEntry {
	speciesId: string;
	shiny: boolean;
	kind?: string;
	comment?: Partial<Record<AvailableLocales, string>> | undefined;
}

export type IParsedEvent = EventBlock & {
	id: string;
	url: string;
	title: string;
	subtitle: string;
	startDate: number;
	endDate: number;
	dateRanges?: Array<{ start: number; end: number }> | undefined;
	imageUrl?: string | undefined;
	source: 'pokemongo' | 'leekduck';
	locale: AvailableLocales;
	isSeason?: boolean;
};

export type PublicEvent = Omit<
	IParsedEvent,
	'title' | 'subtitle' | 'bonuses' | 'locale' | 'bonusSectionIndex'
> & {
	title: Partial<Record<AvailableLocales, string>>;
	subtitle: Partial<Record<AvailableLocales, string>>;
	bonuses: Partial<Record<AvailableLocales, Array<string>>>;
};

export interface IEventSource {
	name: string;
	parseEvents(gameMasterPokemon: GameMasterData): Promise<Array<PublicEvent>>;
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
