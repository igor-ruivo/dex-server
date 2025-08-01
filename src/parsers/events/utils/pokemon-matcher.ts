import type { IEntry } from '../../types/events';
import type { GameMasterData, GameMasterPokemon } from '../../types/pokemon';
import {
	ndfNormalized,
	normalizePokemonName,
	normalizeSpeciesNameForId,
} from '../../utils/normalization';
import { KNOWN_FORMS, RAID_LEVEL_MAPPINGS } from '../config/constants';

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
			if (
				currP.toLocaleLowerCase().includes(' candy') ||
				currP.toLocaleLowerCase().includes('dynamax') ||
				currP.toLocaleLowerCase().includes('gigantamax')
			) {
				continue;
			}
			const raidLIndex = currP.indexOf(' raids');
			if (
				raidLIndex !== -1 &&
				!currP.includes('will return to') &&
				!currP.includes('will appear in')
			) {
				console.log(currP);
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
			return this.handleSpecialCases(currP, isShadow, isMega, raidLevel);
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
		console.error('Multiple matches for ' + currP);
		return null;
	}

	/**
	 * Handles special-case Pokémon names that don't match standard forms.
	 */
	private handleSpecialCases(
		currP: string,
		isShadow: boolean,
		isMega: boolean,
		raidLevel: string
	): IEntry | null {
		const specialCases: Record<string, string> = {
			giratina: 'giratina_altered',
			zacian: 'zacian_hero',
			zamazenta: 'zamazenta_hero',
			morpeko: 'morpeko_full_belly',
			pumpkaboo: 'pumpkaboo_average',
			gourgeist: 'gourgeist_average',
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
		console.error("(0) Couldn't map form for " + currP);
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
			console.error("Couldn't map form for " + currP);
			return null;
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
		if (raidLevel.toLocaleLowerCase() !== 'mega' || !isMega) {
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

/**
 * Extracts Pokémon species IDs from a list of HTML elements using a PokemonMatcher.
 */
export const extractPokemonSpeciesIdsFromElements = (
	elements: Array<Node>,
	matcher: PokemonMatcher
): Array<IEntry> => {
	const textes: Array<string> = [];
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
	];
	const blackListedKeywords = [
		'some trainers',
		'the following',
		'appearing',
		'lucky, you m',
		' tms',
		'and more',
		'wild encounters',
		'sunny',
		'event-themed',
		'rainy',
		'snow',
		'partly cloudy',
		'cloudy',
		'windy',
		'fog',
		'will be available',
	];
	const parsedPokemon = textes.filter(
		(t) =>
			t !== 'All' &&
			(whitelist.some((k) => t.toLocaleLowerCase().includes(k)) ||
				!blackListedKeywords.some((k) => t.toLocaleLowerCase().includes(k)))
	);

	// Detect shiny phrase in the text
	const shinyPhraseRegex = /if you[’'`]?re lucky[^\n]*shiny/i;
	const shinyByPhrase = textes.some((t) => shinyPhraseRegex.test(t));

	// Mark shiny by asterisk or by phrase
	const results = matcher.matchPokemonFromText(parsedPokemon);
	return results.map((entry, idx) => {
		const originalText = parsedPokemon[idx] || '';
		const isAsterisk = originalText.trim().endsWith('*');
		return {
			...entry,
			shiny: isAsterisk || shinyByPhrase,
		};
	});
};

export default PokemonMatcher;
