import type HttpDataFetcher from '../../../services/data-fetcher';
import type GameMasterTranslator from '../../../services/gamemaster-translator';
import { AvailableLocales } from '../../../services/gamemaster-translator';
import type {
	GameMasterData,
	GameMasterMovesType,
	IGameMasterMove,
	PvEMove,
	PvPMove,
} from '../../../types/pokemon';

const normalizedMoveName = (moveName: string) => {
	return moveName
		.split('_')
		.map(
			(p) =>
				p.substring(0, 1).toLocaleUpperCase() +
				p.substring(1).toLocaleLowerCase()
		)
		.join(' ');
};

class MovesProvider {
	constructor(
		private readonly dataFetcher: HttpDataFetcher,
		private readonly translatorService: GameMasterTranslator
	) {}
	private readonly GAME_MASTER_URL =
		'https://raw.githubusercontent.com/PokeMiners/game_masters/master/latest/latest.json';

	async fetchMoves(): Promise<Record<string, IGameMasterMove>> {
		const gmData = await this.dataFetcher.fetchJson<Array<GameMasterMovesType>>(
			this.GAME_MASTER_URL
		);

		const pvpMoves: Record<string, PvPMove> = {};
		const pveMoves: Record<string, PvEMove> = {};

		const renamedMoveIds: Record<string, string> = {
			FUTURESIGHT: 'FUTURE_SIGHT',
			TECHNO_BLAST_WATER: 'TECHNO_BLAST_DOUSE',
			PYROBALL: 'PYRO_BALL',
		};

		const renamedVFXsIds: Record<string, string> = {
			myst_fire: 'MYSTICAL_FIRE',
			futuresight: 'FUTURE_SIGHT',
		};

		gmData
			.filter(
				(entry) =>
					!entry.data.templateId?.startsWith('VN_BM_') &&
					(entry.data?.moveSettings || entry.data?.combatMove)
			)
			.forEach((entry) => {
				const supermegaTerm = 'TEMP_EVOLUTION_MEGA';
				const supermegaTermSuffix = '_PLUS';
				const isPvP = !!entry.data.combatMove;
				const dataPointer = entry.data.moveSettings || entry.data.combatMove;
				const helperConst = '_MOVE_';
				const helperIdx = entry.data.templateId.indexOf(helperConst);
				const moveIdPointer = entry.data.templateId.substring(
					helperIdx + helperConst.length
				);
				const typePointer = dataPointer.pokemonType || dataPointer.type;
				const isSuperMega = moveIdPointer.includes(supermegaTerm);
				const id = isSuperMega
					? (
							renamedVFXsIds[dataPointer.vfxName] ?? dataPointer.vfxName
						).toLocaleUpperCase() + supermegaTermSuffix
					: moveIdPointer.endsWith('_FAST')
						? moveIdPointer.substring(0, moveIdPointer.lastIndexOf('_FAST'))
						: moveIdPointer;
				const isFast = moveIdPointer.endsWith('_FAST');

				if (isPvP) {
					const term = 'COMBAT_V';
					const vidSubstring = (dpt: GameMasterMovesType) =>
						dpt.data.templateId.substring(
							dpt.data.templateId.indexOf(term) + term.length
						);
					const vidTarget = isSuperMega
						? gmData
								.filter(
									(entry) =>
										!entry.data.templateId?.startsWith('VN_BM_') &&
										(entry.data?.moveSettings || entry.data?.combatMove)
								)
								.find(
									(m) =>
										(m.data.moveSettings || m.data.combatMove).vfxName ===
											dataPointer.vfxName &&
										!m.data.templateId.includes(supermegaTerm) &&
										!!m.data.combatMove
								)
						: undefined;
					pvpMoves[id] = {
						moveId: id,
						isSuperMega,
						vId: vidSubstring(vidTarget ?? entry).substring(
							0,
							vidSubstring(vidTarget ?? entry).indexOf('_')
						),
						type:
							typePointer.split('POKEMON_TYPE_')[1]?.toLocaleLowerCase() ?? '',
						isFast: isFast,
						pvpPower: dataPointer.power,
						pvpEnergy: dataPointer.energyDelta,
						pvpCooldown: isFast
							? (+(dataPointer.durationTurns ?? 0) + 1) / 2
							: 0,
						buffs: dataPointer.buffs,
					};
				} else {
					const vidTarget = isSuperMega
						? gmData
								.filter(
									(entry) =>
										!entry.data.templateId?.startsWith('VN_BM_') &&
										(entry.data?.moveSettings || entry.data?.combatMove)
								)
								.find(
									(m) =>
										(m.data.moveSettings || m.data.combatMove).vfxName ===
											dataPointer.vfxName &&
										!m.data.templateId.includes(supermegaTerm) &&
										!m.data.combatMove
								)
						: undefined;
					pveMoves[id] = {
						moveId: id,
						isSuperMega,
						vId: (vidTarget ?? entry).data.templateId.substring(
							1,
							(vidTarget ?? entry).data.templateId.indexOf('_')
						),
						type:
							typePointer.split('POKEMON_TYPE_')[1]?.toLocaleLowerCase() ?? '',
						isFast: isFast,
						pvePower: dataPointer.power,
						pveEnergy: dataPointer.energyDelta,
						pveCooldown: +dataPointer.durationMs / 1000,
					};
				}
			});

		const movesDictionary: Record<string, IGameMasterMove> = {};

		Object.values(pvpMoves).forEach((move) => {
			if (!move.moveId) {
				return;
			}

			const pveCounterpart = pveMoves[move.moveId];
			const translatedId = renamedMoveIds[move.moveId] ?? move.moveId;
			const enName = normalizedMoveName(translatedId);

			// Build moveName as a record of all AvailableLocales
			const moveName: Partial<Record<AvailableLocales, string>> = {};
			Object.values(AvailableLocales).forEach((locale) => {
				const translation = this.translatorService.getTranslationForMoveName(
					locale,
					move.vId
				);
				moveName[locale] =
					(translation || enName) + (move.isSuperMega ? '+' : '');
			});

			movesDictionary[translatedId] = {
				moveId: translatedId,
				isSuperMega: move.isSuperMega,
				vId: move.vId,
				type: move.type,
				isFast: move.isFast,
				pvpPower: move.pvpPower ?? 0,
				pvePower: pveCounterpart?.pvePower ?? 0,
				pvpEnergy: move.pvpEnergy ?? 0,
				pveEnergy: pveCounterpart?.pveEnergy ?? 0,
				pvpCooldown: move.pvpCooldown ?? 0,
				pveCooldown: pveCounterpart?.pveCooldown ?? 0,
				buffs: move.buffs,
				moveName,
			};
		});

		Object.values(pveMoves).forEach((move) => {
			if (!move.moveId) return;
			const pvpCounterpart = pvpMoves[move.moveId];
			const translatedId = renamedMoveIds[move.moveId] ?? move.moveId;
			const enName = normalizedMoveName(translatedId);

			// Build moveName as a record of all AvailableLocales
			const moveName: Partial<Record<AvailableLocales, string>> = {};
			Object.values(AvailableLocales).forEach((locale) => {
				const translation = this.translatorService.getTranslationForMoveName(
					locale,
					move.vId
				);
				moveName[locale] =
					(translation || enName) + (move.isSuperMega ? '+' : '');
			});
			movesDictionary[translatedId] = {
				moveId: translatedId,
				isSuperMega: move.isSuperMega,
				vId: move.vId,
				type: move.type,
				isFast: move.isFast,
				pvpPower: pvpCounterpart?.pvpPower ?? 0,
				pvePower: move.pvePower ?? 0,
				pvpEnergy: pvpCounterpart?.pvpEnergy ?? 0,
				pveEnergy: move.pveEnergy ?? 0,
				pvpCooldown: pvpCounterpart?.pvpCooldown ?? 0,
				pveCooldown: move.pveCooldown ?? 0,
				buffs: pvpCounterpart?.buffs,
				moveName,
			};
		});

		// Missing moves

		const aegislashChargePsychoCutMoveName: Partial<
			Record<AvailableLocales, string>
		> = {};
		Object.values(AvailableLocales).forEach((locale) => {
			const translation = this.translatorService.getTranslationForMoveName(
				locale,
				'0226' // Psycho Cut vid
			);
			aegislashChargePsychoCutMoveName[locale] = translation || 'Psycho Cut';
		});

		if (!movesDictionary.AEGISLASH_CHARGE_PSYCHO_CUT) {
			movesDictionary.AEGISLASH_CHARGE_PSYCHO_CUT = {
				moveId: 'AEGISLASH_CHARGE_PSYCHO_CUT',
				isSuperMega: false,
				vId: '-1',
				type: 'psychic',
				isFast: true,
				pvpPower: 0,
				pvePower: 4,
				pvpEnergy: 6,
				pveEnergy: 7,
				pvpCooldown: 1,
				pveCooldown: 0.5,
				moveName: aegislashChargePsychoCutMoveName,
			};
		}

		const aegislashChargeAirSlashMoveName: Partial<
			Record<AvailableLocales, string>
		> = {};
		Object.values(AvailableLocales).forEach((locale) => {
			const translation = this.translatorService.getTranslationForMoveName(
				locale,
				'0255' // Air Slash vid
			);
			aegislashChargeAirSlashMoveName[locale] = translation || 'Air Slash';
		});

		if (!movesDictionary.AEGISLASH_CHARGE_AIR_SLASH) {
			movesDictionary.AEGISLASH_CHARGE_AIR_SLASH = {
				moveId: 'AEGISLASH_CHARGE_AIR_SLASH',
				vId: '-1',
				isSuperMega: false,
				type: 'flying',
				isFast: true,
				pvpPower: 0,
				pvePower: 12,
				pvpEnergy: 6,
				pveEnergy: 8,
				pvpCooldown: 1.5,
				pveCooldown: 1,
				moveName: aegislashChargeAirSlashMoveName,
			};
		}

		const gulpMissileArrokudaMoveName: Partial<
			Record<AvailableLocales, string>
		> = {};
		Object.values(AvailableLocales).forEach((locale) => {
			gulpMissileArrokudaMoveName[locale] = normalizedMoveName(
				'GULP_MISSILE_ARROKUDA'
			);
		});

		if (!movesDictionary.GULP_MISSILE_ARROKUDA) {
			movesDictionary.GULP_MISSILE_ARROKUDA = {
				moveId: 'GULP_MISSILE_ARROKUDA',
				vId: '-1',
				type: 'water',
				isSuperMega: false,
				isFast: false,
				pvpPower: 15,
				pvePower: 0,
				pvpEnergy: 0,
				pveEnergy: 0,
				pvpCooldown: 0.5,
				pveCooldown: 0,
				moveName: gulpMissileArrokudaMoveName,
				buffs: {
					buffActivationChance: 1,
					attackerDefenseStatStageChange: -1,
				},
			};
		}

		const gulpMissilePikachuMoveName: Partial<
			Record<AvailableLocales, string>
		> = {};
		Object.values(AvailableLocales).forEach((locale) => {
			gulpMissilePikachuMoveName[locale] = normalizedMoveName(
				'GULP_MISSILE_PIKACHU'
			);
		});

		if (!movesDictionary.GULP_MISSILE_PIKACHU) {
			movesDictionary.GULP_MISSILE_PIKACHU = {
				moveId: 'GULP_MISSILE_PIKACHU',
				vId: '-1',
				type: 'water',
				isFast: false,
				isSuperMega: false,
				pvpPower: 15,
				pvePower: 0,
				pvpEnergy: 0,
				pveEnergy: 0,
				pvpCooldown: 0.5,
				pveCooldown: 0,
				moveName: gulpMissilePikachuMoveName,
				buffs: {
					buffActivationChance: 1,
					targetAttackStatStageChange: -2,
				},
			};
		}

		const fellStingerPlusMoveName: Partial<Record<AvailableLocales, string>> = {
			[AvailableLocales.en]: 'Fell Stinger+',
			[AvailableLocales.ptbr]: 'Ferrão Letal+',
		};

		if (!movesDictionary.FELL_STINGER_PLUS) {
			movesDictionary.FELL_STINGER_PLUS = {
				moveId: 'FELL_STINGER_PLUS',
				vId: '0311',
				type: 'bug',
				isFast: false,
				isSuperMega: true,
				pvpPower: 40,
				pvePower: 140,
				pvpEnergy: -35,
				pveEnergy: -100,
				pvpCooldown: 0.5,
				pveCooldown: 2,
				moveName: fellStingerPlusMoveName,
				buffs: {
					buffActivationChance: 1,
					attackerAttackStatStageChange: 1,
				},
			};
		}

		return movesDictionary;
	}

