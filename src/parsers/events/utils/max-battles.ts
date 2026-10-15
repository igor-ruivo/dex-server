import type { IEntry, IEntryWindow } from '../../types/events';
import { parseDateFromString } from './normalization';
import type PokemonMatcher from './pokemon-matcher';

/** A Max Pokémon: the Dynamax form every Max Battle boss has, or the rarer Gigantamax one. */
export type MaxForm = 'dynamax' | 'gigantamax';

const TIER_WORDS: Record<string, string> = {
	one: '1',
	two: '2',
	three: '3',
	four: '4',
	five: '5',
	six: '6',
};

/** "Dynamax Uxie*: …", "Shiny Gigantamax Cinderace—if you're lucky!": the form word, then the name up to where it stops. */
const MAX_NAME = /\b(dynamax|gigantamax)\s+([^:*,;!?—–()\n]+)/gi;
/** Where a name ends when a sentence goes on after it ("Gigantamax Cinderace storms into…"). */
const NAME_END =
	/\s+(?:if|will|may|can|could|in|is|are|during|storms?|makes?|returns?|appears?|and|from|at|on|for|to)\b/i;
const NOT_A_NAME = new Set(['pokémon', 'pokemon', 'battles', 'battle']);

/** The Max Battle tier a text names ("five-star Max Battles", "6-star Max Battles"), or none. */
export const maxBattleTier = (text: string): string | undefined => {
	const match = /\b(one|two|three|four|five|six|[1-6])[\s-]*star\b/i.exec(text);
	if (!match) {
		return undefined;
	}
	const word = match[1].toLowerCase();
	return TIER_WORDS[word] ?? word;
};

/** The form an event title says its Pokémon have: Gigantamax, or Dynamax for a title that speaks of Max Battles. */
export const maxFormOfTitle = (title: string): MaxForm | undefined => {
	const lower = title.toLowerCase();
	if (lower.includes('gigantamax')) {
		return 'gigantamax';
	}
	if (lower.includes('dynamax') || lower.includes('max battle')) {
		return 'dynamax';
	}
	return undefined;
};

/**
 * The Max Pokémon the lines of a section name, as "Dynamax <name>" / "Gigantamax <name>" (the entry's `kind` is the form, its
 * `tier` the Max Battle tier the text mentions). An asterisk right after a name marks that Pokémon as able to be shiny (the
 * "*If you're lucky…" footnote); when no name has one, a "Shiny" in front of a name says it. A section that uses asterisks
 * says it all with them.
 */
export const parseMaxBattleEntries = (
	lines: ReadonlyArray<string>,
	matcher: PokemonMatcher
): Array<IEntry> => {
	// the tier is the one the sentence that introduces a name speaks of ("…debut in five-star Max Battles!"), and holds until the
	// next sentence that introduces others: "…debut in GO Pass: Into the Wild!" names no tier, so its Pokémon have none
	let tier = maxBattleTier(lines.join(' '));
	const found: Array<{
		entry: IEntry;
		starred: boolean;
		announcedShiny: boolean;
	}> = [];
	for (const line of lines) {
		const foundBefore = found.length;
		for (const match of line.matchAll(MAX_NAME)) {
			const form = match[1].toLowerCase() as MaxForm;
			const name = match[2]
				.split(NAME_END)[0]
				.replace(/[.\s]+$/g, '')
				.trim();
			// a species name starts with a capital: "Dynamax debut" and "Dynamax battles" are not one
			const first = name.charAt(0);
			const capitalised = first !== first.toLowerCase();
			if (!name || !capitalised || NOT_A_NAME.has(name.toLowerCase())) {
				continue;
			}
			const species = matcher.matchPokemonFromText([name])[0];
			if (!species?.speciesId) {
				continue;
			}
			const before = line.slice(
				Math.max(0, (match.index ?? 0) - 12),
				match.index ?? 0
			);
			const after = line.charAt((match.index ?? 0) + match[0].length);
			found.push({
				entry: {
					speciesId: species.speciesId,
					kind: form,
					shiny: false,
					...(tier ? { tier } : {}),
				},
				starred: after === '*',
				announcedShiny: /\bshiny\s*$/i.test(before),
			});
		}
		// a line that names no one is an introduction (not a footnote): the tier it speaks of, if any, is the one of what follows
		if (found.length === foundBefore && !line.startsWith('*')) {
			tier = maxBattleTier(line);
		}
	}
	const usesAsterisks = found.some((f) => f.starred);
	const out: Array<IEntry> = [];
	for (const { entry, starred, announcedShiny } of found) {
		const shiny = usesAsterisks ? starred : announcedShiny;
		const existing = out.find(
			(e) => e.speciesId === entry.speciesId && e.kind === entry.kind
		);
		if (!existing) {
			out.push({ ...entry, shiny });
		} else if (shiny) {
			existing.shiny = true;
		}
	}
	return out;
};

/** "Five-Star Max Battles", "Five-Star Max Battles: Wednesday, November 11": the tier, then the day the tier's Pokémon are on. */
const TIER_HEADING =
	/^(one|two|three|four|five|six|[1-6])[\s-]*star\s+max\s+battles?\s*(?:[:\-–—]\s*(.+?))?\s*$/i;
