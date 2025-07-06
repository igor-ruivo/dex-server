import { PokemonTypes } from '../types/pokemon';

export interface GameMasterPokemon {
  dex: number;
  speciesId: string;
  speciesName: string;
  types: PokemonTypes[];
  imageUrl: string;
  goImageUrl: string;
  shinyGoImageUrl: string;
  atk: number;
  def: number;
  hp: number;
  fastMoves: string[];
  chargedMoves: string[];
  eliteMoves: string[];
  legacyMoves: string[];
  isShadow: boolean;
  isMega: boolean;
  familyId?: string;
  parent?: string;
  evolutions: string[];
  aliasId?: string;
  form: string;
  isLegendary: boolean;
  isMythical: boolean;
  isBeast: boolean;
}

interface PvPokePokemon {
  dex: number;
  speciesName: string;
  speciesId: string;
  baseStats: {
    atk: number;
    def: number;
    hp: number;
  };
  types: string[];
  fastMoves: string[];
  chargedMoves: string[];
  eliteMoves?: string[];
  legacyMoves?: string[];
  tags?: string[];
  family?: {
    id: string;
    parent?: string;
    evolutions?: string[];
  };
  aliasId?: string;
  released: boolean;
}

export interface GameMasterData {
  [speciesId: string]: GameMasterPokemon;
}

export class GameMasterParser {
  private readonly sourceUrl = 'https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/gamemaster/pokemon.json';
  
  // Pokemon that should be included even if not released
  private readonly releasedOverride = new Set([
    'cosmog', 'cosmoem', 'rayquaza_mega', 'typhlosion_hisuian', 'ditto', 'shedinja',
    'annihilape', 'heracross_mega', 'hatenna', 'hattrem', 'hatterene', 'morpeko_full_belly',
    'morpeko_hangry', 'mawile_mega', 'spewpa', 'toxel', 'cursola', 'corsola_galarian',
    'sinistea', 'polteageist', 'sizzlipede', 'centiskorch', 'gossifleur', 'eldegoss',
    'applin', 'flapple', 'appletun', 'dipplin', 'hydrapple', 'tinkatink', 'tinkatuff',
    'tinkaton', 'lilligant_hisuian', 'zorua_hisuian', 'zoroark_hisuian', 'honedge',
    'doublade', 'aegislash_blade', 'aegislash_shield', 'tatsugiri'
  ]);

  // Pokemon that should be excluded
  private readonly blacklistedSpecies = new Set([
    'pikachu_5th_anniversary', 'pikachu_flying', 'pikachu_kariyushi', 'pikachu_libre',
    'pikachu_pop_star', 'pikachu_rock_star', 'pikachu_shaymin', 'pikachu_horizons'
  ]);

  // Hidden power moves that should be consolidated
  private readonly hiddenPowers = new Set([
    'HIDDEN_POWER_BUG', 'HIDDEN_POWER_DARK', 'HIDDEN_POWER_DRAGON', 'HIDDEN_POWER_ELECTRIC',
    'HIDDEN_POWER_FIGHTING', 'HIDDEN_POWER_FIRE', 'HIDDEN_POWER_FLYING', 'HIDDEN_POWER_GHOST',
    'HIDDEN_POWER_GRASS', 'HIDDEN_POWER_GROUND', 'HIDDEN_POWER_ICE', 'HIDDEN_POWER_POISON',
    'HIDDEN_POWER_PSYCHIC', 'HIDDEN_POWER_ROCK', 'HIDDEN_POWER_STEEL', 'HIDDEN_POWER_WATER'
  ]);

  // Image URL builders
  private readonly pokemonBaseUrl = 'https://assets.pokemon.com/assets/cms2/img/pokedex/full/';
  
