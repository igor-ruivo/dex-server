import type { GameMasterData, IGameMasterMove } from '../parsers/types/pokemon';
import { PokemonTypes } from '../parsers/types/pokemon';
import type { DPSEntry } from './utils';
import { computeDPSEntry, getAllChargedMoves, MAX_LEVEL_INDEX } from './utils';

type ComputedDpsRank = DPSEntry & {
	dpsRank: number;
	tdoRank: number;
	edpsRank: number;
};

class RaidDpsCalculator {
	constructor(
		private readonly gameMasterPokemon: GameMasterData,
		private readonly moves: Record<string, IGameMasterMove>
	) {}

	compute() {
		const output: Record<string, Record<string, ComputedDpsRank>> = {};

		// One ranking per attacking type. The old generic "" (type-agnostic) list
		// was dropped — a raid ranking only makes sense once a type is chosen.
		Object.values(PokemonTypes)
			.map((type) => type.toLocaleLowerCase())
			.forEach((type) => {
				const pokemonEntries = Object.values(this.gameMasterPokemon)
					.filter(
						(p) =>
							!p.aliasId &&
							getAllChargedMoves(p, this.moves).some(
								(m) => this.moves[m].type === type
							)
					)
					.map((p) => computeDPSEntry(p, this.moves, 15, MAX_LEVEL_INDEX, type))
					.filter((e) => e.fastMove && e.chargedMove && e.dps >= 0);

				// Consumers rank by whichever figure they care about (DPS, TDO or eDPS —
				// see go-pokedex's `RaidMetric`) — a single `rank` baked in here could
				// only ever reflect one of those, silently misleading anyone reading it
				// under a different metric. Precomputing all three removes the need for
				// every consumer to re-sort this list itself just to get a correct rank.
				const rankBy = (
					metric: 'dps' | 'tdo' | 'edps'
				): Map<string, number> => {
					const sorted = [...pokemonEntries].sort((a, b) =>
						b[metric] !== a[metric]
							? b[metric] - a[metric]
							: a.speciesId.localeCompare(b.speciesId)
					);
					return new Map(sorted.map((e, i) => [e.speciesId, i + 1]));
				};
				const dpsRanks = rankBy('dps');
				const tdoRanks = rankBy('tdo');
				const edpsRanks = rankBy('edps');

				// Iteration/serialization order still reads naturally best-DPS-first —
				// merely cosmetic now that every consumer ranks off an explicit field.
				pokemonEntries.sort(
					(a, b) =>
						(dpsRanks.get(a.speciesId) ?? 0) - (dpsRanks.get(b.speciesId) ?? 0)
				);

				const parsedEntries: Record<string, ComputedDpsRank> = {};
				pokemonEntries.forEach((k) => {
					parsedEntries[k.speciesId] = {
						...k,
						dpsRank: dpsRanks.get(k.speciesId)!,
						tdoRank: tdoRanks.get(k.speciesId)!,
						edpsRank: edpsRanks.get(k.speciesId)!,
					};
				});

				output[type] = parsedEntries;
			});

		return output;
	}
}

export default RaidDpsCalculator;
