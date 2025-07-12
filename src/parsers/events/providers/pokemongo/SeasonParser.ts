import { JSDOM } from 'jsdom';

import { HttpDataFetcher } from '../../../services/data-fetcher';
import { AvailableLocales, pairEventTranslations } from '../../../services/gamemaster-translator';
import { IEntry, IParsedEvent,PublicEvent } from '../../../types/events';
import { GameMasterPokemon } from '../../../types/pokemon';
import { parseEventDateRange } from '../../utils/normalization';
import { extractPokemonSpeciesIdsFromElements,PokemonMatcher } from '../../utils/pokemon-matcher';

// Helper to extract text content from a selector
const getText = (doc: Document, selector: string) => doc.querySelector(selector)?.textContent?.trim() ?? '';

export async function fetchSeasonData(gameMasterPokemon: Record<string, GameMasterPokemon>, domain: Array<GameMasterPokemon>): Promise<PublicEvent> {
    const fetcher = new HttpDataFetcher();
    const seasonUrlBuilder = (locale: AvailableLocales) => `https://pokemongo.com/${locale}/seasons`;
    const seasonsHtmls = await Promise.all(
        Object.values(AvailableLocales)
            .map(async locale => ({
                locale,
                html: await fetcher.fetchText(seasonUrlBuilder(locale))
            }))
    );

    const parsedSeasons: Array<IParsedEvent> = [];

    for (const season of seasonsHtmls) {
        const dom = new JSDOM(season.html);
        const doc = dom.window.document;

        const title = getText(doc, 'h1');

        const bonuses = Array.from(doc.querySelector('#seasonal-bonuses')?.children[1].children ?? [])
            .map(a => a.textContent?.trim() ?? '')
            .filter(Boolean)

        if (season.locale !== AvailableLocales.en) {
            parsedSeasons.push({
                id: 'season',
                url: seasonUrlBuilder(season.locale),
                source: 'pokemongo',
                title: title,
                subtitle: title,
                imageUrl: '',
                startDate: 0,
                endDate: 0,
                wild: [],
                raids: [],
                incenses: [],
                eggs: [],
                researches: [],
                lures: [],
                bonuses: bonuses,
                isSeason: true,
                locale: season.locale,
                bonusSectionIndex: -1
            });
            
            continue;
        }

        const imageUrl = doc.querySelector('#hero picture>img')?.getAttribute('src') ?? '';

        const dateText = getText(doc, '#hero-logo h1 + *');
        let startDate = 0, endDate = 0;
        const dateRanges = parseEventDateRange(dateText);
        if (dateRanges.length > 0) {
            startDate = dateRanges[0].start;
            endDate = dateRanges[0].end;
        }

        // Wild spawns by zone (grouped lists, legacy order)
        const wild: Array<IEntry> = [];
        const appearing = Array.from(doc.getElementById('different-pokemon-appearing')?.querySelectorAll('[role=list]') ?? []);
        const wildGroups = [
            appearing[0], // city
            appearing[1], // forest
            appearing[2], // mountain
            appearing[3], // beach
            appearing[4], // north
            appearing[5]  // south
        ];
        wildGroups.forEach((group, i) => {
            if (group) {
                const entries = extractPokemonSpeciesIdsFromElements(Array.from(group.querySelectorAll('[role=listitem]')), new PokemonMatcher(gameMasterPokemon, domain)).map(f => ({ ...f, kind: String(i) }));
                wild.push(...entries);
            }
        });

        // Research encounters (Field Research)
        const researches: Array<IEntry> = [];
        const researchList = doc.getElementById('encounter-pokemon');
        if (researchList) {
            researches.push(...extractPokemonSpeciesIdsFromElements(Array.from(researchList.querySelectorAll('[role=listitem]')), new PokemonMatcher(gameMasterPokemon, domain)));
        }

        // Eggs by distance/type (legacy order and comments, with correct index mapping)
        const eggs: Array<IEntry> = [];
        const eggsElement = Array.from(doc.getElementById('eggs')?.querySelectorAll('[role=list]') ?? []);
        // Legacy index mapping:
        // 0: 2km, 1: 5km, 2: 5km (Adventure Sync), 3: 7km, 4: 7km (Route), 5: 10km, 6: 10km (Adventure Sync)
        const eggGroups = [
            eggsElement[0], // 2km
            eggsElement[1], // 5km
            eggsElement[3], // 7km
            eggsElement[5], // 10km
            eggsElement[2], // 5km (Adventure Sync)
            eggsElement[4], // 7km (Route)
            eggsElement[6]  // 10km (Adventure Sync)
        ];
        const eggKindMap = ["2", "5", "7", "10", "5", "7", "10"];

        // Helper to extract egg comments from a document
        const extractEggComments = (doc: Document): Array<string> =>
            Array.from(doc.getElementById('eggs')?.querySelectorAll('[role=figure] > div:first-child > div:first-child') ?? [])
                .filter(el => {
                    const figure = el.closest('[role=figure]');
                    const prev = figure?.previousElementSibling;
                    return prev && [...prev.classList].some(cls => cls.includes('groupDivider'));
                })
                .map(el => el.textContent?.trim() ?? '');

        const comments = extractEggComments(doc);

        eggGroups.forEach((group, i) => {
            if (group) {
                // For indexes 4, 5, 6 use the parsed comments array, otherwise undefined
                const comment = (i >= 4)
                    ? { [AvailableLocales.en]: comments[i - 4] || '' }
                    : undefined;
                const entries = extractPokemonSpeciesIdsFromElements(Array.from(group.querySelectorAll('[role=listitem]')), new PokemonMatcher(gameMasterPokemon, domain)).map(f => ({ ...f, kind: eggKindMap[i], comment }));
                eggs.push(...entries);
            }
        });

        parsedSeasons.push({
            id: 'season',
            url: seasonUrlBuilder(AvailableLocales.en),
            source: 'pokemongo',
            title: title,
            subtitle: title,
            imageUrl,
            startDate,
            endDate,
            wild,
            raids: [],
            incenses: [],
            eggs,
            researches,
            lures: [],
            bonuses: bonuses,
            isSeason: true,
            locale: season.locale,
            bonusSectionIndex: -1
        });
    }

    const translatedSeason = pairEventTranslations(parsedSeasons);
    return translatedSeason[0];
} 