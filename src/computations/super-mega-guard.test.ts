import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import type {
	GameMasterData,
	GameMasterPokemon,
} from '../parsers/types/pokemon';
import {
	assertSuperMegasAlwaysCapBound,
	findSuperMegasUnderCap,
	HIGHEST_CAPPED_CP,
} from './super-mega-guard';

const species = (
	speciesId: string,
	baseStats: { atk: number; def: number; hp: number },
	isSuperMega: boolean
) => ({ speciesId, baseStats, isSuperMega }) as unknown as GameMasterPokemon;

describe('Super Max Megas stay out of capped leagues at level 50', () => {
	const heavy = species('heavy_mega', { atk: 300, def: 250, hp: 200 }, true);
	const light = species('light_mega', { atk: 80, def: 80, hp: 80 }, true);
	const lightButNotSuper = species(
		'light_other',
		{ atk: 80, def: 80, hp: 80 },
		false
	);

	it('accepts a Super Max Mega whose 0/0/0 build is over the cap at level 50', () => {
		const gameMaster: GameMasterData = { heavy_mega: heavy };
		expect(findSuperMegasUnderCap(gameMaster)).toEqual([]);
		expect(() => assertSuperMegasAlwaysCapBound(gameMaster)).not.toThrow();
	});

	it('rejects one that would fit under the cap, naming it', () => {
		const gameMaster: GameMasterData = { heavy_mega: heavy, light_mega: light };
		expect(findSuperMegasUnderCap(gameMaster).map((o) => o.speciesId)).toEqual([
			'light_mega',
		]);
		expect(() => assertSuperMegasAlwaysCapBound(gameMaster)).toThrow(
			/light_mega/
		);
	});

	it('does not look at Pokémon that are not Super Max Megas', () => {
		const gameMaster: GameMasterData = { light_other: lightButNotSuper };
		expect(findSuperMegasUnderCap(gameMaster)).toEqual([]);
	});

	it('holds for every Super Max Mega in the current game master (data/game-master.json)', () => {
		const file = path.join(process.cwd(), 'data', 'game-master.json');
		if (!fs.existsSync(file)) return;
		const gameMaster = JSON.parse(
			fs.readFileSync(file, 'utf8')
		) as GameMasterData;
		expect(
			findSuperMegasUnderCap(gameMaster, HIGHEST_CAPPED_CP),
			'a Super Max Mega fits under a capped league at level 50: go-pokedex needs level-52 best IV spreads (see super-mega-guard.ts)'
		).toEqual([]);
	});
});
