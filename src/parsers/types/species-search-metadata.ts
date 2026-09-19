/**
 * Everything go-pokedex's search-string generators (Search Strings tab, Mass
 * Delete's bulk sweeps) need about one species that's both whole-gamemaster
 * to compute and settings-independent — kept in its own file/output
 * (`species-search-metadata.json`), keyed by the exact same speciesId the
 * gamemaster uses, rather than written onto `GameMasterPokemon` itself. See
 * `best-iv-spread-calculator.ts` and `form-identifier-calculator.ts` for how
 * each piece is computed.
 */

/** One raw (pre-purification) IV spread. */
export interface BadIvPattern {
	A: number;
	D: number;
	S: number;
}

/** The only two level ceilings ("50" or "51"/Best Buddy) any consumer ever
 *  evaluates against. */
export type BestIvLevel = 50 | 51;

export type PerLevelPatterns = Record<
	`level${BestIvLevel}`,
	Array<BadIvPattern>
>;

/** Tied-for-rank-1 (best stat product) raw IV patterns, per league (Great /
 *  Ultra / Master) and per level ceiling — everything Mass Delete's bulk
 *  sweeps (`findBadIvCarveOuts`, `findTradeableSpeciesData` in go-pokedex)
 *  need about one species, computed once here instead of by every client. */
export type BestIvSpreads = Record<
	'great' | 'ultra' | 'master',
	PerLevelPatterns
>;

export interface SpeciesSearchMetadata {
	/** The shortest `dex[&type[&!type]]` in-game-search identifier that pins
	 *  down this species' own form among every dex number shared by multiple
	 *  species — see `form-identifier-calculator.ts`. A Shadow shares its
	 *  non-Shadow counterpart's identical value (Shadow status never changes
	 *  a species' dex or types). `String(dex)` (no disambiguation needed)
	 *  when this dex has only one candidate form. */
	searchFormId: string;
	bestIvSpreads: BestIvSpreads;
	/** Only ever populated for a Shadow species — a non-Shadow catch can
	 *  never purify, so it'd be pure dead weight everywhere else. */
	bestIvSpreadsPurified?: BestIvSpreads;
}

export type SpeciesSearchMetadataMap = Record<string, SpeciesSearchMetadata>;
