import fs from 'fs/promises';
import path from 'path';

import type { IDataFetcher } from '../services/data-fetcher';
import type {
	BasePvPEntry,
	GameMasterData,
	IGameMasterMove,
	PvPEntry,
	PvPLeagueMetadata,
} from '../types/pokemon';
import {
	getActiveLeagueDefinitions,
	LeagueDefinitions,
	POKEMON_CONFIG,
	type PvPLeagueDefinition,
	type PVPokeFormat,
	PVPokeFormatsUrl,
} from './config/pokemon-config';

export function validatePvPokeFormats(
	formats: ReadonlyArray<PVPokeFormat>,
	definitions = LeagueDefinitions
): void {
	for (const definition of Object.values(definitions)) {
		if (!definition.icon || !definition.rankingFile) {
			throw new Error(
				`PvP league ${definition.id} is missing a required icon or ranking file`
			);
		}
	}
	getActiveLeagueDefinitions(formats, definitions);
}

class PvPParser {
	constructor(
		private readonly dataFetcher: IDataFetcher,
		private readonly gameMasterPokemon: GameMasterData,
		private readonly moves: Record<string, IGameMasterMove>
	) {
		this.activeLeagueDefinitions = {};
	}

	private activeLeagueDefinitions: Record<string, PvPLeagueDefinition>;

	async parse() {
		try {
			const formats =
				await this.dataFetcher.fetchJson<Array<PVPokeFormat>>(PVPokeFormatsUrl);
			validatePvPokeFormats(formats);
			this.activeLeagueDefinitions = getActiveLeagueDefinitions(formats);
			const leagueEntries = await Promise.all(
				Object.entries(this.activeLeagueDefinitions).map(
					async ([leagueKey, definition]) => {
						const sourceJson = await this.dataFetcher.fetchJson<
							Array<BasePvPEntry>
						>(definition.url);
						if (
							!Array.isArray(sourceJson) ||
							sourceJson.length === 0 ||
							sourceJson.some(
								(entry) =>
									!entry.speciesId ||
									!Array.isArray(entry.moveset) ||
									!Array.isArray(entry.scores) ||
									!Array.isArray(entry.matchups) ||
									!Array.isArray(entry.counters)
							)
						) {
							throw new Error(
								`PvPoke ranking ${leagueKey} is missing required ranking data`
							);
						}
						const parsedLeague = await this.parseLeague(leagueKey, sourceJson);
						return [leagueKey, parsedLeague] as [
							string,
							Record<string, PvPEntry>,
						];
					}
				)
			);

			const currentRankings = leagueEntries.reduce(
				(acc, [leagueKey, entries]) => {
					acc[leagueKey] = entries;
					return acc;
				},
				{} as Record<string, Record<string, PvPEntry>>
			);

			return currentRankings;
		} catch (error) {
			console.error('Failed to parse PvP data:', error);
			throw error;
		}
	}

	getLeagueMetadata(): Array<PvPLeagueMetadata> {
		return Object.values(this.activeLeagueDefinitions).map(
			({ id, title, cpCap, icon, format, rankingFile }) => ({
				id,
				title,
				cpCap,
				icon,
				format,
				rankingFile,
			})
		);
	}

	private async parseLeague(
		leagueKey: string,
		pvpEntries: Array<BasePvPEntry>
	) {
		const rankedPokemonDictionary: Record<string, PvPEntry> = {};

		const dataDir = path.join(process.cwd(), 'data');
		const filePath = path.join(
			dataDir,
			this.activeLeagueDefinitions[leagueKey].rankingFile
		);
		let previousRankings: Record<string, PvPEntry> = {};
		try {
			const fileContent = await fs.readFile(filePath, 'utf-8');
			previousRankings = JSON.parse(fileContent) as Record<string, PvPEntry>;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
				throw error;
			}
		}

		// Filter to unique computedIds (no alias duplicates)
		const uniqueEntries: Array<BasePvPEntry> = [];
		const seenIds = new Set<string>();
		for (const entry of pvpEntries) {
			const pokemon = this.gameMasterPokemon[entry.speciesId];
			if (!pokemon) {
				throw new Error(
					`${entry.speciesId} doesn't exist in pokémon game master!`
				);
			}
			const computedId = pokemon.aliasId ?? pokemon.speciesId;
			if (!seenIds.has(computedId)) {
				seenIds.add(computedId);
				uniqueEntries.push(entry);
			}
		}

		uniqueEntries.forEach((entry) => {
			entry.moveset.forEach((move) => {
				const existingMove = this.moves[move];
				if (
					!existingMove &&
					!POKEMON_CONFIG.HIDDEN_POWERS.has(move) &&
					move !== 'none'
				) {
					throw new Error(`${move} doesn't exist in moves game master!`);
				}
			});
		});

		// Compute if any rank has changed using uniqueEntries
		let anyRankChanged = false;
		if (Object.keys(previousRankings).length !== uniqueEntries.length) {
			anyRankChanged = true;
		} else {
			for (let i = 0; i < uniqueEntries.length; i++) {
				const entry = uniqueEntries[i];
				const pokemon = this.gameMasterPokemon[entry.speciesId];
				const computedId = pokemon.aliasId ?? pokemon.speciesId;
				const prevRank = previousRankings[computedId]?.rank;
				const currentRank = i + 1;
				if (!prevRank || prevRank !== currentRank) {
					anyRankChanged = true;
					break;
				}
			}
		}

		if (anyRankChanged) {
			console.warn(`Detected rank changes in ${leagueKey}`);
		} else {
			console.log(`No changes in ranking for ${leagueKey}`);
		}

		uniqueEntries.forEach((entry, index) => {
			const pokemon = this.gameMasterPokemon[entry.speciesId];
			const computedId = pokemon.aliasId ?? pokemon.speciesId;
			const computedRank = index + 1;

			let rankChange = previousRankings[computedId]?.rankChange ?? 0;
			if (previousRankings && anyRankChanged) {
				const prevRank = previousRankings[computedId]?.rank;
				if (prevRank) {
					rankChange = prevRank - computedRank;
				}
			}
			rankedPokemonDictionary[computedId] = {
				speciesId: computedId,
				moveset: entry.moveset,
				lead: entry.scores[0],
				switch: entry.scores[2],
				charger: entry.scores[3],
				closer: entry.scores[1],
				consistency: entry.scores[5],
				attacker: entry.scores[4],
				score: entry.score,
				rank: computedRank,
				rankChange,
				matchups: entry.matchups.map(({ opRating: _, ...rest }) => {
					return rest;
				}),
				counters: entry.counters.map(({ opRating: _, ...rest }) => {
					return rest;
				}),
			};
		});

		return rankedPokemonDictionary;
	}
}

export default PvPParser;
