import { describe, expect, it } from 'vitest';

import {
	BLACKLISTED_PVP_FORMAT,
	getActiveLeagueDefinitions,
	LeagueDefinitions,
} from './config/pokemon-config';
import { validatePvPokeFormats } from './pvp-parser';

describe('PvPoke ranking formats', () => {
	it('configures every current non-blacklisted format', () => {
		const configuredFormats = new Set(
			Object.values(LeagueDefinitions).map(({ format }) => format)
		);
		const currentFormats = [
			'all',
			'catch',
			'cauldron',
			'chrysalis',
			'classic',
			'colormega',
			'copadiluvio',
			'coupedusillage',
			'fantasy',
			'gymbreakers',
			'laic2027',
			'ligaultra',
			'little',
			'mega',
			'premier',
			'remix',
			'retro',
			'spectral',
			'tsuki',
			'willpower',
		];

		for (const format of currentFormats) {
			if (!BLACKLISTED_PVP_FORMAT.test(format)) {
				expect(configuredFormats.has(format)).toBe(true);
			}
		}
	});

	it('fails when a new non-blacklisted format is listed', () => {
		expect(() =>
			validatePvPokeFormats([
				{ title: 'New Cup', cup: 'newcup', cp: 1500, showFormat: true },
			])
		).toThrow('unconfigured ranking format');
	});

	it('ignores blacklisted formats', () => {
		expect(() =>
			validatePvPokeFormats([
				{ title: 'LAIC', cup: 'laic2027', cp: 1500, showFormat: true },
				{
					title: 'Battle Frontier (Spectral)',
					cup: 'spectral',
					cp: 1500,
					showFormat: true,
				},
				{
					title: 'Battle Frontier (Cauldron)',
					cup: 'cauldron',
					cp: 2500,
					showFormat: true,
				},
				{
					title: 'Gymbreakers',
					cup: 'gymbreakers',
					cp: 1500,
					showFormat: true,
				},
			])
		).not.toThrow();
	});

	it('selects only visible ranking formats and permanent leagues', () => {
		const active = getActiveLeagueDefinitions([
			{ title: 'Visible', cup: 'mega', cp: 1500, showFormat: true },
			{
				title: 'Hidden ranking',
				cup: 'premier',
				cp: 10000,
				showFormat: true,
				hideRankings: true,
			},
			{ title: 'Cup only', cup: 'little', cp: 500, showCup: true },
		]);

		expect(Object.keys(active)).toEqual([
			'great',
			'ultra',
			'master',
			'mega-1500',
		]);
	});
});
