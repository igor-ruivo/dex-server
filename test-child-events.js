const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');

async function testChildEvents() {
    try {
        const response = await fetch('https://pokemongolive.com/en/post/global-events-gofest2025-overlays/');
        const html = await response.text();
        
        const dom = new JSDOM(html);
        const document = dom.window.document;
        
        const entries = Array.from(document.getElementsByClassName("blogPost__post__blocks")[0]?.children ?? []);
        
        console.log('Found entries:', entries.length);
        
        for (let k = 0; k < entries.length; k++) {
            const containerBlock = entries[k].children[0];
            const innerEntries = containerBlock.getElementsByClassName("ContainerBlock");
            
            if (innerEntries.length === 0) {
                continue;
            }

            console.log(`Entry ${k}:`);
            console.log(`  ContainerBlock children: ${containerBlock.children.length}`);
            
            // Look for headlines in the container block
            const headlines = containerBlock.getElementsByClassName("ContainerBlock__headline");
            console.log(`  Headlines found: ${headlines.length}`);
            for (let i = 0; i < headlines.length; i++) {
                console.log(`    Headline ${i}: "${headlines[i]?.innerText?.trim()}"`);
            }
            
            // Look for any text content in the container block
            console.log(`  ContainerBlock text: "${containerBlock.textContent?.trim()}"`);
            
            // Look at the first few children
            for (let i = 0; i < Math.min(3, containerBlock.children.length); i++) {
                const child = containerBlock.children[i];
                console.log(`    Child ${i} tag: ${child.tagName}, text: "${child.textContent?.trim()}"`);
            }
            
            console.log('  ---');
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

testChildEvents(); 