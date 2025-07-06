import { GameMasterParser } from '../game-master-parser';
import { DataFetcher } from '../services/data-fetcher';

export class ParserFactory {
  static createGameMasterParser(dataFetcher?: DataFetcher): GameMasterParser {
    return new GameMasterParser(dataFetcher);
  }
} 