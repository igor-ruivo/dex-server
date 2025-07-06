import { PokemonGoSource } from './sources/pokemongo-source';
import { readFileSync } from 'fs';
import path from 'path';

// Load game master data (pokemon dictionary)
const gameMasterPath = path.resolve(__dirname, '../../../data/game-master.json');
const gameMasterPokemon = JSON.parse(readFileSync(gameMasterPath, 'utf-8'));

async function testPokemonGoParser() {
    const parser = new PokemonGoSource();
    console.log('Fetching and parsing Pokémon GO events...');
    const events = await parser.parseEvents('', gameMasterPokemon);
    console.log(`\nTotal events parsed: ${events.length}\n`);

    // Print summary for first, middle, and last event
    const indices = [0, Math.floor(events.length / 2), events.length - 1].filter(i => i >= 0 && i < events.length);
    for (const i of indices) {
        const event = events[i];
        console.log(`Event #${i + 1}`);
        console.log('-------------------------');
        console.log(`Title: ${event.title}`);
        console.log(`Start: ${new Date(event.startDate).toLocaleString()}`);
        console.log(`End:   ${new Date(event.endDate).toLocaleString()}`);
        console.log(`Bonuses: ${event.bonuses ? event.bonuses.join('\n') : '(none)'}`);
        console.log(`Pokémon: ${event.pokemon.map(p => p.speciesId).join(', ') || '(none)'}`);
        console.log(`Source URL: ${event.sourceUrl}`);
        console.log('-------------------------\n');
    }

    // Optionally, print all event titles
    console.log('All event titles:');
    events.forEach((e, idx) => console.log(`${idx + 1}. ${e.title}`));
}

testPokemonGoParser().catch(err => {
    console.error('Error running test:', err);
    process.exit(1);
}); 