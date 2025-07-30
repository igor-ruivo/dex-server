import type { IDataFetcher } from '../services/data-fetcher';
import type {
	BasePokemon,
	GameMasterData,
	GameMasterPokemon,
	IGameMasterMove,
} from '../types/pokemon';
import { POKEMON_CONFIG } from './config/pokemon-config';
import { SYNTHETIC_POKEMON } from './data/synthetic-pokemon';
import ImageUrlBuilder from './utils/image-url-builder';
import PokemonTransformer from './utils/pokemon-transformer';
import PokemonValidator from './utils/pokemon-validator';
export interface IPokemonDomains {
	allDomain: Array<GameMasterPokemon>;
	normalDomain: Array<GameMasterPokemon>;
	nonShadowDomain: Array<GameMasterPokemon>;
	nonMegaDomain: Array<GameMasterPokemon>;
	nonMegaNonShadowDomain: Array<GameMasterPokemon>;
}

/**
 * Returns all relevant domains from the Game Master data.
 */
export const getDomains = (
	gameMasterPokemon: GameMasterData
): IPokemonDomains => {
	const allDomain = Object.values(gameMasterPokemon).filter((p) => !p.aliasId);

	const nonShadowDomain = allDomain.filter((p) => !p.isShadow);
	const nonMegaDomain = allDomain.filter((p) => !p.isMega);

	const nonMegaNonShadowDomain = nonShadowDomain.filter((p) => !p.isMega);
	const normalDomain = nonMegaNonShadowDomain.filter(
		(p) => !(p.isBeast || p.isLegendary || p.isMythical)
	);

	return {
		allDomain,
		normalDomain,
		nonMegaDomain,
		nonShadowDomain,
		nonMegaNonShadowDomain,
	};
};

class GameMasterParser {
	constructor(
		private readonly dataFetcher: IDataFetcher,
		private readonly moves: Record<string, IGameMasterMove>
	) {}

	async parse() {
		console.log('🔄 Fetching Pokemon Game Master data...');

		try {
			const rawData = await this.dataFetcher.fetchJson<Array<BasePokemon>>(
				POKEMON_CONFIG.SOURCE_URL
			);
			console.log(`📊 Found ${rawData.length} Pokemon in source data`);

			// Combine source data with synthetic Pokemon
			const allPokemon = [...rawData, ...SYNTHETIC_POKEMON];

			const pokemonDictionary = this.transformData(allPokemon, this.moves);
			console.log(
				`✅ Successfully parsed ${Object.keys(pokemonDictionary).length} Pokemon`
			);

			return pokemonDictionary;
		} catch (error) {
			console.error('❌ Failed to parse Game Master data:', error);
			throw error;
		}
	}

	private transformData(
		rawData: Array<BasePokemon>,
		knownMoves: Record<string, IGameMasterMove>
	): GameMasterData {
		const seenSpecies = new Set<string>();
		const pokemonDictionary: GameMasterData = {};

		// Filter and process Pokemon
		const validPokemon = rawData.filter(
			(pokemon) =>
				PokemonValidator.isValidPokemon(pokemon) &&
				!seenSpecies.has(pokemon.speciesId)
		);

		for (const pokemon of validPokemon) {
			seenSpecies.add(pokemon.speciesId);

			const transformed = this.transformPokemon(pokemon, rawData);
			if (transformed) {
				pokemonDictionary[pokemon.speciesId] = transformed;
				this.checkPokemonMoves(transformed, knownMoves);
			}
		}

		// Apply manual corrections
		this.applyManualCorrections(pokemonDictionary);

		return pokemonDictionary;
	}

	private checkPokemonMoves(
		pokemon: GameMasterPokemon,
		knownMoves: Record<string, IGameMasterMove>
	) {
		const allPokemonMoves = new Set([
			...(pokemon.eliteMoves ?? []),
			...pokemon.fastMoves,
			...pokemon.chargedMoves,
			...(pokemon.legacyMoves ?? []),
		]);

		for (const move of allPokemonMoves) {
			if (!knownMoves[move]) {
				throw new Error(
					`${move} isn't a known move! (Pokémon species: ${pokemon.speciesId})`
				);
			}
		}
	}

	private isNormalPokemonAndHasShadowVersion(
		pokemon: BasePokemon,
		allPokemon: Array<BasePokemon>
	) {
		if (PokemonValidator.isShadowPokemon(pokemon)) {
			return false;
		}

		if (PokemonValidator.isMegaPokemon(pokemon)) {
			const megaTerm = '_mega';
			const primalTerm = '_primal';
			if (
				!pokemon.speciesId.includes(megaTerm) &&
				!pokemon.speciesId.includes(primalTerm)
			) {
				throw new Error(
					`${pokemon.speciesId} doesn't have a well defined id for base type!`
				);
			}

			const baseVersionId = pokemon.speciesId
				.split(megaTerm)[0]
				.split(primalTerm)[0];
			const basePkm = allPokemon.find((a) => a.speciesId === baseVersionId);
			if (!basePkm) {
				throw new Error(`${baseVersionId} doesn't exist in game master!`);
			}

			pokemon = basePkm;
		}

		return allPokemon.some(
			(p) =>
				p.speciesId !== pokemon.speciesId &&
				!p.aliasId &&
				p.dex === pokemon.dex &&
				PokemonValidator.isShadowPokemon(p) &&
				p.types.length === pokemon.types.length &&
				p.types.every((t) => pokemon.types.includes(t))
		);
	}

