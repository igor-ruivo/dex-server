import { PokemonGoSource } from './sources/pokemongo-source';
import { readFileSync } from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';

// Load game master data (pokemon dictionary)
const gameMasterPath = path.resolve(__dirname, '../../../data/game-master.json');
const gameMasterPokemon = JSON.parse(readFileSync(gameMasterPath, 'utf-8'));

async function testBonusExtraction() {
    const parser = new PokemonGoSource();
    console.log('Testing bonus extraction from a specific event...');
    
    // Get a specific event to test
    const events = await parser.parseEvents('', gameMasterPokemon);
    
    if (events.length > 0) {
        const testEvent = events[0];
        console.log(`\nTesting bonus extraction for: ${testEvent.title}`);
        console.log(`Source URL: ${testEvent.sourceUrl}`);
        console.log(`Bonuses found: ${testEvent.bonuses ? testEvent.bonuses.length : 0}`);
        
        if (testEvent.bonuses && testEvent.bonuses.length > 0) {
            console.log('\nBonus content:');
            testEvent.bonuses.forEach((bonus, index) => {
                console.log(`\n--- Bonus ${index + 1} ---`);
                console.log(bonus);
            });
        } else {
            console.log('\nNo bonuses found. Let\'s debug the HTML structure...');
            
            // Let's fetch the specific post and examine its HTML structure
            const fetcher = (parser as any).fetcher;
            const individualPost = await fetcher.fetchSinglePost(testEvent.sourceUrl);
            
            if (individualPost) {
                console.log('\nExamining HTML structure for bonus sections...');
                
                // Test the structured bonus extraction directly
                const bonuses = (parser as any).extractBonusesStructured(individualPost.html);
                console.log(`\nStructured extraction found ${bonuses.length} bonuses:`);
                bonuses.forEach((bonus: string, index: number) => {
                    console.log(`\n--- Structured Bonus ${index + 1} ---`);
                    console.log(bonus);
                });
                
                // Also test the regex fallback
                const regexBonuses = (parser as any).extractBonusesRegex(individualPost.html);
                console.log(`\nRegex extraction found ${regexBonuses.length} bonuses:`);
                regexBonuses.forEach((bonus: string, index: number) => {
                    console.log(`\n--- Regex Bonus ${index + 1} ---`);
                    console.log(bonus);
                });
                
                // Let's also look for ContainerBlock elements in the HTML
                const containerBlockMatches = individualPost.html.match(/<div[^>]*class="[^"]*ContainerBlock[^"]*"[^>]*>/gi);
                console.log(`\nFound ${containerBlockMatches ? containerBlockMatches.length : 0} ContainerBlock elements`);
                
                // Look for bonus-related text in the HTML
                const bonusMatches = individualPost.html.match(/bonus/gi);
                console.log(`\nFound ${bonusMatches ? bonusMatches.length : 0} instances of "bonus" in HTML`);
                
                // Look for specific bonus-related class names
                const eventBonusesBlockMatches = individualPost.html.match(/EventBonusesBlock/gi);
                console.log(`\nFound ${eventBonusesBlockMatches ? eventBonusesBlockMatches.length : 0} EventBonusesBlock elements`);
                
                // Look for ContainerBlock__headline elements
                const headlineMatches = individualPost.html.match(/ContainerBlock__headline/gi);
                console.log(`\nFound ${headlineMatches ? headlineMatches.length : 0} ContainerBlock__headline elements`);
                
                // Extract a sample of HTML around bonus mentions
                if (bonusMatches && bonusMatches.length > 0) {
                    console.log('\nSample HTML around bonus mentions:');
                    const bonusIndex = individualPost.html.toLowerCase().indexOf('bonus');
                    if (bonusIndex !== -1) {
                        const sample = individualPost.html.substring(Math.max(0, bonusIndex - 300), bonusIndex + 300);
                        console.log(sample);
                    }
                }
                
                // Look for specific bonus section patterns
                const bonusSectionPatterns = [
                    /<div[^>]*class="[^"]*EventBonusesBlock[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
                    /<div[^>]*class="[^"]*bonus[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
                    /<h[1-6][^>]*>([^<]*bonus[^<]*)<\/h[1-6]>/gi
                ];
                
                console.log('\nSearching for bonus sections with specific patterns:');
                bonusSectionPatterns.forEach((pattern, index) => {
                    const matches = individualPost.html.match(pattern);
                    console.log(`Pattern ${index + 1} found ${matches ? matches.length : 0} matches`);
                    if (matches && matches.length > 0) {
                        console.log(`Sample from pattern ${index + 1}:`);
                        console.log(matches[0].substring(0, 200) + '...');
                    }
                });
            }
        }
    }
}

function removeLeadingAndTrailingAsterisks(str: string): string {
    return str.replace(/^\*+|\*+$/g, '').trim();
}

