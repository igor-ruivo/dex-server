import fs from 'fs/promises';
import path from 'path';
import { PokemonGoSource } from './sources/pokemongo-source';
import { GameMasterData } from '../pokemon/game-master-parser';
import { IParsedEvent, PublicEvent } from '../../types/events';

async function generateEvents(gameMasterData: GameMasterData) {
  console.log('🔄 Starting Pokemon GO events generation...');
  
  const now = new Date().toISOString();
  
  try {
    // Use the provided fresh Game Master data
    console.log('📊 Using fresh Game Master data from memory...');
    const gameMaster = gameMasterData;
    
    // Parse all events
    console.log('📰 Fetching and parsing Pokemon GO events...');
    const source = new PokemonGoSource();
    const events = await source.parseEvents(gameMaster);

    const eventIsRelevant = (event: IParsedEvent) => {
      return ((event.bonuses && event.bonuses.length > 0) ||
      (event.wild && event.wild.length > 0) ||
      (event.raids && event.raids.length > 0) ||
      (event.research && event.research.length > 0) ||
      (event.eggs && event.eggs.length > 0) ||
      (event.incenses && event.incenses.length > 0)) && event.dateRanges && event.dateRanges.length > 0;
    }

    const relevantEnglishEvents = events.filter(event => eventIsRelevant(event) && event.isEnglishVersion);
    
    // Create a map of English events by ID for quick lookup
    const englishEventsMap = new Map(relevantEnglishEvents.map(event => [event.id, event]));
    
    // Start with all relevant English events in the new format
    const localizedEvents: PublicEvent[] = relevantEnglishEvents.map(event => ({
      id: event.id,
      url: event.url,
      title: {
        en: event.title,
        pt: ''
      },
      subtitle: {
        en: event.subtitle,
        pt: undefined
      },
      startDate: event.startDate,
      endDate: event.endDate,
      dateRanges: event.dateRanges,
      imageUrl: event.imageUrl,
      source: event.source,
      wild: event.wild,
      raids: event.raids,
      eggs: event.eggs,
      research: event.research,
      incenses: event.incenses,
      bonuses: {
        en: event.bonuses,
        pt: undefined
      }
    }));
    
    // Process Portuguese events to merge with English counterparts
    const portugueseEvents = events.filter(event => 
      event.url.toLocaleLowerCase().includes('/pt_br/')
    );
    
    for (const ptEvent of portugueseEvents) {
      const englishEvent = englishEventsMap.get(ptEvent.id);
      
      if (!englishEvent) {
        console.log(`⚠️  Portuguese event ${ptEvent.id} has no English counterpart, skipping`);
        continue;
      }
      
      // Find and update the existing English event with Portuguese translations
      const existingEventIndex = localizedEvents.findIndex(e => e.id === ptEvent.id);
      if (existingEventIndex !== -1) {
        localizedEvents[existingEventIndex] = {
          ...localizedEvents[existingEventIndex],
          title: {
            en: localizedEvents[existingEventIndex].title.en,
            pt: ptEvent.title
          },
          subtitle: {
            en: localizedEvents[existingEventIndex].subtitle.en,
            pt: ptEvent.subtitle
          },
          bonuses: {
            en: localizedEvents[existingEventIndex].bonuses.en,
            pt: ptEvent.bonuses
          }
        };
      }
    }

    // Write events data file
    const dataDir = path.join(process.cwd(), 'data');
    await fs.mkdir(dataDir, { recursive: true });
    const eventsPath = path.join(dataDir, 'events.json');
    await fs.writeFile(eventsPath, JSON.stringify(localizedEvents, null, 2));
    
    console.log(`✅ Events data written to: ${eventsPath}`);
    console.log('');
    console.log('📊 Events Generation Summary:');
    console.log(`- Total events: ${events.length}`);
    console.log(`- Last updated: ${now}`);
    
    return localizedEvents;
    
  } catch (error) {
    console.error('❌ Events generation failed:', error);
    throw error;
  }
}

// Run if called directly (for testing/development)
if (require.main === module) {
  console.error('❌ generateEvents() requires GameMasterData parameter when run directly');
  process.exit(1);
}

export { generateEvents }; 