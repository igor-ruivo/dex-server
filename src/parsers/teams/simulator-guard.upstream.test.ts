import { describe, expect, it } from 'vitest';

import { POKEMON_CONFIG } from '../pokemon/config/pokemon-config';
import type { BasePokemon } from '../types/pokemon';
import type { PvPokeMove } from '../types/teams';
import { metaGroupUrl, PVPOKE_MOVES_URL } from './config';
import {
	findChangedSimulatorSources,
	findUnknownMechanics,
} from './simulator-guard';

/**
 * Live check against PvPoke's GitHub: has its battle code or data moved on from what go-pokedex's
 * simulator port was verified against?
 *
 * If this fails:
 *   1. diff PvPoke's changed file(s) against the previous version and port whatever affects results
 *      into go-pokedex's `src/lib/pvp-sim/`;
 *   2. run `pnpm run pvp-sim:parity` there until it reports "Parity OK";
 *   3. regenerate its golden fixture (`node scripts/pvp-sim-parity/make-golden.cjs`);
 *   4. only then update the hashes in `simulator-guard.ts`.
 *
 * Runs as part of `pnpm run test`, which the daily update runs before generating (a failure there raises
 * the Discord alert). It needs the network: offline local runs skip it, but under CI (`CI` set) an
 * unreachable GitHub FAILS the test — a guard that silently skips would guard nothing.
 */
/** Offline is only excusable off CI; on CI an unreachable upstream must not turn the guard into a silent pass. */
const skipOrFail = (ctx: { skip: () => never }, error: unknown): never => {
	if (process.env.CI) throw new Error(`Couldn't reach PvPoke to verify its simulator: ${String(error)}`);
	return ctx.skip();
};

const fetchText = async (url: string): Promise<string> => {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
	return res.text();
};

describe('PvPoke simulator upstream', () => {
	it('has not changed since the port was verified', async (ctx) => {
		let changed: Array<string>;
		try {
			changed = await findChangedSimulatorSources({
				fetchText,
				fetchJson: () => Promise.reject(new Error('unused')),
				getSkippedFetches: () => [],
				announceExpectedFetches: () => undefined,
			});
		} catch (error) {
			return skipOrFail(ctx, error);
		}
		expect(
			changed,
			'PvPoke changed its battle/team-builder source — port the change, re-verify parity, then update simulator-guard.ts'
		).toEqual([]);
	});

	it('uses no battle mechanic the port lacks', async (ctx) => {
		let moves: Array<PvPokeMove>;
		let pokemon: Array<BasePokemon>;
		try {
			moves = JSON.parse(
				await fetchText(PVPOKE_MOVES_URL)
			) as Array<PvPokeMove>;
			pokemon = JSON.parse(
				await fetchText(POKEMON_CONFIG.SOURCE_URL)
			) as Array<BasePokemon>;
			await fetchText(metaGroupUrl('great'));
		} catch (error) {
			return skipOrFail(ctx, error);
		}
		expect(findUnknownMechanics(moves, pokemon)).toEqual([]);
	});
});
