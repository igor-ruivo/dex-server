import { BaseParser } from './base-parser';
import { GameMasterPokemon, GameMasterPokemonSchema } from '../types';

export class PvpokePokemonParser extends BaseParser {
  protected async parseData(rawData: any): Promise<GameMasterPokemon[]> {
    const pokemon: GameMasterPokemon[] = [];
    
    if (!Array.isArray(rawData)) {
      throw new Error('Expected array of PvPoke Pokemon data');
    }

    for (const item of rawData) {
      try {
        const parsedPokemon: GameMasterPokemon = {
          dex: item.dex || 0,
          speciesId: item.speciesId || '',
          speciesName: item.speciesName || this.normalizeSpeciesName(item.speciesId || ''),
          types: this.extractTypes(item),
          fastMoves: item.fastMoves || [],
          chargedMoves: item.chargedMoves || [],
          stats: {
            atk: item.stats?.atk || 0,
            def: item.stats?.def || 0,
            hp: item.stats?.hp || 0,
          },
          family: item.family || undefined,
          evolutionBranch: this.extractEvolutionBranch(item),
        };

        pokemon.push(parsedPokemon);
      } catch (error) {
        // Skip invalid entries
        continue;
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
    
    if (pokemonData.types && Array.isArray(pokemonData.types)) {
      types.push(...pokemonData.types.map((type: string) => type.toLowerCase()));
    }
    
    return types;
  }

  private extractEvolutionBranch(pokemonData: any): GameMasterPokemon['evolutionBranch'] {
    if (!pokemonData.evolutionBranch || !Array.isArray(pokemonData.evolutionBranch)) {
      return undefined;
    }
    
    return pokemonData.evolutionBranch.map((evolution: any) => ({
      evolution: evolution.evolution || '',
      candyCost: evolution.candyCost || 0,
      itemCost: evolution.itemCost || undefined,
    }));
  }
} 