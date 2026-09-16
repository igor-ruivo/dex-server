import type { GameMasterData, PokemonStats } from '../parsers/types/pokemon';
import type {
	BadIvPattern,
	BestIvLevel,
	BestIvSpreads,
	PerLevelPatterns,
} from '../parsers/types/species-search-metadata';
import { cpm, MAX_LEVEL } from './utils';

/**
 * Verbatim port of go-pokedex's own IV brute force (`computeBestIVs` in
 * `src/utils/pokemon-helper.ts`) — kept byte-for-byte identical (down to the
 * tie-break bookkeeping this module never actually reads) so the tied-top-1
 * extraction below is provably the same computation the client already runs
 * per-species today, not a re-derived approximation of it. Do not "clean up"
 * this function without re-diffing it against the client's copy.
 */

export type IVs = {
	A: number;
	D: number;
	S: number;
	star: number;
};

export type BattleStats = {
	A: number;
	D: number;
	S: number;
};

export type RankEntry = {
	IVs: IVs;
	battle: BattleStats;
	L: number;
	CP: number;
};

export const calculateCP = (
	baseAtk: number,
	atkIV: number,
	baseDef: number,
	defIV: number,
	baseHP: number,
	hpIV: number,
	level: number
) =>
	Math.max(
		10,
		Math.floor(
			((baseAtk + atkIV) *
				Math.sqrt(baseDef + defIV) *
				Math.sqrt(baseHP + hpIV) *
				cpm[level] *
				cpm[level]) /
				10
		)
	);

export const calculateHP = (baseHP: number, hpIV: number, level: number) =>
	Math.max(10, Math.floor((baseHP + hpIV) * cpm[level]));

