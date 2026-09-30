import { describe, expect, it } from 'vitest';

import type { IDataFetcher } from '../services/data-fetcher';
import type { BasePokemon } from '../types/pokemon';
import type { PvPokeMove } from '../types/teams';
import {
	assertSimulatorVerified,
	buildSimulatorStatus,
	findChangedSimulatorSources,
	findUnknownMechanics,
	VERIFIED_SIMULATOR_SOURCES,
} from './simulator-guard';

const pokemon = (
	speciesId: string,
	formChange: NonNullable<BasePokemon['formChange']>
): BasePokemon => ({
	dex: 0,
	speciesId,
	speciesName: speciesId,
	types: [],
	fastMoves: [],
	chargedMoves: [],
	baseStats: { atk: 0, def: 0, hp: 0 },
	released: true,
	formChange,
});

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
					pokemon('mimikyu', {
						type: 'set',
						trigger: 'charged_move_damage',
						effect: 'protect',
					}),
				]
			)
		).toEqual([]);
	});

	it('reports mechanics it has no implementation for', () => {
		const issues = findUnknownMechanics(
			[move({ tags: ['teleport'] })],
			[pokemon('newmon', { type: 'set', trigger: 'on_faint' })]
		);
		expect(issues).toEqual([
			'form-change trigger "on_faint" (newmon)',
			'move tag "teleport" (TEST)',
		]);
	});
});

describe('findChangedSimulatorSources', () => {
	it('flags sources that differ from, or fail to match, the verified hash', async () => {
		const fetcher: IDataFetcher = {
			fetchText: (url: string) =>
				Promise.resolve(url.endsWith('Battle.js') ? 'not the real file' : ''),
			fetchJson: () => Promise.reject(new Error('unused')),
			getSkippedFetches: () => [],
			announceExpectedFetches: () => undefined,
		};
		const changed = await findChangedSimulatorSources(fetcher);
		expect(changed).toHaveLength(
			Object.keys(VERIFIED_SIMULATOR_SOURCES).length
		);
	});
});

describe('buildSimulatorStatus', () => {
	it('is verified only when nothing changed and nothing is unknown', () => {
		expect(buildSimulatorStatus([], []).verified).toBe(true);
		expect(buildSimulatorStatus(['js/battle/Battle.js'], []).verified).toBe(
			false
		);
		expect(buildSimulatorStatus([], ['x']).verified).toBe(false);
	});
});

describe('assertSimulatorVerified', () => {
	it('passes a verified simulator', () => {
		expect(() =>
			assertSimulatorVerified(buildSimulatorStatus([], []))
		).not.toThrow();
	});

	it('fails the run, naming what changed, so the daily alert fires', () => {
		const failing = () =>
			assertSimulatorVerified(
				buildSimulatorStatus(['js/battle/Battle.js'], ['move tag "x" (Y)'])
			);
		expect(failing).toThrow('js/battle/Battle.js');
		expect(failing).toThrow('move tag "x" (Y)');
	});
});
