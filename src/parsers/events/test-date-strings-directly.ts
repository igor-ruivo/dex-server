import { parseEventDateRange } from './utils/normalization';

const testDateStrings = [
    // set manually, don't change. Ever
    'Tuesday, July 15, at 10:00 a.m. to Sunday, July 20, 2025, at 8:00 p.m. local time',
    'Saturday, July 12, 2025, from 2:00 p.m. to 5:00 p.m. local time',
    'Tuesday, July 22, at 10:00 a.m. to Sunday, July 27, 2025, at 8:00 p.m. local time',
    'Tuesday, July 8, at 10:00 a.m. to Sunday, July 13, 2025, at 8:00 p.m. local time',
    'Saturday, June 28, and Sunday, June 29, 2025, from 10:00 a.m. to 6:00 p.m. local time each day',
    'Sunday, July 20, 2025, from 2:00 p.m. to 5:00 p.m. local time',
    'Tuesday, July 1, at 10:00 a.m. to Sunday, July 6, 2025, at 8:00 p.m. local time',
    'Monday, June 23, at 10:00 a.m. local time to Sunday, June 29, 2025 at 11:59 p.m. local time',
    'Saturday, July 5, and Sunday, July 6, 2025 from 2:00 p.m. to 5:00 p.m. local time.',
    'Friday, June 20, at 12:00 a.m. to Sunday, June 22, 2025, at 11:59 p.m. local time',
    'Saturday, June 21, 2025, from 2:00 p.m. to 5:00 p.m. local time',
    'June 23 at 10:00 a.m. to June 27, 2025, at 8:00 p.m. local time',
    'Friday, May 30, at 10:00 a.m. to Tuesday, June 3, 2025, at 8:00 p.m. local time',
    'Saturday, June 7, at 10:00 a.m. to Wednesday, June 11, 2025, at 8:00 p.m. local time'
];

console.log("Testing date strings directly:");
console.log("=".repeat(80));
console.log();

for (const dateString of testDateStrings) {
    console.log(`Input: "${dateString}"`);
    
    // Debug: Let's see what happens with the "from X to Y" format
    if (dateString.includes(' from ') && dateString.includes(' to ')) {
        console.log(`  Debug: Found "from ... to ..." format`);
        const split = dateString.split(' to ');
        console.log(`  Debug: Split[0] = "${split[0]}"`);
        console.log(`  Debug: Split[1] = "${split[1]}"`);
    }
    
    const results = parseEventDateRange(dateString);
    
    if (results.length > 0) {
        if (results.length === 1) {
            const result = results[0];
            if (result.start === result.end) {
                const date = new Date(result.start);
                console.log(`Result: ${result.start} (${date.toLocaleDateString()}, ${date.toLocaleTimeString()})`);
            } else {
                const startDate = new Date(result.start);
                const endDate = new Date(result.end);
                console.log(`Start: ${result.start} (${startDate.toLocaleDateString()}, ${startDate.toLocaleTimeString()})`);
                console.log(`End:   ${result.end} (${endDate.toLocaleDateString()}, ${endDate.toLocaleTimeString()})`);
            }
        } else {
            console.log(`Multiple ranges (${results.length}):`);
            results.forEach((result, index) => {
                const startDate = new Date(result.start);
                const endDate = new Date(result.end);
                console.log(`  Range ${index + 1}: ${result.start} (${startDate.toLocaleDateString()}, ${startDate.toLocaleTimeString()}) to ${result.end} (${endDate.toLocaleDateString()}, ${endDate.toLocaleTimeString()})`);
            });
        }
    } else {
        console.log("Result: FAILED TO PARSE");
    }
    
    console.log();
} 