	/**
	 * The PokeMiners Game Master carries a fair amount of dead move data: renamed
	 * duplicates, scrapped signature moves, mega "+"/"++" variants that never
	 * shipped, etc. None of it is attached to a Pokémon, so it has no business in
	 * moves.json. This drops every move that no known Pokémon can learn.
	 *
	 * Must run after the Pokémon Game Master has been parsed, since the parsed
	 * dictionary is the source of truth for what's actually learnable.
	 */
	pruneUnlearnableMoves(
		moves: Record<string, IGameMasterMove>,
		pokemonDictionary: GameMasterData
	): Record<string, IGameMasterMove> {
		const learnable = new Set<string>();
		for (const pokemon of Object.values(pokemonDictionary)) {
			for (const move of [
				...pokemon.fastMoves,
				...pokemon.chargedMoves,
				...(pokemon.eliteMoves ?? []),
				...(pokemon.legacyMoves ?? []),
				...(pokemon.extraChargedMoves ?? []),
			]) {
				learnable.add(move);
			}
		}

		const learnableMoves: Record<string, IGameMasterMove> = {};
		const skipped: Array<string> = [];
		for (const [moveId, move] of Object.entries(moves)) {
			if (learnable.has(moveId)) {
				learnableMoves[moveId] = move;
			} else {
				skipped.push(moveId);
			}
		}

		if (skipped.length > 0) {
			console.log(
				`Skipping ${skipped.length} move(s) not learnable by any known Pokémon: ${skipped.join(', ')}`
			);
		}

		return learnableMoves;
	}
}

export default MovesProvider;
