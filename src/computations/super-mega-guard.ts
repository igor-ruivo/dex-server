import type { GameMasterData } from '../parsers/types/pokemon';
import { calculateCP } from './best-iv-spread-calculator';
import { MAX_LEVEL } from './utils';

/**
 * The highest CP cap any capped league has: Ultra League's. Every cup that isn't uncapped (500, 1500, 2500 CP) is at or below
 * it.
 */
export const HIGHEST_CAPPED_CP = 2500;

/**
 * Super Max Megas (`isSuperMega`) get two more levels (up to 52) in go-pokedex. That only ever matters in an uncapped league:
 * in a capped one, even the lightest build of such a Pokémon (0/0/0 IVs) is over the cap at level 50, so its best spread there
 * sits at a lower level than 50 and the extra levels change nothing. go-pokedex relies on that — it reuses the ordinary
 * level-50 best spreads for them and never ships an IV table for a level ceiling of 52 — so this lists the Super Max Megas for
 * which it would stop being true: those whose 0/0/0 build at level 50 fits under a capped league's cap.
 */
export const findSuperMegasUnderCap = (
	gameMaster: GameMasterData,
	cap: number = HIGHEST_CAPPED_CP
): Array<{ speciesId: string; cp: number }> =>
	Object.values(gameMaster)
		.filter((pokemon) => pokemon.isSuperMega)
		.map((pokemon) => ({
			speciesId: pokemon.speciesId,
			cp: calculateCP(
				pokemon.baseStats.atk,
				0,
				pokemon.baseStats.def,
				0,
				pokemon.baseStats.hp,
				0,
				(MAX_LEVEL - 1) * 2
			),
		}))
		.filter(({ cp }) => cp <= cap);

/** Throws (so the daily run fails and raises the Discord alert) when a Super Max Mega could reach level 50 in a capped league. */
export const assertSuperMegasAlwaysCapBound = (
	gameMaster: GameMasterData,
	cap: number = HIGHEST_CAPPED_CP
): void => {
	const offenders = findSuperMegasUnderCap(gameMaster, cap);
	if (offenders.length === 0) return;
	throw new Error(
		[
			`Super Max Mega Pokémon that fit under a capped league's ${cap} CP at level 50 with 0/0/0 IVs: ${offenders
				.map(({ speciesId, cp }) => `${speciesId} (${cp} CP)`)
				.join(', ')}.`,
			"go-pokedex assumes a Super Max Mega never reaches level 50 in a capped league (so the extra levels only matter in an uncapped one, and the ordinary level-50 best IV spreads serve it). That no longer holds:",
			"it now needs best-IV spreads for a level ceiling of 52 (dex-server's species-search-metadata / team-builder.json) and go-pokedex's Super Max Mega build (superMegaBuild in lib/pvp-sim/team-eval.ts, useOptimalBuild) must stop reusing the level-50 spread.",
		].join(' ')
	);
};