export const computeBestIVs = (
	baseatk: number,
	basedef: number,
	basesta: number,
	league: number,
	maxLevel: number = MAX_LEVEL
): Record<string, Array<RankEntry>> => {
	const floor = 0;
	let minLvl = 1;
	let maxLvl = maxLevel;

	const ranks: Record<string, Array<RankEntry>> = {};

	const maxAtk = { value: 0, aIV: 0, dIV: 0, sIV: 0, sp: 0 };
	const maxDef = { value: 0, aIV: 0, dIV: 0, sIV: 0, sp: 0 };
	const maxHP = { value: 0, aIV: 0, dIV: 0, sIV: 0, sp: 0 };
	const minAtk = { value: 1000, aIV: 0, dIV: 0, sIV: 0, sp: 0 };
	const minDef = { value: 1000, aIV: 0, dIV: 0, sIV: 0, sp: 0 };
	const minHP = { value: 1000, aIV: 0, dIV: 0, sIV: 0, sp: 0 };
	let minRankLvl = 100;
	let maxRankLvl = 0;
	let numRanks = 0;
	/* account for half-level CPMs (40-1)*2=78 */
	minLvl = Math.max(0, (minLvl - 1) * 2);
	/* use half-levels */
	maxLvl = Math.max(0, (maxLvl - 1) * 2);
	/* use half-levels */
	for (let atk = floor / 1; atk <= 15; atk++) {
		for (let def = floor / 1; def <= 15; def++) {
			for (let sta = floor / 1; sta <= 15; sta++) {
				for (let level = maxLvl; level >= minLvl; level--) {
					const cp = calculateCP(
						baseatk,
						atk,
						basedef,
						def,
						basesta,
						sta,
						level
					);
					if (league && cp > league) {
						continue;
					}
					/* Update maxLvl on first loop (0/0/0 or floor/floor/floor) to optimize performance */
					if (atk === floor / 1 && def === floor / 1 && sta === floor / 1) {
						maxLvl = level;
					}
					const aSt = (baseatk + atk) * cpm[level];
					const dSt = (basedef + def) * cpm[level];
					const sSt = calculateHP(basesta, sta, level);
					const statProd = Math.round(aSt * dSt * sSt);
					/* update maxStats if necessary */
					if (
						maxAtk.value < aSt ||
						(maxAtk.sp < statProd && maxAtk.value <= aSt)
					) {
						maxAtk.value = aSt;
						maxAtk.aIV = atk;
						maxAtk.dIV = def;
						maxAtk.sIV = sta;
						maxAtk.sp = statProd;
					}
					if (
						maxDef.value < dSt ||
						(maxDef.sp < statProd && maxDef.value <= dSt)
					) {
						maxDef.value = dSt;
						maxDef.aIV = atk;
						maxDef.dIV = def;
						maxDef.sIV = sta;
						maxDef.sp = statProd;
					}
					if (
						maxHP.value < sSt ||
						(maxHP.sp < statProd && maxHP.value <= sSt)
					) {
						maxHP.value = sSt;
						maxHP.aIV = atk;
						maxHP.dIV = def;
						maxHP.sIV = sta;
						maxHP.sp = statProd;
					}
					if (level / 1 > maxRankLvl / 1) {
						maxRankLvl = level;
					}
					/* update minStats if necessary */
					if (
						minAtk.value > aSt ||
						(minAtk.sp < statProd && minAtk.value >= aSt)
					) {
						minAtk.value = aSt;
						minAtk.aIV = atk;
						minAtk.dIV = def;
						minAtk.sIV = sta;
						minAtk.sp = statProd;
					}
					if (
						minDef.value > dSt ||
						(minDef.sp < statProd && minDef.value >= dSt)
					) {
						minDef.value = dSt;
						minDef.aIV = atk;
						minDef.dIV = def;
						minDef.sIV = sta;
						minDef.sp = statProd;
					}
					if (
						minHP.value > sSt ||
						(minHP.sp < statProd && minHP.value >= sSt)
					) {
						minHP.value = sSt;
						minHP.aIV = atk;
						minHP.dIV = def;
						minHP.sIV = sta;
						minHP.sp = statProd;
					}
					if (level / 1 < minRankLvl / 1) {
						minRankLvl = level;
					}

					const IVsum = atk / 1 + def / 1 + sta / 1;

					let star = 0;
					if (IVsum < 23) {
						star = 0;
					} else if (IVsum < 30) {
						star = 1;
					} else if (IVsum < 37) {
						star = 2;
					} else if (IVsum < 45) {
						star = 3;
					} else {
						star = 4;
					}

					const levelDisplay = level / 2 + 1;
					/* store as arrays to prevent hash collisions from dropping entires */
					/* Tie Breaking Order: 1)StatProd -> 2)AtkStat -> 3)HPval -> 4)finalCP -> 5)StaIV -> 6)ERROR */
					const newIndex = statProd + '.' + Math.round(100000 * aSt);
					const entry: RankEntry = {
						IVs: { A: atk, D: def, S: sta, star: star },
						battle: { A: aSt, D: dSt, S: sSt },
						L: levelDisplay,
						CP: cp,
					};
					if (!(newIndex in ranks)) {
						ranks[newIndex] = [entry];
					} else {
						let i = 0;
						const arr = ranks[newIndex];
						const arrLen = arr.length;
						for (; i < arrLen; i++) {
							if (sSt > arr[i].battle.S) {
								break;
							} else if (sSt === arr[i].battle.S) {
								if (cp > arr[i].CP) {
									break;
								} else if (cp === arr[i].CP) {
									if (sta > arr[i].IVs.S) {
										break;
									}
								}
							}
						}
						arr.splice(i, 0, entry);
					}
					numRanks = numRanks + 1;
					break;
					/* stop evaluating this IV combination */
				}
			}
		}
	}

	/* sort by statProd+CP before returning */
	const sorted: Record<string, Array<RankEntry>> = {};
	Object.keys(ranks)
		.sort((a: string, b: string) => Number(b) - Number(a))
		.forEach((key: string) => {
			sorted[key] = ranks[key];
		});
	return sorted;
};

/* ---- tied-for-rank-1 extraction — mirrors go-pokedex's own `getBestTied` -- */

