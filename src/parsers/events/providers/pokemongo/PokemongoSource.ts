import type HttpDataFetcher from '../../../services/data-fetcher';
import {
	AvailableLocales,
	pairEventTranslations,
} from '../../../services/gamemaster-translator';
import type {
	EventBlock,
	IEventSource,
	IParsedEvent,
	IPokemonGoEventBlockParser,
	IPokemonGoHtmlParser,
	PokemonGoPost,
} from '../../../types/events';
import type { GameMasterData, GameMasterPokemon } from '../../../types/pokemon';
import { parseEventDateRange } from '../../utils/normalization';
import PokemonMatcher, {
	extractPokemonSpeciesIdsFromElements,
} from '../../utils/pokemon-matcher';
import PokemonGoNewsParser from './news-parsers/NewsParser';
import PokemonGoPostParser from './news-parsers/PostParser';
import PokemonGoFetcher from './PokemongoFetcher';

/**
 * Constants for event section types.
 */
const EVENT_SECTION_TYPES = {
	BONUSES: [
		'Bonuses',
		'Event bonus',
		'Event Bonus',
		'Event bonuses',
		'Event Bonuses',
		'Bonuses',
	],
	WILD_ENCOUNTERS: [
		'Wild encounters',
		'Wild Encounters',
		'Event-themed Pokémon',
	],
	EGGS: ['Eggs'],
	LURES: ['Encounters from Lure Modules'],
	RESEARCH: [
		'Field Research Task Rewards',
		'Field Research Task Encounters',
		'Field Research task encounters',
		'Field Research task rewards',
		'Field Research',
		'Timed Research',
	],
	RAIDS: ['Raids', 'Shadow Raids', 'Shadow Raid debut'],
	INCENSE: ['Incense Encounters', 'Increased Incense encounters'],
	FEATURED: ['Featured Pokémon'],
};

/**
 * Constants for block level HTML elements.
 */
const BLOCK_LEVEL_ELEMENTS: Array<string> = [
	'P',
	'DIV',
	'LI',
	'UL',
	'OL',
	'SECTION',
	'ARTICLE',
	'HEADER',
	'FOOTER',
	'NAV',
	'ASIDE',
	'MAIN',
	'H1',
	'H2',
	'H3',
	'H4',
	'H5',
	'H6',
	'BLOCKQUOTE',
	'PRE',
	'ADDRESS',
	'DL',
	'DT',
	'DD',
	'FIGURE',
	'FIGCAPTION',
	'HR',
	'TABLE',
	'THEAD',
	'TBODY',
	'TFOOT',
	'TR',
	'TH',
	'TD',
	'FORM',
	'FIELDSET',
	'LEGEND',
];

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
 * Extracts the locale from the event's url path.
 */
const extractLocaleFromPath = (path: string): AvailableLocales => {
	const url = path.toLocaleLowerCase();
	const match = /\/([a-z_]{1,5})\/news\//.exec(url);
	if (match?.[1]) {
		return match[1] as AvailableLocales;
	}

	const parts = url.split('/');
	if (
		parts.length > 3 &&
		parts[3] &&
		parts[3] !== 'news' &&
		parts[3] !== 'post'
	) {
		return parts[3] as AvailableLocales;
	}
	return AvailableLocales.en;
};

/**
 * Builds the IParsedEvent object for a subevent.
 */
const buildEventObject = (
	post: PokemonGoPost,
	parser: IPokemonGoHtmlParser,
	subEvent: IPokemonGoEventBlockParser,
	startDate: number,
	endDate: number,
	dateRanges: Array<{ start: number; end: number }>,
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
		bonusSectionIndex: parsedContent.bonusSectionIndex,
	};
};

/**
 * Event source for parsing Pokémon GO events from the official website.
 * Implements the IEventSource interface.
 */
class PokemonGoSource implements IEventSource {
	public name = 'pokemongo';
	private fetcher: PokemonGoFetcher;

	constructor(
		readonly dataFetcher: HttpDataFetcher,
		private readonly gameMasterPokemon: GameMasterData,
		private readonly domain: Array<GameMasterPokemon>
	) {
		this.fetcher = new PokemonGoFetcher(dataFetcher);
	}

