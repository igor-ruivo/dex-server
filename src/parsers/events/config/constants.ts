export const KNOWN_FORMS = new Set([
    "Mow",
    "Alolan",
    "Wash",
    "Plant",
    "Sandy",
    "Trash",
    "Frost",
    "Sky",
    "Hero",
    "Speed",
    "Land",
    "Attack",
    "Origin",
    "Aria",
    "Burn",
    "Unbound",
    "Pa'u",
    "Dusk",
    "Armored",
    "Paldean",
    "Rainy",
    "Snowy",
    "Sunny",
    "Defense",
    "Chill",
    "Douse",
    "Shock",
    "Baile",
    "Sensu",
    "Galarian",
    "Hisuian",
    "Ordinary",
    "Large",
    "Small",
    "Super",
    "Midday",
    "Overcast",
    "Sunshine",
    "Altered",
    "Therian",
    "Pom-Pom",
    "Average",
    "Midnight",
    "Incarnate",
    "Standard"
]);

export const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

export const WHITELIST_KEYWORDS = [
    "(sunny)", "(rainy)", "(snowy)", 
    "sunny form", "rainy form", "snowy form"
];

export const BLACKLISTED_KEYWORDS = [
    "some trainers", "the following", "appearing", 
    "lucky, you m", " tms", "and more", "wild encounters", 
    "sunny", "event-themed", "rainy", "snow", 
    "partly cloudy", "cloudy", "windy", "fog", 
    "will be available"
];

export const CORS_PROXY_URL = 'https://cors-anywhere.herokuapp.com/';

export const POKEMON_OVERRIDES: Record<string, string> = {
    'palkida': 'palkia',
    'darmanitan': 'darmanitan_standard',
    'giratina': 'giratina_altered',
    'zacian': 'zacian_hero',
    'zamazenta': 'zamazenta_hero',
    'morpeko': 'morpeko_full_belly',
    'pumpkaboo': 'pumpkaboo_average',
    'gourgeist': 'gourgeist_average'
};

export const RAID_LEVEL_MAPPINGS: Record<string, string> = {
    'one-star': '1',
    'three-star': '3',
    'four-star': '4',
    'five-star': '5',
    'six-star': '6',
    'shadow': 'Shadow'
}; 