/**
 * Every raw IV pattern tied for the single best (rounded) stat product, for
 * one base-stat line at one CP cap and level ceiling — exactly what
 * go-pokedex's `getBestTied` (compute.worker.ts) extracts from
 * `computeBestIVs`'s own output. `computeBestIVs` sorts descending by
 * statProd+CP, so every tie for the top spot is contiguous starting at index
 * 0. Deliberately does NOT apply the 90%-of-cap pre-filter or the
 * `isProtectedByBlanket` business rule `getBestTied`'s caller layers on top —
 * those are policy, not a property of the species' own best spread, and
 * baking them in here would force a data regeneration every time either
 * changes. Returns `[]` only when the cap admits no valid spread at all.
 */
export const tiedTop1Patterns = (
	baseAtk: number,
	baseDef: number,
	baseHp: number,
	cap: number,
	maxLevel: number
): Array<BadIvPattern> => {
	const flat = Object.values(
		computeBestIVs(baseAtk, baseDef, baseHp, cap, maxLevel)
	).flat();
	if (flat.length === 0) return [];
	const topProd = Math.round(
		flat[0].battle.A * flat[0].battle.D * flat[0].battle.S
	);
	const patterns: Array<BadIvPattern> = [];
	for (const entry of flat) {
		if (
			Math.round(entry.battle.A * entry.battle.D * entry.battle.S) !== topProd
		)
			break;
		patterns.push({ A: entry.IVs.A, D: entry.IVs.D, S: entry.IVs.S });
	}
	return patterns;
};

/* ---- purified tied-for-rank-1 — mirrors go-pokedex's `getBestPurifiedTied` */

/** A Best Friend-level purify adds +2 to every one of a Shadow's own raw
 *  IVs, capped at 15 — see the client's own `purify` for the full reasoning
 *  (a Shadow catch's true ceiling is what its raw IVs become once purified,
 *  not their own unpurified stat product). */
const PURIFY_BONUS = 2;
const purify = (iv: number) => Math.min(iv + PURIFY_BONUS, 15);

/**
 * Every RAW (pre-purification) IV pattern whose PURIFIED outcome ties for
 * the single best stat product, for one base-stat line at one CP cap —
 * exactly what go-pokedex's `getBestPurifiedTied` computes via its own
 * from-scratch 16x16x16 loop (purification collapses several raw buckets
 * onto the same purified outcome, so this can't just reuse
 * `tiedTop1Patterns`'s result). `levelIndex` is the half-level CPM index
 * (e.g. `MAX_LEVEL_INDEX`), not a game level — matches the client's own
 * calling convention for this function.
 */
export const tiedTop1PurifiedPatterns = (
	baseAtk: number,
	baseDef: number,
	baseHp: number,
	cap: number,
	levelIndex: number
): Array<BadIvPattern> => {
	let bestProd = -1;
	let patterns: Array<BadIvPattern> = [];
	for (let a = 0; a <= 15; a++) {
		for (let d = 0; d <= 15; d++) {
			for (let s = 0; s <= 15; s++) {
				const pa = purify(a);
				const pd = purify(d);
				const ps = purify(s);
				let level = levelIndex;
				while (
					level >= 0 &&
					calculateCP(baseAtk, pa, baseDef, pd, baseHp, ps, level) > cap
				)
					level--;
				if (level < 0) continue;
				const aSt = (baseAtk + pa) * cpm[level];
				const dSt = (baseDef + pd) * cpm[level];
				const sSt = calculateHP(baseHp, ps, level);
				const prod = Math.round(aSt * dSt * sSt);
				if (prod > bestProd) {
					bestProd = prod;
					patterns = [{ A: a, D: d, S: s }];
				} else if (prod === bestProd) {
					patterns.push({ A: a, D: d, S: s });
				}
			}
		}
	}
	return patterns;
};

/* ---- per-species / whole-dictionary orchestration -------------------------- */

