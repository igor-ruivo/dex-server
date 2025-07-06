import { BasePokemon } from '../../types/pokemon';
import { POKEMON_CONFIG } from '../config/pokemon-config';

export class PokemonValidator {
  static isValidPokemon(pokemon: BasePokemon): boolean {
    return (
      (pokemon.released || POKEMON_CONFIG.RELEASED_OVERRIDE.has(pokemon.speciesId)) &&
      !POKEMON_CONFIG.BLACKLISTED_SPECIES.has(pokemon.speciesId)
    );
  }

  static isShadowPokemon(pokemon: BasePokemon): boolean {
    return (
      (pokemon.tags && pokemon.tags.includes('shadow')) ||
      pokemon.speciesName.toLowerCase().includes('(shadow)')
    );
  }

  static isMegaPokemon(pokemon: BasePokemon): boolean {
    return (
      (pokemon.tags && pokemon.tags.includes('mega')) ||
      pokemon.speciesName.toLowerCase().includes('(mega)')
    );
  }

  static hasTag(pokemon: BasePokemon, tag: string): boolean {
    return pokemon.tags ? pokemon.tags.includes(tag) : false;
  }
} 