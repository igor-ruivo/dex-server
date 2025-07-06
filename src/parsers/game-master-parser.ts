import { BaseParser } from './base-parser';
import { GameMasterPokemon, GameMasterPokemonSchema } from '../types';

export class PokeMinersGameMasterParser extends BaseParser {
  protected async parseData(rawData: any): Promise<GameMasterPokemon[]> {
    const pokemon: GameMasterPokemon[] = [];
    
    if (!Array.isArray(rawData)) {
      throw new Error('Expected array of game master data');
    }

    for (const item of rawData) {
      if (item.templateId && item.data && item.data.pokemonSettings) {
        const pokemonData = item.data.pokemonSettings;
        
        try {
          const parsedPokemon: GameMasterPokemon = {
            dex: pokemonData.pokedexNumber || 0,
            speciesId: pokemonData.pokemonId || '',
            speciesName: this.normalizeSpeciesName(pokemonData.pokemonId || ''),
            types: this.extractTypes(pokemonData),
            fastMoves: pokemonData.quickMoves || [],
            chargedMoves: pokemonData.cinematicMoves || [],
            stats: {
              atk: pokemonData.stats?.baseAttack || 0,
              def: pokemonData.stats?.baseDefense || 0,
              hp: pokemonData.stats?.baseStamina || 0,
            },
            family: pokemonData.familyId || undefined,
            evolutionBranch: this.extractEvolutionBranch(pokemonData),
          };

          pokemon.push(parsedPokemon);
        } catch (error) {
          // Skip invalid entries
          continue;
        }
      }
    }

    return pokemon;
  }

  protected validateData(data: any): boolean {
    if (!Array.isArray(data)) return false;
    
    return data.every(pokemon => {
      try {
        GameMasterPokemonSchema.parse(pokemon);
        return true;
      } catch {
        return false;
      }
    });
  }

  private normalizeSpeciesName(speciesId: string): string {
    return speciesId
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  private extractTypes(pokemonData: any): string[] {
    const types: string[] = [];
    
    if (pokemonData.type1) {
      types.push(pokemonData.type1.toLowerCase());
    }
    if (pokemonData.type2) {
      types.push(pokemonData.type2.toLowerCase());
    }
    
    return types;
  }

  private extractEvolutionBranch(pokemonData: any): GameMasterPokemon['evolutionBranch'] {
    if (!pokemonData.evolutionBranch) return undefined;
    
    return pokemonData.evolutionBranch.map((evolution: any) => ({
      evolution: evolution.evolution || '',
      candyCost: evolution.candyCost || 0,
      itemCost: evolution.itemCost || undefined,
    }));
  }
} 