import { BaseParser } from './base-parser';
import { GameMasterPokemon, validateGameMasterPokemon } from '../types';

export class PvpokePokemonParser extends BaseParser {
  protected async parseData(rawData: unknown): Promise<GameMasterPokemon[]> {
    const pokemon: GameMasterPokemon[] = [];
    
    if (!Array.isArray(rawData)) {
      throw new Error('Expected array of PvPoke Pokemon data');
    }

    for (const item of rawData) {
      if (item && typeof item === 'object') {
        const pokemonData = item as Record<string, unknown>;
        
        try {
          const parsedPokemon: GameMasterPokemon = {
            dex: (pokemonData.dex as number) || 0,
            speciesId: (pokemonData.speciesId as string) || '',
            speciesName: (pokemonData.speciesName as string) || this.normalizeSpeciesName((pokemonData.speciesId as string) || ''),
            types: this.extractTypes(pokemonData),
            fastMoves: (pokemonData.fastMoves as string[]) || [],
            chargedMoves: (pokemonData.chargedMoves as string[]) || [],
            stats: {
              atk: ((pokemonData.stats as Record<string, unknown>)?.atk as number) || 0,
              def: ((pokemonData.stats as Record<string, unknown>)?.def as number) || 0,
              hp: ((pokemonData.stats as Record<string, unknown>)?.hp as number) || 0,
            },
            family: (pokemonData.family as string) || undefined,
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

  protected validateData(data: unknown): boolean {
    if (!Array.isArray(data)) return false;
    
    return data.every(pokemon => {
      try {
        validateGameMasterPokemon(pokemon);
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

  private extractTypes(pokemonData: Record<string, unknown>): string[] {
    const types: string[] = [];
    
    if (pokemonData.types && Array.isArray(pokemonData.types)) {
      types.push(...(pokemonData.types as string[]).map((type: string) => type.toLowerCase()));
    }
    
    return types;
  }

  private extractEvolutionBranch(pokemonData: Record<string, unknown>): GameMasterPokemon['evolutionBranch'] {
    if (!pokemonData.evolutionBranch || !Array.isArray(pokemonData.evolutionBranch)) {
      return undefined;
    }
    
    const evolutionBranch = pokemonData.evolutionBranch as Array<Record<string, unknown>>;
    return evolutionBranch.map((evolution) => ({
      evolution: (evolution.evolution as string) || '',
      candyCost: (evolution.candyCost as number) || 0,
      itemCost: (evolution.itemCost as string) || undefined,
    }));
  }
} 