import type { IEntry } from '../../types/events';
import type { GameMasterData, GameMasterPokemon } from '../../types/pokemon';
import {
	ndfNormalized,
	normalizePokemonName,
	normalizeSpeciesNameForId,
} from '../../utils/normalization';
import { KNOWN_FORMS, RAID_LEVEL_MAPPINGS } from '../config/constants';

const RESOURCE_REFERENCE_PATTERN = /\b(?:candy|energy)\b/i;

export const isPokemonResourceReference = (text: string): boolean =>
	RESOURCE_REFERENCE_PATTERN.test(text);

/**
 * Utility for matching Pokémon names and forms to Game Master data in the event pipeline.
 * Handles normalization, form detection, and special cases for event parsing.
 */
class PokemonMatcher {
	/**
	 * Constructs a new PokemonMatcher.
	 * @param gameMasterPokemon - The full Game Master Pokémon dictionary.
	 * @param domain - The subset of Pokémon relevant for this context.
	 */
	constructor(
		private readonly gameMasterPokemon: GameMasterData,
		private readonly domain: Array<GameMasterPokemon>
	) {}

	/** The name a species is written with in event text ("Zorua (Hisuian)" → "zorua"), or undefined if unknown. */
	plainNameOf(speciesId: string): string | undefined {
		const name = this.gameMasterPokemon[speciesId]?.speciesName;
		return (
			name
				?.replace(/\s*\(.*$/, '')
				.trim()
				.toLowerCase() || undefined
		);
	}

	/**
	 * Matches an array of Pokémon name strings to IEntry objects using normalization and form logic.
	 */
	matchPokemonFromText(texts: Array<string>): Array<IEntry> {
		const wildEncounters: Array<IEntry> = [];
		const seen = new Set<string>();
		const pkmWithNoClothes = texts.map((pp) => {
			const idx = pp.indexOf(' wearing');
			if (idx !== -1) {
				return pp.substring(0, idx);
			}
			return pp;
		});
		let raidLevel = '';
		for (const rawName of pkmWithNoClothes) {
			const isShiny = rawName.includes('*');
			let isShadow = false;
			let isMega = false;
			let currP = normalizePokemonName(rawName);
			if (isPokemonResourceReference(currP)) {
				continue;
			}
			const raidLIndex = currP.indexOf(' raids');
			if (
				raidLIndex !== -1 &&
				!currP.includes('will return to') &&
				!currP.includes('will appear in')
			) {
				//console.log(currP);
				raidLevel = currP.substring(0, raidLIndex);
				for (const [key, value] of Object.entries(RAID_LEVEL_MAPPINGS)) {
					raidLevel = raidLevel.replaceAll(key, value);
				}
				continue;
			}
			let words = currP.split(' ');
			if (words.includes('shadow')) {
				isShadow = true;
				words = words.filter((word) => word !== 'shadow');
			}
			if (words.includes('mega')) {
				isMega = true;
				words = words.filter((word) => word !== 'mega');
			}
			if (words.includes('primal')) {
				isMega = true;
				words = words.filter((word) => word !== 'primal');
			}
			currP = words.join(' ').trim();

			// Edge case for Darmanitan -> it has a form (Standard) on the id but not on the name...
			if (currP === 'darmanitan') {
				if (isShadow) {
					//darmanitan_standard_shadow // darmanitan_standard
					if (!seen.has('darmanitan_standard_shadow')) {
						seen.add('darmanitan_standard_shadow');

						wildEncounters.push({
							speciesId: 'darmanitan_standard_shadow',
							shiny: isShiny,
							kind: raidLevel,
						});
					}
					continue;
				}

				if (!seen.has('darmanitan_standard')) {
					seen.add('darmanitan_standard');

					wildEncounters.push({
						speciesId: 'darmanitan_standard',
						shiny: isShiny,
						kind: raidLevel,
					});
				}
				continue;
			}

			const match = this.matchPokemon(currP, isShadow, isMega, raidLevel);
			if (match && !seen.has(match.speciesId)) {
				seen.add(match.speciesId);
				wildEncounters.push(match);
			}
		}
		return wildEncounters;
	}

	/**
	 * Matches a single Pokémon name (with form, shadow, mega, raid level) to an IEntry.
	 */
	private matchPokemon(
		currP: string,
		isShadow: boolean,
		isMega: boolean,
		raidLevel: string
	): IEntry | null {
		// Direct indexing (90% hits)
		const match = this.gameMasterPokemon[normalizeSpeciesNameForId(currP)];
		if (match && !isShadow && !isMega) {
			return {
				speciesId: match.speciesId,
				shiny: false,
				kind: raidLevel,
			};
		}

		// handle nidoran sex
		if (currP.includes('nidoran') && currP.includes('♀')) {
			return {
				speciesId: 'nidoran_female',
				shiny: false,
				kind: raidLevel,
			};
		}

		if (currP.includes('nidoran') && currP.includes('♂')) {
			return {
				speciesId: 'nidoran_male',
				shiny: false,
				kind: raidLevel,
			};
		}

		// Find base Pokémon name in domain
		const isolatedPkmName = this.domain.filter((domainP) => {
			const normalizedDomainPSpeciesName = domainP.speciesName
				.toLocaleLowerCase()
				.normalize('NFD')
				.replace(/[\u0300-\u036f]/g, '');
			const pattern = new RegExp(`\\b${normalizedDomainPSpeciesName}\\b`, 'i');
			return pattern.test(currP);
		});
		if (isolatedPkmName.length === 0) {
			return this.handleFormOnlyPokemon(currP, isShadow, isMega, raidLevel);
		}
		if (isolatedPkmName.length > 1) {
			console.error("Couldn't isolate the base pokémon name of " + currP);
			return null;
		}
		return this.matchPokemonWithForm(
			isolatedPkmName[0],
			currP,
			isShadow,
			isMega,
			raidLevel
		);
	}

	/**
	 * Handles Pokémon names that only specify a form (e.g., Oricorio).
	 */
	private handleFormOnlyPokemon(
		currP: string,
		isShadow: boolean,
		isMega: boolean,
		raidLevel: string
	): IEntry | null {
		const formCandidate = currP
			.replaceAll('(', '')
			.replaceAll(')', '')
			.split(' ')
			.filter((f) =>
				Array.from(KNOWN_FORMS).some((e) => ndfNormalized(e) === f)
			);
		if (formCandidate.length === 0) {
			return this.handleSpecialCases(currP, raidLevel);
		}
		if (formCandidate.length > 1) {
			console.error('Multiple forms for ' + currP);
			return null;
		}
		const form = formCandidate[0];
		const finalResults = this.domain.filter(
			(wd) =>
				ndfNormalized(wd.speciesName).includes('(' + form + ')') &&
				wd.isShadow === isShadow &&
				wd.isMega === isMega
		);
		if (finalResults.length === 0) {
			console.error(`Couldn't find Form in gamemaster: ${currP}`);
			return null;
		}
		if (finalResults.length === 1) {
			return {
				speciesId: finalResults[0].speciesId,
				shiny: false,
				kind: raidLevel,
			};
		}
		// Handle multiple forms (e.g., Oricorio)
		const pkmNameWithoutForm = currP.replaceAll(form, '').trim();
		const ans = this.domain.filter(
			(wff) =>
				pkmNameWithoutForm
					.split(' ')
					.some((s) => ndfNormalized(wff.speciesName).includes(s)) &&
				ndfNormalized(wff.speciesName).includes(form) &&
				wff.isShadow === isShadow &&
				wff.isMega === isMega
		);
		if (ans.length === 0) {
			console.error('No match found for ' + currP);
			return null;
		}
		if (ans.length === 1) {
			return {
				speciesId: ans[0].speciesId,
				shiny: false,
				kind: raidLevel,
			};
		}

		if (currP.includes('zamazenta') && currP.includes('hero')) {
			return {
				speciesId: 'zamazenta_hero',
				shiny: false,
				kind: raidLevel,
			};
		}

		if (currP.includes('zacian') && currP.includes('hero')) {
			return {
				speciesId: 'zacian_hero',
				shiny: false,
				kind: raidLevel,
			};
		}

		console.error('Multiple matches for ' + currP);
		return null;
	}

	/**
	 * Handles special-case Pokémon names that don't match standard forms.
	 */
	private handleSpecialCases(currP: string, raidLevel: string): IEntry | null {
		const specialCases: Record<string, string> = {
			giratina: 'giratina_altered',
			zacian: 'zacian_hero',
			zamazenta: 'zamazenta_hero',
			morpeko: 'morpeko_full_belly',
			pumpkaboo: 'pumpkaboo_average',
			gourgeist: 'gourgeist_average',
			indeedee: 'indeedee_male',
			urshifu: 'urshifu_single_strike',
		};
		for (const [key, value] of Object.entries(specialCases)) {
			if (currP.includes(key)) {
				return {
					speciesId: value,
					shiny: false,
					kind: raidLevel,
				};
			}
		}

		const currPWords = currP.split(' ');
		const names = Object.values(this.gameMasterPokemon)
			.filter((p) => !p.aliasId)
			.map((p) => p.speciesName.toLocaleLowerCase().split(' '));

		if (
			currPWords.length <= 10 &&
			currPWords.some((w) =>
				names.some((wordsInName) => wordsInName.includes(w.toLocaleLowerCase()))
			)
		) {
			console.error("(0) Couldn't map form for " + currP);
		}

		return null;
	}

	/**
	 * Matches a Pokémon with a specific form, shadow, or mega status.
	 */
	private matchPokemonWithForm(
		basePokemon: GameMasterPokemon,
		currP: string,
		isShadow: boolean,
		isMega: boolean,
		raidLevel: string
	): IEntry | null {
		const dex = basePokemon.dex;
		const availableForms = this.getAvailableForms(
			dex,
			isShadow,
			isMega,
			raidLevel
		);
		if (availableForms.length === 1) {
			return {
				speciesId: availableForms[0].speciesId,
				shiny: false,
				kind: raidLevel,
			};
		}
		// Handle Mega Charizard X/Y
		if ((raidLevel === 'Mega' || isMega) && dex === 6) {
			const words = currP.split(' ');
			if (words.includes('x')) {
				return {
					speciesId: 'charizard_mega_x',
					shiny: false,
					kind: raidLevel,
				};
			}
			if (words.includes('y')) {
				return {
					speciesId: 'charizard_mega_y',
					shiny: false,
					kind: raidLevel,
				};
			}
		}

		// Handle Mega Raichu X/Y

		if ((raidLevel === 'Mega' || isMega) && dex === 26) {
			const words = currP.split(' ');
			if (words.includes('x')) {
				return {
					speciesId: 'raichu_mega_x',
					shiny: false,
					kind: raidLevel,
				};
			}
			if (words.includes('y')) {
				return {
					speciesId: 'raichu_mega_y',
					shiny: false,
					kind: raidLevel,
				};
			}
		}

		// Handle Mega Mewtwo X/Y
		if ((raidLevel === 'Mega' || isMega || raidLevel === '5') && dex === 150) {
			const words = currP.split(' ');
			if (words.includes('x')) {
				return {
					speciesId: 'mewtwo_mega_x',
					shiny: false,
					kind: raidLevel,
				};
			}
			if (words.includes('y')) {
				return {
					speciesId: 'mewtwo_mega_y',
					shiny: false,
					kind: raidLevel,
				};
			}
		}

		if (availableForms.length === 0) {
			if (isMega) {
				console.log("Domain didn't cover Megas while computing " + currP);
			} else {
				console.error("Couldn't find form of " + currP);
			}
			return null;
		}
		const mappedForm = availableForms.filter((af) =>
			Array.from(KNOWN_FORMS).some(
				(e) =>
					ndfNormalized(af.speciesName).includes(ndfNormalized(e)) &&
					currP.includes(ndfNormalized(e))
			)
		);
		if (mappedForm.length === 0) {
			if (isShadow) {
				const guess = Object.values(this.gameMasterPokemon).filter(
					(g) =>
						!g.aliasId &&
						g.isShadow &&
						dex === g.dex &&
						!Array.from(KNOWN_FORMS).some((f) =>
							ndfNormalized(g.speciesName).includes(ndfNormalized(f))
						)
				);
				if (guess.length === 1) {
					return {
						speciesId: guess[0].speciesId,
						shiny: false,
						kind: raidLevel,
					};
				}
			}

			if (currP.includes('except ')) {
				console.log(`${currP} has 'except' keyword in it. Ignoring...`);
				return null;
			}

			// then it's the base form (the simplest pokémon form). we're assuming it's the smallest id of the species.
			const ans = availableForms.sort(
				(f1: GameMasterPokemon, f2: GameMasterPokemon) =>
					f1.speciesId.length - f2.speciesId.length
			)[0];

			return {
				speciesId: ans.speciesId,
				shiny: false,
				kind: raidLevel,
			};
		}
		if (mappedForm.length === 1) {
			return {
				speciesId: mappedForm[0].speciesId,
				shiny: false,
				kind: raidLevel,
			};
		}
		console.error('Multiple mapped forms for ' + currP);
		return null;
	}

	/**
	 * Gets all available forms for a given dex number and status.
	 */
	private getAvailableForms(
		dex: number,
		isShadow: boolean,
		isMega: boolean,
		raidLevel: string
	): Array<GameMasterPokemon> {
		if ((raidLevel && raidLevel.toLocaleLowerCase() !== 'mega') || !isMega) {
			if (!isShadow) {
				return this.domain.filter(
					(formC) =>
						formC.dex === dex &&
						formC.isShadow === isShadow &&
						formC.isMega === isMega
				);
			} else {
				return Object.values(this.gameMasterPokemon).filter(
					(l) => !l.isMega && l.dex === dex && !l.aliasId && l.isShadow
				);
			}
		} else {
			return Object.values(this.gameMasterPokemon).filter(
				(l) => l.isMega && l.dex === dex && !l.aliasId && !l.isShadow
			);
		}
	}
}

/** The elements that hold text as a block: the text under the nearest one of them, inline tags included, is one phrase. */
const BLOCK_SELECTOR =
	'p, li, div, h1, h2, h3, h4, h5, h6, td, th, dd, dt, blockquote, ul, ol, table, section, article';
/**
 * An asterisk right after a name: "Hoppip*", "Skarmory*!", "Eevee*. You" (the list is cut at commas and "and", not at the
 * end of a sentence). A star that opens a text (the footnote "*If you're lucky…") follows no name.
 */
const STAR_AFTER_NAME = /[^\s*]\*/;
/**
 * Whether a name fragment is starred: the asterisk follows the name ("Hoppip*"), or — for a Pokémon "wearing" something
 * ("Charmander wearing Friede's goggles*", "Pikachu wearing Cap's hat*!") — comes later in the sentence, after the outfit and
 * before the next comma or the end of the sentence.
 */
const hasStar = (fragment: { text: string; after: string }): boolean => {
	if (STAR_AFTER_NAME.test(fragment.text)) return true;
	if (!/\bwearing\b/i.test(fragment.text)) return false;
	const sameClause = fragment.after.split(/[,;!?]|\.(?=\s|$)/)[0];
	return sameClause.includes('*');
};

/** The word that makes a phrase about a shiny. "If you're lucky" alone does not: it also introduces Special Backgrounds. */
const SHINY_WORD = /\bshiny\b/i;
/** A remark such as "If you're lucky, they may be Shiny!", which refers to Pokémon named before it. */
const SHINY_REMARK = /if you[’'`]?re lucky[^\n]*shiny/i;

/**
 * The [start, end) ranges of the sentences of a text. A sentence ends at . ! or ? followed by a space and a capital, digit
 * or opening quote — so "2:00 p.m. to 9:00 p.m. local time" stays in one piece.
 */
const sentenceRanges = (text: string): Array<[number, number]> => {
	const ranges: Array<[number, number]> = [];
	let start = 0;
	for (const match of text.matchAll(/[.!?]+(?=\s+[A-Z0-9“"‘'(])/g)) {
		const end = match.index + match[0].length;
		ranges.push([start, end]);
		start = end;
	}
	ranges.push([start, text.length]);
	return ranges;
};

/**
 * Extracts Pokémon species IDs from a list of HTML elements using a PokemonMatcher.
 */
export const extractPokemonSpeciesIdsFromElements = (
	elements: Array<Node>,
	matcher: PokemonMatcher
): Array<IEntry> => {
	const textes: Array<string> = [];
	// The text of every block (a paragraph, a list item, the loose text of a div…), put back together: a phrase can run through
	// inline tags (<strong>Zorua</strong> …), so "shiny" is read from these rather than from the separate text nodes.
	const blockParts = new Map<Node | null, Array<string>>();
	const addToBlock = (node: Node, text: string) => {
		const parent = node.parentElement;
		const holder = parent?.closest?.(BLOCK_SELECTOR) ?? parent;
		blockParts.set(holder, [...(blockParts.get(holder) ?? []), text]);
	};
	const stack = [...elements];
	while (stack.length > 0) {
		const node = stack.pop();
		if (!node) continue;
		if (node.nodeType === 1) {
			// ELEMENT_NODE
			const el = node as Element;
			if (Array.from(el.classList ?? []).includes('ContainerBlock__headline')) {
				continue;
			}
			if (el.tagName === 'BR') addToBlock(el, ' ');
			if (el.childNodes) {
				for (let i = el.childNodes.length - 1; i >= 0; i--) {
					stack.push(el.childNodes[i]);
				}
			}
		} else if (node.nodeType === 3) {
			// TEXT_NODE
			const actualText = node.textContent?.trim();
			if (actualText) {
				textes.push(actualText);
				addToBlock(node, node.textContent ?? '');
			}
		}
	}
	// Filtering and parsing as in user's parseFromString
	const whitelist = [
		'(sunny)',
		'(rainy)',
		'(snowy)',
		'sunny form',
		'rainy form',
		'snowy form',
		'to encounter',
		'encounters with',
		'such as',
		'might even encounter',
		'including',
		'and more!',
	];
	const blackListedKeywords = [
		'some trainers',
		'the following',
		'appearing',
		'lucky, you m',
		' tms',
		'wild encounters',
		'sunny',
		'event-themed',
		'rainy',
		'snow',
		'partly cloudy',
		'cloudy',
		'windy',
		'fog',
	];

	const cleanedTextes = textes.map((t) =>
		t
			.replace(/when you take on[^!]*!/gi, '')
			.replace(/for battles against[^!]*!/gi, '')
			.replace(/(?:[^\s.!?;:]+\s+){1,3}(?:candy|energy)\b/gi, '')
			.replace(/\s+/g, ' ')
			.trim()
	);

	// Every name fragment keeps what follows it in its text: a Pokémon "wearing" something has its star after the outfit.
	const fragments = cleanedTextes
		.filter(
			(t) =>
				t !== 'All' &&
				(whitelist.some((k) => t.toLocaleLowerCase().includes(k)) ||
					!blackListedKeywords.some((k) => t.toLocaleLowerCase().includes(k)))
		)
		.flatMap((node) => {
			let from = 0;
			return node
				.split(/,|and more|\band\b|might even encounter/)
				.map((piece) => piece.trim())
				.filter(Boolean)
				.map((text) => {
					const at = node.indexOf(text, from);
					if (at >= 0) from = at + text.length;
					return { text, after: at >= 0 ? node.slice(at + text.length) : '' };
				});
		});
	const parsedPokemon = fragments.map((fragment) => fragment.text);

	const results = matcher.matchPokemonFromText(parsedPokemon);

	// An asterisk right after a name marks that Pokémon as the one that can be shiny ("Hoppip*", with a footnote "*If you're
	// lucky, you may encounter a Shiny one!"). Each starred fragment is matched on its own, so the Pokémon is known whatever
	// the other fragments (and the matcher's own de-duplication) do to the list. A section that uses asterisks says it all
	// with them: the Pokémon without one (Bramblin) is not shiny, and no sentence of the section widens that.
	const starred = new Set<string>();
	for (const fragment of fragments) {
		if (!hasStar(fragment)) continue;
		matcher
			.matchPokemonFromText([fragment.text])
			.forEach((entry) => starred.add(entry.speciesId));
	}
	if (starred.size > 0) {
		return results.map((entry) => ({
			...entry,
			shiny: starred.has(entry.speciesId),
		}));
	}

	// No asterisks: a Pokémon can be shiny when a sentence that says "shiny" names it ("Zorua … will still have an increased
	// chance to be Shiny"). "If you're lucky" alone says nothing: it also introduces Special Backgrounds. A remark that is both
	// lucky and shiny but names no Pokémon of the results ("If you're lucky, they may be Shiny!") speaks for the Pokémon of its
	// block.
	const names = new Map(
		results.map(
			(entry) =>
				[entry.speciesId, matcher.plainNameOf(entry.speciesId)] as const
		)
	);
	const mentions = (sentence: string, speciesId: string) => {
		const name = names.get(speciesId);
		return (
			!!name &&
			new RegExp(
				`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
				'i'
			).test(sentence)
		);
	};
	const shinySpecies = new Set<string>();
	const blocks = [...blockParts.values()]
		.map((parts) => parts.join('').replace(/\s+/g, ' ').trim())
		.filter(Boolean);
	for (const block of blocks) {
		const sentences = sentenceRanges(block).map(([start, end]) =>
			block.slice(start, end)
		);
		for (const sentence of sentences) {
			if (!SHINY_WORD.test(sentence)) continue;
			const named = results.filter((entry) =>
				mentions(sentence, entry.speciesId)
			);
			if (named.length > 0)
				named.forEach((entry) => shinySpecies.add(entry.speciesId));
			else if (SHINY_REMARK.test(sentence)) {
				results
					.filter((entry) =>
						sentences.some((other) => mentions(other, entry.speciesId))
					)
					.forEach((entry) => shinySpecies.add(entry.speciesId));
			}
		}
	}
	return results.map((entry) => ({
		...entry,
		shiny: shinySpecies.has(entry.speciesId),
	}));
};

export default PokemonMatcher;
