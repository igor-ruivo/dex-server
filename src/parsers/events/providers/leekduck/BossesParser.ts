import { JSDOM } from 'jsdom';

import type { IPokemonDomains } from '../../../pokemon/game-master-parser';
import type HttpDataFetcher from '../../../services/data-fetcher';
import type { IEntry } from '../../../types/events';
import type { GameMasterData } from '../../../types/pokemon';
import PokemonMatcher from '../../utils/pokemon-matcher';

// LeekDuck no longer bakes the full current raid rotation into the static
// /raid-bosses/ page: that page's initial HTML only contains whichever single
// raid rotation their SSR happened to pick as "selected" (client JS then
// swaps in the real content from these same endpoints). Multiple regular
// rotations frequently overlap (e.g. the week's base 5-star/Mega rotation
// plus a crossover event page that additionally documents that week's
// tier-1/tier-3 bosses), so reading only the SSR'd page can silently miss
// entire tiers. We instead read the manifest LeekDuck's own widget uses and
// merge every currently-active (non location-locked) rotation's fragment.
const LEEKDUCK_RAID_MANIFEST_URL = 'https://leekduck.com/raids/manifest.json';
const leekduckRaidFragmentUrl = (slug: string) =>
	`https://leekduck.com/raids/${slug}`;

interface ILeekduckManifestRaidEntry {
	slug: string;
	start_timestamp: number;
	end_timestamp: number;
	tags?: Array<string>;
}

interface ILeekduckRaidManifest {
	regular_raids: Array<ILeekduckManifestRaidEntry>;
	shadow_raids: Array<ILeekduckManifestRaidEntry>;
}

type ClassAndMatcher = {
	matcher: PokemonMatcher;
	prefix: string;
};

const isExclusive = (entry: ILeekduckManifestRaidEntry) =>
	(entry.tags ?? []).includes('Exclusive');

// Mirrors what the entries currently shown on leekduck.com/raid-bosses/ would
// be: every non location-locked rotation running right now, or (during a gap
// between rotations) the soonest upcoming one, same fallback LeekDuck's own
// selector uses.
function selectCurrentRaidEntries(
	entries: Array<ILeekduckManifestRaidEntry>,
	nowMs: number
): Array<ILeekduckManifestRaidEntry> {
	const candidates = entries.filter((e) => !isExclusive(e));

	const active = candidates.filter(
		(e) => e.start_timestamp * 1000 <= nowMs && nowMs <= e.end_timestamp * 1000
	);
	if (active.length > 0) {
		return active;
	}

	const upcoming = candidates
		.filter((e) => e.start_timestamp * 1000 > nowMs)
		.sort((a, b) => a.start_timestamp - b.start_timestamp);

	return upcoming.length > 0 ? [upcoming[0]] : [];
}

class BossesParser {
	constructor(
		private readonly dataFetcher: HttpDataFetcher,
		private readonly gameMasterPokemon: GameMasterData,
		private readonly domains: IPokemonDomains
	) {}

	private parseTiers(
		doc: Document,
		classMatcher: ClassAndMatcher,
		seen: Set<string>,
		pokemons: Array<IEntry>
	) {
		const tiers = Array.from(doc.getElementsByClassName('tier'));

		for (const currentTier of tiers) {
			// LeekDuck tags each tier's own header with a `data-tier`
			// attribute directly ("1", "3", "5", "Mega") now — reading it
			// beats parsing the header's own display text, which is what
			// broke: the old code assumed a specific word count/shape that
			// LeekDuck's rewording no longer guarantees.
			const tier = (
				currentTier.getElementsByTagName('h2')[0]?.getAttribute('data-tier') ??
				''
			).toLocaleLowerCase();

			// We only want the standing tier-1/tier-3 bosses here; tier 5,
			// Mega, and Elite raids are event-scoped and come from
			// EventsParser instead.
			if (!tier || tier === 'mega' || tier === '5' || tier === 'super') {
				continue;
			}

			const names = currentTier.getElementsByClassName('name');
			for (const name of names) {
				const parsedName =
					`${classMatcher.prefix} ${name.textContent?.trim()}`.trim();

				const parsedPkm = classMatcher.matcher.matchPokemonFromText([
					parsedName,
				]);

				if (parsedPkm[0]) {
					const dedupeKey = `${tier}|${parsedPkm[0].speciesId}`;
					if (seen.has(dedupeKey)) {
						continue;
					}
					seen.add(dedupeKey);

					pokemons.push({
						shiny: parsedPkm[0].shiny,
						speciesId: parsedPkm[0].speciesId,
						kind: tier,
					});
				}
			}
		}
	}

	private async parseRaidGroup(
		entries: Array<ILeekduckManifestRaidEntry>,
		classMatcher: ClassAndMatcher,
		seen: Set<string>,
		pokemons: Array<IEntry>
	) {
		const currentEntries = selectCurrentRaidEntries(entries, Date.now());
		// How many raid rotations are currently active isn't knowable in
		// advance — widen the fetcher's progress denominator now that we
		// actually know, for this run.
		this.dataFetcher.announceExpectedFetches(currentEntries.length);

		for (const entry of currentEntries) {
			const html = await this.dataFetcher.fetchText(
				leekduckRaidFragmentUrl(entry.slug)
			);
			const dom = new JSDOM(`<!doctype html><body>${html}</body>`);
			this.parseTiers(dom.window.document, classMatcher, seen, pokemons);
		}
	}

	async parse() {
		const manifest = await this.dataFetcher.fetchJson<ILeekduckRaidManifest>(
			LEEKDUCK_RAID_MANIFEST_URL
		);

		const pokemons: Array<IEntry> = [];
		const seen = new Set<string>();

		// The domain isn't as restrictive as it could, because the current PokemonMatcher requires all the entries.
		const normalMatcher = new PokemonMatcher(
			this.gameMasterPokemon,
			this.domains.normalDomain
		);

		const shadowMatcher = new PokemonMatcher(
			this.gameMasterPokemon,
			this.domains.nonMegaNonShadowDomain
		);

		await this.parseRaidGroup(
			manifest.regular_raids,
			{ matcher: normalMatcher, prefix: '' },
			seen,
			pokemons
		);
		await this.parseRaidGroup(
			manifest.shadow_raids,
			{ matcher: shadowMatcher, prefix: 'Shadow' },
			seen,
			pokemons
		);

		return pokemons;
	}
}

export default BossesParser;
