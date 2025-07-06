import { httpClient } from './http-client';
import { ParserRegistry } from '../parsers';
import { createChildLogger } from '../utils/logger';
import { getEnabledSources, getSourcesByType } from '../config';
import { 
  AggregatedData, 
  PokemonEvent, 
  RaidBoss, 
  GameMasterPokemon, 
  TeamRocket,
  ProcessingResult 
} from '../types';

const logger = createChildLogger('DataAggregator');

export class DataAggregator {
  async aggregateData(): Promise<AggregatedData> {
    logger.info('Starting data aggregation process');
    const startTime = Date.now();

    try {
      // Fetch and parse events
      const events = await this.fetchEvents();
      
      // Fetch and parse raid bosses
      const raidBosses = await this.fetchRaidBosses();
      
      // Fetch and parse game master data
      const gameMasterData = await this.fetchGameMasterData();
      
      // Fetch and parse team rocket data (placeholder for now)
      const teamRocket: TeamRocket[] = [];

      const aggregatedData: AggregatedData = {
        events,
        raidBosses: {
          current: raidBosses.filter(boss => this.isCurrentRaidBoss(boss)),
          upcoming: raidBosses.filter(boss => !this.isCurrentRaidBoss(boss)),
        },
        teamRocket,
        gameMaster: {
          pokemon: gameMasterData,
          lastUpdated: new Date().toISOString(),
        },
        metadata: {
          lastFetch: new Date().toISOString(),
          version: '1.0.0',
          sources: getEnabledSources().map(source => source.name),
        },
      };

      const processingTime = Date.now() - startTime;
      logger.info(`Data aggregation completed in ${processingTime}ms`);

      return aggregatedData;
    } catch (error) {
      logger.error('Data aggregation failed:', error);
      throw error;
    }
  }

  private async fetchEvents(): Promise<PokemonEvent[]> {
    const eventSources = getSourcesByType('events');
    const events: PokemonEvent[] = [];

    for (const source of eventSources) {
      try {
        logger.debug(`Fetching events from ${source.name}`);
        const rawData = await httpClient.getWithRetry(source.url);
        const parser = ParserRegistry.getParser(source.parser);
        
        if (!parser) {
          logger.warn(`No parser found for ${source.parser}`);
          continue;
        }

        const result = await parser.parse(rawData);
        
        if (result.success && result.data) {
          events.push(...result.data);
          logger.debug(`Successfully parsed ${result.data.length} events from ${source.name}`);
        } else {
          logger.warn(`Failed to parse events from ${source.name}: ${result.error}`);
        }
      } catch (error) {
        logger.error(`Error fetching events from ${source.name}:`, error);
      }
    }

    return this.deduplicateEvents(events);
  }

  private async fetchRaidBosses(): Promise<RaidBoss[]> {
    const raidSources = getSourcesByType('raids');
    const raidBosses: RaidBoss[] = [];

    for (const source of raidSources) {
      try {
        logger.debug(`Fetching raid bosses from ${source.name}`);
        const rawData = await httpClient.getWithRetry(source.url);
        const parser = ParserRegistry.getParser(source.parser);
        
        if (!parser) {
          logger.warn(`No parser found for ${source.parser}`);
          continue;
        }

        const result = await parser.parse(rawData);
        
        if (result.success && result.data) {
          raidBosses.push(...result.data);
          logger.debug(`Successfully parsed ${result.data.length} raid bosses from ${source.name}`);
        } else {
          logger.warn(`Failed to parse raid bosses from ${source.name}: ${result.error}`);
        }
      } catch (error) {
        logger.error(`Error fetching raid bosses from ${source.name}:`, error);
      }
    }

    return this.deduplicateRaidBosses(raidBosses);
  }

  private async fetchGameMasterData(): Promise<GameMasterPokemon[]> {
    const gameMasterSources = getSourcesByType('game-master');
    const allPokemon: GameMasterPokemon[] = [];

    for (const source of gameMasterSources) {
      try {
        logger.debug(`Fetching game master data from ${source.name}`);
        const rawData = await httpClient.getWithRetry(source.url);
        const parser = ParserRegistry.getParser(source.parser);
        
        if (!parser) {
          logger.warn(`No parser found for ${source.parser}`);
          continue;
        }

        const result = await parser.parse(rawData);
        
        if (result.success && result.data) {
          allPokemon.push(...result.data);
          logger.debug(`Successfully parsed ${result.data.length} Pokemon from ${source.name}`);
        } else {
          logger.warn(`Failed to parse game master data from ${source.name}: ${result.error}`);
        }
      } catch (error) {
        logger.error(`Error fetching game master data from ${source.name}:`, error);
      }
    }

    return this.deduplicatePokemon(allPokemon);
  }

  private deduplicateEvents(events: PokemonEvent[]): PokemonEvent[] {
    const seen = new Set<string>();
    return events.filter(event => {
      const key = `${event.title}-${event.type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private deduplicateRaidBosses(raidBosses: RaidBoss[]): RaidBoss[] {
    const seen = new Set<string>();
    return raidBosses.filter(boss => {
      const key = `${boss.name}-${boss.tier}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private deduplicatePokemon(pokemon: GameMasterPokemon[]): GameMasterPokemon[] {
    const seen = new Set<string>();
    return pokemon.filter(p => {
      if (seen.has(p.speciesId)) return false;
      seen.add(p.speciesId);
      return true;
    });
  }

  private isCurrentRaidBoss(boss: RaidBoss): boolean {
    // Simple logic - could be enhanced with date-based filtering
    return boss.tier === '1' || boss.tier === '3' || boss.tier === '5';
  }
} 