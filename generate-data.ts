import fs from 'fs/promises';
import path from 'path';
import { GameMasterParser, GameMasterData } from './src/parsers/game-master-parser';
import { generateEvents } from './src/parsers/events/generate-events';

interface PokemonEvent {
  title: string;
  description: string;
  type: 'event' | 'community-day' | 'raid-day' | 'go-fest' | 'season';
  startDate?: number;
  endDate?: number;
  dateRanges?: Array<{ start: number; end: number }>;
  imageUrl?: string;
  sourceUrl?: string;
  source?: string;
  categories?: string[];
  wild?: any[];
  raids?: any[];
  eggs?: any[];
  research?: any[];
  incenses?: any[];
  bonuses?: string[];
  isRelevant?: boolean;
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
    // Step 1: Parse Game Master data first
    const gameMasterParser = new GameMasterParser();
    const pokemonDictionary = await gameMasterParser.parse();
    
    // Step 2: Generate events data using the fresh Game Master data
    const eventsData = await generateEvents(pokemonDictionary);
    
    // Step 3: Save Game Master data to disk (after events are generated)
    const dataDir = path.join(process.cwd(), 'data');
    await fs.mkdir(dataDir, { recursive: true });
    const gameMasterPath = path.join(dataDir, 'game-master.json');
    await fs.writeFile(gameMasterPath, JSON.stringify(pokemonDictionary, null, 2));
    console.log(`✅ Game Master data written to: ${gameMasterPath}`);
    
    // Create aggregated data
    const data: AggregatedData = {
      events: eventsData.events.map(event => ({
        title: event.title,
        description: event.subtitle || 'Pokemon GO event',
        type: 'event' as const,
        startDate: event.startDate,
        endDate: event.endDate,
        dateRanges: event.dateRanges,
        imageUrl: event.imageUrl,
        sourceUrl: event.sourceUrl,
        source: event.source,
        categories: event.categories,
        wild: event.wild,
        raids: event.raids,
        eggs: event.eggs,
        research: event.research,
        incenses: event.incenses,
        bonuses: event.bonuses,
        isRelevant: event.isRelevant,
      })),
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
        sources: ['PvPoke Game Master', 'Pokemon GO Live News', 'Dummy Raids Source'],
      },
    };

    // Write main aggregated data file
    const mainDataPath = path.join(dataDir, 'aggregated-data.json');
    await fs.writeFile(mainDataPath, JSON.stringify(data, null, 2));
    console.log(`✅ Main data written to: ${mainDataPath}`);

    // Write remaining individual data files
    const files = [
      { name: 'events.json', data: data.events },
      { name: 'raid-bosses.json', data: data.raidBosses },
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