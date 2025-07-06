import { PokemonTypes, PokemonForms } from '../../types/pokemon';
import { POKEMON_CONFIG } from '../config/pokemon-config';

export class PokemonTransformer {
  static transformTypes(types: string[]): PokemonTypes[] {
    return types
      .filter(type => type !== 'none')
      .map(type => {
        const typeName = type.charAt(0).toUpperCase() + type.slice(1);
        return PokemonTypes[typeName as keyof typeof PokemonTypes];
      })
      .filter(type => type !== undefined);
  }

  static cleanMoves(moves: string[]): string[] {
    if (!moves) return [];
    
    const hasHiddenPower = moves.some(move => POKEMON_CONFIG.HIDDEN_POWERS.has(move));
    if (hasHiddenPower) {
      return [...moves.filter(move => !POKEMON_CONFIG.HIDDEN_POWERS.has(move)), 'HIDDEN_POWER'];
    }
    
    return moves;
  }

  static cleanSpeciesName(name: string): string {
    return name.replaceAll('Darmanitan (Standard)', 'Darmanitan');
  }

  static sexConverter(name: string): string {
    return name
      .replace("Male", "♂")
      .replace("Female", "♀");
  }

  static getForm(name: string): string {
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
  }

  static getGoForm(pokemonName: string): string {
    if (pokemonName.includes('(Alolan)')) return 'ALOLA';
    if (pokemonName.includes('(Mega X)')) return 'MEGA_X';
    if (pokemonName.includes('(Mega Y)')) return 'MEGA_Y';
    if (pokemonName.includes('(Armored)')) return 'A';
    if (pokemonName.includes('(Paldean)')) return 'PALDEA';
    if (pokemonName.includes('(Sunshine)')) return 'SUNNY';
    if (pokemonName.includes('(10% Forme)')) return 'TEN_PERCENT';
    if (pokemonName.includes('(50% Forme)')) return 'FIFTY_PERCENT';
    if (pokemonName.includes('(Complete Forme)')) return 'COMPLETE';
    if (pokemonName.includes("(Pa'u)")) return 'PAU';
    if (pokemonName.includes('(Pom-Pom)')) return 'POMPOM';
    if (pokemonName.includes('(Dawn Wings)')) return 'DAWN_WINGS';
    if (pokemonName.includes('(Dusk Mane)')) return 'DUSK_MANE';
    if (pokemonName.includes('(Full Belly)')) return 'FULL_BELLY';
    if (pokemonName.includes('(Crowned Sword)')) return 'CROWNED_SWORD';
    if (pokemonName.includes('(Crowned Shield)')) return 'CROWNED_SHIELD';
    if (pokemonName.includes('(Rapid Strike)')) return 'RAPID_STRIKE';
    if (pokemonName.includes('(Single Strike)')) return 'SINGLE_STRIKE';

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
  }
} 