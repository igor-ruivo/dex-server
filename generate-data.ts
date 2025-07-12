import fs from 'fs/promises';
import path from 'path';
import { GameMasterParser } from './src/parsers/pokemon/game-master-parser';
import { EventsParser } from './src/parsers/events/providers/leekduck/EventsParser';
import { BossesParser } from './src/parsers/events/providers/leekduck/BossesParser';
import { EggsParser } from './src/parsers/events/providers/leekduck/EggsParser';
import { RocketLineupsParser } from './src/parsers/events/providers/leekduck/RocketLineupsParser';
import { IEntry } from './src/parsers/types/events';
import { fetchSeasonData } from './src/parsers/events/providers/pokemongo/SeasonParser';
import { MovesProvider } from './src/parsers/events/providers/pokeminers/MovesProvider';
import GameMasterTranslator from './src/parsers/services/gamemaster-translator';
import { PokemonGoSource } from './src/parsers/events/providers/pokemongo/PokemongoSource';

const generateData = async () => {
  console.log('🚀 Starting Pokemon GO data generation...');
  
  const now = new Date().toISOString();
  
  try {
    // Step 1: Initiate the translator
    const translatorService = new GameMasterTranslator();
    await translatorService.setupGameMasterSources();

    // Step 2: Instantiate the moves provider
    const movesProvider = new MovesProvider(translatorService);
    const moves = await movesProvider.fetchMoves();

    // Step 3: Parse Game Master data first
    const gameMasterParser = new GameMasterParser();
    const pokemonDictionary = await gameMasterParser.parse(moves);
    
    // Step 4: Generate events
    const source = new PokemonGoSource();
    const events = await source.parseEvents(pokemonDictionary);

    // Step 5: Generate season data
    const seasonDomain = Object.values(pokemonDictionary).filter(p => !p.isShadow && !p.isMega && !p.aliasId);
    const seasonData = await fetchSeasonData(pokemonDictionary, seasonDomain);
    
    // Step 6: LeekDuck integration
    const leekduckEventsParser = new EventsParser();
    const leekduckEvents = await leekduckEventsParser.parse(pokemonDictionary);
throw new Error('');
    const leekduckBossesParser = new BossesParser();
    const leekduckBossEntries: IEntry[] = await leekduckBossesParser.parse(pokemonDictionary);
    
    const leekduckEggsParser = new EggsParser();
    const leekduckEggEntries = await leekduckEggsParser.parse(pokemonDictionary);

    const leekduckRocketLineupsParser = new RocketLineupsParser();
    const leekduckRocketLineups = await leekduckRocketLineupsParser.parse(pokemonDictionary, translatorService);

    // Write outputs
    const dataDir = path.join(process.cwd(), 'data');
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(path.join(dataDir, 'spotlight-hours.json'), JSON.stringify(leekduckEvents.spotlightHours, null, 2));
    await fs.writeFile(path.join(dataDir, 'leekduck-special-raid-bosses.json'), JSON.stringify(leekduckEvents.specialRaidBosses, null, 2));
    await fs.writeFile(path.join(dataDir, 'leekduck-raid-bosses.json'), JSON.stringify(leekduckBossEntries, null, 2));
    await fs.writeFile(path.join(dataDir, 'leekduck-eggs.json'), JSON.stringify(leekduckEggEntries, null, 2));
    await fs.writeFile(path.join(dataDir, 'rocket-lineups.json'), JSON.stringify(leekduckRocketLineups, null, 2));
    await fs.writeFile(path.join(dataDir, 'events.json'), JSON.stringify(events, null, 2));
    await fs.writeFile(path.join(dataDir, 'game-master.json'), JSON.stringify(pokemonDictionary, null, 2));
    await fs.writeFile(path.join(dataDir, 'season.json'), JSON.stringify(seasonData, null, 2));
    await fs.writeFile(path.join(dataDir, 'moves.json'), JSON.stringify(moves, null, 2));
    console.log('✅ All LeekDuck and main data written to disk.');
    console.log('');
    console.log('📁 Generated files:');
    console.log('- data/events.json');
    console.log('- data/spotlight-hours.json');
    console.log('- data/leekduck-special-raid-bosses.json');
    console.log('- data/leekduck-raid-bosses.json');
    console.log('- data/leekduck-eggs.json');
    console.log('- data/rocket-lineups.json');
    console.log('- data/game-master.json');
    console.log('- data/season.json');
    console.log('- data/moves.json');
    console.log('');
    console.log(`⏰ Last updated: ${now}`);
    console.log(`�� Pokemon parsed: ${Object.keys(pokemonDictionary).length}`);
    console.log('');
    console.log('💡 Note: These files will be committed by GitHub Actions');
  } catch (error) {
    console.error('❌ Data generation failed:', error);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  generateData();
}

export { generateData };