	private getShorterUrlVersion(url: string) {
		if (url.includes('/news/')) {
			return url.split('/news/')[1];
		}

		return url.split('/post/')[1];
	}

	/**
	 * Parses all events from the provider using the given Game Master data.
	 */
	async parseEvents() {
		try {
			const posts = await this.fetcher.fetchAllPosts();
			const originalEvents = await this.parseOriginalPosts(
				posts,
				this.gameMasterPokemon
			);
			const translatedEvents = await this.parseTranslatedPosts(
				posts,
				originalEvents
			);

			return pairEventTranslations([...originalEvents, ...translatedEvents]);
		} catch {
			return [];
		}
	}

	/**
	 * Parses original English posts to extract full event data.
	 */
	private async parseOriginalPosts(
		posts: Array<PokemonGoPost>,
		gameMasterPokemon: GameMasterData
	): Promise<Array<IParsedEvent>> {
		const originalPosts = posts.filter((p) => p.locale === AvailableLocales.en);
		const postPromises = originalPosts.map((post) => {
			try {
				return this.parseSinglePost(post, gameMasterPokemon);
			} catch {
				return [];
			}
		});

		return (await Promise.all(postPromises)).flat();
	}

	/**
	 * Parses translated posts to extract bonus information only.
	 */
	private async parseTranslatedPosts(
		posts: Array<PokemonGoPost>,
		originalEvents: Array<IParsedEvent>
	): Promise<Array<IParsedEvent>> {
		const translatedPosts = posts.filter(
			(p) => p.locale !== AvailableLocales.en
		);
		const postPromises = translatedPosts.map((post) => {
			try {
				const originalEvent = this.findMatchingOriginalEvent(
					post,
					originalEvents
				);
				if (!originalEvent) {
					return [];
				}

				return this.parsePostForTranslations(
					post,
					originalEvent.bonusSectionIndex
				);
			} catch {
				return [];
			}
		});

		return (await Promise.all(postPromises)).flat();
	}

	/**
	 * Finds the matching original event for a translated post.
	 */
	private findMatchingOriginalEvent(
		post: PokemonGoPost,
		originalEvents: Array<IParsedEvent>
	): IParsedEvent | undefined {
		return originalEvents.find(
			(e) =>
				this.getShorterUrlVersion(e.url) === this.getShorterUrlVersion(post.url)
		);
	}

	/**
	 * Common logic for creating parser and iterating through subevents.
	 */
	private createParserAndGetSubEvents(post: PokemonGoPost) {
		const parser: IPokemonGoHtmlParser =
			post.type === 'post'
				? new PokemonGoPostParser(post.html)
				: new PokemonGoNewsParser(post.html);

		return { parser, subEvents: parser.getSubEvents() };
	}

	private parsePostForTranslations(
		post: PokemonGoPost,
		bonusSectionindex: number
	): Array<IParsedEvent> {
		const { parser, subEvents } = this.createParserAndGetSubEvents(post);
		const events: Array<IParsedEvent> = [];

		for (let i = 0; i < subEvents.length; i++) {
			const subEvent: IPokemonGoEventBlockParser = subEvents[i];
			const sectionElements = subEvent.getEventBlocks();
			const parsedContent = this.parseTranslatedBonusFromPost(
				sectionElements,
				bonusSectionindex
			);
			const event = buildEventObject(
				post,
				parser,
				subEvent,
				0,
				0,
				[],
				parsedContent,
				i
			);

			events.push(event);
		}
		return events;
	}

	/**
	 * Creates an empty EventBlock with default values.
	 */
	private createEmptyEventBlock(bonusSectionIndex = -1): EventBlock {
		return {
			raids: [],
			wild: [],
			eggs: [],
			researches: [],
			incenses: [],
			lures: [],
			bonuses: [],
			bonusSectionIndex,
		};
	}

	/**
	 * Parses bonus content from a section element.
	 */
	private parseBonusContent(sectionElement: Element): Array<string> {
		const bonusesArr: Array<string> = [];
		const sectionBodies = Array.from(
			sectionElement.children
		) as Array<HTMLElement>;

		for (let j = 1; j < sectionBodies.length; j++) {
			const bonusContainer = sectionBodies[j];
			if (bonusContainer) {
				const visualBonuses = this.extractBonusesVisualLines(bonusContainer);
				bonusesArr.push(...visualBonuses);
			}
		}

		return bonusesArr;
	}

