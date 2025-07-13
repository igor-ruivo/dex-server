import { IDataFetcher } from '../services/data-fetcher';
import { BasePvPEntry, GameMasterPokemon, IGameMasterMove, PvPEntry } from '../types/pokemon';
import { Leagues, POKEMON_CONFIG } from './config/pokemon-config';

type LeagueKey = keyof typeof Leagues;

export class PvPParser {
    constructor(
        private readonly dataFetcher: IDataFetcher,
        private readonly gameMasterPokemon: Record<string, GameMasterPokemon>,
        private readonly moves: Record<string, IGameMasterMove>
    ) {}

    parse = async (): Promise<Record<LeagueKey, Record<string, PvPEntry>>> => {
        try {
            const leagueEntries = await Promise.all(
                (Object.keys(Leagues) as Array<LeagueKey>).map(async (leagueKey) => {
                    const url = Leagues[leagueKey];
                    const sourceJson = await this.dataFetcher.fetchJson<Array<BasePvPEntry>>(url);
                    const parsedLeague = this.parseLeague(sourceJson);
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
    };

    private parseLeague = (pvpEntries: Array<BasePvPEntry>): Record<string, PvPEntry> => {
        const rankedPokemonDictionary: Record<string, PvPEntry> = {};
        const observedPokemon = new Set<string>();

        pvpEntries.forEach((entry) => {
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

        pvpEntries
            .filter((entry) => {
                const pokemon = this.gameMasterPokemon[entry.speciesId];
                const computedId = pokemon.aliasId ?? pokemon.speciesId;
                if (observedPokemon.has(computedId)) {
                    return false;
                } else {
                    observedPokemon.add(computedId);
                    return true;
                }
            })
            .forEach((entry, index) => {
                const pokemon = this.gameMasterPokemon[entry.speciesId];
                const computedId = pokemon.aliasId ?? pokemon.speciesId;
                const computedRank = index + 1;

                const parsedRankChange = 0; //TODO -> read file from disk, parse/load, check same speciesId in there and calc the rank delta (should only do it if file exists and it's metadata is recent (<24h))
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
                    rankChange: parsedRankChange,
                    matchups: entry.matchups.map(({ opRating: _, ...rest }) => {
                        return rest;
                    }),
                    counters: entry.counters.map(({ opRating: _, ...rest }) => {
                        return rest;
                    }),
                };
            });

        return rankedPokemonDictionary;
    };
}

export type { GameMasterData } from '../types/pokemon';