/** "from 6:00 p.m. to 7:00 p.m.": the hours a section gives for its days. */
const HOURS =
	/from\s+(\d{1,2}:\d{2}\s*[ap]\.?m\.?)\s+to\s+(\d{1,2}:\d{2}\s*[ap]\.?m\.?)/i;
const compactTime = (time: string): string =>
	time.replace(/\./g, '').replace(/\s+/g, ' ').toLowerCase();

/** The window of a day ("Wednesday, November 11") with the section's hours, when both and the year are known. */
const windowOf = (
	label: string,
	hours: RegExpExecArray | null,
	year: number | undefined
): IEntryWindow => {
	if (!hours || !year) {
		return { label };
	}
	const day = `${label.replace(/^[A-Za-z]+day,\s*/, '')}, ${year}`;
	const start = parseDateFromString(`${day}, at ${compactTime(hours[1])}`);
	const end = parseDateFromString(`${day}, at ${compactTime(hours[2])}`);
	return isNaN(start) || isNaN(end) ? { label } : { label, start, end };
};

/**
 * The Max Pokémon of a section that lists them under a heading for each tier ("One-Star Max Battles" / "Ralts*", "Five-Star Max
 * Battles: Wednesday, November 11" / "Registeel*"), by plain name: the tier is the heading's, the form is Dynamax unless the
 * name says Gigantamax, an asterisk after a name makes it shiny, and a day in a heading is kept as the entry's `window` (with the
 * hours of the intro, "from 6:00 p.m. to 7:00 p.m.", and the year, when they are known). Nothing when there is no tier heading.
 */
export const parseTieredMaxBattleEntries = (
	lines: ReadonlyArray<string>,
	matcher: PokemonMatcher,
	year?: number
): Array<IEntry> => {
	const hours = HOURS.exec(lines.join(' '));
	let tier: string | undefined;
	let window: IEntryWindow | undefined;
	const out: Array<IEntry> = [];
	for (const line of lines) {
		const heading = TIER_HEADING.exec(line);
		if (heading) {
			const word = heading[1].toLowerCase();
			tier = TIER_WORDS[word] ?? word;
			window = heading[2]
				? windowOf(heading[2].trim(), hours, year)
				: undefined;
			continue;
		}
		// a footnote ("*If you're lucky…") or a sentence is not a name; before the first heading nothing is
		if (!tier || line.startsWith('*') || line.split(/\s+/).length > 5) {
			continue;
		}
		const name = line
			.replace(/\*/g, '')
			.replace(/^\s*(?:shiny\s+)?(?:dynamax|gigantamax)\s+/i, '')
			.trim();
		const species = name ? matcher.matchPokemonFromText([name])[0] : undefined;
		if (!species?.speciesId) {
			continue;
		}
		const kind: MaxForm = /gigantamax/i.test(line) ? 'gigantamax' : 'dynamax';
		const existing = out.find(
			(e) =>
				e.speciesId === species.speciesId && e.kind === kind && e.tier === tier
		);
		const shiny = line.includes('*');
		if (existing) {
			existing.shiny ||= shiny;
			continue;
		}
		out.push({
			speciesId: species.speciesId,
			kind,
			shiny,
			tier,
			...(window ? { window } : {}),
		});
	}
	return out;
};

/**
 * The lines of text of the blocks of a section, headings included, with a line break (<br>) also starting a new line: a heading
 * and the names under it often share one paragraph ("<strong>One-Star Max Battles</strong><br>Ralts*").
 */
export const maxBattleHeadedLinesOf = (
	bodies: ReadonlyArray<Element>
): Array<string> =>
	bodies.flatMap((body) => {
		const blocks = Array.from(
			body.querySelectorAll('li, p, h1, h2, h3, h4, h5, h6')
		);
		return (blocks.length > 0 ? blocks : [body]).flatMap((block) => {
			const copy = block.cloneNode(true) as Element;
			copy.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
			return (copy.textContent ?? '')
				.split('\n')
				.map((line) => line.replace(/\s+/g, ' ').trim())
				.filter(Boolean);
		});
	});

/** Adds Max Pokémon to a list: the same species in the same form is kept once (and shiny if any of its mentions says so). */
export const mergeMaxEntries = (
	list: Array<IEntry>,
	parsed: Array<IEntry>
): void => {
	for (const entry of parsed) {
		const existing = list.find(
			(e) => e.speciesId === entry.speciesId && e.kind === entry.kind
		);
		if (!existing) {
			list.push(entry);
		} else {
			if (entry.shiny) {
				existing.shiny = true;
			}
			existing.tier ??= entry.tier;
			existing.window ??= entry.window;
		}
	}
};

/**
 * The lines of text of a block of a page that names Max Pokémon: its paragraphs and list items, and the captions of a grid of
 * Pokémon pictures ("Dynamax Rhyhorn" under its image).
 */
export const maxBattleLinesOf = (root: Element): Array<string> =>
	Array.from(root.querySelectorAll('p, li, [class*="PokemonCaption"]'))
		.map((block) => (block.textContent ?? '').replace(/\s+/g, ' ').trim())
		.filter(Boolean);
