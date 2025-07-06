import { PokemonGoFetcher } from './services/pokemongo-fetcher';
import { fetchDateFromString, fixDateString } from './utils/normalization';

async function summarizeEvents() {
    const fetcher = new PokemonGoFetcher();
    
    console.log('Fetching actual event list from news page...');
    const allPosts = await fetcher.fetchAllPosts();
    
    // Filter for only posts (URLs containing /post/)
    const postEvents = allPosts.filter(post => post.url.includes('/post/'));
    console.log(`Found ${postEvents.length} POST events.\n`);
    
    console.log('='.repeat(120));
    console.log('POKEMON GO POST EVENTS SUMMARY');
    console.log('='.repeat(120));
    console.log('TITLE'.padEnd(60) + 'DATE STRING'.padEnd(40) + 'STATUS');
    console.log('-'.repeat(120));
    
    let successCount = 0;
    
    for (const post of postEvents) {
        // Extract the first <p> inside .ContainerBlock__body
        const bodyMatch = post.html.match(/<div class="ContainerBlock__body">([\s\S]*?)<\/div>/i);
        let firstP = '';
        let dateString = 'N/A';
        
        if (bodyMatch) {
            const pMatch = bodyMatch[1].match(/<p>([\s\S]*?)<\/p>/i);
            if (pMatch) {
                firstP = pMatch[1].replace(/<[^>]+>/g, '').trim();
                dateString = firstP.length > 100 ? firstP.substring(0, 100) + '...' : firstP;
            }
        }

        // Parse title
        const titleMatch = post.html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
        const title = titleMatch ? titleMatch[1].trim() : post.title;
        const shortTitle = title.length > 55 ? title.substring(0, 55) + '...' : title;

        // Try to extract date range
        let startDate = 0;
        let endDate = 0;
        let patternUsed = 'None';
        
        // Pattern 1: Multi-day events with "to"
        let dateRangeMatch = firstP.match(/([A-Za-z]+day, [A-Za-z]+ \d{1,2},? at \d{1,2}:\d{2} [ap]\.m\.) to ([A-Za-z]+day, [A-Za-z]+ \d{1,2}, \d{4},? at \d{1,2}:\d{2} [ap]\.m\.)/);
        if (dateRangeMatch) {
            patternUsed = 'Pattern 1';
            try {
                startDate = fetchDateFromString(fixDateString(dateRangeMatch[1] + ' 2025'));
                endDate = fetchDateFromString(fixDateString(dateRangeMatch[2]));
            } catch (err) {
                // Ignore errors
            }
        } else {
            // Pattern 2: Multi-day events without weekdays
            dateRangeMatch = firstP.match(/([A-Za-z]+ \d{1,2} at \d{1,2}:\d{2} [ap]\.m\.) to ([A-Za-z]+ \d{1,2}, \d{4},? at \d{1,2}:\d{2} [ap]\.m\.)/);
            if (dateRangeMatch) {
                patternUsed = 'Pattern 2';
                try {
                    startDate = fetchDateFromString(fixDateString(dateRangeMatch[1] + ' 2025'));
                    endDate = fetchDateFromString(fixDateString(dateRangeMatch[2]));
                } catch (err) {
                    // Ignore errors
                }
            } else {
                // Pattern 3: Single day events with "from X to Y"
                dateRangeMatch = firstP.match(/([A-Za-z]+day, [A-Za-z]+ \d{1,2}, \d{4},? from \d{1,2}:\d{2} [ap]\.m\. to \d{1,2}:\d{2} [ap]\.m\.)/);
                if (dateRangeMatch) {
                    patternUsed = 'Pattern 3';
                    try {
                        const dateMatch = dateRangeMatch[1].match(/([A-Za-z]+day, [A-Za-z]+ \d{1,2}, \d{4})/);
                        const timeMatch = dateRangeMatch[1].match(/from (\d{1,2}:\d{2} [ap]\.m\.) to (\d{1,2}:\d{2} [ap]\.m\.)/);
                        if (dateMatch && timeMatch) {
                            const dateParts = dateMatch[1].split(', ');
                            const monthDay = dateParts[1] + ', ' + dateParts[2];
                            const startDateStr = monthDay.replace(', 2025', '') + ', at ' + timeMatch[1] + ' 2025';
                            const endDateStr = monthDay.replace(', 2025', '') + ', at ' + timeMatch[2] + ' 2025';
                            startDate = fetchDateFromString(fixDateString(startDateStr));
                            endDate = fetchDateFromString(fixDateString(endDateStr));
                        }
                    } catch (err) {
                        // Ignore errors
                    }
                } else {
                    // Pattern 4: Events with timezones (PDT, etc.)
                    dateRangeMatch = firstP.match(/([A-Za-z]+, [A-Za-z]+ \d{1,2}, at \d{1,2}:\d{2} [ap]\.m\. [A-Z]+) to ([A-Za-z]+, [A-Za-z]+ \d{1,2}, at \d{1,2}:\d{2} [ap]\.m\. [A-Z]+)/);
                    if (dateRangeMatch) {
                        patternUsed = 'Pattern 4';
                        try {
                            const startWithoutTz = dateRangeMatch[1].replace(/ [A-Z]+$/, '');
                            const endWithoutTz = dateRangeMatch[2].replace(/ [A-Z]+$/, '');
                            startDate = fetchDateFromString(fixDateString(startWithoutTz + ' 2025'));
                            endDate = fetchDateFromString(fixDateString(endWithoutTz));
                        } catch (err) {
                            // Ignore errors
                        }
                    } else {
                        // Pattern 5: Events with "local time" in the middle
                        dateRangeMatch = firstP.match(/([A-Za-z]+day, [A-Za-z]+ \d{1,2}, at \d{1,2}:\d{2} [ap]\.m\. local time to [A-Za-z]+day, [A-Za-z]+ \d{1,2}, \d{4},? at \d{1,2}:\d{2} [ap]\.m\.)/);
                        if (dateRangeMatch) {
                            patternUsed = 'Pattern 5';
                            try {
                                // Extract start and end parts
                                const parts = dateRangeMatch[0].split(' to ');
                                if (parts.length === 2) {
                                    startDate = fetchDateFromString(fixDateString(parts[0].replace(' local time', '') + ' 2025'));
                                    endDate = fetchDateFromString(fixDateString(parts[1]));
                                }
                            } catch (err) {
                                // Ignore errors
                            }
                        } else {
                            // Pattern 6: "Saturday, June 28, and Sunday, June 29, 2025, from X to Y"
                            dateRangeMatch = firstP.match(/([A-Za-z]+day, [A-Za-z]+ \d{1,2}, and [A-Za-z]+day, [A-Za-z]+ \d{1,2}, \d{4}, from \d{1,2}:\d{2} [ap]\.m\. to \d{1,2}:\d{2} [ap]\.m\.)/);
                            if (dateRangeMatch) {
                                patternUsed = 'Pattern 6';
                                try {
                                    // Extract the second date (end date) and use it for both start/end
                                    const dateMatch = dateRangeMatch[1].match(/and ([A-Za-z]+day, [A-Za-z]+ \d{1,2}, \d{4})/);
                                    const timeMatch = dateRangeMatch[1].match(/from (\d{1,2}:\d{2} [ap]\.m\.) to (\d{1,2}:\d{2} [ap]\.m\.)/);
                                    if (dateMatch && timeMatch) {
                                        const dateParts = dateMatch[1].split(', ');
                                        const monthDay = dateParts[1] + ', ' + dateParts[2];
                                        const startDateStr = monthDay.replace(', 2025', '') + ', at ' + timeMatch[1] + ' 2025';
                                        const endDateStr = monthDay.replace(', 2025', '') + ', at ' + timeMatch[2] + ' 2025';
                                        startDate = fetchDateFromString(fixDateString(startDateStr));
                                        endDate = fetchDateFromString(fixDateString(endDateStr));
                                    }
                                } catch (err) {
                                    // Ignore errors
                                }
                            } else {
                                // Pattern 7: Single start date with timezone "will start on Tuesday, June 3, 2025, at 1:00 p.m. PDT"
                                dateRangeMatch = firstP.match(/will start on ([A-Za-z]+day, [A-Za-z]+ \d{1,2}, \d{4}, at \d{1,2}:\d{2} [ap]\.m\. [A-Z]+)/);
                                if (dateRangeMatch) {
                                    patternUsed = 'Pattern 7';
                                    try {
                                        // Remove timezone and parse
                                        const dateWithoutTz = dateRangeMatch[1].replace(/ [A-Z]+$/, '');
                                        startDate = fetchDateFromString(fixDateString(dateWithoutTz));
                                        endDate = startDate; // Single day event
                                    } catch (err) {
                                        // Ignore errors
                                    }
                                } else {
                                    // Pattern 8: Simple date ranges without "at" (fix Pattern 2)
                                    dateRangeMatch = firstP.match(/([A-Za-z]+ \d{1,2} to [A-Za-z]+ \d{1,2}, \d{4},? at \d{1,2}:\d{2} [ap]\.m\.)/);
                                    if (dateRangeMatch) {
                                        patternUsed = 'Pattern 8';
                                        try {
                                            // This is a more complex format, might need custom parsing
                                            console.log('Complex date format detected, needs custom parsing');
                                        } catch (err) {
                                            // Ignore errors
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        
        const success = startDate && endDate && !isNaN(startDate) && !isNaN(endDate);
        if (success) successCount++;
        
        const status = success ? '✅ SUCCESS' : '❌ FAILED';
        const patternInfo = success ? ` (${patternUsed})` : '';
        
        console.log(shortTitle.padEnd(60) + dateString.padEnd(40) + status + patternInfo);
    }
    
    console.log('-'.repeat(120));
    console.log(`SUMMARY: ${successCount}/${postEvents.length} posts successfully parsed (${Math.round(successCount/postEvents.length*100)}%)`);
    console.log('='.repeat(120));
}

summarizeEvents().catch(console.error); 