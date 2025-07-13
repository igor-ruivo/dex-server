import { GameMasterPokemon, PokemonTypes } from 'src/parsers/types/pokemon';

class RaidDpsCalculator {
    constructor(private readonly gameMasterPokemon: GameMasterPokemon) {}

    compute() {
        const output = {};

        Object.values(PokemonTypes).forEach((type) => {});
    }
}

export default RaidDpsCalculator;