/** `50`/`51` (Best Buddy) — the only two level ceilings any go-pokedex
 *  caller ever evaluates against. Literal (not `MAX_LEVEL + 1`): TS widens
 *  arithmetic on literal types to plain `number`, which `BestIvLevel` (a
 *  50 | 51 union) would then reject. */
export const BEST_IV_LEVELS: ReadonlyArray<BestIvLevel> = [MAX_LEVEL, 51];

/** Great (1500) / Ultra (2500) / Master (uncapped) — the only three CP caps
 *  Mass Delete's bulk sweeps (`findBadIvCarveOuts`, `findTradeableSpeciesData`)
 *  ever evaluate against. */
export const LEAGUE_CAPS = {
	great: 1500,
	ultra: 2500,
	master: Number.MAX_VALUE,
} as const;

export type LeagueKey = keyof typeof LEAGUE_CAPS;

const computeSpreadsAcrossLeaguesAndLevels = (
	stats: PokemonStats,
	compute: (cap: number, level: number) => Array<BadIvPattern>
): BestIvSpreads => {
	const leagues = Object.entries(LEAGUE_CAPS) as Array<[LeagueKey, number]>;
	return Object.fromEntries(
		leagues.map(([league, cap]) => [
			league,
			Object.fromEntries(
				BEST_IV_LEVELS.map((level) => [`level${level}`, compute(cap, level)])
			) as PerLevelPatterns,
		])
	) as BestIvSpreads;
};

/**
 * Every field one non-Shadow species needs for Mass Delete's bulk sweeps —
 * see `tiedTop1Patterns`'s own doc comment for exactly what "best" means
 * here and what's deliberately left out (the CP-threshold/blanket-shape
 * policy, still applied client-side).
 */
export const computeBestIvSpreads = (stats: PokemonStats): BestIvSpreads =>
	computeSpreadsAcrossLeaguesAndLevels(stats, (cap, level) =>
		tiedTop1Patterns(stats.atk, stats.def, stats.hp, cap, level)
	);

/**
 * The Shadow-only counterpart of {@link computeBestIvSpreads}, keyed by
 * game level directly (not a half-level index) for the same reason
 * `computeBestIvSpreads` is: `tiedTop1PurifiedPatterns` itself wants a
 * half-level index, so the level-to-index conversion happens right here,
 * once, rather than leaking into every caller.
 */
export const computeBestIvSpreadsPurified = (
	stats: PokemonStats
): BestIvSpreads =>
	computeSpreadsAcrossLeaguesAndLevels(stats, (cap, level) =>
		tiedTop1PurifiedPatterns(
			stats.atk,
			stats.def,
			stats.hp,
			cap,
			(level - 1) * 2
		)
	);

/** One species' IV-spread half of `SpeciesSearchMetadata` — the other half
 *  (`searchFormId`/`hasShadowCounterpart`) comes from
 *  `form-identifier-calculator.ts`; `species-search-metadata.ts` combines
 *  both into the single record actually written to disk. */
export interface BestIvSpreadFields {
	bestIvSpreads: BestIvSpreads;
	bestIvSpreadsPurified?: BestIvSpreads;
}

/**
 * Every species' `bestIvSpreads` (always) and `bestIvSpreadsPurified`
 * (Shadow forms only — a non-Shadow catch can never purify, so the field
 * would be pure dead weight everywhere else), keyed by speciesId. A pure
 * function of `gameMasterPokemon` — never mutates it.
 */
export const computeBestIvSpreadsForAllSpecies = (
	gameMasterPokemon: GameMasterData
): Record<string, BestIvSpreadFields> => {
	const result: Record<string, BestIvSpreadFields> = {};
	for (const pokemon of Object.values(gameMasterPokemon)) {
		result[pokemon.speciesId] = {
			bestIvSpreads: computeBestIvSpreads(pokemon.baseStats),
			...(pokemon.isShadow
				? {
						bestIvSpreadsPurified: computeBestIvSpreadsPurified(
							pokemon.baseStats
						),
					}
				: {}),
		};
	}
	return result;
};
