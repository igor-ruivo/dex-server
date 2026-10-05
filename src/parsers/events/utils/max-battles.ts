import type { IEntry } from '../../types/events';
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
	const tier = maxBattleTier(lines.join(' '));
	const found: Array<{
		entry: IEntry;
		starred: boolean;
		announcedShiny: boolean;
	}> = [];
	for (const line of lines) {
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
