import type {
	GameMasterData,
	GameMasterPokemon,
} from '../parsers/types/pokemon';

/**
 * Precomputes the Mega<->base and Shadow<->non-Shadow relationships directly
 * onto `game-master.json` itself (see the four new fields on
 * `GameMasterPokemon`), so go-pokedex never needs to derive them client-side —
 * no scanning the whole gamemaster to find a match, no `speciesId` string
 * surgery (`.replace('_shadow', '')`, appending `_shadow`, splitting on
 * `_mega`/`_primal`) to guess a relationship that's really just data.
 */

/** A Mega/Primal form's speciesId always encodes its base — e.g.
 *  `charizard_mega_x` / `charizard_mega_y` / `kyogre_primal` — the exact
 *  convention `GameMasterParser`'s own `isNormalPokemonAndHasShadowVersion`
 *  already relies on internally (for the RETURN-move check). Unlike
 *  go-pokedex's old dex-number-based matching, this needs no exceptions list
 *  for a non-Mega form that merely happens to share a dex with one (Galarian
 *  Slowbro/Slowpoke, Armored Mewtwo) — their speciesId never contains
 *  `_mega`/`_primal` at all, so they're never even candidates. */
const MEGA_TERM = '_mega';
const PRIMAL_TERM = '_primal';
const baseIdForMega = (speciesId: string): string =>
	speciesId.split(MEGA_TERM)[0].split(PRIMAL_TERM)[0];

/**
 * Same base matching rule as `isNormalPokemonAndHasShadowVersion` elsewhere
 * in this codebase (dex + exact type set), *plus* an exact `form` match —
 * confirmed necessary against real data: several Legendaries have an
 * alternate forme sharing both dex *and* types with their own default forme
 * (Dialga/Origin, Palkia/Origin, Giratina Altered/Origin, Tornadus/Thundurus/
 * Landorus Incarnate/Therian, Mewtwo/Armored), and only the DEFAULT forme was
 * ever actually released as Shadow — dex+types alone matches both formes to
 * the same one Shadow entry, which is wrong for the alternate. `form` is
 * always identical between a Shadow and its own non-Shadow base (Shadow
 * status never changes it) and always differs for an unrelated alternate
 * forme, so this is an exact disambiguator, not a heuristic.
 */
const findShadowCounterpart = (
	pokemon: GameMasterPokemon,
	gameMasterPokemon: GameMasterData
): GameMasterPokemon | undefined =>
	Object.values(gameMasterPokemon).find(
		(p) =>
			p.speciesId !== pokemon.speciesId &&
			!p.aliasId &&
			p.dex === pokemon.dex &&
			p.isShadow &&
			p.form === pokemon.form &&
			p.types.length === pokemon.types.length &&
			p.types.every((t) => pokemon.types.includes(t))
	);

export const augmentGameMasterWithFamilyRelations = (
	gameMasterPokemon: GameMasterData
): GameMasterData => {
	for (const pokemon of Object.values(gameMasterPokemon)) {
		if (!pokemon.isMega || pokemon.aliasId) continue;
		const baseId = baseIdForMega(pokemon.speciesId);
		const base = gameMasterPokemon[baseId];
		if (!base) continue;
		pokemon.baseSpecies = baseId;
		(base.megaFormsIds ??= []).push(pokemon.speciesId);
	}

	for (const pokemon of Object.values(gameMasterPokemon)) {
		// A Mega form is never itself Shadow-catchable — Shadow-ness is a
		// base-species concept — so it must never match a same-dex/same-type
		// Shadow the way `findShadowCounterpart` would otherwise report (e.g.
		// Mega Charizard Y sharing Charizard's own dex+types).
		if (pokemon.isShadow || pokemon.isMega || pokemon.aliasId) continue;
		const shadow = findShadowCounterpart(pokemon, gameMasterPokemon);
		if (!shadow) continue;
		pokemon.shadowSpecies = shadow.speciesId;
		shadow.nonShadowSpecies = pokemon.speciesId;
	}

	return gameMasterPokemon;
};
