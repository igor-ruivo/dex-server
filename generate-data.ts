import { Leagues } from '@src/parsers/pokemon/config/pokemon-config';
import { PvPParser } from '@src/parsers/pokemon/pvp-parser';
import { HttpDataFetcher } from '@src/parsers/services/data-fetcher';
import fs from 'fs/promises';
import path from 'path';

import { BossesParser } from './src/parsers/events/providers/leekduck/BossesParser';
import { EggsParser } from './src/parsers/events/providers/leekduck/EggsParser';
import { EventsParser } from './src/parsers/events/providers/leekduck/EventsParser';
import { RocketLineupsParser } from './src/parsers/events/providers/leekduck/RocketLineupsParser';
import { MovesProvider } from './src/parsers/events/providers/pokeminers/MovesProvider';
import { PokemonGoSource } from './src/parsers/events/providers/pokemongo/PokemongoSource';
import { fetchSeasonData } from './src/parsers/events/providers/pokemongo/SeasonParser';
import { GameMasterParser } from './src/parsers/pokemon/game-master-parser';
import GameMasterTranslator from './src/parsers/services/gamemaster-translator';
import { IEntry } from './src/parsers/types/events';

const generateData = async () => {
    console.log('🚀 Starting Pokemon GO data generation...');

    try {
        // Initialize dependencies
        const dataFetcher = new HttpDataFetcher();

        // Step 1: Initiate the translator
        const translatorService = new GameMasterTranslator();
        await translatorService.setupGameMasterSources();

        // Step 2: Instantiate the moves provider
        const movesProvider = new MovesProvider(translatorService);
        const moves = await movesProvider.fetchMoves();

        // Step 3: Parse Game Master data first
        const gameMasterParser = new GameMasterParser();
        const pokemonDictionary = await gameMasterParser.parse(moves);

        // Step 4: Parse PvP Data
        const pvpParser = new PvPParser(dataFetcher, pokemonDictionary, moves);
        const pvpData = await pvpParser.parse();

        // Step 5: Generate events
        const source = new PokemonGoSource();
        const events = await source.parseEvents(pokemonDictionary);

        // Step 6: Generate season data
        const seasonDomain = Object.values(pokemonDictionary).filter((p) => !p.isShadow && !p.isMega && !p.aliasId);
        const seasonData = await fetchSeasonData(pokemonDictionary, seasonDomain);

        // Step 7: LeekDuck integration
        const leekduckEventsParser = new EventsParser();
        const leekduckEvents = await leekduckEventsParser.parse(pokemonDictionary);

        const leekduckBossesParser = new BossesParser();
        const leekduckBossEntries: Array<IEntry> = await leekduckBossesParser.parse(pokemonDictionary);

        const leekduckEggsParser = new EggsParser();
        const leekduckEggEntries = await leekduckEggsParser.parse(pokemonDictionary);

        const leekduckRocketLineupsParser = new RocketLineupsParser();
        const leekduckRocketLineups = await leekduckRocketLineupsParser.parse(pokemonDictionary, translatorService);

        // Write outputs
        const dataDir = path.join(process.cwd(), 'data');
        await fs.mkdir(dataDir, { recursive: true });
        await fs.writeFile(
            path.join(dataDir, 'spotlight-hours.json'),
            JSON.stringify(leekduckEvents.spotlightHours, null, '\t')
        );
        await fs.writeFile(
            path.join(dataDir, 'leekduck-special-raid-bosses.json'),
            JSON.stringify(leekduckEvents.specialRaidBosses, null, '\t')
        );
        await fs.writeFile(
            path.join(dataDir, 'leekduck-raid-bosses.json'),
            JSON.stringify(leekduckBossEntries, null, '\t')
        );
        await fs.writeFile(path.join(dataDir, 'leekduck-eggs.json'), JSON.stringify(leekduckEggEntries, null, '\t'));
        await fs.writeFile(
            path.join(dataDir, 'rocket-lineups.json'),
            JSON.stringify(leekduckRocketLineups, null, '\t')
        );
        await fs.writeFile(path.join(dataDir, 'events.json'), JSON.stringify(events, null, '\t'));
        await fs.writeFile(path.join(dataDir, 'game-master.json'), JSON.stringify(pokemonDictionary, null, '\t'));
        for (const key of Object.keys(Leagues)) {
            const fileName = `${key.toLocaleLowerCase()}-league-pvp.json`;
            const filePath = path.join(dataDir, fileName);
            await fs.writeFile(filePath, JSON.stringify(pvpData[key], null, '\t'));
        }
        await fs.writeFile(path.join(dataDir, 'season.json'), JSON.stringify(seasonData, null, '\t'));
        await fs.writeFile(path.join(dataDir, 'moves.json'), JSON.stringify(moves, null, '\t'));

        console.log('✅ All data written to disk.');
        console.log(`�� Pokemon parsed: ${Object.keys(pokemonDictionary).length}`);
    } catch (error) {
        console.error('❌ Data generation failed:', error);
        process.exit(1);
    }
};

// Run if called directly
if (require.main === module) {
    void generateData();
}

export { generateData };
