import { MONTHS, POKEMON_OVERRIDES } from '../config/constants';

export const toMonthIndex = (month: string): number => {
    return MONTHS.indexOf(month);
};

export const removeLeadingAndTrailingAsterisks = (plainText: string): string => {
    if (plainText.startsWith('*')) {
        plainText = plainText.substring(1);
    }

    if (plainText.endsWith('*')) {
        plainText = plainText.substring(0, plainText.length - 1);
    }

    return plainText;
};

export const normalizeSpeciesNameForId = (speciesName: string): string => {
    return speciesName
        .replaceAll("-", "_")
        .replaceAll(". ", "_")
        .replaceAll(/[’‘‛′'`]/g, "")
        .replaceAll(" ", "_")
        .replaceAll(" (jr)", "_jr")
        .replaceAll('♂', '_male')
        .replaceAll('♀', '_female');
};

export const ndfNormalized = (str: string): string => {
    return str
        .toLocaleLowerCase()
        .replaceAll(/[’‘‛′`]/g, "'")
        .replaceAll("'", "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
};

export const fetchDateFromString = (date: string): number => {
    try {
        const trimmedDate = date
            .trim()
            .replaceAll("  ", " ")
            .replaceAll(/\u00A0/g, " ")
            .replaceAll("  ", " ")
            .replaceAll("a.m.", "am")
            .replaceAll("A.M.", "am")
            .replaceAll("p.m.", "pm")
            .replaceAll("P.M.", "pm");

        // Remove weekdays from the beginning of the string
        let cleanDate = trimmedDate.replace(/^[A-Za-z]+day,\s*/, '');
        
        // Handle "from X to Y" format for single-day events
        if (/from \d{1,2}:\d{2} [ap]m to \d{1,2}:\d{2} [ap]m/.test(cleanDate.replace(/\./g, ''))) {
            // Extract date and start time
            const dateMatch = cleanDate.match(/([A-Za-z]+ \d{1,2},? \d{4}), from (\d{1,2}:\d{2} [ap]\.m\.) to (\d{1,2}:\d{2} [ap]\.m\.)/);
            if (dateMatch) {
                const base = dateMatch[1].replace(/\./g, '');
                const start = base + ', at ' + dateMatch[2].replace(/\./g, '');
                return fetchDateFromString(start);
            }
        }

        // Handle "at" format: "June 23 at 10:00 a.m."
        if (/^[A-Za-z]+ \d{1,2} at \d{1,2}:\d{2} [ap]m/.test(cleanDate.replace(/\./g, ''))) {
            // Convert to standard format
            cleanDate = cleanDate.replace(/ at /, ', at ');
        }

        // Handle "and" format for multi-day ranges: "June 21 and Sunday, June 22"
        if (cleanDate.includes(' and ')) {
            // Take the first date in the range
            cleanDate = cleanDate.split(' and ')[0];
            // Remove any weekday from the first part
            cleanDate = cleanDate.replace(/^[A-Za-z]+day,\s*/, '');
        }

        // Handle "to" format for date ranges: "June 21 to June 23"
        if (cleanDate.includes(' to ')) {
            // Take the first date in the range
            cleanDate = cleanDate.split(' to ')[0];
        }

        // Remove "local time" or similar suffixes
        const localIdx = cleanDate.toLowerCase().lastIndexOf("local");
        if (localIdx !== -1) {
            cleanDate = cleanDate.substring(0, localIdx).trim();
        }

        // Remove timezone abbreviations
        cleanDate = cleanDate.replace(/\b(PDT|PST|EDT|EST|UTC|GMT)\b/g, '').trim();

        // Clean up any remaining artifacts
        cleanDate = cleanDate.replace(", at", "").trim();

        // Parse the cleaned date string
        const components = cleanDate.split(" ");
        if (components.length < 2) return NaN;

        // Extract month, day, year, and time
        const month = components[0];
        const day = components[1].replace(',', '');
        
        // Find year - it could be in different positions
        let year = new Date().getFullYear();
        let timeStr = '';
        
        // Look for year in the components
        for (let i = 2; i < components.length; i++) {
            const comp = components[i].replace(',', '');
            if (comp.length === 4 && !isNaN(parseInt(comp)) && parseInt(comp) > 2020 && parseInt(comp) < 2050) {
                year = parseInt(comp);
                // Time might be after the year
                if (i + 1 < components.length) {
                    timeStr = components.slice(i + 1).join(' ');
                }
                break;
            } else if (comp.includes(':') || comp.includes('am') || comp.includes('pm')) {
                // This is time
                timeStr = components.slice(i).join(' ');
                break;
            }
        }
        
        // If no year found and no time found, check if there's time in the last component
        if (timeStr === '' && components.length > 2) {
            const lastComp = components[components.length - 1];
            if (lastComp.includes(':') || lastComp.includes('am') || lastComp.includes('pm')) {
                timeStr = lastComp;
            }
        }

        // Handle time component if present
        let hour = 0, minute = 0;
        if (timeStr) {
            // Extract time from "at 10:00 am" format
            const timeMatch = timeStr.match(/at (\d{1,2}):(\d{2}) ([ap]m)/);
            if (timeMatch) {
                hour = parseInt(timeMatch[1]);
                minute = parseInt(timeMatch[2]);
                const ampm = timeMatch[3].toLowerCase();
                
                // Adjust for PM
                if (ampm === 'pm' && hour !== 12) {
                    hour += 12;
                }
                // Adjust for AM (12 AM = 0)
                if (ampm === 'am' && hour === 12) {
                    hour = 0;
                }
            }
        }

        const monthIdx = toMonthIndex(month);
        if (monthIdx === -1) return NaN;

        const dateObj = new Date(
            year, 
            monthIdx, 
            parseInt(day), 
            hour, 
            minute
        );
        
        return dateObj.valueOf();
    } catch (e) {
        return NaN;
    }
};

export const normalizePokemonName = (pokemonName: string): string => {
    let normalized = pokemonName
        .replace("*", "")
        .replace(" Forme", "")
        .trim()
        .replaceAll("(normal)", "")
        .replaceAll(' cloak', '')
        .trim();

    // Apply overrides
    for (const [key, value] of Object.entries(POKEMON_OVERRIDES)) {
        if (normalized.includes(key)) {
            normalized = normalized.replace(key, value);
        }
    }

    return normalized;
};

export const fixDateString = (dateString: string) => dateString.replace(/(\b[A-Za-z]+), (\d{1,2})/, "$1 $2");

export function parseEventDateRange(date: string): Array<{ start: number, end: number }> {
    if (!date) return [];
    // Remove trailing period
    if (date.endsWith('.')) date = date.slice(0, -1);
    // Normalize spaces and time suffixes
    date = date
        .replaceAll(/\u00A0/g, ' ')
        .replaceAll('  ', ' ')
        .replaceAll('a.m.', 'am')
        .replaceAll('A.M.', 'am')
        .replaceAll('p.m.', 'pm')
        .replaceAll('P.M.', 'pm')
        .replaceAll('local time', '')
        .replaceAll('PDT', '').replaceAll('PST', '').replaceAll('EDT', '').replaceAll('EST', '').replaceAll('UTC', '').replaceAll('GMT', '')
        .trim();
    // Remove weekday at start
    date = date.replace(/^[A-Za-z]+day,\s*/, '');

    // Special handling for multi-day time ranges: handle both old and new formats
    if (date.includes(' and ') && date.includes(' from ') && date.includes(' to ')) {
        // Much more flexible regex to handle various formats:
        // 'Saturday, July 5, and Sunday, July 6, 2025 from 2:00 p.m. to 5:00 p.m. local time.'
        // 'June 28, and Sunday, June 29, 2025, from 10:00 a.m. to 6:00 p.m.'
        // 'Saturday, June 28, and Sunday, June 29, 2025, from 10:00 a.m. to 6:00 p.m.'
        // 'Saturday, July 5, and Sunday, July 6, 2025 from 2:00 p.m. to 5:00 p.m. local time.'
        const multiDayMatch = date.match(/([A-Za-z]+ \d{1,2}),? and (?:[A-Za-z]+day, )?([A-Za-z]+ \d{1,2})(?:, (\d{4}))?,? from (\d{1,2}:\d{2} [ap]m) to (\d{1,2}:\d{2} [ap]m)/i);
        if (multiDayMatch && multiDayMatch[1] && multiDayMatch[2] && multiDayMatch[4] && multiDayMatch[5]) {
            let year = multiDayMatch[3] || '2025';
            let startDate = multiDayMatch[1] + ', ' + year;
            let endDate = multiDayMatch[2] + ', ' + year;
            const startTime = multiDayMatch[4];
            const endTime = multiDayMatch[5];
            
            // Add null checks before calling parseSide
            if (startDate && endDate && startTime && endTime) {
                const day1Start = parseSide(startDate + ', at ' + startTime);
                const day1End = parseSide(startDate + ', at ' + endTime);
                const day2Start = parseSide(endDate + ', at ' + startTime);
                const day2End = parseSide(endDate + ', at ' + endTime);
                if (!isNaN(day1Start) && !isNaN(day1End) && !isNaN(day2Start) && !isNaN(day2End)) {
                    return [
                        { start: day1Start, end: day1End },
                        { start: day2Start, end: day2End }
                    ];
                }
            }
        } else {
            if (typeof console !== 'undefined' && console.warn) {
                console.warn('[parseEventDateRange] Multi-day date string did not match or had missing groups:', date, multiDayMatch);
            }
        }
    }

    // Unify "from ... to ..." to "to" format
    if (date.includes(' from ') && date.includes(' to ')) {
        const split = date.split(' to ');
        split[0] = split[0].replace(' from ', ' at ');
        const idx = split[0].indexOf(' at ') + 4;
        split[1] = split[0].substring(0, idx) + split[1];
        date = split.join(' to ');
    }
    // Unify "and ..." to "to" format
    if (date.includes(' and ')) {
        const split = date.split(' and ');
        date = split[0] + ' to ' + split[1];
    }
    // Split on " to "
    const parsedDate = date.split(' to ');
    if (parsedDate.length > 2) return [];
    // Ensure ", at" for easier parsing
    for (let i = 0; i < parsedDate.length; i++) {
        if (!parsedDate[i].includes(', at') && parsedDate[i].includes(' at')) {
            parsedDate[i] = parsedDate[i].replace(' at', ', at');
        }
    }
    // Parse each side
    function parseSide(side: string): number {
        if (!side || typeof side !== 'string') return NaN;
        
        side = fixDateString(side.trim());
        // Remove weekday if still present
        side = side.replace(/^[A-Za-z]+day,\s*/, '');
        // Find year
        let year = new Date().getFullYear();
        const yearMatch = side.match(/, (\d{4})/);
        if (yearMatch) {
            year = Number(yearMatch[1]);
            side = side.replace(', ' + year, '');
        }
        // Find time - FIXED: capture AM/PM properly with more flexible regex
        let timeMatch = side.match(/, at (\d{1,2}):(\d{2}) ([ap]m)/i);
        let hour = 0, minute = 0;
        if (timeMatch) {
            hour = Number(timeMatch[1]);
            minute = Number(timeMatch[2]);
            const ampm = timeMatch[3].toLowerCase();
            if (ampm === 'pm' && hour !== 12) hour += 12;
            if (ampm === 'am' && hour === 12) hour = 0;
        } else {
            // Try alternative pattern without "at"
            timeMatch = side.match(/(\d{1,2}):(\d{2}) ([ap]m)/i);
            if (timeMatch) {
                hour = Number(timeMatch[1]);
                minute = Number(timeMatch[2]);
                const ampm = timeMatch[3].toLowerCase();
                if (ampm === 'pm' && hour !== 12) hour += 12;
                if (ampm === 'am' && hour === 12) hour = 0;
            }
        }
        // Remove time for date parsing
        const datePart = side.split(', at')[0];
        // Parse month and day
        const month = datePart.trim().split(' ')[0];
        const day = datePart.trim().split(' ')[1]?.replace(',', '');
        const monthIdx = toMonthIndex(month);
        if (monthIdx === -1 || !day) return NaN;
        return new Date(year, monthIdx, Number(day), hour, minute).valueOf();
    }
    const start = parseSide(parsedDate[0]);
    const end = parsedDate[1] ? parseSide(parsedDate[1]) : start;
    if (isNaN(start) || isNaN(end)) return [];
    return [{ start, end }];
}

// New function for multi-day events with multiple time ranges
export function parseMultiDayEvent(date: string): Array<{ start: number, end: number }> {
    if (!date) return [];
    // Remove trailing period
    if (date.endsWith('.')) date = date.slice(0, -1);
    // Normalize spaces and time suffixes
    date = date
        .replaceAll(/\u00A0/g, ' ')
        .replaceAll('  ', ' ')
        .replaceAll('a.m.', 'am')
        .replaceAll('A.M.', 'am')
        .replaceAll('p.m.', 'pm')
        .replaceAll('P.M.', 'pm')
        .replaceAll('local time', '')
        .replaceAll('PDT', '').replaceAll('PST', '').replaceAll('EDT', '').replaceAll('EST', '').replaceAll('UTC', '').replaceAll('GMT', '')
        .trim();
    // Remove weekday at start
    date = date.replace(/^[A-Za-z]+day,\s*/, '');

    // Handle multi-day time ranges: "June 28, and Sunday, June 29, 2025, from 10:00 a.m. to 6:00 p.m."
    if (date.includes(' and ') && date.includes(' from ') && date.includes(' to ')) {
        const andMatch = date.match(/([A-Za-z]+ \d{1,2}), and [A-Za-z]+day, ([A-Za-z]+ \d{1,2}, \d{4}),? from (\d{1,2}:\d{2} [ap]m) to (\d{1,2}:\d{2} [ap]m)/i);
        if (andMatch) {
            const startDate = andMatch[1] + ', 2025';
            const endDate = andMatch[2];
            const startTime = andMatch[3];
            const endTime = andMatch[4];
            
            const start = parseSide(startDate + ', at ' + startTime);
            const end = parseSide(endDate + ', at ' + endTime);
            
            if (!isNaN(start) && !isNaN(end)) {
                return [{ start, end }];
            }
        }
    }

    // Fallback to single range
    const singleRange = parseEventDateRange(date);
    return singleRange;

    function parseSide(side: string): number {
        side = side.trim();
        // Remove weekday if still present
        side = side.replace(/^[A-Za-z]+day,\s*/, '');
        // Find year
        let year = new Date().getFullYear();
        const yearMatch = side.match(/, (\d{4})/);
        if (yearMatch) {
            year = Number(yearMatch[1]);
            side = side.replace(', ' + year, '');
        }
        // Find time
        const timeMatch = side.match(/, at (\d{1,2}):(\d{2}) ([ap]m)/i);
        let hour = 0, minute = 0;
        if (timeMatch) {
            hour = Number(timeMatch[1]);
            minute = Number(timeMatch[2]);
            const ampm = timeMatch[3].toLowerCase();
            if (ampm === 'pm' && hour !== 12) hour += 12;
            if (ampm === 'am' && hour === 12) hour = 0;
        }
        // Remove time for date parsing
        const datePart = side.split(', at')[0];
        // Parse month and day
        const month = datePart.trim().split(' ')[0];
        const day = datePart.trim().split(' ')[1].replace(',', '');
        const monthIdx = toMonthIndex(month);
        if (monthIdx === -1 || !day) return NaN;
        return new Date(year, monthIdx, Number(day), hour, minute).valueOf();
    }
} 