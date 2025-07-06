import { PokemonGoFetcher } from './services/pokemongo-fetcher';
import { fetchDateFromString, fixDateString } from './utils/normalization';

const EVENT_URL = 'https://pokemongo.com/en/post/ultra-unlock-hisui';

async function testSingleEvent() {
    const fetcher = new PokemonGoFetcher();
    console.log('Fetching event:', EVENT_URL);
    const post = await fetcher.fetchSinglePost(EVENT_URL);
    if (!post) {
        console.error('Failed to fetch event post.');
        return;
    }
    console.log('Fetched HTML length:', post.html.length);
    console.log('First 1000 HTML chars:', post.html.slice(0, 1000));

    // Print all lines containing a year (likely to be a date)
    const yearLines = post.html.split('\n').filter(line => /202\d/.test(line));
    console.log('Lines with years:', yearLines);

    // Parse title
    const titleMatch = post.html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    const title = titleMatch ? titleMatch[1].trim() : post.title;
    console.log('Parsed title:', title);

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

    // Try to extract date range from the firstP string
    let dateRangeRaw = '';
    let startDate = 0;
    let endDate = 0;
    const dateRangeMatch = firstP.match(/([A-Za-z]+day, [A-Za-z]+ \d{1,2},? at \d{1,2}:\d{2} [ap]\.m\.) to ([A-Za-z]+day, [A-Za-z]+ \d{1,2}, \d{4},? at \d{1,2}:\d{2} [ap]\.m\.)/);
    if (dateRangeMatch) {
        dateRangeRaw = dateRangeMatch[0];
        console.log('Extracted date range:', dateRangeRaw);
        try {
            startDate = fetchDateFromString(fixDateString(dateRangeMatch[1] + ' 2025'));
            endDate = fetchDateFromString(fixDateString(dateRangeMatch[2]));
        } catch (err) {
            console.error('Date parsing error:', err);
        }
    } else {
        console.log('No date range matched in first <p>.');
    }
    console.log('Parsed start date:', startDate ? new Date(startDate).toLocaleString() : 'N/A');
    console.log('Parsed end date:', endDate ? new Date(endDate).toLocaleString() : 'N/A');
    console.log('Raw start epoch:', startDate);
    console.log('Raw end epoch:', endDate);
}

testSingleEvent().catch(console.error); 