	private parseTranslatedBonusFromPost(
		sectionElements: Array<Element>,
		bonusSectionIndex: number
	): EventBlock {
		const eventBlock = this.createEmptyEventBlock(bonusSectionIndex);

		if (
			bonusSectionIndex === -1 ||
			sectionElements.length < bonusSectionIndex + 1
		) {
			return eventBlock;
		}

		const sectionElement = sectionElements[bonusSectionIndex];
		eventBlock.bonuses = this.parseBonusContent(sectionElement);

		return eventBlock;
	}

	/**
	 * Parses a single post and returns all subevents as IParsedEvent objects.
	 */
	private parseSinglePost(
		post: PokemonGoPost,
		gameMasterPokemon: GameMasterData
	): Array<IParsedEvent> {
		const { parser, subEvents } = this.createParserAndGetSubEvents(post);
		const events: Array<IParsedEvent> = [];

		for (let i = 0; i < subEvents.length; i++) {
			const subEvent: IPokemonGoEventBlockParser = subEvents[i];
			const dateRanges = parseEventDateRange(subEvent.dateString);
			if (dateRanges.length === 0) {
				continue;
			}

			const startDate = Math.min(...dateRanges.map((r) => r.start));
			const endDate = Math.max(...dateRanges.map((r) => r.end));
			const sectionElements = subEvent.getEventBlocks();
			const parsedContent = this.parseInnerEvent(
				sectionElements,
				gameMasterPokemon,
				this.domain,
				parser.getTitle().toLocaleLowerCase().includes('community day')
			);
			const event = buildEventObject(
				post,
				parser,
				subEvent,
				startDate,
				endDate,
				dateRanges,
				parsedContent,
				i
			);

			if (this.eventIsRelevant(event)) {
				events.push(event);
			}
		}
		return events;
	}

	private eventIsRelevant(event: IParsedEvent) {
		return (
			event.locale !== AvailableLocales.en ||
			(((event.bonuses && event.bonuses.length > 0) ||
				(event.wild && event.wild.length > 0) ||
				(event.raids && event.raids.length > 0) ||
				(event.researches && event.researches.length > 0) ||
				(event.eggs && event.eggs.length > 0) ||
				(event.incenses && event.incenses.length > 0)) &&
				event.dateRanges &&
				event.dateRanges.length > 0)
		);
	}

	/**
	 * Checks if a section is a bonus section by its type.
	 */
	private isBonusSection(sectionType: string): boolean {
		return EVENT_SECTION_TYPES.BONUSES.some((bonusType) =>
			sectionType.includes(bonusType)
		);
	}

