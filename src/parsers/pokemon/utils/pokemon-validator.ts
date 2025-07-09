import { BasePokemon } from '../../types/pokemon';
import { POKEMON_CONFIG } from '../config/pokemon-config';

/**
 * Utility for validating Pokémon data and tags for use in the Pokémon pipeline.
 * Checks for released, shadow, mega, and tag status.
 */
export class PokemonValidator {
  /**
   * Checks if a Pokémon is valid (released and not blacklisted).
   */
  static isValidPokemon = (pokemon: BasePokemon): boolean => {
    return (
      (pokemon.released || POKEMON_CONFIG.RELEASED_OVERRIDE.has(pokemon.speciesId)) &&
      !POKEMON_CONFIG.BLACKLISTED_SPECIES.has(pokemon.speciesId)
    );
  };

  /**
   * Checks if a Pokémon is a Shadow Pokémon.
   */
  static isShadowPokemon = (pokemon: BasePokemon): boolean => {
    return (
      (pokemon.tags && pokemon.tags.includes('shadow')) ||
      pokemon.speciesName.toLowerCase().includes('(shadow)')
    );
  };

  /**
   * Checks if a Pokémon is a Mega Pokémon.
   */
  static isMegaPokemon = (pokemon: BasePokemon): boolean => {
    return (
      (pokemon.tags && pokemon.tags.includes('mega')) ||
      pokemon.speciesName.toLowerCase().includes('(mega)')
    );
  };

  /**
   * Checks if a Pokémon has a specific tag.
   */
  static hasTag = (pokemon: BasePokemon, tag: string): boolean => {
    return pokemon.tags ? pokemon.tags.includes(tag) : false;
  };
} 