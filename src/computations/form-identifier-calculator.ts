import type {
	GameMasterData,
	GameMasterPokemon,
} from '../parsers/types/pokemon';

/**
 * Verbatim port of go-pokedex's own disambiguation-identifier builder
 * (`buildUniqueTypes`/`generatePokemonId` in `src/lib/search-string.ts`, and
 * `buildFormIds`/`formIdentifierFor` in `src/routes/pokemon/SearchStringsTab.tsx`) —
 * kept byte-for-byte identical so `searchFormId` is provably the same string
 * every one of go-pokedex's search-string generators already computes for
 * itself today, not a re-derived approximation of it. Do not "clean up"
 * these functions without re-diffing them against the client's copies.
 */

export type PokemonForm = {
	dexNumber: number;
	/** Already lowercased — matches the literal type keywords Pokémon GO's
	 *  own search bar understands (e.g. `psychic`, not `Psychic`). */
	types: Array<string>;
	isShadow: boolean;
	p: GameMasterPokemon;
};
export type UniqueTypes = Record<number, Set<string>>;

/** Which types, per dex number, only one form at that dex has — enough on its own to identify that form. */
export const buildUniqueTypes = (
	pokemonForms: Array<PokemonForm>
): UniqueTypes => {
	const typeOccurrences: Record<number, Record<string, number>> = {};
	pokemonForms.forEach(({ dexNumber, types }) => {
		if (!typeOccurrences[dexNumber]) typeOccurrences[dexNumber] = {};
		types.forEach((type) => {
			typeOccurrences[dexNumber][type] =
				(typeOccurrences[dexNumber][type] || 0) + 1;
		});
	});
	const uniqueTypes: UniqueTypes = {};
	for (const dex in typeOccurrences) {
		const dexNumber = parseInt(dex);
		uniqueTypes[dexNumber] = new Set<string>();
		for (const type in typeOccurrences[dexNumber]) {
			if (typeOccurrences[dexNumber][type] === 1)
				uniqueTypes[dexNumber].add(type);
		}
	}
	return uniqueTypes;
};

/**
 * The shortest `dex[,type[,!type]]` identifier that pins down one specific
 * form at a dex number shared by multiple forms/species — a bare dex number
 * when it's the only form there, otherwise its one unique type if it has one,
 * otherwise enough of its types (plus negated sibling-only types) to rule out
 * every sibling. Character count matters here: this is repeated once per
 * exception in a generated string.
 */
export const generatePokemonId = (
	dexNumber: number,
	types: Array<string>,
	uniqueTypes: UniqueTypes,
	formSiblings: Array<PokemonForm>,
	form: PokemonForm
): string => {
	if (formSiblings.length === 1) return `${dexNumber}`;
	let identifier = `${dexNumber}`;
	const uniqueTypesForDex = uniqueTypes[dexNumber] || new Set<string>();
	const siblingTypesToNegate = new Set<string>();
	const uniqueType = types.find((type) => uniqueTypesForDex.has(type));
	if (uniqueType) {
		identifier += `,${uniqueType}`;
	} else {
		types.forEach((type) => {
			if (formSiblings.some((t) => !t.types.includes(type)))
				identifier += `,${type}`;
		});
		formSiblings.forEach((sibling) => {
			if (sibling !== form) {
				sibling.types.forEach((siblingType) => {
					if (
						!types.includes(siblingType) &&
						sibling.types.some((t) => types.includes(t))
					) {
						siblingTypesToNegate.add(siblingType);
					}
				});
			}
		});
		siblingTypesToNegate.forEach((type) => {
			identifier += `,!${type}`;
		});
	}
	return identifier;
};

/**
 * The shortest `dex[&type[&!type]]` identifier that pins down one specific
 * form among every dex number shared by multiple forms/species — built once
 * from the whole gamemaster, keyed by `dex,types` so a Shadow reuses its
 * non-Shadow counterpart's identical entry (Shadow never changes a species'
 * dex or types).
 */
export const buildFormIds = (
	gameMasterPokemon: GameMasterData
): Record<string, string> => {
	const allPokemonForms: Array<PokemonForm> = Object.values(gameMasterPokemon)
		.filter((e) => !e.isMega && !e.aliasId && !e.isShadow)
		.map((e) => ({
			dexNumber: e.dex,
			types: e.types.map((f) => f.toString().toLocaleLowerCase()),
			isShadow: false,
			p: e,
		}));
	const uniqueTypes = buildUniqueTypes(allPokemonForms);
	const formIds: Record<string, string> = {};
	allPokemonForms.forEach((form) => {
		const formSiblings = allPokemonForms.filter(
			(f) => f.dexNumber === form.dexNumber
		);
		const id = generatePokemonId(
			form.dexNumber,
			form.types,
			uniqueTypes,
			formSiblings,
			form
		);
		formIds[`${form.dexNumber},${form.types.join(',')}`] = id.replaceAll(
			',',
			'&'
		);
	});
	return formIds;
};

export const formIdentifierFor = (
	species: GameMasterPokemon,
	formIds: Record<string, string>
): string => {
	const key = `${species.dex},${species.types.map((t) => t.toString().toLocaleLowerCase()).join(',')}`;
	return formIds[key] ?? String(species.dex);
};

/* ---- Shadow-counterpart flag — mirrors go-pokedex's own ------------------- */
/*      `isNormalPokemonAndHasShadowVersion` (utils/pokemon-helper.ts)        */

export const isNormalPokemonAndHasShadowVersion = (
	pokemon: GameMasterPokemon,
	gameMasterPokemon: GameMasterData
): boolean => {
	if (pokemon.isShadow) {
		return false;
	}

	return Object.values(gameMasterPokemon).some(
		(p) =>
			p.speciesId !== pokemon.speciesId &&
			!p.aliasId &&
			p.dex === pokemon.dex &&
			p.isShadow &&
			p.types.length === pokemon.types.length &&
			p.types.every((t) => pokemon.types.includes(t))
	);
};

/* ---- whole-dictionary orchestration ---------------------------------------- */

/**
 * Mutates every species in `gameMasterPokemon` in place, adding
 * `searchFormId` and `hasShadowCounterpart` (see their own doc comments on
 * `GameMasterPokemon`). Returns the same object for convenience.
 *
 * Reuses `game-master.json` itself for the same reason
 * `augmentGameMasterWithBestIvSpreads` does: a short string and a boolean per
 * species is a tiny payload, always looked up by the exact speciesId key the
 * gamemaster already uses.
 */
export const augmentGameMasterWithFormIdentifiers = (
	gameMasterPokemon: GameMasterData
): GameMasterData => {
	const formIds = buildFormIds(gameMasterPokemon);
	for (const pokemon of Object.values(gameMasterPokemon)) {
		pokemon.searchFormId = formIdentifierFor(pokemon, formIds);
		pokemon.hasShadowCounterpart = isNormalPokemonAndHasShadowVersion(
			pokemon,
			gameMasterPokemon
		);
	}
	return gameMasterPokemon;
};
