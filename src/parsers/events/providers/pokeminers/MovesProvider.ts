import type HttpDataFetcher from '../../../services/data-fetcher';
import type GameMasterTranslator from '../../../services/gamemaster-translator';
import { AvailableLocales } from '../../../services/gamemaster-translator';
import type {
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
		};

		gmData
			.filter(
				(entry) =>
					!entry.data.templateId?.startsWith('VN_BM_') &&
					(entry.data?.moveSettings || entry.data?.combatMove)
			)
			.forEach((entry) => {
				const isPvP = !!entry.data.combatMove;
				const dataPointer = entry.data.moveSettings || entry.data.combatMove;
				const helperConst = '_MOVE_';
				const helperIdx = entry.data.templateId.indexOf(helperConst);
				const moveIdPointer = entry.data.templateId.substring(
					helperIdx + helperConst.length
				);
				const typePointer = dataPointer.pokemonType || dataPointer.type;
				const id = moveIdPointer.endsWith('_FAST')
					? moveIdPointer.substring(0, moveIdPointer.lastIndexOf('_FAST'))
					: moveIdPointer;
				const isFast = moveIdPointer.endsWith('_FAST');

				if (isPvP) {
					const term = 'COMBAT_V';
					const vidSubstring = entry.data.templateId.substring(
						entry.data.templateId.indexOf(term) + term.length
					);
					pvpMoves[id] = {
						moveId: id,
						vId: vidSubstring.substring(0, vidSubstring.indexOf('_')),
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
					pveMoves[id] = {
						moveId: id,
						vId: entry.data.templateId.substring(
							1,
							entry.data.templateId.indexOf('_')
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
				moveName[locale] = translation || enName;
			});

			movesDictionary[translatedId] = {
				moveId: translatedId,
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
				moveName[locale] = translation || enName;
			});
			movesDictionary[translatedId] = {
				moveId: translatedId,
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

		// Add missing moves
		const upperHandMoveName: Partial<Record<AvailableLocales, string>> = {};
		Object.values(AvailableLocales).forEach((locale) => {
			upperHandMoveName[locale] = normalizedMoveName('UPPER_HAND');
		});

		if (!movesDictionary.UPPER_HAND) {
			movesDictionary.UPPER_HAND = {
				moveId: 'UPPER_HAND',
				vId: '-1',
				type: 'fighting',
				isFast: false,
				pvpPower: 70,
				pvePower: 50,
				pvpEnergy: -40,
				pveEnergy: -33,
				pvpCooldown: 0.5,
				pveCooldown: 2.0,
				buffs: {
					buffActivationChance: 0.3,
					targetDefenseStatStageChange: -1,
				},
				moveName: upperHandMoveName,
			};
		}

		const clangingScalesMoveName: Partial<Record<AvailableLocales, string>> =
			{};
		Object.values(AvailableLocales).forEach((locale) => {
			clangingScalesMoveName[locale] = normalizedMoveName('CLANGING_SCALES');
		});

		if (!movesDictionary.CLANGING_SCALES) {
			movesDictionary.CLANGING_SCALES = {
				moveId: 'CLANGING_SCALES',
				vId: '-1',
				type: 'dragon',
				isFast: false,
				pvpPower: 120,
				pvePower: 120,
				pvpEnergy: -45,
				pveEnergy: -100,
				pvpCooldown: 0.5,
				pveCooldown: 3.3,
				buffs: {
					buffActivationChance: 1,
					attackerDefenseStatStageChange: -1,
				},
				moveName: clangingScalesMoveName,
			};
		}

		const aquaStepMoveName: Partial<Record<AvailableLocales, string>> = {};
		Object.values(AvailableLocales).forEach((locale) => {
			aquaStepMoveName[locale] = normalizedMoveName('AQUA_STEP');
		});

		if (!movesDictionary.AQUA_STEP) {
			movesDictionary.AQUA_STEP = {
				moveId: 'AQUA_STEP',
				vId: '-1',
				type: 'water',
				isFast: false,
				pvpPower: 55,
				pvePower: 55,
				pvpEnergy: -40,
				pveEnergy: -40,
				pvpCooldown: 0.5,
				pveCooldown: 3.5,
				buffs: {
					buffActivationChance: 1,
					attackerAttackStatStageChange: 1,
				},
				moveName: aquaStepMoveName,
			};
		}

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

		const chillingWaterMoveName: Partial<Record<AvailableLocales, string>> = {};
		Object.values(AvailableLocales).forEach((locale) => {
			chillingWaterMoveName[locale] = normalizedMoveName('CHILLING_WATER');
		});

		if (!movesDictionary.CHILLING_WATER) {
			movesDictionary.CHILLING_WATER = {
				moveId: 'CHILLING_WATER',
				vId: '-1',
				type: 'water',
				isFast: false,
				pvpPower: 60,
				pvePower: 65,
				pvpEnergy: -45,
				pveEnergy: -33,
				pvpCooldown: 0.5,
				pveCooldown: 3.5,
				buffs: {
					buffActivationChance: 1,
					targetAttackStatStageChange: -1,
				},
				moveName: chillingWaterMoveName,
			};
		}

		return movesDictionary;
	}
}

export default MovesProvider;
