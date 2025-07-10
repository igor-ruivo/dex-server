import fs from 'fs/promises';
import path from 'path';
import { GameMasterParser } from './src/parsers/pokemon/game-master-parser';
import { generateEvents } from './src/parsers/events/generate-events';
import { EventsParser } from './src/parsers/events/providers/leekduck/EventsParser';
import { BossesParser } from './src/parsers/events/providers/leekduck/BossesParser';
import { EggsParser } from './src/parsers/events/providers/leekduck/EggsParser';
import { RocketLineupsParser } from './src/parsers/events/providers/leekduck/RocketLineupsParser';
import { IRocketGrunt, IEntry, ISpotlightHourEvent, ILeekduckSpecialRaidBossEvent } from './src/parsers/types/events';
import { fetchSeasonData } from './src/parsers/events/providers/pokemongo/SeasonParser';


const generateData = async () => {
  console.log('🚀 Starting Pokemon GO data generation...');
  
  const now = new Date().toISOString();
  
  try {
    // Step 1: Parse Game Master data first
    const gameMasterParser = new GameMasterParser();
    const pokemonDictionary = await gameMasterParser.parse();
    
    // Step 2: Generate events data using the fresh Game Master data
    const eventsData = await generateEvents(pokemonDictionary);

    // Step 2.5: Generate season data using the fresh Game Master data
    // Reuse the getDomains logic from PokemongoSource
    const seasonDomain = Object.values(pokemonDictionary).filter(p => !p.isShadow && !p.isMega && !p.aliasId);
    const seasonData = await fetchSeasonData(pokemonDictionary, seasonDomain);
    
    // Step 3: LeekDuck integration
    const leekduckEventsParser = new EventsParser();
    const leekduckBossesParser = new BossesParser();
    const leekduckEggsParser = new EggsParser();
    const leekduckRocketLineupsParser = new RocketLineupsParser();

    // Fetch LeekDuck events (Spotlight Hour and raid events)
    const leekduckEvents = await leekduckEventsParser.parse(pokemonDictionary);

    // Spotlight Hour events
    const leekduckSpotlightEvents: ISpotlightHourEvent[] = leekduckEvents
      .filter(e => e.spotlightPokemons && e.spotlightPokemons.length > 0)
      .map(e => {
        const en = e.spotlightBonus || '';
        const pt = en
          .replaceAll('Catch XP', 'XP ao capturar')
          .replaceAll('Catch Candy', 'Doces ao capturar')
          .replaceAll('Transfer Candy', 'Doces ao transferir')
          .replaceAll('Evolution XP', 'XP ao evoluir')
          .replaceAll('Catch Stardust', 'Poeira Estelar ao capturar');
        return {
          bonus: { en, pt },
          pokemon: (e.spotlightPokemons || []).map((p: IEntry) => p.speciesId),
          dateStart: e.date,
          dateEnd: e.dateEnd
        };
      });

    // 5-star, Mega, and Shadow raid bosses as special DTOs
    const leekduckSpecialRaidBossEvents: ILeekduckSpecialRaidBossEvent[] = leekduckEvents
      .filter(e => e.raids && e.raids.length > 0)
      .map(e => ({
        dateStart: e.date,
        dateEnd: e.dateEnd,
        pokemon: e.raids || [],
        title: e.title
      }));

    // Fetch LeekDuck bosses (excluding 5-star and mega)
    const leekduckBossEntries: IEntry[] = await leekduckBossesParser.parse(pokemonDictionary);

    // Fetch LeekDuck eggs
    let leekduckEggEntries: IEntry[] = await leekduckEggsParser.parse(pokemonDictionary);
    leekduckEggEntries = leekduckEggEntries.map(entry => {
      if (entry.comment && typeof entry.comment.en === 'string') {
        const en = entry.comment.en;
        const pt = en
          .replaceAll('Adventure Sync Rewards', 'Recompensas de Sincroaventura')
          .replaceAll('Route Rewards', 'Recompensas de Rota')
          .replaceAll('7 km Eggs from Mateo’s Gift Exchange', 'Ovos de 7 km da Troca de presentes de Mateo');
        return { ...entry, comment: { en, pt } };
      }
      return entry;
    });

    // Fetch LeekDuck rocket lineups
    let leekduckRocketLineups: IRocketGrunt[] = await leekduckRocketLineupsParser.parse(pokemonDictionary);
    // Load PT translations
    const { HttpDataFetcher } = await import('./src/parsers/services/data-fetcher');
    const fetcher = new HttpDataFetcher();
    const ptTranslationData = await fetcher.fetchJson<{data: string}>('https://raw.githubusercontent.com/PokeMiners/pogo_assets/master/Texts/Latest%20APK/JSON/i18n_brazilianportuguese.json');
    // Legacy algorithm to build translation dictionary
    const translatedPhrasesDictionary: Record<string, string> = {};
    const gruntTerm = 'combat_grunt_quote';
    const arr = Array.from(ptTranslationData.data);
    arr.forEach((t, index) => {
      if (typeof t !== 'string') return;
      if (t.startsWith(gruntTerm)) {
        const key = t.substring(gruntTerm.length);
        const name = arr[index + 1] as string;
        translatedPhrasesDictionary[key] = name;
      }
      if (t === 'combat_giovanni_quote#1') {
        translatedPhrasesDictionary['Giovanni'] = arr[index + 1] as string;
      }
      if (t === 'combat_cliff_quote#1') {
        translatedPhrasesDictionary['Cliff'] = arr[index + 1] as string;
      }
      if (t === 'combat_arlo_quote#1') {
        translatedPhrasesDictionary['Arlo'] = arr[index + 1] as string;
      }
      if (t === 'combat_sierra_quote#1') {
        translatedPhrasesDictionary['Sierra'] = arr[index + 1] as string;
      }
      if (t === 'combat_grunt_decoy_quote#1') {
        translatedPhrasesDictionary['Decoy Female Grunt'] = arr[index + 1] as string;
      }
      if (t === 'combat_grunt_quote#1__male_speaker') {
        const name = arr[index + 1] as string;
        translatedPhrasesDictionary['Male Grunt'] = name;
        translatedPhrasesDictionary['Female Grunt'] = name;
      }
    });
    // Map PT translation to each rocket lineup
    leekduckRocketLineups = leekduckRocketLineups.map(entry => {
      let pt = entry.phrase.en;
      // Try to match by trainerId or type
      if (entry.trainerId && translatedPhrasesDictionary[entry.trainerId]) {
        pt = translatedPhrasesDictionary[entry.trainerId];
      } else if (entry.type && translatedPhrasesDictionary[`_${entry.type}__male_speaker`]) {
        pt = translatedPhrasesDictionary[`_${entry.type}__male_speaker`];
      }
      return { ...entry, phrase: { en: entry.phrase.en, pt } };
    });

    // Write outputs
    const dataDir = path.join(process.cwd(), 'data');
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(path.join(dataDir, 'spotlight-hours.json'), JSON.stringify(leekduckSpotlightEvents, null, 2));
    await fs.writeFile(path.join(dataDir, 'leekduck-special-raid-bosses.json'), JSON.stringify(leekduckSpecialRaidBossEvents, null, 2));
    await fs.writeFile(path.join(dataDir, 'leekduck-raid-bosses.json'), JSON.stringify(leekduckBossEntries, null, 2));
    await fs.writeFile(path.join(dataDir, 'leekduck-eggs.json'), JSON.stringify(leekduckEggEntries, null, 2));
    await fs.writeFile(path.join(dataDir, 'rocket-lineups.json'), JSON.stringify(leekduckRocketLineups, null, 2));
    await fs.writeFile(path.join(dataDir, 'events.json'), JSON.stringify(eventsData, null, 2));
    await fs.writeFile(path.join(dataDir, 'game-master.json'), JSON.stringify(pokemonDictionary, null, 2));
    await fs.writeFile(path.join(dataDir, 'season.json'), JSON.stringify(seasonData, null, 2));
    console.log('✅ All LeekDuck and main data written to disk.');
    console.log('');
    console.log('📁 Generated files:');
    console.log('- data/events.json');
    console.log('- data/spotlight-hours.json');
    console.log('- data/leekduck-special-raid-bosses.json');
    console.log('- data/leekduck-raid-bosses.json');
    console.log('- data/leekduck-eggs.json');
    console.log('- data/rocket-lineups.json');
    console.log('- data/game-master.json');
    console.log('- data/season.json');
    console.log('');
    console.log(`⏰ Last updated: ${now}`);
    console.log(`📊 Pokemon parsed: ${Object.keys(pokemonDictionary).length}`);
    console.log('');
    console.log('💡 Note: These files will be committed by GitHub Actions');
  } catch (error) {
    console.error('❌ Data generation failed:', error);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  generateData();
}

export { generateData };