  // Override mappings for special Pokemon
  private readonly overrideMappings = new Map<string, string>([
    ['slowbro_mega', 'https://assets.pokemon.com/assets/cms2/img/pokedex/full/080_f2.png'],
    ['slowbro_galarian', 'https://assets.pokemon.com/assets/cms2/img/pokedex/full/080_f3.png'],
    ['mewtwo_armored', 'https://i.imgur.com/Vwhh8KW.png'],
    ['castform_sunny', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/10013.png'],
    ['castform_rainy', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/10014.png'],
    ['castform_snowy', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/10015.png'],
    ['rotom_frost', 'https://assets.pokemon.com/assets/cms2/img/pokedex/full/479_f4.png'],
    ['rotom_mow', 'https://assets.pokemon.com/assets/cms2/img/pokedex/full/479_f6.png'],
    ['rotom_wash', 'https://assets.pokemon.com/assets/cms2/img/pokedex/full/479_f3.png'],
    ['darmanitan_galarian_standard', 'https://assets.pokemon.com/assets/cms2/img/pokedex/full/555_f2.png'],
    ['darmanitan_galarian_standard_shadow', 'https://assets.pokemon.com/assets/cms2/img/pokedex/full/555_f2.png'],
    ['darmanitan_standard', 'https://assets.pokemon.com/assets/cms2/img/pokedex/full/555.png'],
    ['darmanitan_standard_shadow', 'https://assets.pokemon.com/assets/cms2/img/pokedex/full/555.png'],
    ['genesect_burn', 'https://assets.pokemon.com/assets/cms2/img/pokedex/full/649.png'],
    ['genesect_chill', 'https://assets.pokemon.com/assets/cms2/img/pokedex/full/649.png'],
    ['genesect_douse', 'https://assets.pokemon.com/assets/cms2/img/pokedex/full/649.png'],
    ['genesect_shock', 'https://assets.pokemon.com/assets/cms2/img/pokedex/full/649.png'],
    ['zygarde_10', 'https://assets.pokemon.com/assets/cms2/img/pokedex/full/718_f2.png'],
    ['zygarde', 'https://assets.pokemon.com/assets/cms2/img/pokedex/full/718.png'],
    ['zygarde_complete', 'https://assets.pokemon.com/assets/cms2/img/pokedex/full/718_f3.png'],
    ['oricorio_pau', 'https://assets.pokemon.com/assets/cms2/img/pokedex/full/741_f3.png'],
    ['oricorio_pom_pom', 'https://assets.pokemon.com/assets/cms2/img/pokedex/full/741_f2.png'],
    ['pumpkaboo_small', 'https://assets.pokemon.com/assets/cms2/img/pokedex/full/710.png'],
    ['necrozma_dawn_wings', 'https://assets.pokemon.com/assets/cms2/img/pokedex/full/800_f3.png'],
    ['necrozma_dusk_mane', 'https://assets.pokemon.com/assets/cms2/img/pokedex/full/800_f2.png'],
    ['kyurem_black', 'https://assets.pokemon.com/assets/cms2/img/pokedex/full/646_f3.png'],
    ['kyurem_white', 'https://assets.pokemon.com/assets/cms2/img/pokedex/full/646_f2.png'],
    ['tauros_blaze', 'https://assets.pokemon.com/assets/cms2/img/pokedex/full/128_f3.png'],
    ['tauros_aqua', 'https://assets.pokemon.com/assets/cms2/img/pokedex/full/128_f4.png'],
    ['urshifu_single_strike', 'https://assets.pokemon.com/assets/cms2/img/pokedex/full/892.png'],
    ['urshifu_rapid_strike', 'https://assets.pokemon.com/assets/cms2/img/pokedex/full/892_f2.png'],
    ['zacian_hero', 'https://assets.pokemon.com/assets/cms2/img/pokedex/full/888.png'],
    ['zacian_crowned_sword', 'https://assets.pokemon.com/assets/cms2/img/pokedex/full/888_f2.png'],
    ['zamazenta_hero', 'https://assets.pokemon.com/assets/cms2/img/pokedex/full/889.png'],
    ['zamazenta_crowned_shield', 'https://assets.pokemon.com/assets/cms2/img/pokedex/full/889_f2.png'],
    ['aegislash_blade', 'https://assets.pokemon.com/assets/cms2/img/pokedex/full/681_f2.png'],
    ['aegislash_shield', 'https://assets.pokemon.com/assets/cms2/img/pokedex/full/681.png']
  ]);

  // GO image override mappings
  private readonly goOverrideMappings = new Map<string, string>([
    ['unown', this.buildGoImageUrlHelper('201', 'UNOWN_F')],
    ['spinda', this.buildGoImageUrlHelper('327', '00')],
    ['kyogre_primal', this.buildGoImageUrlHelper('382', 'PRIMAL')],
    ['groudon_primal', this.buildGoImageUrlHelper('383', 'PRIMAL')],
    ['burmy_plant', this.buildGoImageUrlHelper('412', 'BURMY_PLANT')],
    ['burmy_sandy', this.buildGoImageUrlHelper('412', 'BURMY_SANDY')],
    ['burmy_trash', this.buildGoImageUrlHelper('412', 'BURMY_TRASH')],
    ['wormadam_plant', this.buildGoImageUrlHelper('413', 'WORMADAM_PLANT')],
    ['wormadam_sandy', this.buildGoImageUrlHelper('413', 'WORMADAM_SANDY')],
    ['wormadam_trash', this.buildGoImageUrlHelper('413', 'WORMADAM_TRASH')],
    ['shellos', this.buildGoImageUrlHelper('422', 'WEST_SEA')],
    ['gastrodon', this.buildGoImageUrlHelper('423', 'WEST_SEA')],
    ['basculin', this.buildGoImageUrlHelper('550', 'RED_STRIPED')],
    ['darmanitan_galarian_standard', this.buildGoImageUrlHelper('555', 'GALARIAN_STANDARD')],
    ['darmanitan_galarian_standard_shadow', this.buildGoImageUrlHelper('555', 'GALARIAN_STANDARD')],
    ['darmanitan_standard_shadow', this.buildGoImageUrlHelper('555', 'STANDARD')],
    ['deerling', this.buildGoImageUrlHelper('585', 'SPRING')],
    ['sawsbuck', this.buildGoImageUrlHelper('586', 'SPRING')],
    ['kyurem', this.buildGoImageUrlHelper('646', 'NORMAL')],
    ['genesect', this.buildGoImageUrlHelper('649', 'NORMAL')],
    ['vivillon', this.buildGoImageUrlHelper('666', 'MEADOW')],
    ['flabebe', this.buildGoImageUrlHelper('669', 'RED')],
    ['floette', this.buildGoImageUrlHelper('670', 'RED')],
    ['florges', this.buildGoImageUrlHelper('671', 'RED')],
    ['furfrou', this.buildGoImageUrlHelper('676', 'NATURAL')],
    ['meowstic', this.buildGoImageUrlHelper('678', '')]
  ]);

  // Shiny GO image override mappings
  private readonly shinyGoOverrideMappings = new Map<string, string>([
    ['unown', this.buildShinyGoImageUrlHelper('201', 'UNOWN_F')],
    ['spinda', this.buildShinyGoImageUrlHelper('327', '00')],
    ['kyogre_primal', this.buildShinyGoImageUrlHelper('382', 'PRIMAL')],
    ['groudon_primal', this.buildShinyGoImageUrlHelper('383', 'PRIMAL')],
    ['burmy_plant', this.buildShinyGoImageUrlHelper('412', 'BURMY_PLANT')],
    ['burmy_sandy', this.buildShinyGoImageUrlHelper('412', 'BURMY_SANDY')],
    ['burmy_trash', this.buildShinyGoImageUrlHelper('412', 'BURMY_TRASH')],
    ['wormadam_plant', this.buildShinyGoImageUrlHelper('413', 'WORMADAM_PLANT')],
    ['wormadam_sandy', this.buildShinyGoImageUrlHelper('413', 'WORMADAM_SANDY')],
    ['wormadam_trash', this.buildShinyGoImageUrlHelper('413', 'WORMADAM_TRASH')],
    ['shellos', this.buildShinyGoImageUrlHelper('422', 'WEST_SEA')],
    ['gastrodon', this.buildShinyGoImageUrlHelper('423', 'WEST_SEA')],
    ['basculin', this.buildShinyGoImageUrlHelper('550', 'RED_STRIPED')],
    ['darmanitan_galarian_standard', this.buildShinyGoImageUrlHelper('555', 'GALARIAN_STANDARD')],
    ['darmanitan_galarian_standard_shadow', this.buildShinyGoImageUrlHelper('555', 'GALARIAN_STANDARD')],
    ['darmanitan_standard_shadow', this.buildShinyGoImageUrlHelper('555', 'STANDARD')],
    ['deerling', this.buildShinyGoImageUrlHelper('585', 'SPRING')],
    ['sawsbuck', this.buildShinyGoImageUrlHelper('586', 'SPRING')],
    ['kyurem', this.buildShinyGoImageUrlHelper('646', 'NORMAL')],
    ['genesect', this.buildShinyGoImageUrlHelper('649', 'NORMAL')],
    ['vivillon', this.buildShinyGoImageUrlHelper('666', 'MEADOW')],
    ['flabebe', this.buildShinyGoImageUrlHelper('669', 'RED')],
    ['floette', this.buildShinyGoImageUrlHelper('670', 'RED')],
    ['florges', this.buildShinyGoImageUrlHelper('671', 'RED')],
    ['furfrou', this.buildShinyGoImageUrlHelper('676', 'NATURAL')],
    ['meowstic', this.buildShinyGoImageUrlHelper('678', '')]
  ]);

  // Synthetic Pokemon that need to be added
  private readonly syntheticPokemon: PvPokePokemon[] = [
    {
      dex: 554,
      speciesId: 'darumaka_shadow',
      speciesName: 'Darumaka (Shadow)',
      baseStats: { atk: 153, def: 86, hp: 172 },
      types: ['fire', 'none'],
      fastMoves: ['TACKLE', 'FIRE_FANG'],
      chargedMoves: ['FIRE_PUNCH', 'FLAME_CHARGE'],
      eliteMoves: [],
      legacyMoves: [],
      released: true,
      family: {
        id: 'FAMILY_DARUMAKA',
        evolutions: ['darmanitan_standard_shadow']
      },
      tags: ['shadow']
    }
  ];

  async parse(): Promise<GameMasterData> {
    console.log('🔄 Fetching Pokemon Game Master data...');
    
    try {
      const response = await fetch(this.sourceUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
      }
      
      const rawData = await response.json() as PvPokePokemon[];
      console.log(`📊 Found ${rawData.length} Pokemon in source data`);
      
      // Combine source data with synthetic Pokemon
      const allPokemon = [...rawData, ...this.syntheticPokemon];
      
      const pokemonDictionary = this.transformData(allPokemon);
      console.log(`✅ Successfully parsed ${Object.keys(pokemonDictionary).length} Pokemon`);
      
      return pokemonDictionary;
      
    } catch (error) {
      console.error('❌ Failed to parse Game Master data:', error);
      throw error;
    }
  }

  private transformData(rawData: PvPokePokemon[]): GameMasterData {
    const seenSpecies = new Set<string>();
    const pokemonDictionary: GameMasterData = {};

    // Filter and process Pokemon
    const validPokemon = rawData.filter(pokemon => 
      this.isValidPokemon(pokemon) && !seenSpecies.has(pokemon.speciesId)
    );

    for (const pokemon of validPokemon) {
      seenSpecies.add(pokemon.speciesId);
      
      const transformed = this.transformPokemon(pokemon, rawData);
      if (transformed) {
        pokemonDictionary[pokemon.speciesId] = transformed;
      }
    }

    // Apply manual corrections
    this.applyManualCorrections(pokemonDictionary);

    return pokemonDictionary;
  }

  private isValidPokemon(pokemon: PvPokePokemon): boolean {
    return (
      (pokemon.released || this.releasedOverride.has(pokemon.speciesId)) &&
      !this.blacklistedSpecies.has(pokemon.speciesId)
    );
  }

  private transformPokemon(pokemon: PvPokePokemon, allPokemon: PvPokePokemon[]): GameMasterPokemon | null {
    try {
      const isShadow = this.isShadowPokemon(pokemon);
      const isMega = this.isMegaPokemon(pokemon);
      const goForm = this.getGoForm(pokemon.speciesName);
      
      // Calculate form for image URLs using the original logic
      const idForIndexCalc = pokemon.speciesId.replace('_shadow', '');
      const repeatedDexs = allPokemon.filter(p => 
        this.isValidPokemon(p) && p.dex === pokemon.dex && !this.isShadowPokemon(p) && !p.aliasId
      );
      const currentIndex = repeatedDexs.findIndex(p => p.speciesId === idForIndexCalc);
      if (currentIndex === -1) {
        console.log(`Couldn't find matching species id for ${pokemon.speciesId} (alias: ${pokemon.aliasId})`);
      }
      let imageForm = '';
      if (currentIndex > 0) {
        imageForm = (currentIndex + 1).toString();
      }

      return {
        dex: pokemon.dex,
        speciesId: pokemon.speciesId,
        speciesName: this.sexConverter(this.cleanSpeciesName(pokemon.speciesName)),
        types: this.transformTypes(pokemon.types),
        imageUrl: this.buildImageUrl(pokemon, imageForm),
        goImageUrl: this.buildGoImageUrlForPokemon(pokemon, goForm),
        shinyGoImageUrl: this.buildShinyGoImageUrlForPokemon(pokemon, goForm),
        atk: pokemon.baseStats.atk,
        def: pokemon.baseStats.def,
        hp: pokemon.baseStats.hp,
        fastMoves: this.cleanMoves(pokemon.fastMoves),
        chargedMoves: this.cleanMoves(pokemon.chargedMoves),
        eliteMoves: this.cleanMoves(pokemon.eliteMoves || []),
        legacyMoves: this.cleanMoves(pokemon.legacyMoves || []),
        isShadow,
        isMega,
        familyId: pokemon.family?.id,
        parent: pokemon.speciesId === 'darmanitan_standard_shadow' ? 'darumaka_shadow' : pokemon.family?.parent,
        evolutions: pokemon.family?.evolutions || [],
        aliasId: pokemon.aliasId,
        form: this.getForm(pokemon.speciesName),
        isLegendary: this.hasTag(pokemon, 'legendary'),
        isMythical: this.hasTag(pokemon, 'mythical'),
        isBeast: this.hasTag(pokemon, 'ultrabeast')
      };
    } catch (error) {
      console.warn(`⚠️ Failed to transform Pokemon ${pokemon.speciesId}:`, error);
      return null;
    }
  }

  private isShadowPokemon(pokemon: PvPokePokemon): boolean {
    return (
      (pokemon.tags && pokemon.tags.includes('shadow')) ||
      pokemon.speciesName.toLowerCase().includes('(shadow)')
    );
  }

  private isMegaPokemon(pokemon: PvPokePokemon): boolean {
    return (
      (pokemon.tags && pokemon.tags.includes('mega')) ||
      pokemon.speciesName.toLowerCase().includes('(mega)')
    );
  }

  private hasTag(pokemon: PvPokePokemon, tag: string): boolean {
    return pokemon.tags ? pokemon.tags.includes(tag) : false;
  }

  private transformTypes(types: string[]): PokemonTypes[] {
    return types
      .filter(type => type !== 'none')
      .map(type => {
        const typeName = type.charAt(0).toUpperCase() + type.slice(1);
        return PokemonTypes[typeName as keyof typeof PokemonTypes];
      })
      .filter(type => type !== undefined);
  }

  private cleanMoves(moves: string[]): string[] {
    if (!moves) return [];
    
    const hasHiddenPower = moves.some(move => this.hiddenPowers.has(move));
    if (hasHiddenPower) {
      return [...moves.filter(move => !this.hiddenPowers.has(move)), 'HIDDEN_POWER'];
    }
    
    return moves;
  }

  private cleanSpeciesName(name: string): string {
    return name.replaceAll('Darmanitan (Standard)', 'Darmanitan');
  }

  private sexConverter(name: string): string {
    return name
      .replace("Male", "♂")
      .replace("Female", "♀");
  }

  private getForm(name: string): string {
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

    if (form && !Object.values(PokemonTypes).map(f => f.toLowerCase()).includes(form.toLowerCase())) {
      console.log("Missing form for raid detection:" + form);
      console.log(`pokemon id: ${name}`);
    }
    return form;
  }

  private getGoForm(pokemonName: string): string {
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

  private buildImageUrl(pokemon: PvPokePokemon, form: string): string {
    const dex = pokemon.dex.toString().padStart(3, '0');
    const formSuffix = form ? `_f${form}` : '';
    
    // Check for override mapping
    if (this.overrideMappings.has(pokemon.speciesId)) {
      return this.overrideMappings.get(pokemon.speciesId)!;
    }
    
    return `${this.pokemonBaseUrl}${dex}${formSuffix}.png`;
  }

  private applyManualCorrections(pokemonDictionary: GameMasterData): void {
    // Apply any manual corrections needed
    const gastrodon = pokemonDictionary['gastrodon'];
    if (gastrodon) {
      gastrodon.familyId = 'FAMILY_SHELLOS';
      gastrodon.parent = 'shellos';
    }

    const cursola = pokemonDictionary['cursola'];
    if (cursola) {
      cursola.parent = 'corsola_galarian';
    }

    const corsola = pokemonDictionary['corsola'];
    if (corsola) {
      corsola.familyId = 'FAMILY_CORSOLA';
    }

    const corsolaGalarian = pokemonDictionary['corsola_galarian'];
    if (corsolaGalarian) {
      corsolaGalarian.familyId = 'FAMILY_CORSOLA';
      corsolaGalarian.evolutions = ['cursola'];
    }

    // Handle golisopodsh alias
    const golisopodsh = pokemonDictionary['golisopodsh'];
    if (golisopodsh) {
      golisopodsh.aliasId = 'golisopod';
    }
  }

  private buildGoImageUrlHelper(dex: string, form: string): string {
    const formSuffix = form ? `.f${form}` : '';
    return `${dex}${formSuffix}.icon.png`;
  }

  private buildShinyGoImageUrlHelper(dex: string, form: string): string {
    const formSuffix = form ? `.f${form}` : '';
    return `${dex}${formSuffix}.s.icon.png`;
  }

  private buildGoImageUrlForPokemon(pokemon: PvPokePokemon, goForm: string): string {
    const dex = pokemon.dex.toString();
    
    // Check for override mapping
    if (this.goOverrideMappings.has(pokemon.speciesId)) {
      return this.goOverrideMappings.get(pokemon.speciesId)!;
    }
    
    return this.buildGoImageUrlHelper(dex, goForm);
  }

  private buildShinyGoImageUrlForPokemon(pokemon: PvPokePokemon, goForm: string): string {
    const dex = pokemon.dex.toString();
    
    // Check for override mapping
    if (this.shinyGoOverrideMappings.has(pokemon.speciesId)) {
      return this.shinyGoOverrideMappings.get(pokemon.speciesId)!;
    }
    
    return this.buildShinyGoImageUrlHelper(dex, goForm);
  }
} 