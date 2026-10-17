import type { IGameMasterMove } from '../../../types/pokemon';
import type { PvPokeMove } from '../../../types/teams';

type BuffsType = NonNullable<IGameMasterMove['buffs']>;

/** PvPoke's `[atk, def]` stage pair for a stat-stage change, as the Game Master's `{attacker,target}*StatStageChange` keys. */
const stageKeys = (
	who: 'attacker' | 'target',
	stages: readonly [number, number] | undefined
): Record<string, number> => {
	const out: Record<string, number> = {};
	if (stages?.[0]) out[`${who}AttackStatStageChange`] = stages[0];
	if (stages?.[1]) out[`${who}DefenseStatStageChange`] = stages[1];
	return out;
};

/** PvPoke's buff description in the Game Master's `buffs` shape (`undefined` when the move has none). */
const toGameMasterBuffs = (move: PvPokeMove): BuffsType | undefined => {
	if (!move.buffs) return undefined;

	const target = move.buffTarget ?? 'self';
	const stages =
		target === 'both'
			? {
					...stageKeys('attacker', move.buffsSelf),
					...stageKeys('target', move.buffsOpponent),
				}
			: stageKeys(target === 'self' ? 'attacker' : 'target', move.buffs);

	if (Object.keys(stages).length === 0) return undefined;

	return {
		buffActivationChance: Number.parseFloat(String(move.buffApplyChance ?? 1)),
		...stages,
	};
};

const sameBuffs = (a: BuffsType | undefined, b: BuffsType | undefined) => {
	const ka = Object.keys(a ?? {});
	const kb = Object.keys(b ?? {});
	return ka.length === kb.length && ka.every((k) => a?.[k] === b?.[k]);
};

/**
 * Our Game Master source takes a while to pick up balance changes, PvPoke's doesn't: wherever PvPoke lists a move under the
 * same id, its PvP numbers (power, energy, fast-move cooldown, buffs) win. Moves PvPoke doesn't know are left alone, and so
 * are the fields that aren't PvP stats (type, fast/charged, PvE numbers, names).
 */
export const applyPvPokeMoveOverrides = (
	moves: Record<string, IGameMasterMove>,
	pvpokeMoves: ReadonlyArray<PvPokeMove>
): Record<string, IGameMasterMove> => {
	const overridden: Array<string> = [];

	for (const pvpoke of pvpokeMoves) {
		const move = moves[pvpoke.moveId];
		if (!move) continue;

		const before = JSON.stringify(move);

		move.pvpPower = pvpoke.power;
		// Fast moves gain energy (positive), charged moves spend it (negative).
		move.pvpEnergy = move.isFast ? pvpoke.energyGain : -pvpoke.energy;
		if (move.isFast) move.pvpCooldown = pvpoke.cooldown / 1000;

		const buffs = toGameMasterBuffs(pvpoke);
		if (!sameBuffs(move.buffs, buffs)) move.buffs = buffs;

		if (JSON.stringify(move) !== before) overridden.push(pvpoke.moveId);
	}

	if (overridden.length > 0) {
		console.log(
			`Applied PvPoke's PvP stats to ${overridden.length} move(s): ${overridden.join(', ')}`
		);
	}

	return moves;
};
