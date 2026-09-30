import { describe, expect, it } from 'vitest';

import type { BasePokemon } from '../types/pokemon';
import type { PvPokeMove } from '../types/teams';
import {
	buildSimulatorStatus,
	findChangedSimulatorSources,
	findUnknownMechanics,
	VERIFIED_SIMULATOR_SOURCES,
} from './simulator-guard';

const move = (extra: Partial<PvPokeMove>): PvPokeMove => ({
	moveId: 'TEST',
	name: 'Test',
	type: 'normal',
	power: 1,
	energy: 0,
	energyGain: 1,
	cooldown: 500,
	turns: 1,
	...extra,
});

describe('findUnknownMechanics', () => {
	it('accepts every mechanic the simulator port implements', () => {
		expect(
			findUnknownMechanics(
				[
					move({ tags: ['instant', 'ignoresFaint'], buffTarget: 'both' }),
					move({ damageMethod: 'percentMaxHP' }),
				],
				[
					{
						speciesId: 'mimikyu',
						formChange: { type: 'set', trigger: 'charged_move_damage', effect: 'protect' },
					} as BasePokemon,
				]
			)
		).toEqual([]);
	});

	it('reports mechanics it has no implementation for', () => {
		const issues = findUnknownMechanics(
			[move({ tags: ['teleport'] })],
			[
				{
					speciesId: 'newmon',
					formChange: { type: 'set', trigger: 'on_faint' },
				} as BasePokemon,
			]
		);
		expect(issues).toEqual([
			'form-change trigger "on_faint" (newmon)',
			'move tag "teleport" (TEST)',
		]);
	});
});

describe('findChangedSimulatorSources', () => {
	it('flags sources that differ from, or fail to match, the verified hash', async () => {
		const fetcher = {
			fetchText: async (url: string) =>
				url.endsWith('Battle.js') ? 'not the real file' : '',
		} as never;
		const changed = await findChangedSimulatorSources(fetcher);
		expect(changed).toHaveLength(Object.keys(VERIFIED_SIMULATOR_SOURCES).length);
	});
});

describe('buildSimulatorStatus', () => {
	it('is verified only when nothing changed and nothing is unknown', () => {
		expect(buildSimulatorStatus([], []).verified).toBe(true);
		expect(buildSimulatorStatus(['js/battle/Battle.js'], []).verified).toBe(false);
		expect(buildSimulatorStatus([], ['x']).verified).toBe(false);
	});
});
