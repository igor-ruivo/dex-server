import { PokemonForms,PokemonTypes } from '../../types/pokemon';
import { POKEMON_CONFIG } from '../config/pokemon-config';

/**
 * Utility for transforming, cleaning, and extracting information from Pokémon data.
 * Used in the Pokémon pipeline for type, move, and form normalization.
 */
export class PokemonTransformer {
  /**
   * Transforms an array of type strings into PokemonTypes enums, filtering out 'none'.
   */
  static transformTypes = (types: Array<string>): Array<PokemonTypes> => {
    return types
      .filter(type => type !== 'none')
      .map(type => {
        const typeName = type.charAt(0).toUpperCase() + type.slice(1);
        return PokemonTypes[typeName as keyof typeof PokemonTypes];
      })
      .filter(type => type !== undefined);
  };

  /**
   * Cleans a list of moves, replacing all hidden powers with 'HIDDEN_POWER' if present.
   */
  static cleanMoves = (moves: Array<string>): Array<string> => {
    if (!moves) return [];
    
    const hasHiddenPower = moves.some(move => POKEMON_CONFIG.HIDDEN_POWERS.has(move));
    if (hasHiddenPower) {
      return [...moves.filter(move => !POKEMON_CONFIG.HIDDEN_POWERS.has(move)), 'HIDDEN_POWER'];
    }
    
    return moves;
  };

  /**
   * Cleans the species name for special cases (e.g., Darmanitan).
   */
  static cleanSpeciesName = (name: string): string => {
    return name.replaceAll('Darmanitan (Standard)', 'Darmanitan');
  };

  /**
   * Converts 'Male'/'Female' in a name to their respective symbols.
   */
  static sexConverter = (name: string): string => {
    return name
      .replace("Male", "♂")
      .replace("Female", "♀");
  };

  /**
   * Extracts the form from a Pokémon name, if present in parentheses.
   * Logs warnings for multiple forms or missing forms.
   */
  static getForm = (name: string): string => {
    name = name.replaceAll("(Shadow)", "");
    name = name.replaceAll("Shadow", "");
    
    if (name.length - 1 > name.replaceAll("(", "").length) {
      console.error(`Multiple forms for ${name} detected.`);
    }

    const firstParenthesisIdx = name.indexOf("(");
    if (firstParenthesisIdx === -1) {
      return "";
    }

    const form = name.substring(firstParenthesisIdx + 1, name.indexOf(")"));
    if (form === "Jr") {
      return "";
    }

    if (form && !Object.values(PokemonForms).map(f => f.toLowerCase()).includes(form.toLowerCase())) {
      console.log("Missing form for raid detection:" + form);
      console.log(`pokemon id: ${name}`);
    }
    return form;
  };

  /**
   * Returns the GO form string for a given Pokémon name.
   * Uses a mapping object for known forms for maintainability.
   * Falls back to extracting the form from parentheses if not found in the mapping.
   */
  static getGoForm = (pokemonName: string): string => {
    const FORM_MAPPINGS: Record<string, string> = {
      '(Alolan)': 'ALOLA',
      '(Mega X)': 'MEGA_X',
      '(Mega Y)': 'MEGA_Y',
      '(Armored)': 'A',
      '(Paldean)': 'PALDEA',
      '(Sunshine)': 'SUNNY',
      '(10% Forme)': 'TEN_PERCENT',
      '(50% Forme)': 'FIFTY_PERCENT',
      '(Complete Forme)': 'COMPLETE',
      "(Pa'u)": 'PAU',
      '(Pom-Pom)': 'POMPOM',
      '(Dawn Wings)': 'DAWN_WINGS',
      '(Dusk Mane)': 'DUSK_MANE',
      '(Full Belly)': 'FULL_BELLY',
      '(Crowned Sword)': 'CROWNED_SWORD',
      '(Crowned Shield)': 'CROWNED_SHIELD',
      '(Rapid Strike)': 'RAPID_STRIKE',
      '(Single Strike)': 'SINGLE_STRIKE',
    };
    for (const [key, value] of Object.entries(FORM_MAPPINGS)) {
      if (pokemonName.includes(key)) {
        return value;
      }
    }
    // Fallback: extract form from parentheses if present
    if ((pokemonName.length - pokemonName.replaceAll('(', '').length === 1) && 
        !pokemonName.includes('Shadow') && !pokemonName.includes('Jr')) {
      const form = pokemonName.substring(pokemonName.indexOf('(') + 1, pokemonName.indexOf(')'));
      if (form.includes(' ')) {
        console.log('Warning: form for pokémon go asset containing spaces: ' + pokemonName + ' -> form is: ' + form);
      }
      return form.toUpperCase();
    }
    if (pokemonName.includes('(') && !pokemonName.includes('Shadow') && !pokemonName.includes('Jr')) {
      console.log('Missing form conversion for pokémon go asset ' + pokemonName);
    }
    return '';
  };
} 