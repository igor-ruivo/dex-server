import { JSDOM } from 'jsdom';

import type HttpDataFetcher from '../../../services/data-fetcher';
import { AvailableLocales } from '../../../services/gamemaster-translator';
import type {
	IGblAttackAvailability,
	IGblAttackChange,
	IGblEncounter,
	IGblSeason,
} from '../../../types/gbl';
import type {
	GameMasterData,
	GameMasterPokemon,
	IGameMasterMove,
} from '../../../types/pokemon';
import type { RichBlock } from '../../../types/rich-text';
import {
	attackChangeVerdict,
	bulletDirection,
	parseAttackChange,
} from '../../utils/gbl-attack-changes';
import PokemonMatcher from '../../utils/pokemon-matcher';
import { parseRichBlocks } from '../../utils/rich-text';
import { hasShinySparkle } from '../../utils/shiny-sparkle';

const SITE = 'https://pokemongo.com';
/** The news listing shows 30 posts a page; `nr` is how many to skip. */
const LISTING_PAGE_SIZE = 30;
/** More than the listing has ever had, so that a listing that never ends cannot loop for ever. */
const MAX_LISTING_PAGES = 100;
const GBL_SLUG = /^\/news\/(go-battle-league-[^/?#]+)$/;

const SURPRISE_TILE = /^surprise encounter with a legendary/i;
const ATTACK_AVAILABILITY =
	/^(.+?) will now be able to learn the (Fast|Charged) Attack (.+?)\.?$/;

const normalizedName = (name: string) =>
	name.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();

const textOf = (element: Element | null | undefined) =>
	(element?.textContent ?? '').replace(/\s+/g, ' ').trim();

const documentOf = (html: string) => new JSDOM(html).window.document;

/**
 * The slug of the newest "go-battle-league-<season>" post. The listing is paged (30 posts at a time, `?nr=` posts skipped) and a
 * season's post can be well down it by the time the next one is due, so the pages are read until one adds nothing new, and the
 * newest post by its date is taken.
 */
export const findLatestGblSlug = async (
	fetchText: (url: string) => Promise<string>
): Promise<string> => {
	const seen = new Set<string>();
	let latest: { slug: string; timestamp: number } | undefined;

	for (let page = 0; page < MAX_LISTING_PAGES; page++) {
		const html = await fetchText(
			`${SITE}/${AvailableLocales.en}/news?nr=${page * LISTING_PAGE_SIZE}`
		);
		const links = Array.from(
			documentOf(html).querySelectorAll('a[href^="/news/"]')
		);
		let added = 0;
		for (const link of links) {
			const href = link.getAttribute('href') ?? '';
			if (seen.has(href)) {
				continue;
			}
			seen.add(href);
			added++;
			const slug = GBL_SLUG.exec(href)?.[1];
			if (!slug) {
				continue;
			}
			const timestamp = Number(
				link.querySelector('pg-date-format')?.getAttribute('timestamp')
			);
			if (!Number.isFinite(timestamp)) {
				throw new Error(`The listing gives no date for the post "${slug}"`);
			}
			if (!latest || timestamp > latest.timestamp) {
				latest = { slug, timestamp };
			}
		}
		if (added === 0) {
			break;
		}
	}

	if (!latest) {
		throw new Error('No "go-battle-league-…" post in the news listing');
	}
	return latest.slug;
};

/** A Pokémon's name as the post writes it, as a species; throws when it is not exactly one known Pokémon. */
const speciesIdOf = (matcher: PokemonMatcher, name: string): string => {
	const matches = matcher.matchPokemonFromText([name]);
	if (matches.length !== 1) {
		throw new Error(`Cannot match the Pokémon "${name}" to a species`);
	}
	return matches[0].speciesId;
};

/** A move's name as the post writes it, as a move id; a fast and a charged move can share a name, so which one it is can be asked. */
const moveIdResolver = (moves: Record<string, IGameMasterMove>) => {
	const byName = new Map<string, Array<IGameMasterMove>>();
	for (const move of Object.values(moves)) {
		const key = normalizedName(
			move.moveName[AvailableLocales.en] ?? move.moveId.replace(/_/g, ' ')
		);
		byName.set(key, [...(byName.get(key) ?? []), move]);
	}
	return (name: string, isFast?: boolean): string => {
		const candidates = (byName.get(normalizedName(name)) ?? []).filter(
			(move) => isFast === undefined || move.isFast === isFast
		);
		if (candidates.length > 1) {
			// a move with a synthetic twin (Aegislash's stance moves) is the one whose id is its name
			const exact = candidates.filter(
				(move) =>
					move.moveId === normalizedName(name).toUpperCase().replace(/ /g, '_')
			);
			if (exact.length === 1) {
				return exact[0].moveId;
			}
		}
		if (candidates.length !== 1) {
			throw new Error(
				`Cannot match the move "${name}" to exactly one move (${candidates.map((m) => m.moveId).join(', ') || 'none found'})`
			);
		}
		return candidates[0].moveId;
	};
};

/**
 * The ranks the encounters are met at. The post shows them only in its pictures, as a badge: the rank-ups are always at these
 * ranks, and the standard encounters come in the same order every season (five from rank 1, two from 6, four from 11, four from
 * 16, then the surprise Legendary from 20). A post with another number of pictures fails the run rather than being guessed at.
 */
const RANK_UP_RANKS = [1, 2000, 2500, 2750, 3000];
const STANDARD_RANKS = [1, 1, 1, 1, 1, 6, 6, 11, 11, 11, 11, 16, 16, 16, 16];
const SURPRISE_RANK = 20;

interface EncounterTile {
	name: string;
	imageUrl: string;
}

/** The pictured Pokémon of a "Guaranteed Rank-Up Encounters" / "Standard Encounters" block, in the order of the post. */
const readEncounterTiles = (
	doc: Document,
	heading: RegExp
): Array<EncounterTile> => {
	const rewards = doc.getElementById('rewards');
	const title = Array.from(rewards?.querySelectorAll('h2') ?? []).find((h) =>
		heading.test(textOf(h))
	);
	// the heading sits in a wrapper of its own, next to the picture grid and the footnote
	const block = title?.parentElement?.parentElement;
	if (!block) {
		throw new Error(`No "${heading.source}" section in the rewards`);
	}
	return Array.from(
		block.querySelectorAll('[class*="GridPokemonCaption"]')
	).map((caption) => {
		const name = textOf(caption);
		const imageUrl =
			caption.parentElement?.querySelector('img')?.getAttribute('src') ?? '';
		if (!imageUrl) {
			throw new Error(`The encounter "${name}" has no picture`);
		}
		return { name, imageUrl };
	});
};

const RANK_UP_HEADING = /^Guaranteed Rank-Up Encounters$/i;
const STANDARD_HEADING = /^Standard Encounters$/i;

/** The addresses of the post's pictures of its encounters: they are the only place that says which Pokémon can be shiny. */
export const gblPictureUrls = (html: string): Array<string> => {
	const doc = documentOf(html);
	return [
		...readEncounterTiles(doc, RANK_UP_HEADING),
		...readEncounterTiles(doc, STANDARD_HEADING),
	].map((tile) => tile.imageUrl);
};

interface RawAttackChange {
	name: string;
	/** The bullet points of the move's changes (a paragraph in a language that writes them so), with their formatting. */
	blocks: Array<RichBlock>;
}

/** A section of "name, then its changes" cards: the changes each move gets. */
const readAttackChanges = (section: Element): Array<RawAttackChange> => {
	const cards: Array<{ name: string; content: Array<Element> }> = [];
	for (const child of Array.from(section.children).slice(1)) {
		const name = textOf(child.querySelector('h2, h3'));
		if (name) {
			cards.push({ name, content: [] });
		} else {
			cards[cards.length - 1]?.content.push(child);
		}
	}
	return cards.map(({ name, content }) => ({
		name,
		blocks: parseRichBlocks(content),
	}));
};

const blockText = (block: RichBlock) =>
	block.runs.map((run) => run.text).join('');

/**
 * The season's name from a post: its first heading is "<the league>: <the season>" ("Liga de Batalha GO: Trilhas do Entardecer",
 * "GO Battle League - …", "「GOバトルリーグ：黄昏の旅路」の最新情報"), so the name is what follows the first colon or dash, up to a closing
 * quote. Undefined when the post is missing or its heading is not of that form.
 */
export const seasonNameOf = (html: string | undefined): string | undefined => {
	if (!html) {
		return undefined;
	}
	const heading = textOf(
		documentOf(html)
			.getElementById('rewards')
			?.parentElement?.querySelector('h2')
	);
	const name = /^[^:：]*?(?::|：| - )s*([^」”"]+)/.exec(heading)?.[1]?.trim();
	return name ?? undefined;
};

interface GblSeasonInput {
	slug: string;
	/** The post's html, in English: the app translates what it shows, and the Pokémon and the figures are the same in every language. */
	html: string;
	/** The post's html in the other languages, for the season's name in each (a language without one shows the English name). */
	localizedHtml?: Partial<Record<AvailableLocales, string>>;
	/** Whether the post's picture (by its address) carries the shiny sparkle, i.e. the Pokémon can be shiny. */
	shinyOf: (imageUrl: string) => boolean;
	gameMaster: GameMasterData;
	domain: Array<GameMasterPokemon>;
	moves: Record<string, IGameMasterMove>;
}

/**
 * Reads a "GO Battle League: <season>" post. Everything that names a Pokémon or a move has to resolve to a known species / move, and
 * every change to a move has to be worded the way it is known, or this throws (and so the whole generate step fails): nothing is
 * guessed or dropped.
 */
export const parseGblSeason = ({
	slug,
	html,
	localizedHtml = {},
	shinyOf,
	gameMaster,
	domain,
	moves,
}: GblSeasonInput): IGblSeason => {
	const doc = documentOf(html);
	// the sections of the post (the rewards, the cups, the attack changes…) are siblings
	const sections = doc.getElementById('rewards')?.parentElement;
	if (!sections) {
		throw new Error(`The post "${slug}" has no rewards section`);
	}
	const matcher = new PokemonMatcher(gameMaster, domain);
	const moveId = moveIdResolver(moves);

	const sectionByHeading = (heading: RegExp) => {
		const section = Array.from(sections.children).find((candidate) =>
			heading.test(textOf(candidate.querySelector('h2')))
		);
		if (!section) {
			throw new Error(`The post "${slug}" has no "${heading.source}" section`);
		}
		return section;
	};

	const encounters = (
		tiles: Array<EncounterTile>,
		ranks: ReadonlyArray<number>,
		what: string
	): Array<IGblEncounter> => {
		if (tiles.length !== ranks.length) {
			throw new Error(
				`The post "${slug}" has ${tiles.length} ${what}, not the ${ranks.length} whose ranks are known`
			);
		}
		return tiles.map((tile, i) => ({
			speciesId: speciesIdOf(matcher, tile.name),
			shiny: shinyOf(tile.imageUrl),
			rank: ranks[i],
		}));
	};
	const rankUp = encounters(
		readEncounterTiles(doc, RANK_UP_HEADING),
		RANK_UP_RANKS,
		'rank-up encounters'
	);
	// the surprise Legendary closes the standard encounters
	const standardTiles = readEncounterTiles(doc, STANDARD_HEADING);
	const surprise = standardTiles.pop();
	if (!surprise || !SURPRISE_TILE.test(surprise.name)) {
		throw new Error(
			`The post "${slug}" does not end its standard encounters with the surprise Legendary`
		);
	}
	const standard = encounters(
		standardTiles,
		STANDARD_RANKS,
		'standard encounters'
	);

	const changesSection = sectionByHeading(/^Attack Changes$/i);
	const cards = readAttackChanges(changesSection);
	if (cards.length === 0) {
		throw new Error(`The post "${slug}" lists no attack changes`);
	}
	// each language's own post: its wording of every move's changes, found at the same place and checked to have the same moves
	const changesIndex = Array.from(sections.children).indexOf(changesSection);
	const localCards = new Map<AvailableLocales, Array<RawAttackChange>>();
	for (const locale of Object.values(AvailableLocales)) {
		const localHtml = localizedHtml[locale];
		if (locale === AvailableLocales.en || !localHtml) {
			continue;
		}
		const section =
			documentOf(localHtml).getElementById('rewards')?.parentElement?.children[
				changesIndex
			];
		const localized = section ? readAttackChanges(section) : [];
		if (localized.length === cards.length) {
			localCards.set(locale, localized);
		} else {
			console.log(
				`[GblSeasonParser] ${locale} attack changes do not line up with the English ones (${localized.length} moves, not ${cards.length}) — showing the English text.`
			);
		}
	}
	const attackChanges: Array<IGblAttackChange> = cards.map((card, i) => {
		// what each bullet point of the English post does, to label the move and to colour the bullet
		const perBullet = card.blocks.map((block) =>
			parseAttackChange(blockText(block))
		);
		if (perBullet.length === 0) {
			throw new Error(`The attack changes of "${card.name}" are empty`);
		}
		return {
			moveId: moveId(card.name),
			verdict: attackChangeVerdict(perBullet.flat()),
			directions: perBullet.map(bulletDirection),
			text: Object.fromEntries(
				Object.values(AvailableLocales).map((locale) => {
					const blocks = localCards.get(locale)?.[i]?.blocks;
					return [locale, blocks?.length ? blocks : card.blocks];
				})
			) as IGblAttackChange['text'],
		};
	});

	const attackAvailability: Array<IGblAttackAvailability> = [];
	const availability = sectionByHeading(/^Attack Availability Updates$/i);
	for (const entry of Array.from(availability.children).slice(1)) {
		const details = entry.children[1];
		const name = textOf(details?.children[0]);
		const rows = Array.from(details?.children ?? []).slice(1);
		if (!name || rows.length === 0) {
			throw new Error(
				`Unreadable attack availability entry: "${textOf(entry)}"`
			);
		}
		const speciesId = speciesIdOf(matcher, name);
		for (const row of rows) {
			const sentence = ATTACK_AVAILABILITY.exec(textOf(row));
			if (!sentence) {
				throw new Error(
					`Unrecognised attack availability for ${name}: "${textOf(row)}"`
				);
			}
			const entryMoveId = moveId(sentence[3], sentence[2] === 'Fast');
			// two forms of one species (Toxtricity's) can learn the same move
			if (
				!attackAvailability.some(
					(known) =>
						known.speciesId === speciesId && known.moveId === entryMoveId
				)
			) {
				attackAvailability.push({ speciesId, moveId: entryMoveId });
			}
		}
	}
	if (attackAvailability.length === 0) {
		throw new Error(`The post "${slug}" lists no attack availability updates`);
	}

	const name = Object.fromEntries(
		Object.values(AvailableLocales).map((locale) => [
			locale,
			locale === AvailableLocales.en
				? seasonNameOf(html)
				: (seasonNameOf(localizedHtml[locale]) ?? seasonNameOf(html)),
		])
	) as Record<AvailableLocales, string | undefined>;
	if (!name[AvailableLocales.en]) {
		throw new Error(`The post "${slug}" has no season name`);
	}
	// the post's picture is found as the other news posts' is (see PokemonGoNewsParser.getImgUrl)
	const imageUrl =
		doc.querySelector('article>div>div>picture>img')?.getAttribute('src') ?? '';
	if (!imageUrl) {
		throw new Error(`The post "${slug}" has no picture`);
	}
	return {
		slug,
		name: name as IGblSeason['name'],
		imageUrl,
		rankUpEncounters: rankUp,
		standardEncounters: standard,
		legendarySurprise: { rank: SURPRISE_RANK },
		attackChanges,
		attackAvailability,
	};
};

class GblSeasonParser {
	constructor(
		private readonly dataFetcher: HttpDataFetcher,
		private readonly gameMaster: GameMasterData,
		private readonly domain: Array<GameMasterPokemon>,
		private readonly moves: Record<string, IGameMasterMove>
	) {}

	async fetchLatestSeason(): Promise<IGblSeason> {
		const slug = await findLatestGblSlug((url) =>
			this.dataFetcher.fetchText(url)
		);
		const html = await this.dataFetcher.fetchText(
			`${SITE}/${AvailableLocales.en}/news/${slug}`
		);
		if (!html) {
			throw new Error(`The post "${slug}" could not be fetched`);
		}
		// which Pokémon can be shiny is only in the pictures (the sparkle), so each one is looked at
		const shiny = new Map<string, boolean>();
		await Promise.all(
			gblPictureUrls(html).map(async (url) => {
				shiny.set(url, hasShinySparkle(await this.dataFetcher.fetchBytes(url)));
			})
		);
		// the season's name in the other languages: their posts' headings
		const localizedHtml: Partial<Record<AvailableLocales, string>> = {};
		await Promise.all(
			Object.values(AvailableLocales)
				.filter((locale) => locale !== AvailableLocales.en)
				.map(async (locale) => {
					localizedHtml[locale] = await this.dataFetcher.fetchText(
						`${SITE}/${locale}/news/${slug}`
					);
				})
		);
		return parseGblSeason({
			slug,
			html,
			localizedHtml,
			shinyOf: (url) => shiny.get(url) ?? false,
			gameMaster: this.gameMaster,
			domain: this.domain,
			moves: this.moves,
		});
	}
}

export default GblSeasonParser;