	private transformPokemon(
		pokemon: BasePokemon,
		allPokemon: Array<BasePokemon>
	): GameMasterPokemon | null {
		try {
			const isShadow = PokemonValidator.isShadowPokemon(pokemon);
			const isMega = PokemonValidator.isMegaPokemon(pokemon);
			const goForm = PokemonTransformer.getGoForm(pokemon.speciesName);

			// Calculate form for image URLs using the original logic
			const idForIndexCalc = pokemon.speciesId.replace('_shadow', '');
			const repeatedDexs = allPokemon.filter(
				(p) =>
					PokemonValidator.isValidPokemon(p) &&
					p.dex === pokemon.dex &&
					!PokemonValidator.isShadowPokemon(p) &&
					!p.aliasId
			);

			const currentIndex = repeatedDexs.findIndex(
				(p) => p.speciesId === idForIndexCalc
			);
			if (currentIndex === -1) {
				console.log(
					`Couldn't find matching species id for ${pokemon.speciesId} (alias: ${pokemon.aliasId})`
				);
			}

			let imageForm = '';
			if (currentIndex > 0) {
				imageForm = (currentIndex + 1).toString();
			}

			return {
				dex: pokemon.dex,
				speciesId: pokemon.speciesId,
				speciesName: PokemonTransformer.sexConverter(
					PokemonTransformer.cleanSpeciesName(pokemon.speciesName)
				),
				types: PokemonTransformer.transformTypes(pokemon.types),
				imageUrl: ImageUrlBuilder.buildImageUrl(pokemon, imageForm),
				goImageUrl: ImageUrlBuilder.buildGoImageUrlForPokemon(pokemon, goForm),
				shinyGoImageUrl: ImageUrlBuilder.buildShinyGoImageUrlForPokemon(
					pokemon,
					goForm
				),
				baseStats: pokemon.baseStats,
				fastMoves: PokemonTransformer.cleanMoves(pokemon.fastMoves),
				chargedMoves: [
					...PokemonTransformer.cleanMoves(pokemon.chargedMoves),
					...(isShadow
						? ['FRUSTRATION']
						: this.isNormalPokemonAndHasShadowVersion(pokemon, allPokemon)
							? ['RETURN']
							: []),
				],
				eliteMoves: PokemonTransformer.cleanMoves(pokemon.eliteMoves ?? []),
				legacyMoves: PokemonTransformer.cleanMoves(pokemon.legacyMoves ?? []),
				isShadow,
				isMega,
				family: pokemon.family,
				aliasId: pokemon.aliasId,
				form: PokemonTransformer.getForm(pokemon.speciesName),
				isLegendary: PokemonValidator.hasTag(pokemon, 'legendary'),
				isMythical: PokemonValidator.hasTag(pokemon, 'mythical'),
				isBeast: PokemonValidator.hasTag(pokemon, 'ultrabeast'),
			};
		} catch (error) {
			console.error(error);
			return null;
		}
	}

	private applyManualCorrections(pokemonDictionary: GameMasterData): void {
		// Apply any manual corrections needed
		const gastrodon = pokemonDictionary.gastrodon;
		if (gastrodon?.family) {
			gastrodon.family.id = 'FAMILY_SHELLOS';
			gastrodon.family.parent = 'shellos';
		}

		const cursola = pokemonDictionary.cursola;
		if (cursola?.family) {
			cursola.family.parent = 'corsola_galarian';
		}

		const corsola = pokemonDictionary.corsola;
		if (corsola?.family) {
			corsola.family.id = 'FAMILY_CORSOLA';
		}

		const corsolaGalarian = pokemonDictionary.corsola_galarian;
		if (corsolaGalarian?.family) {
			corsolaGalarian.family.id = 'FAMILY_CORSOLA';
			corsolaGalarian.family.evolutions = ['cursola'];
		}

		const darmanitanShadow = pokemonDictionary.darmanitan_standard_shadow;
		if (darmanitanShadow?.family) {
			darmanitanShadow.family.parent = 'darumaka_shadow';
		}

		// Handle golisopodsh alias
		const golisopodsh = pokemonDictionary.golisopodsh;
		if (golisopodsh) {
			golisopodsh.aliasId = 'golisopod';
		}
	}
}

export default GameMasterParser;
