import { PokemonGoSource } from './sources/pokemongo-source';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

// Load game master data (pokemon dictionary)
const gameMasterPath = path.resolve(__dirname, '../../../data/game-master.json');
const gameMasterPokemon = JSON.parse(readFileSync(gameMasterPath, 'utf-8'));

async function dumpAllExtractedData() {
    console.log('=== Dumping All Extracted Data ===\n');
    
    const parser = new PokemonGoSource();
    const events = await parser.parseEvents('', gameMasterPokemon);
    
    console.log(`Total events parsed: ${events.length}\n`);
    
    // Create a comprehensive dump object
    const dumpData = {
        metadata: {
            totalEvents: events.length,
            eventsWithBonuses: events.filter(e => e.bonuses && e.bonuses.length > 0).length,
            eventsWithPokemon: events.filter(e => e.pokemon && e.pokemon.length > 0).length,
            eventsWithImages: events.filter(e => e.imageUrl).length,
            extractedAt: new Date().toISOString(),
            source: 'pokemongo'
        },
        events: events.map((event, index) => ({
            id: event.id,
            index: index + 1,
            title: event.title,
            subtitle: event.subtitle,
            startDate: event.startDate,
            endDate: event.endDate,
            startDateFormatted: new Date(event.startDate).toLocaleString(),
            endDateFormatted: new Date(event.endDate).toLocaleString(),
            imageUrl: event.imageUrl,
            sourceUrl: event.sourceUrl,
            categories: event.categories,
            bonuses: event.bonuses,
            pokemon: event.pokemon?.map(p => ({
                speciesId: p.speciesId,
                shiny: p.shiny,
                category: p.category,
                raidLevel: p.raidLevel,
                comment: p.comment,
                source: p.source
            })) || [],
            pokemonCount: event.pokemon?.length || 0,
            bonusesCount: event.bonuses?.length || 0,
            isRelevant: event.isRelevant,
            metadata: event.metadata
        }))
    };
    
    // Save to file
    const outputPath = path.resolve(__dirname, '../../../data/extracted-events-dump.json');
    writeFileSync(outputPath, JSON.stringify(dumpData, null, 2));
    
    console.log(`✅ Data dumped to: ${outputPath}`);
    console.log(`📊 Summary:`);
    console.log(`   Total events: ${dumpData.metadata.totalEvents}`);
    console.log(`   Events with bonuses: ${dumpData.metadata.eventsWithBonuses}`);
    console.log(`   Events with Pokémon: ${dumpData.metadata.eventsWithPokemon}`);
    console.log(`   Events with images: ${dumpData.metadata.eventsWithImages}`);
    
    // Show first few events as preview
    console.log('\n📋 Preview of first 3 events:');
    dumpData.events.slice(0, 3).forEach((event, index) => {
        console.log(`\nEvent #${index + 1}: ${event.title}`);
        console.log(`  Subtitle: ${event.subtitle}`);
        console.log(`  Date: ${event.startDateFormatted} - ${event.endDateFormatted}`);
        console.log(`  Image: ${event.imageUrl ? '✅' : '❌'}`);
        console.log(`  Bonuses: ${event.bonusesCount} found`);
        console.log(`  Pokémon: ${event.pokemonCount} found`);
        console.log(`  URL: ${event.sourceUrl}`);
    });
    
    // Show all unique Pokémon
    const allPokemon = new Set<string>();
    events.forEach(event => {
        if (event.pokemon) {
            event.pokemon.forEach(p => allPokemon.add(p.speciesId));
        }
    });
    
    console.log(`\n🎯 Unique Pokémon found: ${allPokemon.size}`);
    console.log(`📝 List: ${Array.from(allPokemon).sort().join(', ')}`);
    
    // Show all unique bonuses
    const allBonuses = new Set<string>();
    events.forEach(event => {
        if (event.bonuses) {
            event.bonuses.forEach(bonus => allBonuses.add(bonus));
        }
    });
    
    console.log(`\n🎁 Unique bonuses found: ${allBonuses.size}`);
    console.log(`📝 List: ${Array.from(allBonuses).map((b, i) => `${i + 1}. ${b.substring(0, 50)}...`).join(', ')}`);
}

// Run the dump
dumpAllExtractedData().catch(console.error); 