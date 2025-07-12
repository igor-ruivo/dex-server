import { HttpDataFetcher, IDataFetcher } from '../services/data-fetcher';
import { BasePokemon, GameMasterData, GameMasterPokemon, IGameMasterMove } from '../types/pokemon';
import { POKEMON_CONFIG } from './config/pokemon-config';
import { SYNTHETIC_POKEMON } from './data/synthetic-pokemon';
import { ImageUrlBuilder } from './utils/image-url-builder';
import { PokemonTransformer } from './utils/pokemon-transformer';
import { PokemonValidator } from './utils/pokemon-validator';

export class GameMasterParser {
	private readonly dataFetcher: IDataFetcher;

	constructor(dataFetcher: IDataFetcher = new HttpDataFetcher()) {
		this.dataFetcher = dataFetcher;
	}

	async parse(moves: Record<string, IGameMasterMove>): Promise<GameMasterData> {
		console.log('🔄 Fetching Pokemon Game Master data...');

		try {
			const rawData = await this.dataFetcher.fetchJson<Array<BasePokemon>>(POKEMON_CONFIG.SOURCE_URL);
			console.log(`📊 Found ${rawData.length} Pokemon in source data`);

			// Combine source data with synthetic Pokemon
			const allPokemon = [...rawData, ...SYNTHETIC_POKEMON];

			const pokemonDictionary = this.transformData(allPokemon, moves);
			console.log(`✅ Successfully parsed ${Object.keys(pokemonDictionary).length} Pokemon`);

			return pokemonDictionary;
		} catch (error) {
			console.error('❌ Failed to parse Game Master data:', error);
			throw error;
		}
	}

	private transformData(rawData: Array<BasePokemon>, knownMoves: Record<string, IGameMasterMove>): GameMasterData {
		const seenSpecies = new Set<string>();
		const pokemonDictionary: GameMasterData = {};

		// Filter and process Pokemon
		const validPokemon = rawData.filter(
			(pokemon) => PokemonValidator.isValidPokemon(pokemon) && !seenSpecies.has(pokemon.speciesId)
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

	private checkPokemonMoves = (pokemon: GameMasterPokemon, knownMoves: Record<string, IGameMasterMove>) => {
		const allPokemonMoves = new Set([
			...(pokemon.eliteMoves ?? []),
			...pokemon.fastMoves,
			...pokemon.chargedMoves,
			...(pokemon.legacyMoves ?? []),
		]);

		for (const move of allPokemonMoves) {
			if (!knownMoves[move]) {
				console.error(`${move} isn't a known move! (Pokémon species: ${pokemon.speciesId})`);
			}
		}
	};

	private transformPokemon = (pokemon: BasePokemon, allPokemon: Array<BasePokemon>): GameMasterPokemon | null => {
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

			const currentIndex = repeatedDexs.findIndex((p) => p.speciesId === idForIndexCalc);
			if (currentIndex === -1) {
				console.log(`Couldn't find matching species id for ${pokemon.speciesId} (alias: ${pokemon.aliasId})`);
			}

			let imageForm = '';
			if (currentIndex > 0) {
				imageForm = (currentIndex + 1).toString();
			}

			return {
				dex: pokemon.dex,
				speciesId: pokemon.speciesId,
				speciesName: PokemonTransformer.sexConverter(PokemonTransformer.cleanSpeciesName(pokemon.speciesName)),
				types: PokemonTransformer.transformTypes(pokemon.types),
				imageUrl: ImageUrlBuilder.buildImageUrl(pokemon, imageForm),
				goImageUrl: ImageUrlBuilder.buildGoImageUrlForPokemon(pokemon, goForm),
				shinyGoImageUrl: ImageUrlBuilder.buildShinyGoImageUrlForPokemon(pokemon, goForm),
				atk: pokemon.baseStats.atk,
				def: pokemon.baseStats.def,
				hp: pokemon.baseStats.hp,
				fastMoves: PokemonTransformer.cleanMoves(pokemon.fastMoves),
				chargedMoves: PokemonTransformer.cleanMoves(pokemon.chargedMoves),
				eliteMoves: PokemonTransformer.cleanMoves(pokemon.eliteMoves ?? []),
				legacyMoves: PokemonTransformer.cleanMoves(pokemon.legacyMoves ?? []),
				isShadow,
				isMega,
				familyId: pokemon.family?.id,
				parent: pokemon.speciesId === 'darmanitan_standard_shadow' ? 'darumaka_shadow' : pokemon.family?.parent,
				evolutions: pokemon.family?.evolutions ?? [],
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
	};

	private applyManualCorrections(pokemonDictionary: GameMasterData): void {
		// Apply any manual corrections needed
		const gastrodon = pokemonDictionary.gastrodon;
		if (gastrodon) {
			gastrodon.familyId = 'FAMILY_SHELLOS';
			gastrodon.parent = 'shellos';
		}

		const cursola = pokemonDictionary.cursola;
		if (cursola) {
			cursola.parent = 'corsola_galarian';
		}

		const corsola = pokemonDictionary.corsola;
		if (corsola) {
			corsola.familyId = 'FAMILY_CORSOLA';
		}

		const corsolaGalarian = pokemonDictionary.corsola_galarian;
		if (corsolaGalarian) {
			corsolaGalarian.familyId = 'FAMILY_CORSOLA';
			corsolaGalarian.evolutions = ['cursola'];
		}

		// Handle golisopodsh alias
		const golisopodsh = pokemonDictionary.golisopodsh;
		if (golisopodsh) {
			golisopodsh.aliasId = 'golisopod';
		}
	}
}

export type { GameMasterData } from '../types/pokemon';
