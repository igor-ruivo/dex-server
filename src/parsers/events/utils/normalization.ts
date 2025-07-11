/**
 * Shared normalization utilities for date, string, and Pokémon name normalization.
 * Used by both event and Pokémon pipelines for consistent parsing and matching.
 */
import { MONTHS } from '../config/constants';

const dateWithoutTimezone = (date: string) => {
    return date
        .replaceAll('local time', '')
        .replaceAll('PDT', '').replaceAll('PST', '').replaceAll('EDT', '').replaceAll('EST', '').replaceAll('UTC', '').replaceAll('GMT', '')
        .trim();
}

const dateModifierNormalization = (date: string) => {
    return date
        .trim()
        .replaceAll("  ", " ")
        .replaceAll(/\u00A0/g, " ")
        .replaceAll("  ", " ")
        .replaceAll("a.m.", "am")
        .replaceAll("A.M.", "am")
        .replaceAll("p.m.", "pm")
        .replaceAll("P.M.", "pm");
}

/**
 * Converts a month name to its index (0-based).
 */
export const toMonthIndex = (month: string): number => {
    return MONTHS.indexOf(month);
};

/**
 * Normalizes a date string for easier parsing (e.g., removes weekday).
 */
export const fixDateString = (dateString: string) => dateString.replace(/(\b[A-Za-z]+), (\d{1,2})/, "$1 $2");

/**
 * Parses a date range string and returns an array of {start, end} timestamps.
 * Handles multi-day and single-day event formats.
 */
export function parseEventDateRange(date: string): Array<{ start: number, end: number }> {
    if (!date) return [];
    // Remove trailing period
    if (date.endsWith('.')) date = date.slice(0, -1);
    // Normalize spaces and time suffixes
    date = dateWithoutTimezone(dateModifierNormalization(date));
    // Remove weekday at start
    date = date.replace(/^[A-Za-z]+day,\s*/, '');

    // --- Patch: Normalize hyphens (– or -) to ' to ' for season date strings ---
    if (!date.includes(' to ')) {
        date = date.replace(/[\u2013\u2014\u2012\u2011\u2010-]/g, 'to ');
    }

    // Special handling for multi-day time ranges: handle both old and new formats
    if (date.includes(' and ') && date.includes(' from ') && date.includes(' to ')) {
        const multiDayMatch = /([A-Za-z]+ \d{1,2}),? and (?:[A-Za-z]+day, )?([A-Za-z]+ \d{1,2})(?:, (\d{4}))?,? from (\d{1,2}:\d{2} [ap]m) to (\d{1,2}:\d{2} [ap]m)/i.exec(date);
        if (multiDayMatch?.[1] && multiDayMatch?.[2] && multiDayMatch?.[4] && multiDayMatch?.[5]) {
            const year = multiDayMatch[3] || '2025';
            const startDate = multiDayMatch[1] + ', ' + year;
            const endDate = multiDayMatch[2] + ', ' + year;
            const startTime = multiDayMatch[4];
            const endTime = multiDayMatch[5];
            if (startDate && endDate && startTime && endTime) {
                const day1Start = parseDateFromString(startDate + ', at ' + startTime);
                const day1End = parseDateFromString(startDate + ', at ' + endTime);
                const day2Start = parseDateFromString(endDate + ', at ' + startTime);
                const day2End = parseDateFromString(endDate + ', at ' + endTime);
                if (!isNaN(day1Start) && !isNaN(day1End) && !isNaN(day2Start) && !isNaN(day2End)) {
                    return [
                        { start: day1Start, end: day1End },
                        { start: day2Start, end: day2End }
                    ];
                }
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
    // --- Patch: If second part is just a time, prepend date from first part ---
    if (parsedDate.length === 2) {
        const timeOnlyRegex = /^\s*(\d{1,2}:\d{2} [ap]m)\s*$/i;
        if (timeOnlyRegex.test(parsedDate[1].trim())) {
            // Extract date part from first side (before ', at')
            const datePart = parsedDate[0].split(', at')[0];
            parsedDate[1] = datePart + ', at ' + parsedDate[1].trim();
        }
    }
    
    const start = parseDateFromString(parsedDate[0]);
    const end = parsedDate[1] ? parseDateFromString(parsedDate[1]) : start;
    if (isNaN(start) || isNaN(end)) return [];
    return [{ start, end }];
}

export function parseDateFromString(side: string): number {
    if (!side || typeof side !== 'string') return NaN;
    side = fixDateString(side.trim());
    side = side.replace(/^[A-Za-z]+day,\s*/, '');
    let year = new Date().getFullYear();
    const yearMatch = /, (\d{4})/.exec(side);
    if (yearMatch) {
        year = Number(yearMatch[1]);
        side = side.replace(', ' + year, '');
    }
    let timeMatch = /, at (\d{1,2}):(\d{2}) ([ap]m)/i.exec(side);
    let hour = 0, minute = 0;
    if (timeMatch) {
        hour = Number(timeMatch[1]);
        minute = Number(timeMatch[2]);
        const ampm = timeMatch[3].toLowerCase();
        if (ampm === 'pm' && hour !== 12) hour += 12;
        if (ampm === 'am' && hour === 12) hour = 0;
    } else {
        timeMatch = /(\d{1,2}):(\d{2}) ([ap]m)/i.exec(side);
        if (timeMatch) {
            hour = Number(timeMatch[1]);
            minute = Number(timeMatch[2]);
            const ampm = timeMatch[3].toLowerCase();
            if (ampm === 'pm' && hour !== 12) hour += 12;
            if (ampm === 'am' && hour === 12) hour = 0;
        }
    }
    const datePart = side.split(', at')[0];
    const month = datePart.trim().split(' ')[0];
    const day = datePart.trim().split(' ')[1]?.replace(',', '');
    const monthIdx = toMonthIndex(month);
    if (monthIdx === -1 || !day) return NaN;
    return new Date(year, monthIdx, Number(day), hour, minute).valueOf();
}