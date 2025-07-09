import fs from 'fs/promises';
import path from 'path';
import { GameMasterParser } from './src/parsers/pokemon/game-master-parser';
import { generateEvents } from './src/parsers/events/generate-events';
import { EventsParser } from './src/parsers/events/providers/leekduck/EventsParser';
import { BossesParser } from './src/parsers/events/providers/leekduck/BossesParser';
import { EggsParser } from './src/parsers/events/providers/leekduck/EggsParser';
import { RocketLineupsParser } from './src/parsers/events/providers/leekduck/RocketLineupsParser';
import { IRocketGrunt, IEntry, ISpotlightHourEvent, ILeekduckSpecialRaidBossEvent } from './src/parsers/types/events';


const generateData = async () => {
  console.log('🚀 Starting Pokemon GO data generation...');
  
  const now = new Date().toISOString();
  
  try {
    // Step 1: Parse Game Master data first
    const gameMasterParser = new GameMasterParser();
    const pokemonDictionary = await gameMasterParser.parse();
    
    // Step 2: Generate events data using the fresh Game Master data
    const eventsData = await generateEvents(pokemonDictionary);

    // Step 2.5: Generate season data using the fresh Game Master data
    // Reuse the getDomains logic from PokemongoSource
    // const seasonDomain = Object.values(pokemonDictionary).filter(p => !p.isShadow && !p.isMega && !p.aliasId); // Unused, remove to fix linter error
    
    // Step 3: LeekDuck integration
    const leekduckEventsParser = new EventsParser();
    const leekduckBossesParser = new BossesParser();
    const leekduckEggsParser = new EggsParser();
    const leekduckRocketLineupsParser = new RocketLineupsParser();

    // Fetch LeekDuck events (Spotlight Hour and raid events)
    const leekduckEvents = await leekduckEventsParser.parse(pokemonDictionary);

    // Spotlight Hour events
    const leekduckSpotlightEvents: ISpotlightHourEvent[] = leekduckEvents
      .filter(e => e.spotlightPokemons && e.spotlightPokemons.length > 0)
      .map(e => ({
        bonus: e.spotlightBonus || '',
        pokemon: (e.spotlightPokemons || []).map((p: IEntry) => p.speciesId),
        dateStart: e.date,
        dateEnd: e.dateEnd
      }));

    // 5-star, Mega, and Shadow raid bosses as special DTOs
    const leekduckSpecialRaidBossEvents: ILeekduckSpecialRaidBossEvent[] = leekduckEvents
      .filter(e => e.raids && e.raids.length > 0)
      .map(e => ({
        dateStart: e.date,
        dateEnd: e.dateEnd,
        pokemon: e.raids || [],
        title: e.title
      }));

    // Fetch LeekDuck bosses (excluding 5-star and mega)
    const leekduckBossEntries: IEntry[] = await leekduckBossesParser.parse(pokemonDictionary);

    // Fetch LeekDuck eggs
    const leekduckEggEntries: IEntry[] = await leekduckEggsParser.parse(pokemonDictionary);

    // Fetch LeekDuck rocket lineups
    const leekduckRocketLineups: IRocketGrunt[] = await leekduckRocketLineupsParser.parse(pokemonDictionary);

    // Write outputs
    const dataDir = path.join(process.cwd(), 'data');
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(path.join(dataDir, 'spotlight-hours.json'), JSON.stringify(leekduckSpotlightEvents, null, 2));
    await fs.writeFile(path.join(dataDir, 'leekduck-special-raid-bosses.json'), JSON.stringify(leekduckSpecialRaidBossEvents, null, 2));
    await fs.writeFile(path.join(dataDir, 'leekduck-raid-bosses.json'), JSON.stringify(leekduckBossEntries, null, 2));
    await fs.writeFile(path.join(dataDir, 'leekduck-eggs.json'), JSON.stringify(leekduckEggEntries, null, 2));
    await fs.writeFile(path.join(dataDir, 'rocket-lineups.json'), JSON.stringify(leekduckRocketLineups, null, 2));
    await fs.writeFile(path.join(dataDir, 'events.json'), JSON.stringify(eventsData, null, 2));
    await fs.writeFile(path.join(dataDir, 'game-master.json'), JSON.stringify(pokemonDictionary, null, 2));
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
    console.log('');
    console.log(`⏰ Last updated: ${now}`);
    console.log(`📊 Pokemon parsed: ${Object.keys(pokemonDictionary).length}`);
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