import fs from 'fs/promises';
import path from 'path';

import { IDataFetcher } from '../services/data-fetcher';
import { BasePvPEntry, GameMasterData, IGameMasterMove, PvPEntry } from '../types/pokemon';
import { Leagues, POKEMON_CONFIG } from './config/pokemon-config';

type LeagueKey = keyof typeof Leagues;

class PvPParser {
    constructor(
        private readonly dataFetcher: IDataFetcher,
        private readonly gameMasterPokemon: GameMasterData,
        private readonly moves: Record<string, IGameMasterMove>
    ) {}

    async parse() {
        try {
            const leagueEntries = await Promise.all(
                (Object.keys(Leagues) as Array<LeagueKey>).map(async (leagueKey) => {
                    const url = Leagues[leagueKey];
                    const sourceJson = await this.dataFetcher.fetchJson<Array<BasePvPEntry>>(url);
                    const parsedLeague = await this.parseLeague(leagueKey, sourceJson);
                    return [leagueKey, parsedLeague] as [LeagueKey, Record<string, PvPEntry>];
                })
            );

            const currentRankings = leagueEntries.reduce(
                (acc, [leagueKey, entries]) => {
                    acc[leagueKey] = entries;
                    return acc;
                },
                {} as Record<LeagueKey, Record<string, PvPEntry>>
            );

            return currentRankings;
        } catch (error) {
            console.error('❌ Failed to parse Game Master data:', error);
            throw error;
        }
    }

    private async parseLeague(leagueKey: LeagueKey, pvpEntries: Array<BasePvPEntry>) {
        const rankedPokemonDictionary: Record<string, PvPEntry> = {};

        const dataDir = path.join(process.cwd(), 'data');
        const filePath = path.join(dataDir, `${leagueKey.toLocaleLowerCase()}-league-pvp.json`);
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const previousRankings = JSON.parse(fileContent) as Record<string, PvPEntry>;

        // Filter to unique computedIds (no alias duplicates)
        const uniqueEntries: Array<BasePvPEntry> = [];
        const seenIds = new Set<string>();
        for (const entry of pvpEntries) {
            const pokemon = this.gameMasterPokemon[entry.speciesId];
            const computedId = pokemon.aliasId ?? pokemon.speciesId;
            if (!seenIds.has(computedId)) {
                seenIds.add(computedId);
                uniqueEntries.push(entry);
            }
        }

        uniqueEntries.forEach((entry) => {
            const pokemon = this.gameMasterPokemon[entry.speciesId];
            if (!pokemon) {
                throw new Error(`${entry.speciesId} doesn't exist in pokémon game master!`);
            }

            entry.moveset.forEach((move) => {
                const existingMove = this.moves[move];
                if (!existingMove && !POKEMON_CONFIG.HIDDEN_POWERS.has(move)) {
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
