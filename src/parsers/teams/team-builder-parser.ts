import { calculateCP } from '../../computations/best-iv-spread-calculator';
import { MAX_LEVEL } from '../../computations/utils';
import { POKEMON_CONFIG } from '../pokemon/config/pokemon-config';
import type { IDataFetcher } from '../services/data-fetcher';
import type { BasePokemon, GameMasterData } from '../types/pokemon';
import type {
	BadIvPattern,
	SpeciesSearchMetadataMap,
} from '../types/species-search-metadata';
import {
	type BestIvs,
	type PvPokeMove,
	TEAM_LEAGUES,
	type TeamBuilderData,
	type TeamBuilderForm,
	type TeamBuilderMove,
	type TeamLeague,
} from '../types/teams';
import { metaGroupUrl, PVPOKE_MOVES_URL } from './config';
import {
	buildSimulatorStatus,
	findChangedSimulatorSources,
	findUnknownMechanics,
} from './simulator-guard';

interface RawGroupEntry {
	speciesId: string;
}

/** Ranked species per league (the keys of each `*-league-pvp.json`). */
export type RankedSpeciesByLeague = Record<TeamLeague, ReadonlyArray<string>>;

/** Great / Ultra / Master League CP caps (Master has none). */
const LEAGUE_CP_CAPS: Record<TeamLeague, number> = {
	great: 1500,
	ultra: 2500,
	master: Number.MAX_VALUE,
};

/**
 * The rank-1 spread to rate a species with, from the tied-for-best (stat product) patterns
 * `species-search-metadata.json` already computes: level-50 only (Best Buddy is ignored, like
 * PvPoke), and on a tie the highest numbers win — Attack first, then Defense, then HP. The level is
 * the highest one at which that spread still fits the league's CP cap.
 */
export const pickBestIvs = (
	patterns: ReadonlyArray<BadIvPattern>,
	baseStats: { atk: number; def: number; hp: number },
	cpCap: number
): BestIvs | undefined => {
	const best = [...patterns].sort(
		(a, b) => b.A - a.A || b.D - a.D || b.S - a.S
	)[0];
	if (!best) return undefined;

	for (let index = (MAX_LEVEL - 1) * 2; index >= 0; index--) {
		if (
			calculateCP(
				baseStats.atk,
				best.A,
				baseStats.def,
				best.D,
				baseStats.hp,
				best.S,
				index
			) <= cpCap
		) {
			return [index / 2 + 1, best.A, best.D, best.S];
		}
	}
	return undefined;
};

/** PvPoke's own move abbreviation: an explicit one, else the initials of the move id's words. */
export const moveAbbreviation = (
	move: Pick<PvPokeMove, 'moveId' | 'abbreviation'>
): string =>
	move.abbreviation ??
	move.moveId
		.split('_')
		.map((word) => word.charAt(0))
		.join('');

const toTeamBuilderMove = (move: PvPokeMove): TeamBuilderMove => {
	const out: TeamBuilderMove = {
		abbreviation: moveAbbreviation(move),
		type: move.type,
		power: move.power,
		energy: move.energy,
		energyGain: move.energyGain,
		cooldown: move.cooldown,
		turns: move.turns,
	};
	if (move.buffs) {
		out.buffs = move.buffs;
		out.buffTarget = move.buffTarget ?? 'self';
		out.buffApplyChance = Number.parseFloat(String(move.buffApplyChance ?? 1));
		if (move.buffsSelf) out.buffsSelf = move.buffsSelf;
		if (move.buffsOpponent) out.buffsOpponent = move.buffsOpponent;
	}
	if (move.category) out.category = move.category;
	if (move.damageMethod) out.damageMethod = move.damageMethod;
	if (move.tags?.length) out.tags = move.tags;
	return out;
};

class TeamBuilderParser {
	constructor(
		private readonly dataFetcher: IDataFetcher,
		private readonly gameMaster: GameMasterData
	) {}

