import { describe, expect, it } from 'vitest';

import type { GameMasterData } from '../types/pokemon';
import { validateImageUrls } from './image-urls-qa';

const dictionary = {
	chandelure_mega: {
		speciesId: 'chandelure_mega',
		imageUrl: 'https://a/1.png',
	},
	bulbasaur: { speciesId: 'bulbasaur', imageUrl: 'https://a/2.png' },
} as unknown as GameMasterData;

describe('validateImageUrls', () => {
	it('passes when every picture was resolved', () => {
		expect(() => validateImageUrls(dictionary, new Map())).not.toThrow();
	});

	it('names every Pokémon whose picture is missing or could not be checked', () => {
		const unresolved = new Map<string, 'missing' | 'unchecked'>([
			['https://a/1.png', 'missing'],
			['https://a/2.png', 'unchecked'],
		]);

		expect(() => validateImageUrls(dictionary, unresolved)).toThrow(
			/2 Pokémon[\s\S]*chandelure_mega \(missing\)[\s\S]*bulbasaur \(unchecked\)/
		);
	});
});
