import type HttpDataFetcher from '../../../services/data-fetcher';
import type { IEntry } from '../../../types/events';
import type { GameMasterData } from '../../../types/pokemon';
import type { MaxForm } from '../../utils/max-battles';

const POKEBATTLER_MAX_URL =
	'https://static.pokebattler.com/infographics/max.json';

/** What of an entry of Pokebattler's Max Battle infographic matters here: the boss and the tier it is filed under. */
interface IPokebattlerMaxBoss {
	pokemonId: string;
	tier: string;
}

/**
 * A tier label that is a current one: "RAID_LEVEL_5_MAX". The other labels carry a suffix ("…_MAX_LEGACY" for bosses that
 * are gone, "…_MAX_FUTURE" for the ones announced) and are left out.
 */
const CURRENT_TIER = /^RAID_LEVEL_(\d)_MAX$/;
const GIGANTAMAX_SUFFIX = '_GIGANTAMAX';

/** The species id of a boss id of Pokebattler ("CINDERACE_GIGANTAMAX" → "cinderace"), or none when the game master has none. */
const speciesIdOf = (
	pokemonId: string,
	dictionary: GameMasterData
): string | undefined => {
	let id = pokemonId.toLowerCase().replace(/_gigantamax$/, '');
	if (dictionary[id]) {
		return id;
	}
	id = id.replace(/_form$/, '');
	if (dictionary[id]) {
		return id;
	}
	// A species whose forms are all named ("urshifu" → "urshifu_rapid_strike"): the first one that is not a Shadow or a Mega.
	return Object.keys(dictionary).find(
		(key) => key.startsWith(`${id}_`) && !/_(shadow|mega|primal)/.test(key)
	);
};

/**
 * The Dynamax and Gigantamax Pokémon that are the bosses of Max Battles right now, by tier, from Pokebattler's infographic
 * data: the ones filed under a plain tier, without the "legacy" (over) and "future" (announced) ones. Each entry is the base
 * species (a boss the game master has no species for throws), its `kind` the form (`dynamax`, or `gigantamax` for an id ending in `_GIGANTAMAX`) and its `tier` the Max Battle
 * tier ("1" to "6"). The data has no shiny information, so `shiny` is `false` here: it means "not known", and the entries
 * can gain it from a source that says so (see `markMaxShiny`).
 */
export const currentMaxBattleBosses = (
	raw: Record<string, IPokebattlerMaxBoss>,
	dictionary: GameMasterData
): Array<IEntry> => {
	const entries: Array<IEntry> = [];
	for (const boss of Object.values(raw)) {
		const tier = CURRENT_TIER.exec(boss.tier)?.[1];
		if (!tier) {
			continue;
		}
		const speciesId = speciesIdOf(boss.pokemonId, dictionary);
		if (!speciesId) {
			// a boss the game master does not know is a mismatch to look at, not something to publish without
			throw new Error(
				`[MaxBattlesParser] no species in the game master for the Max Battle boss "${boss.pokemonId}".`
			);
		}
		const kind: MaxForm = boss.pokemonId.endsWith(GIGANTAMAX_SUFFIX)
			? 'gigantamax'
			: 'dynamax';
		if (!entries.some((e) => e.speciesId === speciesId && e.kind === kind)) {
			entries.push({ speciesId, kind, tier, shiny: false });
		}
	}
	return entries.sort(
		(a, b) =>
			Number(a.tier) - Number(b.tier) || a.speciesId.localeCompare(b.speciesId)
	);
};

/**
 * Marks as shiny the entries that a source which does know says can be (the Max Mondays, the news posts…): the same species
 * in the same form. Returns new entries; the ones nobody says anything about keep `shiny: false`.
 */
export const markMaxShiny = (
	entries: ReadonlyArray<IEntry>,
	sources: ReadonlyArray<ReadonlyArray<IEntry>>
): Array<IEntry> => {
	const shiny = new Set(
		sources.flatMap((list) =>
			list.filter((e) => e.shiny).map((e) => `${e.speciesId}|${e.kind ?? ''}`)
		)
	);
	return entries.map((entry) =>
		shiny.has(`${entry.speciesId}|${entry.kind ?? ''}`)
			? { ...entry, shiny: true }
			: entry
	);
};

class MaxBattlesParser {
	constructor(
		private readonly dataFetcher: HttpDataFetcher,
		private readonly gameMasterPokemon: GameMasterData
	) {}

	/**
	 * The current Max Battle bosses. Nothing here is skipped quietly: a failed download, a boss with no species or a feed with no
	 * current boss at all throws, so the generation fails instead of publishing a degraded file.
	 */
	async parse(): Promise<Array<IEntry>> {
		const raw =
			await this.dataFetcher.fetchJson<Record<string, IPokebattlerMaxBoss>>(
				POKEBATTLER_MAX_URL
			);
		const bosses = currentMaxBattleBosses(raw, this.gameMasterPokemon);
		if (bosses.length === 0) {
			throw new Error(
				'[MaxBattlesParser] Pokebattler listed no current Max Battle boss.'
			);
		}
		return bosses;
	}
}

export default MaxBattlesParser;
