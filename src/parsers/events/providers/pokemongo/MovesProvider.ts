import { GameMasterMovesType, IGameMasterMove, PvEMove, PvPMove } from '../../../types/pokemon';
import { HttpDataFetcher } from '../../../services/data-fetcher';
import path from 'path';
import fs from 'fs/promises';

const PT_TRANSLATION_URL = 'https://raw.githubusercontent.com/PokeMiners/pogo_assets/master/Texts/Latest%20APK/JSON/i18n_brazilianportuguese.json';

function normalizedMoveName(moveName: string) {
  return moveName
    .split('_')
    .map(p => p.substring(0, 1).toLocaleUpperCase() + p.substring(1).toLocaleLowerCase())
    .join(' ');
}

export class MovesProvider {
  private readonly GAME_MASTER_URL = 'https://raw.githubusercontent.com/PokeMiners/game_masters/master/latest/latest.json';
  private readonly fetcher = new HttpDataFetcher();

  async fetchMoves(): Promise<Record<string, IGameMasterMove>> {
    const gmData = await this.fetcher.fetchJson<Array<GameMasterMovesType>>(this.GAME_MASTER_URL);
    const ptTranslationData = await this.fetcher.fetchJson<{data: string}>(PT_TRANSLATION_URL);
    // Build PT move name dictionary
    const translatedMovesDictionary: Record<string, string> = {};
    const arr = Array.from(ptTranslationData.data);
    const term = 'move_name_';
    arr.forEach((t: string, index: number) => {
      if (t.startsWith(term)) {
        const vid = t.substring(term.length);
        const moveName = arr[index + 1];
        translatedMovesDictionary[vid] = moveName as string;
      }
    });
    // --- mapGameMaster logic ---
    const pvpMoves: Record<string, PvPMove> = {};
    const pveMoves: Record<string, PvEMove> = {};
    const renamedMoveIds: Record<string, string> = {
      FUTURESIGHT: 'FUTURE_SIGHT',
      TECHNO_BLAST_WATER: 'TECHNO_BLAST_DOUSE',
    };
    gmData
      .filter(entry => !entry.data.templateId?.startsWith('VN_BM_') && (entry.data?.moveSettings || entry.data?.combatMove))
      .forEach(entry => {
        const isPvP = !!entry.data.combatMove;
        const dataPointer = entry.data.moveSettings || entry.data.combatMove;
        const helperConst = '_MOVE_';
        const helperIdx = entry.data.templateId.indexOf(helperConst);
        const moveIdPointer = entry.data.templateId.substring(helperIdx + helperConst.length);
        const typePointer = dataPointer.pokemonType || dataPointer.type;
        const id = moveIdPointer.endsWith('_FAST') ? moveIdPointer.substring(0, moveIdPointer.lastIndexOf('_FAST')) : moveIdPointer;
        const isFast = moveIdPointer.endsWith('_FAST');
        if (isPvP) {
          const term = 'COMBAT_V';
          const vidSubstring = entry.data.templateId.substring(entry.data.templateId.indexOf(term) + term.length);
          pvpMoves[id] = {
            moveId: id,
            vId: vidSubstring.substring(0, vidSubstring.indexOf('_')),
            type: typePointer.split('POKEMON_TYPE_')[1]?.toLocaleLowerCase() ?? '',
            isFast: isFast,
            pvpPower: dataPointer.power,
            pvpEnergy: dataPointer.energyDelta,
            pvpCooldown: isFast ? (+(dataPointer.durationTurns ?? 0) + 1) / 2 : 0,
            buffs: dataPointer.buffs
          };
        } else {
          pveMoves[id] = {
            moveId: id,
            vId: entry.data.templateId.substring(1, entry.data.templateId.indexOf('_')),
            type: typePointer.split('POKEMON_TYPE_')[1]?.toLocaleLowerCase() ?? '',
            isFast: isFast,
            pvePower: dataPointer.power,
            pveEnergy: dataPointer.energyDelta,
            pveCooldown: +dataPointer.durationMs / 1000,
          };
        }
      });
    const movesDictionary: Record<string, IGameMasterMove> = {};
    Object.values(pvpMoves).forEach(move => {
      if (!move.moveId) return;
      const pveCounterpart = pveMoves[move.moveId];
      const translatedId = renamedMoveIds[move.moveId] ?? move.moveId;
      const enName = normalizedMoveName(translatedId);
      const ptName = translatedMovesDictionary[move.vId] || enName;
      movesDictionary[translatedId] = {
        moveId: translatedId,
        vId: move.vId,
        type: move.type,
        isFast: move.isFast,
        pvpPower: move.pvpPower ?? 0,
        pvePower: pveCounterpart?.pvePower ?? 0,
        pvpEnergyDelta: move.pvpEnergy ?? 0,
        pveEnergyDelta: pveCounterpart?.pveEnergy ?? 0,
        pvpDuration: move.pvpCooldown ?? 0,
        pveDuration: pveCounterpart?.pveCooldown ?? 0,
        pvpBuffs: move?.buffs ? {
          chance: move.buffs.buffActivationChance,
          buffs: Object.entries(move.buffs).filter(e => e[0] !== 'buffActivationChance').map(e => ({
            buff: e[0],
            quantity: e[1]
          })),
        } : undefined,
        moveName: { en: enName, pt: ptName }
      };
    });
    Object.values(pveMoves).forEach(move => {
      if (!move.moveId) return;
      const pvpCounterpart = pvpMoves[move.moveId];
      const translatedId = renamedMoveIds[move.moveId] ?? move.moveId;
      const enName = normalizedMoveName(translatedId);
      const ptName = translatedMovesDictionary[move.vId] || enName;
      movesDictionary[translatedId] = {
        moveId: translatedId,
        vId: move.vId,
        type: move.type,
        isFast: move.isFast,
        pvpPower: pvpCounterpart?.pvpPower ?? 0,
        pvePower: move.pvePower ?? 0,
        pvpEnergyDelta: pvpCounterpart?.pvpEnergy ?? 0,
        pveEnergyDelta: move.pveEnergy ?? 0,
        pvpDuration: pvpCounterpart?.pvpCooldown ?? 0,
        pveDuration: move.pveCooldown ?? 0,
        pvpBuffs: pvpCounterpart?.buffs ? {
          chance: pvpCounterpart.buffs.buffActivationChance,
          buffs: Object.entries(pvpCounterpart.buffs).filter(e => e[0] !== 'buffActivationChance').map(e => ({
            buff: e[0],
            quantity: e[1]
          })),
        } : undefined,
        moveName: { en: enName, pt: ptName }
      };
    });
    // Add missing moves
    if (!movesDictionary['UPPER_HAND']) {
      movesDictionary['UPPER_HAND'] = {
        moveId: 'UPPER_HAND',
        vId: '-1',
        type: 'fighting',
        isFast: false,
        pvpPower: 70,
        pvePower: 50,
        pvpEnergyDelta: -40,
        pveEnergyDelta: -33,
        pvpDuration: 500,
        pveDuration: 2.0,
        pvpBuffs: {
          chance: 0.3,
          buffs: [{ buff: 'targetDefenseStatStageChange', quantity: -1 }],
        },
        moveName: { en: normalizedMoveName('UPPER_HAND'), pt: translatedMovesDictionary['-1'] || normalizedMoveName('UPPER_HAND') }
      };
    }
    if (!movesDictionary['CLANGING_SCALES']) {
      movesDictionary['CLANGING_SCALES'] = {
        moveId: 'CLANGING_SCALES',
        vId: '-1',
        type: 'dragon',
        isFast: false,
        pvpPower: 120,
        pvePower: 120,
        pvpEnergyDelta: -45,
        pveEnergyDelta: -100,
        pvpDuration: 500,
        pveDuration: 3.3,
        pvpBuffs: {
          chance: 1,
          buffs: [{ buff: 'attackerDefenseStatStageChange', quantity: -1 }],
        },
        moveName: { en: normalizedMoveName('CLANGING_SCALES'), pt: translatedMovesDictionary['-1'] || normalizedMoveName('CLANGING_SCALES') }
      };
    }
    return movesDictionary;
  }
}

export async function writeMovesJson() {
  const provider = new MovesProvider();
  const moves = await provider.fetchMoves();
  const dataDir = path.join(process.cwd(), 'data');
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(path.join(dataDir, 'moves.json'), JSON.stringify(moves, null, 2));
}