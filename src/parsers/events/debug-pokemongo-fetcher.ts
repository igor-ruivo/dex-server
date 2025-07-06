import { PokemonGoFetcher } from './services/pokemongo-fetcher';
import { writeFileSync } from 'fs';

async function debugPokemonGoFetcher() {
    const fetcher = new PokemonGoFetcher();
    
    try {
        console.log('Fetching Pokémon GO news page...');
        const html = await fetcher['fetchPage']('https://pokemongolive.com/news');
        
        // Save the full HTML to a file for inspection
        writeFileSync('pokemongo-news-latest.html', html, 'utf-8');
        console.log('Saved fetched HTML to pokemongo-news-latest.html');
        
        // Optionally, print a summary
        console.log(`HTML Content length: ${html.length} characters`);
        const newsCardMatches = html.match(/<a[^>]+class="[^"]*newsCard[^"]*"[^>]*>/gi);
        console.log(`Found ${newsCardMatches?.length || 0} <a class="newsCard..."> links`);
        if (newsCardMatches) {
            newsCardMatches.slice(0, 5).forEach((match, i) => {
                console.log(`${i + 1}. ${match}`);
            });
        }
    } catch (error) {
        console.error('Error fetching page:', error);
    }
}

debugPokemonGoFetcher(); 