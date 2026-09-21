import fs from 'fs/promises';
import path from 'path';

import { augmentGameMasterWithFamilyRelations } from '../computations/family-relations-calculator';
import RaidDpsCalculator from '../computations/raid-dps-calculator';
import { computeSpeciesSearchMetadata } from '../computations/species-search-metadata-calculator';
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
import { validateSkippedFetches } from '../parsers/services/fetch-failures-qa';
import {
	buildGameTranslations,
	validateGameTranslations,
} from '../parsers/services/game-translations-provider';
import GameMasterTranslator from '../parsers/services/gamemaster-translator';
import { validateTranslationCompleteness } from '../parsers/services/translation-completeness-qa';
import type { IEntry } from '../parsers/types/events';

const generateData = async () => {
	console.log('Starting Pokemon GO data generation...');

	try {
		// Initialize dependencies
		const dataFetcher = new HttpDataFetcher();

		// Step 1: Initiate the translator
		const translatorService = new GameMasterTranslator(dataFetcher);
		await translatorService.setupGameMasterSources();

		// Step 1b: Build go-pokedex's GameTranslator data — every UI string
		// that should track the player's in-game language (search-bar
		// keywords, league names, type chips, CP/raid labels, etc.) rather
		// than the website's own UI language. Sourced from the same
		// data-mined string tables `setupGameMasterSources` just fetched, no
		// extra network calls.
		const gameTranslations = buildGameTranslations(translatorService);
		validateGameTranslations(
			gameTranslations.translations,
			gameTranslations.types
		);

		// Step 2: Instantiate the moves provider
		const movesProvider = new MovesProvider(dataFetcher, translatorService);
		const moves = await movesProvider.fetchMoves();

		// Step 3: Parse Game Master data first
		const gameMasterParser = new GameMasterParser(dataFetcher, moves);
		const pokemonDictionary = await gameMasterParser.parse();

		// Step 3a: Precompute the Mega<->base and Shadow<->non-Shadow
		// relationships directly onto `pokemonDictionary` itself — go-pokedex
		// used to re-derive these client-side by scanning the whole gamemaster
		// (dex-number matching for Megas, needing an exceptions list for
		// look-alike dexes) or via speciesId string surgery (`_shadow`
		// append/strip) — both gone now that it's just data on each species.
		augmentGameMasterWithFamilyRelations(pokemonDictionary);

		// Step 3b: Precompute every species' tied-for-rank-1 IV spread(s) per
		// league/level, plus its in-game-search disambiguation identifier —
		// what go-pokedex's Search Strings tab and Mass Delete's bulk sweeps
		// otherwise each recompute by re-scanning the whole gamemaster (or
		// brute-forcing 16x16x16 per species) on every visit. Kept in its own
		// file (`species-search-metadata.json`), not written onto
		// `game-master.json` itself — that file is the client's core species
		// dataset and this is an optional, separately-fetchable add-on, keyed
		// by the same speciesId either way.
		const speciesSearchMetadata =
			computeSpeciesSearchMetadata(pokemonDictionary);

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
		const seasonParser = new SeasonParser(
			dataFetcher,
			domains.normalDomain,
			gameTranslations.translations
		);
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

		// Step 7c: QA that no output ended up with a locale silently missing
		// its translation (as opposed to LeekDuck-content-shape issues, which
		// Step 7b already covers) — e.g. the es-MX/zh-Hant locale-casing bug,
		// or an events/season/rocket-phrase EN fallback regressing. Pruned
		// moves are computed here (rather than inline at write time, further
		// down) so the exact set that's QA'd is the exact set that's written.
		const finalMoves = movesProvider.pruneUnlearnableMoves(
			moves,
			pokemonDictionary
		);
		validateTranslationCompleteness({
			events,
			season: seasonData,
			moves: finalMoves,
			rocketLineups: leekduckRocketLineups,
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
		await fs.writeFile(
			path.join(dataDir, 'species-search-metadata.json'),
			JSON.stringify(speciesSearchMetadata, null, '\t')
		);
		await fs.writeFile(
			path.join(dataDir, 'game-translations.json'),
			JSON.stringify(gameTranslations, null, '\t')
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
			JSON.stringify(finalMoves, null, '\t')
		);
		for (const type of Object.keys(dpsData)) {
			const fileName = `${type.toLocaleLowerCase()}-raid-dps-rank.json`;
			const filePath = path.join(dataDir, fileName);
			await fs.writeFile(filePath, JSON.stringify(dpsData[type], null, '\t'));
		}

		console.log('All data written to disk.');
		console.log(`Pokemon parsed: ${Object.keys(pokemonDictionary).length}`);

		const skipped = dataFetcher.getSkippedFetches();
		if (skipped.length > 0) {
			console.log(
				`\n${skipped.length} fetch(es) were skipped (non-2xx, ignored so the run could finish) — check these:`
			);
			for (const { url, status } of skipped) {
				console.log(`  [${status}] ${url}`);
			}
		}

		// Files are already written above, but the workflow's commit/push step
		// only runs if this whole job succeeds — so throwing here still stops a
		// run with an unreviewed fetch failure from ever being published, it
		// just does so after generation instead of before (the full set of
		// skipped fetches isn't known until every fetch in the run has
		// resolved).
		validateSkippedFetches(skipped);
	} catch (error) {
		console.error('Data generation failed:', error);
		process.exit(1);
	}
};

void generateData();

export default generateData;
