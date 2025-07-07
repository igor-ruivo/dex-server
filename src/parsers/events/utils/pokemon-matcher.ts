import { GameMasterPokemon } from '../../../types/pokemon';
import { IEntry } from '../../../types/events';
import { KNOWN_FORMS, RAID_LEVEL_MAPPINGS } from '../config/constants';
import { ndfNormalized, normalizeSpeciesNameForId, normalizePokemonName } from './normalization';

export class PokemonMatcher {
    private gameMasterPokemon: Record<string, GameMasterPokemon>;
    private domain: GameMasterPokemon[];

    constructor(gameMasterPokemon: Record<string, GameMasterPokemon>, domain: GameMasterPokemon[]) {
        this.gameMasterPokemon = gameMasterPokemon;
        this.domain = domain;
    }

    public matchPokemonFromText(texts: string[]): IEntry[] {
        const wildEncounters: IEntry[] = [];
        const seen = new Set<string>();

        const pkmwithNoClothes = texts.map(pp => {
            const idx = pp.indexOf(" wearing");
            if (idx !== -1) {
                return pp.substring(0, idx);
            }
            return pp;
        });

        let raidLevel = "";
        
        for (let j = 0; j < pkmwithNoClothes.length; j++) {
            let isShadow = false;
            let isMega = false;
            let currP = ndfNormalized(normalizePokemonName(pkmwithNoClothes[j])).trim();

            if (currP.toLocaleLowerCase().includes(' candy') || currP.toLocaleLowerCase().includes('dynamax')) {
                continue;
            }

            const raidLIndex = currP.indexOf(" raids");
            if (raidLIndex !== -1) {
                raidLevel = currP.substring(0, raidLIndex);
                for (const [key, value] of Object.entries(RAID_LEVEL_MAPPINGS)) {
                    raidLevel = raidLevel.replaceAll(key, value);
                }
                continue;
            }

            let words = currP.split(" ");

            if (words.includes("shadow")) {
                isShadow = true;
                words = words.filter(word => word !== "shadow");
            }

            if (words.includes("mega")) {
                isMega = true;
                words = words.filter(word => word !== "mega");
            }

            currP = words.join(" ").trim();

            const match = this.matchPokemon(currP, isShadow, isMega, raidLevel);
            if (match && !seen.has(match.speciesId)) {
                seen.add(match.speciesId);
                wildEncounters.push(match);
            }
        }

        return wildEncounters;
    }

    private matchPokemon(currP: string, isShadow: boolean, isMega: boolean, raidLevel: string): IEntry | null {
        // Direct indexing (90% hits)
        const match = this.gameMasterPokemon[normalizeSpeciesNameForId(currP)];
        if (match && !isShadow && !isMega) {
            return {
                speciesId: match.speciesId,
                shiny: false,
                kind: raidLevel
            };
        }

        // Find base Pokemon name
        const isolatedPkmName = this.domain.filter(domainP => {
            const normalizedDomainPSpeciesName = domainP.speciesName.toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const pattern = new RegExp(`\\b${normalizedDomainPSpeciesName}\\b`, "i");
            return pattern.test(currP);
        });

        if (isolatedPkmName.length === 0) {
            return this.handleFormOnlyPokemon(currP, isShadow, isMega, raidLevel);
        }

        if (isolatedPkmName.length > 1) {
            console.error("Couldn't isolate the base pokémon name of " + currP);
            return null;
        }

        return this.matchPokemonWithForm(isolatedPkmName[0], currP, isShadow, isMega, raidLevel);
    }

    private handleFormOnlyPokemon(currP: string, isShadow: boolean, isMega: boolean, raidLevel: string): IEntry | null {
        const formCandidate = currP
            .replaceAll('(', '')
            .replaceAll(')', '')
            .split(" ")
            .filter(f => Array.from(KNOWN_FORMS).some(e => ndfNormalized(e) === f));

        if (formCandidate.length === 0) {
            return this.handleSpecialCases(currP, isShadow, isMega, raidLevel);
        }

        if (formCandidate.length > 1) {
            console.error("Multiple forms for " + currP);
            return null;
        }

        const form = formCandidate[0];
        const finalResults = this.domain.filter(wd => 
            ndfNormalized(wd.speciesName).includes("(" + form + ")") && 
            wd.isShadow === isShadow && 
            wd.isMega === isMega
        );

        if (finalResults.length === 0) {
            console.error("Couldn't find Form in gamemaster.");
            return null;
        }

        if (finalResults.length === 1) {
            return {
                speciesId: finalResults[0].speciesId,
                shiny: false,
                kind: raidLevel
            };
        }

        // Handle multiple forms (e.g., Oricorio)
        const pkmNameWithoutForm = currP.replaceAll(form, "").trim();
        const ans = this.domain.filter(wff => 
            pkmNameWithoutForm.split(" ").some(s => ndfNormalized(wff.speciesName).includes(s)) && 
            ndfNormalized(wff.speciesName).includes(form) && 
            wff.isShadow === isShadow && 
            wff.isMega === isMega
        );

        if (ans.length === 0) {
            console.error("No match found for " + currP);
            return null;
        }

        if (ans.length === 1) {
            return {
                speciesId: ans[0].speciesId,
                shiny: false,
                kind: raidLevel
            };
        }

        console.error("Multiple matches for " + currP);
        return null;
    }

