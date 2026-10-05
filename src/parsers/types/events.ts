import type { AvailableLocales } from '../services/gamemaster-translator';
import type { GameMasterData } from '../types/pokemon';
import type { RichBlock } from './rich-text';

export interface IEntry {
	speciesId: string;
	shiny: boolean;
	/** What the entry is: a raid tier, an egg distance… or, in `maxBattles`, the form (`dynamax` or `gigantamax`). */
	kind?: string;
	/** The Max Battle tier ("5" for a five-star battle), for the entries of `maxBattles`. */
	tier?: string | undefined;
	comment?: Partial<Record<AvailableLocales, string>> | undefined;
}

/** One tier of a season's major milestone bonuses: what a rank of the season earns. */
export interface IMilestoneTier {
	/** The tier as the page names it ("Tier 1"). */
	tier: string;
	/** The rank that earns it ("Rank 25"). */
	rank: string;
	/** The two colours the card's header goes from (bronze, silver, gold…), whatever the language. */
	colors?: [string, string];
	/** What the tier gives, with its formatting kept. */
	blocks: Array<RichBlock>;
}

export interface IMilestoneBonuses {
	title: string;
	/** The sentence(s) that introduce the tiers ("Reach Major Milestones on your GO Pass to unlock the following bonuses."). */
	intro?: Array<RichBlock>;
	tiers: Array<IMilestoneTier>;
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
	| 'url'
	| 'title'
	| 'subtitle'
	| 'bonuses'
	| 'bonusBlocks'
	| 'milestoneBonuses'
	| 'locale'
	| 'bonusSectionIndex'
	| 'milestoneSectionIndex'
	| 'rewardBlocks'
	| 'rewardSectionIndex'
	| 'rewardDropped'
> & {
	// The "View original" link needs to open in whichever language the post
	// itself is being read in — pokemongo.com actually publishes a genuinely
	// separate URL per locale (e.g. /de/news/…), unlike LeekDuck (a single
	// English-only fan site), so this is worth keeping instead of collapsing
	// to one URL the way title/subtitle/bonuses fall back to EN when a given
	// locale's own translated post is missing.
	url: Partial<Record<AvailableLocales, string>>;
	title: Partial<Record<AvailableLocales, string>>;
	subtitle: Partial<Record<AvailableLocales, string>>;
	bonuses: Partial<Record<AvailableLocales, Array<string>>>;
	/**
	 * The same bonuses with their formatting kept (bullet points and how deep they are, bold, links, the asterisk footnotes), per
	 * locale: what `bonuses` flattens into plain lines.
	 */
	bonusBlocks: Partial<Record<AvailableLocales, Array<RichBlock>>>;
	/** A season's major milestone bonuses, per locale (English where a locale has none of its own). */
	milestoneBonuses?: Partial<Record<AvailableLocales, IMilestoneBonuses>>;
	/** The rewards of a GO Pass's "Featured Pokémon and Rewards" section with their formatting, per locale (English where a locale has none). */
	rewardBlocks?: Partial<Record<AvailableLocales, Array<RichBlock>>>;
	// Which locales actually have their own pokemongo.com post for this event
	// — `url`/`title`/`subtitle`/`bonuses` above fall back to the English
	// post's content for any locale missing here, so consumers that want to
	// know whether a locale's *own* page genuinely exists (rather than
	// silently reading English) need this instead of inferring it from
	// those fallback-filled fields.
	availableLocales: Array<AvailableLocales>;
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
	/** The Dynamax / Gigantamax Pokémon the event brings to Max Battles (the entry's species is the base one). */
	maxBattles: Array<IEntry>;
}

export type EventBlock = EventData & {
	bonuses: Array<string>;
	bonusBlocks: Array<RichBlock>;
	bonusSectionIndex: number;
	/** The "Major Milestone Bonuses" section of a post: where it is among the post's sections (-1 for none) and what it says. */
	milestoneSectionIndex: number;
	milestoneBonuses?: IMilestoneBonuses | undefined;
	/**
	 * The rewards of a "Featured Pokémon and Rewards" section (a GO Pass's), formatted, without the lines the Pokémon were taken from;
	 * where that section is (-1 for none) and which of its blocks were left out, for the posts of the other languages.
	 */
	rewardBlocks: Array<RichBlock>;
	rewardSectionIndex: number;
	rewardDropped: Array<number>;
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
	/** The shadow ids, among the three tiers, that can be shiny (they carry the shiny icon on the page). */
	shinyPokemon: Array<string>;
	catchableTiers: Array<number>;
}
