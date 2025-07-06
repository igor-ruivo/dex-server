import { readFileSync } from 'fs';
import path from 'path';

// Read the dump file
const dumpPath = path.resolve(__dirname, '../../../data/extracted-events-dump.json');
const dumpData = JSON.parse(readFileSync(dumpPath, 'utf-8'));

console.log('=== COMPREHENSIVE DATA EXTRACTION RESULTS ===\n');

// Show metadata
console.log('📊 EXTRACTION STATISTICS:');
console.log(`   Total Events: ${dumpData.metadata.totalEvents}`);
console.log(`   Events with Bonuses: ${dumpData.metadata.eventsWithBonuses}`);
console.log(`   Events with Pokémon: ${dumpData.metadata.eventsWithPokemon}`);
console.log(`   Events with Images: ${dumpData.metadata.eventsWithImages}`);
console.log(`   Extraction Date: ${dumpData.metadata.extractedAt}\n`);

// Show all events in detail
console.log('📋 ALL EXTRACTED EVENTS:\n');
dumpData.events.forEach((event: any, index: number) => {
    console.log(`🎯 EVENT #${index + 1}: ${event.title}`);
    console.log(`   Subtitle: ${event.subtitle}`);
    console.log(`   Date Range: ${event.startDateFormatted} - ${event.endDateFormatted}`);
    console.log(`   Image: ${event.imageUrl ? '✅' : '❌'}`);
    console.log(`   Source URL: ${event.sourceUrl}`);
    
    if (event.bonuses && event.bonuses.length > 0) {
        console.log(`   🎁 Bonuses (${event.bonusesCount}):`);
        event.bonuses.forEach((bonus: string, i: number) => {
            console.log(`      ${i + 1}. ${bonus.substring(0, 100)}${bonus.length > 100 ? '...' : ''}`);
        });
    }
    
    if (event.pokemon && event.pokemon.length > 0) {
        console.log(`   🎯 Pokémon (${event.pokemonCount}):`);
        const pokemonList = event.pokemon.map((p: any) => {
            let display = p.speciesId;
            if (p.shiny) display += ' (Shiny)';
            if (p.category) display += ` [${p.category}]`;
            if (p.raidLevel) display += ` [Raid ${p.raidLevel}]`;
            if (p.comment) display += ` - ${p.comment}`;
            return display;
        });
        
        // Group by 5 for readability
        for (let i = 0; i < pokemonList.length; i += 5) {
            const group = pokemonList.slice(i, i + 5);
            console.log(`      ${group.join(', ')}`);
        }
    }
    
    console.log(''); // Empty line between events
});

// Show unique statistics
console.log('📈 UNIQUE STATISTICS:\n');

// All unique Pokémon
const allPokemon = new Set<string>();
dumpData.events.forEach((event: any) => {
    if (event.pokemon) {
        event.pokemon.forEach((p: any) => allPokemon.add(p.speciesId));
    }
});

console.log(`🎯 Total Unique Pokémon: ${allPokemon.size}`);
console.log(`📝 Complete List: ${Array.from(allPokemon).sort().join(', ')}\n`);

// All unique bonuses
const allBonuses = new Set<string>();
dumpData.events.forEach((event: any) => {
    if (event.bonuses) {
        event.bonuses.forEach((bonus: string) => allBonuses.add(bonus));
    }
});

console.log(`🎁 Total Unique Bonuses: ${allBonuses.size}`);
console.log('📝 Complete Bonus List:');
Array.from(allBonuses).forEach((bonus, i) => {
    console.log(`   ${i + 1}. ${bonus}`);
});

console.log('\n✅ Data extraction completed successfully!'); 