async function testBonusExtractionWithOriginalAlgorithm() {
    console.log('=== Testing bonus extraction with original algorithm ===');
    
    const url = 'https://pokemongo.com/en/post/water-festival-2025';
    console.log(`Fetching from: ${url}`);
    
    const res = await fetch(url);
    const html = await res.text();
    console.log(`Fetched HTML length: ${html.length}`);

    const dom = new JSDOM(html);
    const document = dom.window.document;
    console.log('Created JSDOM document');

    // Follow the original algorithm structure
    const entries = Array.from(document.getElementsByClassName("blogPost__post__blocks")[0]?.children ?? []);
    console.log(`Found ${entries.length} entries in blogPost__post__blocks`);
    
    let hasToComputeInnerEntries = true;

    if (!document.querySelector('.blogPost__post__blocks>.block.block--ContainerBlock>.ContainerBlock>.ContainerBlock__blocks>.block.block--ContainerBlock>.ContainerBlock>.ContainerBlock__headline')) {
        hasToComputeInnerEntries = false;
    }

    const postTitle = (document.getElementsByClassName("blogPost__title")[0] as any)?.innerText;

    // Now implement the bonus extraction following the user's algorithm
    let bonuses = '';

    if (!hasToComputeInnerEntries) {
        if (entries.length === 0) {
            return;
        }

        const subtitle = (entries[0].getElementsByClassName("ContainerBlock__headline")[0] as any)?.innerText?.trim();
        const date = (entries[0].getElementsByClassName("ContainerBlock__body")[0] as any)?.innerText?.trim().split("\n")[0].trim();

        // Process entries for bonuses
        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            const title = entry.getElementsByClassName('ContainerBlock__headline')[0];
            const kind = (title as any)?.innerText?.trim();
            console.log(`\nProcessing entry ${i + 1}, kind: "${kind}"`);
            
            if (!kind) continue;
            
            const contentBodies = Array.from(entry.children) as any[];
            
            // Check for bonus-related titles
            if (kind.includes('Bonuses') || kind.includes('Bônus')) {
                if (contentBodies[1] && contentBodies[1].innerHTML) {
                    const contentWithNewlines = contentBodies[1].innerHTML.trim().replace(/<br\s*\/?>/gi, '\n').trim();
                    
                    const tempElement = document.createElement('div');
                    tempElement.innerHTML = contentWithNewlines;
                    
                    const plainText = tempElement.textContent || tempElement.innerText || '';
                    bonuses += '\n\n' + removeLeadingAndTrailingAsterisks(plainText);
                }
            }
        }
    } else {
        for (let k = 0; k < entries.length; k++) {
            const containerBlock = entries[k].children[0];
            const innerEntries = containerBlock.getElementsByClassName("ContainerBlock");
            
            if (innerEntries.length === 0) {
                continue;
            }

            const subtitle = (containerBlock.getElementsByClassName("ContainerBlock__headline")[0] as any)?.innerText?.trim();
            const date = (containerBlock.children[1] as any)?.innerText?.trim().split("\n")[0].trim();

            // Process inner entries for bonuses
            for (let i = 0; i < innerEntries.length; i++) {
                const entry = innerEntries[i];
                const title = !hasToComputeInnerEntries ? entry.children[0].getElementsByClassName('ContainerBlock__headline')[0] : entry.children[0];
                
                // Extract text from the span inside the headline
                const titleSpan = title?.querySelector('.ContainerBlock__headline__title');
                const kind = titleSpan ? (titleSpan as any)?.textContent?.trim() : (title as any)?.textContent?.trim();
                
                if (!kind) continue;
                
                const contentBodies = Array.from(!hasToComputeInnerEntries ? entry.children[0].children : entry.children) as any[];
                
                // Check for bonus-related titles
                if (kind.includes('Bonuses') || kind.includes('Bônus')) {
                    if (contentBodies[1] && contentBodies[1].innerHTML) {
                        const contentWithNewlines = contentBodies[1].innerHTML.trim().replace(/<br\s*\/?>/gi, '\n').trim();
                        
                        const tempElement = document.createElement('div');
                        tempElement.innerHTML = contentWithNewlines;
                        
                        const plainText = tempElement.textContent || tempElement.innerText || '';
                        bonuses += '\n\n' + removeLeadingAndTrailingAsterisks(plainText);
                    }
                }
                
                // Also check for specific bonus titles as in the user's algorithm
                switch(kind) {
                    case "Event bonus":
                    case "Event Bonus":
                    case "Event bonuses":
                    case "Event Bonuses":
                    case "Bônus do evento":
                    case "Bonuses":
                        if (contentBodies[1] && contentBodies[1].innerHTML) {
                            const contentWithNewlines = contentBodies[1].innerHTML.trim().replace(/<br\s*\/?>/gi, '\n').trim();
                            
                            const tempElement = document.createElement('div');
                            tempElement.innerHTML = contentWithNewlines;
                            
                            const plainText = tempElement.textContent || tempElement.innerText || '';
                            bonuses += '\n\n' + removeLeadingAndTrailingAsterisks(plainText);
                        }
                        break;
                }
            }
        }
    }

    console.log('\n=== Final Results ===');
    console.log('Extracted bonuses:');
    console.log(bonuses.trim() || '(none found)');
}

// Only run the original algorithm test
console.log('=== Running bonus extraction with original algorithm ===');
testBonusExtractionWithOriginalAlgorithm().catch((error) => {
    console.error('Error in test:', error);
}); 