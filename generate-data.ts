import fs from 'fs/promises';
import path from 'path';
import { GameMasterParser } from './src/parsers/pokemon/game-master-parser';
import { generateEvents } from './src/parsers/events/generate-events';
import { fetchSeasonData } from './src/parsers/events/providers/pokemongo/SeasonParser';


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
    const seasonDomain = Object.values(pokemonDictionary).filter(p => !p.isShadow && !p.isMega && !p.aliasId);
    const seasonData = await fetchSeasonData(pokemonDictionary, seasonDomain);
    
    // Step 3: Save Game Master data to disk (after events are generated)
    const dataDir = path.join(process.cwd(), 'data');
    await fs.mkdir(dataDir, { recursive: true });
    const gameMasterPath = path.join(dataDir, 'game-master.json');
    await fs.writeFile(gameMasterPath, JSON.stringify(pokemonDictionary, null, 2));
    console.log(`✅ Game Master data written to: ${gameMasterPath}`);

    // Write season data file
    const seasonPath = path.join(dataDir, 'season.json');
    await fs.writeFile(seasonPath, JSON.stringify(seasonData, null, 2));
    console.log(`✅ Season data written to: ${seasonPath}`);
    

    // Write remaining individual data files
    const files = [
      { name: 'events.json', data: eventsData } ];

    for (const file of files) {
      const filePath = path.join(dataDir, file.name);
      await fs.writeFile(filePath, JSON.stringify(file.data, null, 2));
      console.log(`✅ ${file.name} written to: ${filePath}`);
    }

    console.log('');
    console.log('🎉 Data generation completed successfully!');
    console.log('');
    console.log('📁 Generated files:');
    console.log('- data/events.json');
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