	/**
	 * Processes a section of the event and updates the eventData object accordingly.
	 */
	private processEventSection(
		sectionType: string,
		sectionBodies: Array<HTMLElement>,
		eventData: EventBlock,
		gameMasterPokemon: GameMasterData,
		domain: Array<GameMasterPokemon>,
		isCommunityDay: boolean
	): void {
		if (EVENT_SECTION_TYPES.WILD_ENCOUNTERS.some((x) => x === sectionType)) {
			const parsedPkm = extractPokemonSpeciesIdsFromElements(
				sectionBodies,
				new PokemonMatcher(gameMasterPokemon, domain)
			).filter((p) => !eventData.wild.some((w) => w.speciesId === p.speciesId));

			eventData.wild.push(...parsedPkm);
			return;
		}
		if (EVENT_SECTION_TYPES.EGGS.some((x) => x === sectionType)) {
			const parsedPkm = extractPokemonSpeciesIdsFromElements(
				sectionBodies,
				new PokemonMatcher(gameMasterPokemon, domain)
			).filter((p) => !eventData.eggs.some((w) => w.speciesId === p.speciesId));

			eventData.eggs.push(...parsedPkm);
			return;
		}
		if (
			EVENT_SECTION_TYPES.RESEARCH.some((x) => x === sectionType) ||
			EVENT_SECTION_TYPES.FEATURED.some((x) => x === sectionType)
		) {
			if (isCommunityDay) {
				const parsedPkm = extractPokemonSpeciesIdsFromElements(
					sectionBodies,
					new PokemonMatcher(gameMasterPokemon, domain)
				).filter(
					(p) => !eventData.wild.some((w) => w.speciesId === p.speciesId)
				);

				eventData.wild.push(...parsedPkm);
				return;
			}

			if (
				sectionBodies.some((b) =>
					b.textContent?.toLocaleLowerCase().includes('hatch')
				)
			) {
				const parsedPkm = extractPokemonSpeciesIdsFromElements(
					sectionBodies,
					new PokemonMatcher(gameMasterPokemon, domain)
				).filter(
					(p) => !eventData.eggs.some((w) => w.speciesId === p.speciesId)
				);

				eventData.eggs.push(...parsedPkm);
				return;
			}

			const parsedPkm = extractPokemonSpeciesIdsFromElements(
				sectionBodies,
				new PokemonMatcher(gameMasterPokemon, domain)
			).filter(
				(p) => !eventData.researches.some((w) => w.speciesId === p.speciesId)
			);

			// For now, assume featured pokémons are always related to researches.
			eventData.researches.push(...parsedPkm);
			return;
		}
		if (EVENT_SECTION_TYPES.RAIDS.some((x) => x === sectionType)) {
			const parsedPkm = extractPokemonSpeciesIdsFromElements(
				sectionBodies,
				new PokemonMatcher(gameMasterPokemon, domain)
			).filter(
				(p) => !eventData.raids.some((w) => w.speciesId === p.speciesId)
			);

			eventData.raids.push(...parsedPkm);
			return;
		}
		if (EVENT_SECTION_TYPES.INCENSE.some((x) => x === sectionType)) {
			const parsedPkm = extractPokemonSpeciesIdsFromElements(
				sectionBodies,
				new PokemonMatcher(gameMasterPokemon, domain)
			).filter(
				(p) => !eventData.incenses.some((w) => w.speciesId === p.speciesId)
			);

			eventData.incenses.push(...parsedPkm);
		}
		if (EVENT_SECTION_TYPES.LURES.some((x) => x === sectionType)) {
			const parsedPkm = extractPokemonSpeciesIdsFromElements(
				sectionBodies,
				new PokemonMatcher(gameMasterPokemon, domain)
			).filter(
				(p) => !eventData.lures.some((w) => w.speciesId === p.speciesId)
			);

			eventData.lures.push(...parsedPkm);
		}
	}

	/**
	 * Parses all inner event sections and returns the aggregated EventBlock.
	 */
	private parseInnerEvent(
		sectionElements: Array<Element>,
		gameMasterPokemon: GameMasterData,
		domain: Array<GameMasterPokemon>,
		isCommunityDay: boolean
	): EventBlock {
		const eventBlock = this.createEmptyEventBlock();

		for (let i = 0; i < sectionElements.length; i++) {
			const sectionElement = sectionElements[i];
			const sectionTitle = sectionElement.children[0];
			const sectionType = sectionTitle.textContent?.trim() ?? '';
			const sectionBodies = Array.from(
				sectionElement.children
			) as Array<HTMLElement>;

			if (!sectionType) {
				continue;
			}

			if (this.isBonusSection(sectionType)) {
				eventBlock.bonusSectionIndex = i;
				eventBlock.bonuses = this.parseBonusContent(sectionElement);
				continue;
			}

			this.processEventSection(
				sectionType,
				sectionBodies,
				eventBlock,
				gameMasterPokemon,
				domain,
				isCommunityDay
			);
		}

		return eventBlock;
	}

	/**
	 * Extracts bonus lines from a bonus container element.
	 */
	private extractBonusesVisualLines(bonusContainer: Element): Array<string> {
		const bonuses: Array<string> = [];
		let current = '';
		const pushLines = (text: string) => {
			text
				.split('\n')
				.map((line) => line.trim())
				.filter(Boolean)
				.forEach((line) => bonuses.push(line));
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
	}
}

export default PokemonGoSource;