	async parse(
		rankedSpecies: RankedSpeciesByLeague,
		bestIvSpreads: SpeciesSearchMetadataMap
	): Promise<TeamBuilderData> {
		console.log('Fetching PvPoke team-builder sources...');
		const [rawMoves, rawPokemon, groups] = await Promise.all([
			this.dataFetcher.fetchJson<Array<PvPokeMove>>(PVPOKE_MOVES_URL),
			this.dataFetcher.fetchJson<Array<BasePokemon>>(POKEMON_CONFIG.SOURCE_URL),
			Promise.all(
				TEAM_LEAGUES.map((league) =>
					this.dataFetcher.fetchJson<Array<RawGroupEntry>>(metaGroupUrl(league))
				)
			),
		]);

		const simulator = buildSimulatorStatus(
			await findChangedSimulatorSources(this.dataFetcher),
			findUnknownMechanics(rawMoves, rawPokemon)
		);
		if (!simulator.verified) {
			console.warn(
				`PvPoke simulator changed or uses unknown mechanics — Teams threat score is unverified:`,
				simulator
			);
		}

		const moves: Record<string, TeamBuilderMove> = {};
		for (const move of rawMoves) {
			moves[move.moveId] = toTeamBuilderMove(move);
		}

		return {
			...this.buildBuilderData(
				rawPokemon,
				moves,
				groups,
				rankedSpecies,
				bestIvSpreads
			),
			simulator,
		};
	}

	private buildBuilderData(
		rawPokemon: Array<BasePokemon>,
		moves: Record<string, TeamBuilderMove>,
		groups: Array<Array<RawGroupEntry>>,
		rankedSpecies: RankedSpeciesByLeague,
		bestIvSpreads: SpeciesSearchMetadataMap
	): Omit<TeamBuilderData, 'simulator'> {
		const rawById = new Map(rawPokemon.map((p) => [p.speciesId, p]));
		const ivs: TeamBuilderData['ivs'] = {};
		const forms: Record<string, TeamBuilderForm> = {};

		const addIvs = (speciesId: string) => {
			const raw = rawById.get(speciesId);
			if (!raw) {
				throw new Error(
					`Ranked species ${speciesId} is missing from PvPoke's pokemon.json`
				);
			}
			// A Shadow shares its normal form's spreads (same base stats), and a battle-only alternate form
			// (Mimikyu Busted, Morpeko Hangry…) its original form's.
			const source = [
				speciesId,
				this.gameMaster[speciesId]?.nonShadowSpecies,
				raw.originalFormId,
			].find((id) => id && bestIvSpreads[id]?.bestIvSpreads);
			if (!source) {
				throw new Error(
					`No best IV spreads for ${speciesId} in species-search-metadata`
				);
			}
			const spreads = bestIvSpreads[source].bestIvSpreads;

			const entry: TeamBuilderData['ivs'][string] = {};
			for (const league of TEAM_LEAGUES) {
				const picked = pickBestIvs(
					spreads[league].level50,
					raw.baseStats,
					LEAGUE_CP_CAPS[league]
				);
				if (picked) entry[league] = picked;
			}
			ivs[speciesId] = entry;
		};

		for (const league of TEAM_LEAGUES) {
			for (const speciesId of rankedSpecies[league]) {
				if (!ivs[speciesId]) addIvs(speciesId);
			}
		}

		for (const raw of rawPokemon) {
			if (!raw.formChange && !raw.originalFormId && !raw.nativeStatBuffs) {
				continue;
			}
			const form: TeamBuilderForm = {
				speciesId: raw.speciesId,
				baseStats: raw.baseStats,
				types: raw.types,
				fastMoves: raw.fastMoves,
				chargedMoves: raw.chargedMoves,
			};
			if (raw.formChange) form.formChange = raw.formChange;
			if (raw.originalFormId) form.originalFormId = raw.originalFormId;
			if (raw.nativeStatBuffs) form.nativeStatBuffs = raw.nativeStatBuffs;
			forms[raw.speciesId] = form;
			if (!ivs[raw.speciesId]) addIvs(raw.speciesId);
		}

		for (const form of Object.values(forms)) {
			for (const moveId of [...form.fastMoves, ...form.chargedMoves]) {
				if (!moves[moveId]) {
					throw new Error(`Form ${form.speciesId} uses unknown move ${moveId}`);
				}
			}
		}

		return {
			moves,
			ivs,
			forms,
			excludedThreats: rawPokemon
				.filter((p) => p.tags?.includes('teambuilderexclude'))
				.map((p) => p.speciesId),
			meta: Object.fromEntries(
				TEAM_LEAGUES.map((league, i) => [
					league,
					groups[i].map((g) => g.speciesId),
				])
			) as TeamBuilderData['meta'],
		};
	}
}

export default TeamBuilderParser;
