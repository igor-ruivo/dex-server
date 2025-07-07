import fs from 'fs/promises';
import path from 'path';
import { PokemonGoSource } from './sources/pokemongo-source';
import { GameMasterParser } from '../game-master-parser';

interface EventsData {
  events: any[];
  metadata: {
    lastFetch: string;
    version: string;
    sources: string[];
    totalEvents: number;
    totalBonuses: number;
    totalPokemon: number;
    uniquePokemon: number;
  };
}

async function generateEvents() {
  console.log('🔄 Starting Pokemon GO events generation...');
  
  const now = new Date().toISOString();
  
  try {
    // Load game master data
    console.log('📊 Loading game master data...');
    const gameMasterParser = new GameMasterParser();
    const gameMasterData = await gameMasterParser.parse();
    
    // Parse all events
    console.log('📰 Fetching and parsing Pokemon GO events...');
    const source = new PokemonGoSource();
    const events = await source.parseEvents('', gameMasterData);
    
    // Calculate statistics
    const totalBonuses = events.reduce((sum, event) => sum + (event.bonuses?.length || 0), 0);
    const allPokemon = events.flatMap(event => [
      ...(event.wild || []),
      ...(event.raids || []),
      ...(event.eggs || []),
      ...(event.research || []),
      ...(event.incenses || [])
    ]);
    const uniquePokemon = new Set(allPokemon.map(p => p.speciesId));
    
    // Remove any raw HTML or originalPost fields from events
    const publicEvents = events.map(event => {
      // Remove any html fields at the top level if present
      const eventCopy = { ...event };
      if ('html' in eventCopy) {
        delete (eventCopy as any).html;
      }
      return eventCopy;
    });

    const eventsData: EventsData = {
      events: publicEvents,
      metadata: {
        lastFetch: now,
        version: '1.0.0',
        sources: ['Pokemon GO Live News'],
        totalEvents: publicEvents.length,
        totalBonuses,
        totalPokemon: allPokemon.length,
        uniquePokemon: uniquePokemon.size
      }
    };

    // Create data directory
    const dataDir = path.join(process.cwd(), 'data');
    await fs.mkdir(dataDir, { recursive: true });
    
    // Write events data file
    const eventsPath = path.join(dataDir, 'events.json');
    await fs.writeFile(eventsPath, JSON.stringify(eventsData, null, 2));
    
    console.log(`✅ Events data written to: ${eventsPath}`);
    console.log('');
    console.log('📊 Events Generation Summary:');
    console.log(`- Total events: ${events.length}`);
    console.log(`- Total bonuses: ${totalBonuses}`);
    console.log(`- Total Pokémon: ${allPokemon.length}`);
    console.log(`- Unique Pokémon: ${uniquePokemon.size}`);
    console.log(`- Last updated: ${now}`);
    
    return eventsData;
    
  } catch (error) {
    console.error('❌ Events generation failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  generateEvents().catch(console.error);
}

export { generateEvents }; 