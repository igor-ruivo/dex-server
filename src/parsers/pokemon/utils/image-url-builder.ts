import { BasePokemon } from '../../../types/pokemon';
import { POKEMON_CONFIG } from '../config/pokemon-config';

export class ImageUrlBuilder {
  static buildImageUrl(pokemon: BasePokemon, form: string): string {
    const dex = pokemon.dex.toString().padStart(3, '0');
    const formSuffix = form ? `_f${form}` : '';
    
    // Check for override mapping
    if (POKEMON_CONFIG.IMAGE_OVERRIDE_MAPPINGS.has(pokemon.speciesId)) {
      return POKEMON_CONFIG.IMAGE_OVERRIDE_MAPPINGS.get(pokemon.speciesId)!;
    }
    
    return `${POKEMON_CONFIG.POKEMON_BASE_URL}${dex}${formSuffix}.png`;
  }

  static buildGoImageUrlHelper(dex: string, form: string): string {
    const formSuffix = form && form.trim() !== '' ? `.f${form}` : '';
    return `${dex}${formSuffix}.icon.png`;
  }

  static buildShinyGoImageUrlHelper(dex: string, form: string): string {
    const formSuffix = form && form.trim() !== '' ? `.f${form}` : '';
    return `${dex}${formSuffix}.s.icon.png`;
  }

  static buildGoImageUrlForPokemon(pokemon: BasePokemon, goForm: string): string {
    const dex = pokemon.dex.toString();
    
    // Check for override mapping
    if (POKEMON_CONFIG.GO_OVERRIDE_MAPPINGS.has(pokemon.speciesId)) {
      return POKEMON_CONFIG.GO_OVERRIDE_MAPPINGS.get(pokemon.speciesId)!;
    }
    
    return this.buildGoImageUrlHelper(dex, goForm);
  }

  static buildShinyGoImageUrlForPokemon(pokemon: BasePokemon, goForm: string): string {
    const dex = pokemon.dex.toString();
    
    // Check for override mapping
    if (POKEMON_CONFIG.SHINY_GO_OVERRIDE_MAPPINGS.has(pokemon.speciesId)) {
      return POKEMON_CONFIG.SHINY_GO_OVERRIDE_MAPPINGS.get(pokemon.speciesId)!;
    }
    
    return this.buildShinyGoImageUrlHelper(dex, goForm);
  }
} 