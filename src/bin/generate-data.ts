import fs from 'fs/promises';
import path from 'path';

import { augmentGameMasterWithBestIvSpreads } from '../computations/best-iv-spread-calculator';
import { augmentGameMasterWithFormIdentifiers } from '../computations/form-identifier-calculator';
import RaidDpsCalculator from '../computations/raid-dps-calculator';
import BossesParser from '../parsers/events/providers/leekduck/BossesParser';
import EggsParser from '../parsers/events/providers/leekduck/EggsParser';
import EventsParser from '../parsers/events/providers/leekduck/EventsParser';
import { validateLeekduckData } from '../parsers/events/providers/leekduck/leekduck-data-qa';
import RocketLineupsParser from '../parsers/events/providers/leekduck/RocketLineupsParser';
import MovesProvider from '../parsers/events/providers/pokeminers/MovesProvider';
import PokemonGoSource from '../parsers/events/providers/pokemongo/PokemongoSource';
import SeasonParser from '../parsers/events/providers/pokemongo/SeasonParser';
import { Leagues } from '../parsers/pokemon/config/pokemon-config';
import GameMasterParser, {
	getDomains,
} from '../parsers/pokemon/game-master-parser';
import PvPParser from '../parsers/pokemon/pvp-parser';
import HttpDataFetcher from '../parsers/services/data-fetcher';
import GameMasterTranslator from '../parsers/services/gamemaster-translator';
import type { IEntry } from '../parsers/types/events';

const generateData = async () => {
	console.log('Starting Pokemon GO data generation...');

	try {
		// Initialize dependencies
		const dataFetcher = new HttpDataFetcher();

		// Step 1: Initiate the translator
		const translatorService = new GameMasterTranslator(dataFetcher);
		await translatorService.setupGameMasterSources();

		// Step 2: Instantiate the moves provider
		const movesProvider = new MovesProvider(dataFetcher, translatorService);
		const moves = await movesProvider.fetchMoves();

		// Step 3: Parse Game Master data first
		const gameMasterParser = new GameMasterParser(dataFetcher, moves);
		const pokemonDictionary = await gameMasterParser.parse();

		// Step 3b: Precompute every species' tied-for-rank-1 IV spread(s) per
		// league/level — what go-pokedex's Mass Delete sweeps otherwise
		// brute-force per species, on every visitor's machine. Written straight
		// onto the same game-master.json entries (see that function's own doc
		// comment for why a separate file isn't worth it here).
		augmentGameMasterWithBestIvSpreads(pokemonDictionary);

		// Step 3c: Precompute every species' in-game-search disambiguation
		// identifier + Shadow-counterpart flag — what go-pokedex's Search
		// Strings tab and Mass Delete's generators otherwise each rebuild by
		// re-scanning the whole gamemaster on every page visit.
		augmentGameMasterWithFormIdentifiers(pokemonDictionary);

		// Initialize domains
		const domains = getDomains(pokemonDictionary);

		// Step 4: Parse PvP Data
		const pvpParser = new PvPParser(dataFetcher, pokemonDictionary, moves);
		const pvpData = await pvpParser.parse();

		// Step 5: Generate events
		const source = new PokemonGoSource(
			dataFetcher,
			pokemonDictionary,
			domains.allDomain
		);
		const events = await source.parseEvents();

		// Step 6: Generate season data
		const seasonParser = new SeasonParser(dataFetcher, domains.normalDomain);
		const seasonData = await seasonParser.fetchSeasonData(pokemonDictionary);

		// Step 7: LeekDuck integration
		const leekduckEventsParser = new EventsParser(
			dataFetcher,
			pokemonDictionary,
			domains
		);
		const leekduckEvents = await leekduckEventsParser.parse();

		const leekduckBossesParser = new BossesParser(
			dataFetcher,
			pokemonDictionary,
			domains
		);
		const leekduckBossEntries: Array<IEntry> =
			await leekduckBossesParser.parse();

		const leekduckEggsParser = new EggsParser(
			dataFetcher,
			pokemonDictionary,
			domains.normalDomain
		);
		const leekduckEggEntries = await leekduckEggsParser.parse();

		const leekduckRocketLineupsParser = new RocketLineupsParser(
			dataFetcher,
			pokemonDictionary,
			translatorService,
			domains.nonMegaNonShadowDomain // The domain isn't as restrictive as it could, because the current PokemonMatcher requires all the entries.
		);
		const leekduckRocketLineups = await leekduckRocketLineupsParser.parse();

		// Step 7b: QA the LeekDuck-derived data before it's written/committed.
		// LeekDuck restructures its pages without notice, and a scraper that
		// silently starts returning empty/partial results is worse than one
		// that fails loudly, since a bad generate would otherwise overwrite
		// good data. Throws (failing the job) if anything looks degraded.
		validateLeekduckData({
			eggs: leekduckEggEntries,
			rocketLineups: leekduckRocketLineups,
			raidBosses: leekduckBossEntries,
			specialRaidBosses: leekduckEvents.specialRaidBosses,
			spotlightHours: leekduckEvents.spotlightHours,
		});

		// Step 8: DPS calculations
		const raidDpsCalculator = new RaidDpsCalculator(pokemonDictionary, moves);
		const dpsData = raidDpsCalculator.compute();

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
		await fs.writeFile(
			path.join(dataDir, 'leekduck-eggs.json'),
			JSON.stringify(leekduckEggEntries, null, '\t')
		);
		await fs.writeFile(
			path.join(dataDir, 'rocket-lineups.json'),
			JSON.stringify(leekduckRocketLineups, null, '\t')
		);
		await fs.writeFile(
			path.join(dataDir, 'events.json'),
			JSON.stringify(events, null, '\t')
		);
		await fs.writeFile(
			path.join(dataDir, 'game-master.json'),
			JSON.stringify(pokemonDictionary, null, '\t')
		);
		for (const key of Object.keys(Leagues)) {
			const fileName = `${key.toLocaleLowerCase()}-league-pvp.json`;
			const filePath = path.join(dataDir, fileName);
			await fs.writeFile(filePath, JSON.stringify(pvpData[key], null, '\t'));
		}
		await fs.writeFile(
			path.join(dataDir, 'season.json'),
			JSON.stringify(seasonData, null, '\t')
		);
		await fs.writeFile(
			path.join(dataDir, 'moves.json'),
			JSON.stringify(
				movesProvider.pruneUnlearnableMoves(moves, pokemonDictionary),
				null,
				'\t'
			)
		);
		for (const type of Object.keys(dpsData)) {
			const fileName = `${type.toLocaleLowerCase()}-raid-dps-rank.json`;
			const filePath = path.join(dataDir, fileName);
			await fs.writeFile(filePath, JSON.stringify(dpsData[type], null, '\t'));
		}

		console.log('All data written to disk.');
		console.log(`Pokemon parsed: ${Object.keys(pokemonDictionary).length}`);
	} catch (error) {
		console.error('Data generation failed:', error);
		process.exit(1);
	}
};

void generateData();

export default generateData;
