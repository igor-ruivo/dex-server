import { PokemonGoSource } from './sources/pokemongo-source';
import { readFileSync } from 'fs';
import path from 'path';

// Load game master data (pokemon dictionary)
const gameMasterPath = path.resolve(__dirname, '../../../data/game-master.json');
const gameMasterPokemon = JSON.parse(readFileSync(gameMasterPath, 'utf-8'));

async function testComprehensiveParser() {
    console.log('=== Testing Comprehensive PokemonGoSource Parser ===\n');
    
    const parser = new PokemonGoSource();
    const events = await parser.parseEvents('', gameMasterPokemon);
    
    console.log(`Total events parsed: ${events.length}\n`);
    
    events.forEach((event, index) => {
        console.log(`Event #${index + 1}`);
        console.log('='.repeat(50));
        console.log(`Title: ${event.title}`);
        console.log(`Subtitle: ${event.subtitle}`);
        console.log(`Start: ${new Date(event.startDate).toLocaleString()}`);
        console.log(`End: ${new Date(event.endDate).toLocaleString()}`);
        
        if (event.imageUrl) {
            console.log(`Image: ${event.imageUrl}`);
        } else {
            console.log(`Image: (none)`);
        }
        
        if (event.bonuses && event.bonuses.length > 0) {
            console.log(`Bonuses:`);
            event.bonuses.forEach((bonus, bonusIndex) => {
                console.log(`  ${bonusIndex + 1}. ${bonus}`);
            });
        } else {
            console.log(`Bonuses: (none)`);
        }
        
        if (event.pokemon && event.pokemon.length > 0) {
            console.log(`Pokémon: ${event.pokemon.map(p => p.speciesId).join(', ')}`);
        } else {
            console.log(`Pokémon: (none)`);
        }
        
        console.log(`Source URL: ${event.sourceUrl}`);
        console.log('='.repeat(50));
        console.log('');
    });
    
    // Summary statistics
    const eventsWithBonuses = events.filter(e => e.bonuses && e.bonuses.length > 0);
    const eventsWithPokemon = events.filter(e => e.pokemon && e.pokemon.length > 0);
    const eventsWithImages = events.filter(e => e.imageUrl);
    
    console.log('=== Summary Statistics ===');
    console.log(`Total events: ${events.length}`);
    console.log(`Events with bonuses: ${eventsWithBonuses.length}`);
    console.log(`Events with Pokémon: ${eventsWithPokemon.length}`);
    console.log(`Events with images: ${eventsWithImages.length}`);
    console.log('');
    
    // Show all unique Pokémon found
    const allPokemon = new Set<string>();
    events.forEach(event => {
        if (event.pokemon) {
            event.pokemon.forEach(p => allPokemon.add(p.speciesId));
        }
    });
    
    console.log('=== All Unique Pokémon Found ===');
    console.log(Array.from(allPokemon).sort().join(', '));
    console.log('');
    
    // Show all unique bonuses found
    const allBonuses = new Set<string>();
    events.forEach(event => {
        if (event.bonuses) {
            event.bonuses.forEach(bonus => allBonuses.add(bonus));
        }
    });
    
    console.log('=== All Unique Bonuses Found ===');
    Array.from(allBonuses).forEach((bonus, index) => {
        console.log(`${index + 1}. ${bonus}`);
    });
}

// Run the test
testComprehensiveParser().catch(console.error); 