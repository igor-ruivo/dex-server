import { PokemonGoFetcher } from './services/pokemongo-fetcher';
import { fetchDateFromString, fixDateString } from './utils/normalization';

async function testMultipleEvents() {
    const fetcher = new PokemonGoFetcher();
    
    // First, get the actual list of events from the news page
    console.log('Fetching actual event list from news page...');
    const allPosts = await fetcher.fetchAllPosts();
    console.log(`Found ${allPosts.length} total events.`);
    
    // Filter for only posts (URLs containing /post/)
    const postEvents = allPosts.filter(post => post.url.includes('/post/'));
    console.log(`Found ${postEvents.length} POST events. Testing all of them...`);
    
    let successCount = 0;
    let totalCount = postEvents.length;
    
    for (const post of postEvents) {
        console.log('\n' + '='.repeat(80));
        console.log('Testing event:', post.url);
        console.log('='.repeat(80));
        
        try {
            console.log('Fetched HTML length:', post.html.length);

            // Extract the first <p> inside .ContainerBlock__body
            const bodyMatch = post.html.match(/<div class="ContainerBlock__body">([\s\S]*?)<\/div>/i);
            let firstP = '';
            if (bodyMatch) {
                const pMatch = bodyMatch[1].match(/<p>([\s\S]*?)<\/p>/i);
                if (pMatch) {
                    firstP = pMatch[1].replace(/<[^>]+>/g, '').trim();
                    console.log('First <p> in ContainerBlock__body:', firstP);
                }
            }

            // Parse title
            const titleMatch = post.html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
            const title = titleMatch ? titleMatch[1].trim() : post.title;
            console.log('Parsed title:', title);

            // Try to extract date range from the firstP string
            let dateRangeRaw = '';
            let startDate = 0;
            let endDate = 0;
            
            // Pattern 1: Multi-day events with "to" (our original pattern)
            let dateRangeMatch = firstP.match(/([A-Za-z]+day, [A-Za-z]+ \d{1,2},? at \d{1,2}:\d{2} [ap]\.m\.) to ([A-Za-z]+day, [A-Za-z]+ \d{1,2}, \d{4},? at \d{1,2}:\d{2} [ap]\.m\.)/);
            
            if (dateRangeMatch) {
                dateRangeRaw = dateRangeMatch[0];
                console.log('Extracted date range (Pattern 1):', dateRangeRaw);
                try {
                    startDate = fetchDateFromString(fixDateString(dateRangeMatch[1] + ' 2025'));
                    endDate = fetchDateFromString(fixDateString(dateRangeMatch[2]));
                } catch (err) {
                    console.error('Date parsing error (Pattern 1):', err);
                }
            } else {
                // Pattern 2: Multi-day events without weekdays
                dateRangeMatch = firstP.match(/([A-Za-z]+ \d{1,2} at \d{1,2}:\d{2} [ap]\.m\.) to ([A-Za-z]+ \d{1,2}, \d{4},? at \d{1,2}:\d{2} [ap]\.m\.)/);
                if (dateRangeMatch) {
                    dateRangeRaw = dateRangeMatch[0];
                    console.log('Extracted date range (Pattern 2):', dateRangeRaw);
                    try {
                        startDate = fetchDateFromString(fixDateString(dateRangeMatch[1] + ' 2025'));
                        endDate = fetchDateFromString(fixDateString(dateRangeMatch[2]));
                    } catch (err) {
                        console.error('Date parsing error (Pattern 2):', err);
                    }
                } else {
                    // Pattern 3: Single day events with "from X to Y"
                    dateRangeMatch = firstP.match(/([A-Za-z]+day, [A-Za-z]+ \d{1,2}, \d{4},? from \d{1,2}:\d{2} [ap]\.m\. to \d{1,2}:\d{2} [ap]\.m\.)/);
                    if (dateRangeMatch) {
                        dateRangeRaw = dateRangeMatch[0];
                        console.log('Extracted date range (Pattern 3):', dateRangeRaw);
                        try {
                            // Extract the date part and create start/end times
                            const dateMatch = dateRangeMatch[1].match(/([A-Za-z]+day, [A-Za-z]+ \d{1,2}, \d{4})/);
                            const timeMatch = dateRangeMatch[1].match(/from (\d{1,2}:\d{2} [ap]\.m\.) to (\d{1,2}:\d{2} [ap]\.m\.)/);
                            if (dateMatch && timeMatch) {
                                // Extract date parts: "Sunday, June 29, 2025" -> "June 29, 2025"
                                const dateParts = dateMatch[1].split(', ');
                                const monthDay = dateParts[1] + ', ' + dateParts[2]; // "June 29, 2025"
                                const startDateStr = monthDay.replace(', 2025', '') + ', at ' + timeMatch[1] + ' 2025';
                                const endDateStr = monthDay.replace(', 2025', '') + ', at ' + timeMatch[2] + ' 2025';
                                console.log('Pattern 3 - Start date string:', startDateStr);
                                console.log('Pattern 3 - End date string:', endDateStr);
                                try {
                                    startDate = fetchDateFromString(fixDateString(startDateStr));
                                    console.log('Pattern 3 - Start date result:', startDate);
                                } catch (err) {
                                    console.error('Pattern 3 - Start date error:', err);
                                }
                                try {
                                    endDate = fetchDateFromString(fixDateString(endDateStr));
                                    console.log('Pattern 3 - End date result:', endDate);
                                } catch (err) {
                                    console.error('Pattern 3 - End date error:', err);
                                }
                            }
                        } catch (err) {
                            console.error('Date parsing error (Pattern 3):', err);
                        }
                    } else {
                        // Pattern 3b: Single day events with "from X to Y" (no comma after year)
                        dateRangeMatch = firstP.match(/([A-Za-z]+day, [A-Za-z]+ \d{1,2}, \d{4} from \d{1,2}:\d{2} [ap]\.m\. to \d{1,2}:\d{2} [ap]\.m\.)/);
                        if (dateRangeMatch) {
                            dateRangeRaw = dateRangeMatch[0];
                            console.log('Extracted date range (Pattern 3b):', dateRangeRaw);
                            try {
                                const dateMatch = dateRangeMatch[1].match(/([A-Za-z]+day, [A-Za-z]+ \d{1,2}, \d{4})/);
                                const timeMatch = dateRangeMatch[1].match(/from (\d{1,2}:\d{2} [ap]\.m\.) to (\d{1,2}:\d{2} [ap]\.m\.)/);
                                if (dateMatch && timeMatch) {
                                    // Extract date parts: "Saturday, June 21, 2025" -> "June 21, 2025"
                                    const dateParts = dateMatch[1].split(', ');
                                    const monthDay = dateParts[1] + ', ' + dateParts[2]; // "June 21, 2025"
                                    const startDateStr = monthDay.replace(', 2025', '') + ', at ' + timeMatch[1] + ' 2025';
                                    const endDateStr = monthDay.replace(', 2025', '') + ', at ' + timeMatch[2] + ' 2025';
                                    console.log('Pattern 3b - Start date string:', startDateStr);
                                    console.log('Pattern 3b - End date string:', endDateStr);
                                    try {
                                        startDate = fetchDateFromString(fixDateString(startDateStr));
                                        console.log('Pattern 3b - Start date result:', startDate);
                                    } catch (err) {
                                        console.error('Pattern 3b - Start date error:', err);
                                    }
                                    try {
                                        endDate = fetchDateFromString(fixDateString(endDateStr));
                                        console.log('Pattern 3b - End date result:', endDate);
                                    } catch (err) {
                                        console.error('Pattern 3b - End date error:', err);
                                    }
                                }
                            } catch (err) {
                                console.error('Date parsing error (Pattern 3b):', err);
                            }
                        } else {
                            // Pattern 4: Events with timezones (PDT, etc.)
                            dateRangeMatch = firstP.match(/([A-Za-z]+, [A-Za-z]+ \d{1,2}, at \d{1,2}:\d{2} [ap]\.m\. [A-Z]+) to ([A-Za-z]+, [A-Za-z]+ \d{1,2}, at \d{1,2}:\d{2} [ap]\.m\. [A-Z]+)/);
                            if (dateRangeMatch) {
                                dateRangeRaw = dateRangeMatch[0];
                                console.log('Extracted date range (Pattern 4):', dateRangeRaw);
                                try {
                                    // Remove timezone for parsing, assume local time
                                    const startWithoutTz = dateRangeMatch[1].replace(/ [A-Z]+$/, '');
                                    const endWithoutTz = dateRangeMatch[2].replace(/ [A-Z]+$/, '');
                                    startDate = fetchDateFromString(fixDateString(startWithoutTz + ' 2025'));
                                    endDate = fetchDateFromString(fixDateString(endWithoutTz));
                                } catch (err) {
                                    console.error('Date parsing error (Pattern 4):', err);
                                }
                            } else {
                                // Pattern 5: Events with "local time" in the middle
                                dateRangeMatch = firstP.match(/([A-Za-z]+day, [A-Za-z]+ \d{1,2}, at \d{1,2}:\d{2} [ap]\.m\. local time to [A-Za-z]+day, [A-Za-z]+ \d{1,2}, \d{4},? at \d{1,2}:\d{2} [ap]\.m\.)/);
                                if (dateRangeMatch) {
                                    dateRangeRaw = dateRangeMatch[0];
                                    console.log('Extracted date range (Pattern 5):', dateRangeRaw);
                                    try {
                                        // Extract start and end parts
                                        const parts = dateRangeMatch[0].split(' to ');
                                        if (parts.length === 2) {
                                            startDate = fetchDateFromString(fixDateString(parts[0].replace(' local time', '') + ' 2025'));
                                            endDate = fetchDateFromString(fixDateString(parts[1]));
                                        }
                                    } catch (err) {
                                        console.error('Date parsing error (Pattern 5):', err);
                                    }
                                } else {
                                    // Pattern 6: "Saturday, June 28, and Sunday, June 29, 2025, from X to Y"
                                    dateRangeMatch = firstP.match(/([A-Za-z]+day, [A-Za-z]+ \d{1,2}, and [A-Za-z]+day, [A-Za-z]+ \d{1,2}, \d{4}, from \d{1,2}:\d{2} [ap]\.m\. to \d{1,2}:\d{2} [ap]\.m\.)/);
                                    if (dateRangeMatch) {
                                        dateRangeRaw = dateRangeMatch[0];
                                        console.log('Extracted date range (Pattern 6):', dateRangeRaw);
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
                                            console.error('Date parsing error (Pattern 6):', err);
                                        }
                                    } else {
                                        // Pattern 7: Single start date with timezone "will start on Tuesday, June 3, 2025, at 1:00 p.m. PDT"
                                        dateRangeMatch = firstP.match(/will start on ([A-Za-z]+day, [A-Za-z]+ \d{1,2}, \d{4}, at \d{1,2}:\d{2} [ap]\.m\. [A-Z]+)/);
                                        if (dateRangeMatch) {
                                            dateRangeRaw = dateRangeMatch[0];
                                            console.log('Extracted date range (Pattern 7):', dateRangeRaw);
                                            try {
                                                // Remove timezone and parse
                                                const dateWithoutTz = dateRangeMatch[1].replace(/ [A-Z]+$/, '');
                                                startDate = fetchDateFromString(fixDateString(dateWithoutTz));
                                                endDate = startDate; // Single day event
                                            } catch (err) {
                                                console.error('Date parsing error (Pattern 7):', err);
                                            }
                                        } else {
                                            // Pattern 8: Simple date ranges without "at" (fix Pattern 2)
                                            dateRangeMatch = firstP.match(/([A-Za-z]+ \d{1,2} to [A-Za-z]+ \d{1,2}, \d{4},? at \d{1,2}:\d{2} [ap]\.m\.)/);
                                            if (dateRangeMatch) {
                                                dateRangeRaw = dateRangeMatch[0];
                                                console.log('Extracted date range (Pattern 8):', dateRangeRaw);
                                                try {
                                                    // This is a more complex format, might need custom parsing
                                                    console.log('Complex date format detected, needs custom parsing');
                                                } catch (err) {
                                                    console.error('Date parsing error (Pattern 8):', err);
                                                }
                                            } else {
                                                console.log('No date range matched in first <p>. Content starts with:', firstP.substring(0, 50));
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            
            if (startDate && endDate) {
                successCount++;
            }
            console.log('Parsed start date:', startDate ? new Date(startDate).toLocaleString() : 'N/A');
            console.log('Parsed end date:', endDate ? new Date(endDate).toLocaleString() : 'N/A');
            console.log('Raw start epoch:', startDate);
            console.log('Raw end epoch:', endDate);
            
        } catch (error) {
            console.error('Error processing event:', error);
        }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log(`SUMMARY: ${successCount}/${totalCount} posts successfully parsed (${Math.round(successCount/totalCount*100)}%)`);
    console.log('='.repeat(80));
}

testMultipleEvents().catch(console.error); 