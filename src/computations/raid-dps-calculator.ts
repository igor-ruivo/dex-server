import { GameMasterData, IGameMasterMove, PokemonTypes } from 'src/parsers/types/pokemon';

import { computeDPSEntry, DPSEntry, getAllChargedMoves } from './utils';

type ComputedDpsRank = DPSEntry & {
    rank: number;
};

class RaidDpsCalculator {
    constructor(
        private readonly gameMasterPokemon: GameMasterData,
        private readonly moves: Record<string, IGameMasterMove>
    ) {}

    compute() {
        const output: Record<string, Record<string, ComputedDpsRank>> = {};

        ['', ...Object.values(PokemonTypes)]
            .map((type) => type.toLocaleLowerCase())
            .forEach((type) => {
                const pokemonEntries = Object.values(this.gameMasterPokemon)
                    .filter(
                        (p) =>
                            !p.aliasId &&
                            (!type || getAllChargedMoves(p, this.moves).some((m) => this.moves[m].type === type))
                    )
                    .map((p) => computeDPSEntry(p, this.moves, 15, 100, type));

                pokemonEntries.sort((a, b) => {
                    if (b.dps !== a.dps) {
                        return b.dps - a.dps;
                    }

                    return a.speciesId.localeCompare(b.speciesId);
                });

                const parsedEntries: Record<string, ComputedDpsRank> = {};
                pokemonEntries.forEach((k, i) => {
                    parsedEntries[k.speciesId] = { ...k, rank: i + 1 };
                });

                output[type] = parsedEntries;
            });

        return output;
    }
}

export default RaidDpsCalculator;
