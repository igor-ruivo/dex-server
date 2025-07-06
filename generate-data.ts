import fs from 'fs/promises';
import path from 'path';
import { GameMasterParser, GameMasterData } from './src/parsers/game-master-parser';

interface PokemonEvent {
  title: string;
  description: string;
  type: 'event' | 'community-day' | 'raid-day' | 'go-fest' | 'season';
  featured: boolean;
}

interface RaidBoss {
  name: string;
  tier: '1' | '3' | '5' | 'mega';
  cp: { min: number; max: number };
  shiny: boolean;
}

interface AggregatedData {
  events: PokemonEvent[];
  raidBosses: RaidBoss[];
  gameMaster: {
    pokemon: GameMasterData;
    lastUpdated: string;
  };
  metadata: {
    lastFetch: string;
    version: string;
    sources: string[];
  };
}

async function generateData() {
  console.log('🚀 Starting Pokemon GO data generation...');
  
  const now = new Date().toISOString();
  
  try {
    // Parse Game Master data
    const gameMasterParser = new GameMasterParser();
    const pokemonDictionary = await gameMasterParser.parse();
    
    // Create simple dummy data for other sources
    const data: AggregatedData = {
      events: [
        {
          title: 'Community Day Event',
          description: 'Monthly community day event with featured Pokemon',
          type: 'community-day',
          featured: true,
        },
        {
          title: 'Raid Day Event',
          description: 'Special raid day with exclusive Pokemon',
          type: 'raid-day',
          featured: true,
        },
        {
          title: 'Seasonal Event',
          description: 'Current season event with bonuses',
          type: 'season',
          featured: false,
        },
      ],
      raidBosses: [
        {
          name: 'Charizard',
          tier: '5',
          cp: { min: 2200, max: 2400 },
          shiny: true,
        },
        {
          name: 'Blastoise',
          tier: '5',
          cp: { min: 2100, max: 2300 },
          shiny: false,
        },
        {
          name: 'Venusaur',
          tier: '5',
          cp: { min: 2000, max: 2200 },
          shiny: true,
        },
        {
          name: 'Pikachu',
          tier: '1',
          cp: { min: 300, max: 500 },
          shiny: true,
        },
      ],
      gameMaster: {
        pokemon: pokemonDictionary,
        lastUpdated: now,
      },
      metadata: {
        lastFetch: now,
        version: '1.0.0',
        sources: ['PvPoke Game Master', 'Dummy Events Source', 'Dummy Raids Source'],
      },
    };

    // Create data directory in root (will be committed by GitHub Actions)
    const dataDir = path.join(process.cwd(), 'data');
    await fs.mkdir(dataDir, { recursive: true });
    
    // Write main aggregated data file
    const mainDataPath = path.join(dataDir, 'aggregated-data.json');
    await fs.writeFile(mainDataPath, JSON.stringify(data, null, 2));
    console.log(`✅ Main data written to: ${mainDataPath}`);

    // Write individual data files
    const files = [
      { name: 'events.json', data: data.events },
      { name: 'raid-bosses.json', data: data.raidBosses },
      { name: 'game-master.json', data: pokemonDictionary },
      { name: 'metadata.json', data: data.metadata },
    ];

    for (const file of files) {
      const filePath = path.join(dataDir, file.name);
      await fs.writeFile(filePath, JSON.stringify(file.data, null, 2));
      console.log(`✅ ${file.name} written to: ${filePath}`);
    }

    console.log('');
    console.log('🎉 Data generation completed successfully!');
    console.log('');
    console.log('📁 Generated files:');
    console.log('- data/aggregated-data.json');
    console.log('- data/events.json');
    console.log('- data/raid-bosses.json');
    console.log('- data/game-master.json');
    console.log('- data/metadata.json');
    console.log('');
    console.log(`⏰ Last updated: ${now}`);
    console.log(`📊 Pokemon parsed: ${Object.keys(pokemonDictionary).length}`);
    console.log('');
    console.log('💡 Note: These files will be committed by GitHub Actions');
    
  } catch (error) {
    console.error('❌ Data generation failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  generateData();
}

export { generateData }; 