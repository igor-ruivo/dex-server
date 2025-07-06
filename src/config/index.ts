import { AppConfig, DataSource } from '../types';

export const config: AppConfig = {
  cronSchedule: '0 6 * * *', // Daily at 6 AM
  outputDir: './public/data',
  maxRetries: 3,
  timeout: 30000, // 30 seconds
  sources: [
    {
      name: 'Pokemon GO Live News',
      url: 'https://pokemongolive.com/news/',
      type: 'events',
      parser: 'pokemonGoLiveParser',
      enabled: true,
      priority: 1,
    },
    {
      name: 'Leek Duck Raid Bosses',
      url: 'https://leekduck.com/boss/',
      type: 'raids',
      parser: 'leekDuckRaidParser',
      enabled: true,
      priority: 1,
    },
    {
      name: 'PokeMiners Game Master',
      url: 'https://raw.githubusercontent.com/PokeMiners/game_masters/master/latest/latest.json',
      type: 'game-master',
      parser: 'pokeMinersGameMasterParser',
      enabled: true,
      priority: 1,
    },
    {
      name: 'PvPoke Pokemon Data',
      url: 'https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/gamemaster/pokemon.json',
      type: 'game-master',
      parser: 'pvpokePokemonParser',
      enabled: true,
      priority: 2,
    },
  ],
};

export const getEnabledSources = (): DataSource[] => {
  return config.sources.filter(source => source.enabled);
};

export const getSourcesByType = (type: DataSource['type']): DataSource[] => {
  return getEnabledSources().filter(source => source.type === type);
}; 