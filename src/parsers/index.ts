import { IParser } from './base-parser';
import { PokemonGoLiveParser } from './pokemon-go-live-parser';
import { LeekDuckRaidParser } from './leek-duck-raid-parser';
import { PokeMinersGameMasterParser } from './game-master-parser';
import { PvpokePokemonParser } from './pvpoke-pokemon-parser';

export class ParserRegistry {
  private static parsers: Map<string, IParser> = new Map();

  static {
    this.parsers.set('pokemonGoLiveParser', new PokemonGoLiveParser());
    this.parsers.set('leekDuckRaidParser', new LeekDuckRaidParser());
    this.parsers.set('pokeMinersGameMasterParser', new PokeMinersGameMasterParser());
    this.parsers.set('pvpokePokemonParser', new PvpokePokemonParser());
  }

  static getParser(name: string): IParser | undefined {
    return this.parsers.get(name);
  }

  static registerParser(name: string, parser: IParser): void {
    this.parsers.set(name, parser);
  }

  static getAllParsers(): Map<string, IParser> {
    return new Map(this.parsers);
  }
} 