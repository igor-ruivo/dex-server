import { PokemonGoSource } from './sources/pokemongo-source';
import { JSDOM } from 'jsdom';

async function debugDateExtraction() {
    console.log('🔍 Debugging date extraction...');
    
    try {
        // Create source and fetcher
        const source = new PokemonGoSource();
        const fetcher = (source as any).fetcher;
        
        // Test with a known post URL
        const testUrl = '/en/post/water-festival-2025/';
        console.log(`Testing with URL: ${testUrl}`);
        
        const individualPost = await fetcher.fetchSinglePost(testUrl);
        if (individualPost) {
            console.log('\n=== HTML Structure Analysis ===');
            console.log('Post URL:', testUrl);
            console.log('Post title:', individualPost.title);
            
            // Test the date extraction
            const dateStrings = (source as any).extractDateStringsFromPost(individualPost.html);
            console.log('\nExtracted date strings:', dateStrings);
            
            if (dateStrings.length === 0) {
                console.log('\n=== Debugging HTML Structure ===');
                const dom = new JSDOM(individualPost.html);
                const document = dom.window.document;
                
                // Check if blogPost__post__blocks exists
                const blogPostBlocks = document.getElementsByClassName("blogPost__post__blocks");
                console.log('blogPost__post__blocks found:', blogPostBlocks.length);
                
                if (blogPostBlocks.length > 0) {
                    const entries = Array.from(blogPostBlocks[0].children);
                    console.log('Number of entries:', entries.length);
                    
                    for (let i = 0; i < Math.min(entries.length, 3); i++) {
                        const entry = entries[i] as any;
                        console.log(`\nEntry ${i}:`);
                        console.log('- Tag name:', entry.tagName);
                        console.log('- Class name:', entry.className);
                        
                        // Check for ContainerBlock__headline
                        const headlines = entry.getElementsByClassName("ContainerBlock__headline");
                        console.log('- ContainerBlock__headline found:', headlines.length);
                        
                        // Check for ContainerBlock__body
                        const bodies = entry.getElementsByClassName("ContainerBlock__body");
                        console.log('- ContainerBlock__body found:', bodies.length);
                        
                        if (bodies.length > 0) {
                            console.log('\n--- ContainerBlock__body content ---');
                            for (let j = 0; j < bodies.length; j++) {
                                const body = bodies[j] as any;
                                console.log(`Body ${j}:`);
                                console.log('- innerText:', body.innerText?.trim());
                                console.log('- textContent:', body.textContent?.trim());
                                console.log('- innerHTML (first 200 chars):', body.innerHTML?.substring(0, 200));
                                
                                // Check children
                                const children = Array.from(body.children);
                                console.log('- children count:', children.length);
                                for (let k = 0; k < Math.min(children.length, 3); k++) {
                                    const child = children[k] as any;
                                    console.log(`  Child ${k}:`, child.tagName, child.className, child.textContent?.trim());
                                }
                            }
                        }
                        
                        // Also check direct children of entry
                        console.log('\n--- Direct children of entry ---');
                        const directChildren = Array.from(entry.children);
                        for (let j = 0; j < Math.min(directChildren.length, 5); j++) {
                            const child = directChildren[j] as any;
                            console.log(`Direct child ${j}:`, child.tagName, child.className, child.textContent?.trim());
                        }
                    }
                }
            }
        } else {
            console.log('Failed to fetch individual post');
        }
        
    } catch (error) {
        console.error('Debug failed:', error);
    }
}

debugDateExtraction(); 