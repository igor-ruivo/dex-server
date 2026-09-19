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

/* ---- whole-dictionary orchestration ---------------------------------------- */

/** One species' form-identity half of `SpeciesSearchMetadata` — the other
 *  half (`bestIvSpreads`/`bestIvSpreadsPurified`) comes from
 *  `best-iv-spread-calculator.ts`; `species-search-metadata.ts` combines
 *  both into the single record actually written to disk.
 *
 *  The Shadow-counterpart flag that used to live here (`hasShadowCounterpart`)
 *  moved to `game-master.json` itself — see `shadowSpecies`/`nonShadowSpecies`
 *  on `GameMasterPokemon`, computed by `family-relations-calculator.ts`. */
export interface FormIdentifierFields {
	searchFormId: string;
}

/**
 * Every species' `searchFormId`, keyed by speciesId. A pure function of
 * `gameMasterPokemon` — never mutates it.
 */
export const computeFormIdentifiersForAllSpecies = (
	gameMasterPokemon: GameMasterData
): Record<string, FormIdentifierFields> => {
	const formIds = buildFormIds(gameMasterPokemon);
	const result: Record<string, FormIdentifierFields> = {};
	for (const pokemon of Object.values(gameMasterPokemon)) {
		result[pokemon.speciesId] = {
			searchFormId: formIdentifierFor(pokemon, formIds),
		};
	}
	return result;
};
