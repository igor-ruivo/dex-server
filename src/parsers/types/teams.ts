import type { PokemonFormChange } from './pokemon';

/**
 * Shape of the Teams-page dataset dex-server derives from PvPoke:
 * `team-builder.json` (everything go-pokedex's team-rating simulator needs
 * that `game-master.json` and the ranking files don't already carry).
 */

/** The three leagues the Teams view supports — PvPoke's "all Pokémon" cup at 1500 / 2500 / uncapped CP. */
export const TEAM_LEAGUES = ['great', 'ultra', 'master'] as const;
export type TeamLeague = (typeof TEAM_LEAGUES)[number];

/** The key of the rank-1 spreads (`TeamBuilderData.ivs`) for a CP cap: a static league's id, or `cap-<n>` for any other cap. */
export const ivsKeyForCap = (cpCap: number): string =>
	cpCap === 1500
		? 'great'
		: cpCap === 2500
			? 'ultra'
			: cpCap === 10000
				? 'master'
				: `cap-${cpCap}`;

/** A rotating / custom cup the Teams view also covers (from `leagues.json`). */
export interface ExtraTeamLeague {
	id: string;
	cpCap: number;
	/** PvPoke's format name (e.g. `mega`, `retro`), which its meta group files are named after. */
	format: string;
}

/** One raw entry of PvPoke's `gamemaster/moves.json`. */
export interface PvPokeMove {
	moveId: string;
	name: string;
	abbreviation?: string;
	type: string;
	power: number;
	energy: number;
	energyGain: number;
	cooldown: number;
	turns: number;
	buffs?: [number, number];
	buffsSelf?: [number, number];
	buffsOpponent?: [number, number];
	buffTarget?: 'self' | 'opponent' | 'both';
	// PvPoke ships this as a string ("1", "0.5") — normalised to a number below.
	buffApplyChance?: string | number;
	category?: 'fast' | 'charged';
	damageMethod?: string;
	tags?: Array<string>;
	isMegaMove?: boolean;
}

/** A PvP move as the simulator consumes it — PvPoke's own numbers, verbatim. */
export interface TeamBuilderMove {
	abbreviation: string;
	type: string;
	power: number;
	energy: number;
	energyGain: number;
	cooldown: number;
	turns: number;
	buffs?: [number, number];
	buffsSelf?: [number, number];
	buffsOpponent?: [number, number];
	buffTarget?: 'self' | 'opponent' | 'both';
	buffApplyChance?: number;
	category?: 'fast' | 'charged';
	damageMethod?: string;
	tags?: Array<string>;
}

/** `[level, atk IV, def IV, hp IV]` — the rank-1 (best stat product) spread for a league. */
export type BestIvs = [number, number, number, number];

/**
 * Species whose battle stats or moves change mid-fight (Aegislash, Mimikyu,
 * Morpeko, Cramorant). Shipped in full — including the alternate forms
 * themselves — because the simulator has to be able to swap into them and
 * `game-master.json` only carries the forms a player can own.
 */
export interface TeamBuilderForm {
	speciesId: string;
	baseStats: { atk: number; def: number; hp: number };
	types: Array<string>;
	fastMoves: Array<string>;
	chargedMoves: Array<string>;
	formChange?: PokemonFormChange;
	originalFormId?: string;
	nativeStatBuffs?: [number, number];
}

/**
 * Whether go-pokedex's TypeScript port of PvPoke's simulator is known to match
 * PvPoke's current code (see `simulator-guard.ts`). When `verified` is false the
 * threat score may disagree with pvpoke.com and the client says so.
 */
export interface SimulatorStatus {
	verified: boolean;
	/** Upstream simulator source files that differ from the verified versions. */
	changedSources: Array<string>;
	/** Form-change / move mechanics present in PvPoke's data that the port doesn't implement. */
	unknownMechanics: Array<string>;
}

export interface TeamBuilderData {
	simulator: SimulatorStatus;
	/** Every move the simulator can meet, keyed by moveId. */
	moves: Record<string, TeamBuilderMove>;
	/**
	 * The rank-1 IV spread (best stat product at the league's cap, level ≤ 50) per ranked species and
	 * CP cap — what the Teams view rates every Pokémon with. Keyed by `ivsKeyForCap`: `great` / `ultra` / `master` for the
	 * 1500 / 2500 / uncapped caps (a cup at one of those caps shares them), `cap-<n>` for any other cap a rotating
	 * cup uses (e.g. `cap-500` for a Little Cup). Deliberately NOT PvPoke's own default IVs
	 * (which sit a few ranks down, and lower for legendaries): the simulator is IV-agnostic, so it is
	 * fed the best possible spread and the results are the team at its ceiling.
	 */
	ivs: Record<string, Partial<Record<string, BestIvs>>>;
	forms: Record<string, TeamBuilderForm>;
	/** Species PvPoke keeps out of its team-builder threat lists. */
	excludedThreats: Array<string>;
	/** PvPoke's per-league "meta" group — the species its threat ranking favours. */
	meta: Record<string, Array<string>>;
}
