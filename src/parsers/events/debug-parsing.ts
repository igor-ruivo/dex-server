import { PokemonGoFetcher } from './services/pokemongo-fetcher';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';
import path from 'path';

// Load game master data
const gameMasterPath = path.resolve(__dirname, '../../../data/game-master.json');
const gameMasterPokemon = JSON.parse(readFileSync(gameMasterPath, 'utf-8'));

async function debugParsing() {
    console.log('=== DEBUGGING PARSING ===\n');
    
    const fetcher = new PokemonGoFetcher();
    
    // Fetch a specific post to debug
    const posts = await fetcher.fetchAllPosts();
    const testPost = posts.find(p => p.title.includes('Water Festival'));
    
    if (!testPost) {
        console.log('No Water Festival post found');
        return;
    }
    
    console.log(`Testing post: ${testPost.title}`);
    const individualPost = await fetcher.fetchSinglePost(testPost.url);
    
    if (!individualPost) {
        console.log('Failed to fetch individual post');
        return;
    }
    
    console.log('\n=== HTML STRUCTURE ANALYSIS ===');
    
    const dom = new JSDOM(individualPost.html);
    const document = dom.window.document;
    
    // Check for blogPost__post__blocks
    const blocks = document.getElementsByClassName("blogPost__post__blocks");
    console.log(`Found ${blocks.length} blogPost__post__blocks`);
    
    if (blocks.length > 0) {
        const entries = Array.from(blocks[0].children);
        console.log(`Found ${entries.length} entries in blogPost__post__blocks`);
        
        for (let i = 0; i < Math.min(entries.length, 3); i++) {
            const entry = entries[i];
            console.log(`\nEntry ${i + 1}:`);
            console.log(`  Tag name: ${entry.tagName}`);
            console.log(`  Class name: ${entry.className}`);
            
            // Check for ContainerBlock__headline
            const headlines = entry.getElementsByClassName('ContainerBlock__headline');
            console.log(`  Found ${headlines.length} ContainerBlock__headline elements`);
            
            if (headlines.length > 0) {
                const headline = headlines[0];
                console.log(`  Headline text: "${(headline as any)?.innerText?.trim()}"`);
            }
            
            // Check for children
            console.log(`  Children count: ${entry.children.length}`);
            for (let j = 0; j < Math.min(entry.children.length, 3); j++) {
                const child = entry.children[j];
                console.log(`    Child ${j + 1}: ${child.tagName} - ${child.className}`);
            }
        }
    }
    
    // Check for hasToComputeInnerEntries condition
    const hasComplexStructure = document.querySelector('.blogPost__post__blocks>.block.block--ContainerBlock>.ContainerBlock>.ContainerBlock__blocks>.block.block--ContainerBlock>.ContainerBlock>.ContainerBlock__headline');
    console.log(`\nHas complex structure: ${!!hasComplexStructure}`);
    
    // Test the parsing logic
    console.log('\n=== TESTING PARSING LOGIC ===');
    
    const entries = Array.from(document.getElementsByClassName("blogPost__post__blocks")[0]?.children ?? []);
    let hasToComputeInnerEntries = true;

    if (!document.querySelector('.blogPost__post__blocks>.block.block--ContainerBlock>.ContainerBlock>.ContainerBlock__blocks>.block.block--ContainerBlock>.ContainerBlock>.ContainerBlock__headline')) {
        hasToComputeInnerEntries = false;
    }
    
    console.log(`hasToComputeInnerEntries: ${hasToComputeInnerEntries}`);
    
    if (!hasToComputeInnerEntries) {
        console.log('\nProcessing simple structure...');
        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            const title = entry.getElementsByClassName('ContainerBlock__headline')[0] as unknown as any;
            const kind = title?.innerText?.trim();
            
            console.log(`Entry ${i + 1} kind: "${kind}"`);
            
            if (kind) {
                const contentBodies = Array.from(entry.children) as unknown as any[];
                console.log(`  Content bodies: ${contentBodies.length}`);
                
                if (contentBodies[1]) {
                    const contentText = contentBodies[1].innerHTML?.substring(0, 200) || 'No content';
                    console.log(`  Content preview: "${contentText}..."`);
                }
            }
        }
    } else {
        console.log('\nProcessing complex structure...');
        for (let k = 0; k < entries.length; k++) {
            const containerBlock = entries[k].children[0];
            const innerEntries = containerBlock.getElementsByClassName("ContainerBlock");
            
            console.log(`Container ${k + 1}: Found ${innerEntries.length} inner entries`);
            
            if (innerEntries.length === 0) {
                continue;
            }

            for (let i = 0; i < innerEntries.length; i++) {
                const entry = innerEntries[i];
                console.log(`  Inner Entry ${i + 1}:`);
                console.log(`    Entry tag: ${entry.tagName} - ${entry.className}`);
                console.log(`    Entry children: ${entry.children.length}`);
                
                if (entry.children.length > 0) {
                    const firstChild = entry.children[0];
                    console.log(`    First child: ${firstChild.tagName} - ${firstChild.className}`);
                    
                    const headlines = firstChild.getElementsByClassName('ContainerBlock__headline');
                    console.log(`    Found ${headlines.length} ContainerBlock__headline elements`);
                    
                    if (headlines.length > 0) {
                        const title = headlines[0] as unknown as any;
                        const kind = title?.textContent?.trim() || title?.innerText?.trim();
                        console.log(`    Kind: "${kind}"`);
                        console.log(`    Title element: ${title?.tagName} - ${title?.className}`);
                        console.log(`    Title textContent: "${title?.textContent}"`);
                        console.log(`    Title innerText: "${title?.innerText}"`);
                        console.log(`    Title innerHTML: "${title?.innerHTML?.substring(0, 100)}"`);
                    } else {
                        console.log(`    No ContainerBlock__headline found in first child`);
                        // Try to find any text content
                        const textContent = firstChild.textContent?.trim() || (firstChild as any)?.innerText?.trim();
                        console.log(`    First child text: "${textContent}"`);
                    }
                }
                
                // Define kind variable for the rest of the logic
                const headlines = entry.children[0]?.getElementsByClassName('ContainerBlock__headline');
                const title = headlines?.length > 0 ? headlines[0] as unknown as any : null;
                const kind = title?.textContent?.trim() || title?.innerText?.trim();
                
                if (kind) {
                    const contentBodies = Array.from(entry.children) as unknown as any[];
                    console.log(`    Content bodies: ${contentBodies.length}`);
                    
                    if (contentBodies[1]) {
                        const contentText = contentBodies[1].innerHTML?.substring(0, 200) || 'No content';
                        console.log(`    Content preview: "${contentText}..."`);
                    }
                }
            }
        }
    }
}

debugParsing().catch(console.error); 