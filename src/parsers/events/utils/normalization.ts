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
        .replaceAll("'", "")
        .replaceAll("'", "")
        .replaceAll(" ", "_")
        .replaceAll(" (jr)", "_jr")
        .replaceAll('♂', '_male')
        .replaceAll('♀', '_female');
};

export const ndfNormalized = (str: string): string => {
    return str
        .toLocaleLowerCase()
        .replaceAll("'", "'")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
};

export const fetchDateFromString = (date: string): number => {
    const trimmedDate = date
        .trim()
        .replaceAll("  ", " ")
        .replaceAll(/\u00A0/g, " ")
        .replaceAll("  ", " ")
        .replaceAll("a.m.", "am")
        .replaceAll("A.M.", "am")
        .replaceAll("p.m.", "pm")
        .replaceAll("P.M.", "pm");

    let dWithoutWeekDay = trimmedDate.substring(trimmedDate.indexOf(", ") + 2);
    const hasYear = dWithoutWeekDay.split(", ")[1]?.trim().length === 4 && 
                   Number(dWithoutWeekDay.split(", ")[1]?.trim()) > 2020 && 
                   Number(dWithoutWeekDay.split(", ")[1]?.trim()) < 2050;

    let year = (new Date()).getFullYear();
    if (hasYear) {
        year = Number(dWithoutWeekDay.split(", ")[1]);
        dWithoutWeekDay = dWithoutWeekDay.split(", ").filter((e: string, i: number) => i !== 1).join(", ");
    }

    const localIdx = dWithoutWeekDay.toLocaleLowerCase().lastIndexOf("local");
    const finalDate = dWithoutWeekDay.substring(0, localIdx === -1 ? undefined : localIdx).trim().replace(", at", "");
    const components = finalDate.split(" ");
    const timeComponent = components[2].split(":");
    
    const dateObj = new Date(
        year, 
        toMonthIndex(components[0]), 
        Number(components[1]), 
        Number(timeComponent[0]) + Number(components[3].toLocaleLowerCase() === "pm" && Number(timeComponent[0]) !== 12 ? 12 : 0), 
        Number(timeComponent[1])
    );

    return dateObj.valueOf();
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

export const fixDateString = (dateString: string): string => {
    return dateString.replace(/(\b[A-Za-z]+), (\d{1,2})/, "$1 $2");
}; 