    private handleSpecialCases(currP: string, isShadow: boolean, isMega: boolean, raidLevel: string): IEntry | null {
        const specialCases: Record<string, string> = {
            'giratina': 'giratina_altered',
            'zacian': 'zacian_hero',
            'zamazenta': 'zamazenta_hero',
            'morpeko': 'morpeko_full_belly',
            'pumpkaboo': 'pumpkaboo_average',
            'gourgeist': 'gourgeist_average'
        };

        for (const [key, value] of Object.entries(specialCases)) {
            if (currP.includes(key)) {
                return {
                    speciesId: value,
                    shiny: false,
                    kind: raidLevel
                };
            }
        }

        console.error("(0) Couldn't map form for " + currP);
        return null;
    }

    private matchPokemonWithForm(basePokemon: GameMasterPokemon, currP: string, isShadow: boolean, isMega: boolean, raidLevel: string): IEntry | null {
        const dex = basePokemon.dex;
        const availableForms = this.getAvailableForms(dex, isShadow, isMega, raidLevel);

        if (availableForms.length === 1) {
            return {
                speciesId: availableForms[0].speciesId,
                shiny: false,
                kind: raidLevel
            };
        }

        // Handle Mega Charizard X/Y
        if ((raidLevel === "Mega" || isMega) && dex === 6) {
            const words = currP.split(" ");
            if (words.includes("x")) {
                return {
                    speciesId: "charizard_mega_x",
                    shiny: false,
                    kind: raidLevel
                };
            }
            if (words.includes("y")) {
                return {
                    speciesId: "charizard_mega_y",
                    shiny: false,
                    kind: raidLevel
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

        const mappedForm = availableForms.filter(af => 
            Array.from(KNOWN_FORMS).some(e => 
                ndfNormalized(af.speciesName).includes(ndfNormalized(e)) && 
                currP.includes(ndfNormalized(e))
            )
        );

        if (mappedForm.length === 0) {
            if (isShadow) {
                const guess = Object.values(this.gameMasterPokemon).filter(g => 
                    !g.aliasId && g.isShadow && dex === g.dex && 
                    !Array.from(KNOWN_FORMS).some(f => ndfNormalized(g.speciesName).includes(ndfNormalized(f)))
                );
                if (guess.length === 1) {
                    return {
                        speciesId: guess[0].speciesId,
                        shiny: false,
                        kind: raidLevel
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
                kind: raidLevel
            };
        }

        console.error("Multiple forms for " + currP);
        return null;
    }

    private getAvailableForms(dex: number, isShadow: boolean, isMega: boolean, raidLevel: string): GameMasterPokemon[] {
        if (raidLevel.toLocaleLowerCase() !== "mega" || !isMega) {
            if (!isShadow) {
                return this.domain.filter(formC => 
                    formC.dex === dex && 
                    formC.isShadow === isShadow && 
                    formC.isMega === isMega
                );
            } else {
                return Object.values(this.gameMasterPokemon).filter(l => 
                    !l.isMega && l.dex === dex && !l.aliasId && l.isShadow
                );
            }
        } else {
            return Object.values(this.gameMasterPokemon).filter(l => 
                l.isMega && l.dex === dex && !l.aliasId && !l.isShadow
            );
        }
    }
}

/**
 * User's algorithm: DFS to collect all text nodes from an array of elements, then parse Pokémon names using the matcher.
 * Returns an array of IEntry (speciesId, shiny, etc.)
 */
export function extractPokemonSpeciesIdsFromElements(elements: Node[], matcher: PokemonMatcher): IEntry[] {
    const textes: string[] = [];
    const stack = [...elements];
    while (stack.length > 0) {
        const node = stack.pop();
        if (!node) continue;
        if (node.nodeType === 1) { // ELEMENT_NODE
            const el = node as Element;
            if (Array.from(el.classList ?? []).includes("ContainerBlock__headline")) {
                continue;
            }
            if (el.childNodes) {
                for (let i = el.childNodes.length - 1; i >= 0; i--) {
                    stack.push(el.childNodes[i]);
                }
            }
        } else if (node.nodeType === 3) { // TEXT_NODE
            const actualText = node.textContent?.trim();
            if (actualText) {
                textes.push(actualText);
            }
        }
    }
    // Filtering and parsing as in user's parseFromString
    const whitelist = ["(sunny)", "(rainy)", "(snowy)", "sunny form", "rainy form", "snowy form"];
    const blackListedKeywords = ["some trainers", "the following", "appearing", "lucky, you m", " tms", "and more", "wild encounters", "sunny", "event-themed", "rainy", "snow", "partly cloudy", "cloudy", "windy", "fog", "will be available"];
    const parsedPokemon = textes.filter(t => t !== "All" && t.split(" ").length <= 10 && (whitelist.some(k => t.toLocaleLowerCase().includes(k)) || !blackListedKeywords.some(k => t.toLocaleLowerCase().includes(k))));

    // Detect shiny phrase in the text
    const shinyPhraseRegex = /if you[’'`]?re lucky[^\n]*shiny/i;
    const shinyByPhrase = textes.some(t => shinyPhraseRegex.test(t));

    // Mark shiny by asterisk or by phrase
    const results = matcher.matchPokemonFromText(parsedPokemon);
    return results.map((entry, idx) => {
        const originalText = parsedPokemon[idx] || '';
        const isAsterisk = /\*$/.test(originalText.trim());
        return {
            ...entry,
            shiny: isAsterisk || shinyByPhrase
        };
    });
} 