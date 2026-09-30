import { POKEMON_CONFIG } from '../pokemon/config/pokemon-config';
import type { IDataFetcher } from '../services/data-fetcher';
import type { BasePokemon, GameMasterData } from '../types/pokemon';
import {
	type LeaderboardMember,
	type LeaderboardTeam,
	type PvPokeMove,
	TEAM_LEAGUES,
	type TeamBuilderData,
	type TeamBuilderForm,
	type TeamBuilderMove,
	type TeamLeaderboard,
	type TeamLeague,
} from '../types/teams';
import {
	buildSimulatorStatus,
	findChangedSimulatorSources,
	findUnknownMechanics,
} from './simulator-guard';
import { metaGroupUrl, PVPOKE_MOVES_URL, trainingAnalysisUrl } from './config';

interface RawGroupEntry {
	speciesId: string;
}

interface RawTrainingAnalysis {
	properties: { lastUpdated: string; totalTeams: number };
	teams: Array<{ team: string; teamScore: number; games: number }>;
}

/** Ranked species per league (the keys of each `*-league-pvp.json`). */
export type RankedSpeciesByLeague = Record<TeamLeague, ReadonlyArray<string>>;

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

/**
 * Resolves one training-analysis entry — `"ninetales_shadow E/EB/WBF"` — to
 * concrete move ids. PvPoke writes movesets as move abbreviations, which only
 * mean anything against that species' own move pool (`Ac` is Acid for one
 * species, something else for another), so each abbreviation is looked up
 * inside the species' fast pool (first slot) or charged pool (the rest).
 */
export const resolveLeaderboardMember = (
	entry: string,
	gameMaster: GameMasterData,
	abbreviations: Record<string, string>
): LeaderboardMember => {
	const [rawId, movesetStr] = entry.trim().split(/\s+/);
	const species = gameMaster[rawId];
	if (!species || !movesetStr) {
		throw new Error(
			`Training analysis entry "${entry}" has an unknown species or no moveset`
		);
	}
	const speciesId = species.aliasId ?? species.speciesId;
	const [fastAbbr, ...chargedAbbrs] = movesetStr.split('/');

	const find = (pool: ReadonlyArray<string>, abbr: string, slot: string) => {
		const moveId = pool.find((id) => abbreviations[id] === abbr);
		if (!moveId) {
			throw new Error(
				`Training analysis "${entry}": no ${slot} move of ${speciesId} has abbreviation "${abbr}"`
			);
		}
		return moveId;
	};

	return {
		speciesId,
		moveset: [
			find(species.fastMoves, fastAbbr, 'fast'),
			...chargedAbbrs.map((abbr) =>
				find(species.chargedMoves, abbr, 'charged')
			),
		],
	};
};

export const parseLeaderboardTeam = (
	raw: { team: string; teamScore: number; games: number },
	gameMaster: GameMasterData,
	abbreviations: Record<string, string>
): LeaderboardTeam => ({
	members: raw.team
		.split('|')
		.map((entry) => resolveLeaderboardMember(entry, gameMaster, abbreviations)),
	score: raw.teamScore,
	games: raw.games,
});

class TeamBuilderParser {
	constructor(
		private readonly dataFetcher: IDataFetcher,
		private readonly gameMaster: GameMasterData
	) {}

	async parse(rankedSpecies: RankedSpeciesByLeague): Promise<{
		builder: TeamBuilderData;
		leaderboard: TeamLeaderboard;
	}> {
		console.log('Fetching PvPoke team-builder sources...');
		const [rawMoves, rawPokemon, groups, analyses] = await Promise.all([
			this.dataFetcher.fetchJson<Array<PvPokeMove>>(PVPOKE_MOVES_URL),
			this.dataFetcher.fetchJson<Array<BasePokemon>>(
				POKEMON_CONFIG.SOURCE_URL
			),
			Promise.all(
				TEAM_LEAGUES.map((league) =>
					this.dataFetcher.fetchJson<Array<RawGroupEntry>>(metaGroupUrl(league))
				)
			),
			Promise.all(
				TEAM_LEAGUES.map((league) =>
					this.dataFetcher.fetchJson<RawTrainingAnalysis>(
						trainingAnalysisUrl(league)
					)
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
		const abbreviations: Record<string, string> = {};
		for (const move of rawMoves) {
			moves[move.moveId] = toTeamBuilderMove(move);
			abbreviations[move.moveId] = moves[move.moveId].abbreviation;
		}

		return {
			builder: {
				...this.buildBuilderData(rawPokemon, moves, groups, rankedSpecies),
				simulator,
			},
			leaderboard: this.buildLeaderboard(analyses, abbreviations),
		};
	}

	private buildBuilderData(
		rawPokemon: Array<BasePokemon>,
		moves: Record<string, TeamBuilderMove>,
		groups: Array<Array<RawGroupEntry>>,
		rankedSpecies: RankedSpeciesByLeague
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
			const entry: TeamBuilderData['ivs'][string] = {};
			if (raw.defaultIVs?.cp1500) entry.great = raw.defaultIVs.cp1500;
			if (raw.defaultIVs?.cp2500) entry.ultra = raw.defaultIVs.cp2500;
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

	private buildLeaderboard(
		analyses: Array<RawTrainingAnalysis>,
		abbreviations: Record<string, string>
	): TeamLeaderboard {
		const leagues = {} as TeamLeaderboard['leagues'];
		const dates = new Set<string>();

		TEAM_LEAGUES.forEach((league, i) => {
			const analysis = analyses[i];
			if (!Array.isArray(analysis.teams) || analysis.teams.length === 0) {
				throw new Error(
					`PvPoke training analysis for ${league} league has no teams`
				);
			}
			dates.add(analysis.properties.lastUpdated.replace(/\s+/g, ' ').trim());
			leagues[league] = {
				totalTeams: analysis.properties.totalTeams,
				teams: analysis.teams
					.map((t) => parseLeaderboardTeam(t, this.gameMaster, abbreviations))
					.sort((a, b) => b.score - a.score),
			};
		});

		// PvPoke stamps one date per league file; they're refreshed together, so
		// the newest is what "last updated" should honestly say.
		const lastUpdated = [...dates].sort(
			(a, b) => Date.parse(b) - Date.parse(a)
		)[0];
		return { lastUpdated, leagues };
	}
}

export default TeamBuilderParser;
