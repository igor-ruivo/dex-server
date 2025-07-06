import { BaseParser } from './base-parser';
import { GameMasterPokemon, validateGameMasterPokemon } from '../types';

export class PokeMinersGameMasterParser extends BaseParser {
  protected async parseData(rawData: unknown): Promise<GameMasterPokemon[]> {
    const pokemon: GameMasterPokemon[] = [];
    
    if (!Array.isArray(rawData)) {
      throw new Error('Expected array of game master data');
    }

    for (const item of rawData) {
      if (item && typeof item === 'object' && 'templateId' in item && 'data' in item) {
        const itemData = item as Record<string, unknown>;
        const pokemonData = itemData.data as Record<string, unknown>;
        
        if (pokemonData && typeof pokemonData === 'object' && 'pokemonSettings' in pokemonData) {
          const settings = pokemonData.pokemonSettings as Record<string, unknown>;
          
          try {
            const parsedPokemon: GameMasterPokemon = {
              dex: (settings.pokedexNumber as number) || 0,
              speciesId: (settings.pokemonId as string) || '',
              speciesName: this.normalizeSpeciesName((settings.pokemonId as string) || ''),
              types: this.extractTypes(settings),
              fastMoves: (settings.quickMoves as string[]) || [],
              chargedMoves: (settings.cinematicMoves as string[]) || [],
              stats: {
                atk: ((settings.stats as Record<string, unknown>)?.baseAttack as number) || 0,
                def: ((settings.stats as Record<string, unknown>)?.baseDefense as number) || 0,
                hp: ((settings.stats as Record<string, unknown>)?.baseStamina as number) || 0,
              },
              family: (settings.familyId as string) || undefined,
              evolutionBranch: this.extractEvolutionBranch(settings),
            };

            pokemon.push(parsedPokemon);
          } catch (error) {
            // Skip invalid entries
            continue;
          }
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
    
    if (pokemonData.type1) {
      types.push((pokemonData.type1 as string).toLowerCase());
    }
    if (pokemonData.type2) {
      types.push((pokemonData.type2 as string).toLowerCase());
    }
    
    return types;
  }

  private extractEvolutionBranch(pokemonData: Record<string, unknown>): GameMasterPokemon['evolutionBranch'] {
    if (!pokemonData.evolutionBranch) return undefined;
    
    const evolutionBranch = pokemonData.evolutionBranch as Array<Record<string, unknown>>;
    return evolutionBranch.map((evolution) => ({
      evolution: (evolution.evolution as string) || '',
      candyCost: (evolution.candyCost as number) || 0,
      itemCost: (evolution.itemCost as string) || undefined,
    }));
  }
} 