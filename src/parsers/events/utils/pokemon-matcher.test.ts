import { describe, expect, it } from 'vitest';

import { isPokemonResourceReference } from './pokemon-matcher';

describe('isPokemonResourceReference', () => {
	it.each([
		'Manectric Mega Energy',
		'Manectric Candy',
		'Candy for catching Pokémon',
		'Pokémon GO Energy',
	])('rejects resource references: %s', (text) => {
		expect(isPokemonResourceReference(text)).toBe(true);
	});

	it.each(['Mega Manectric', 'Manectric', 'Manectric in raids'])(
		'keeps encounter references: %s',
		(text) => {
			expect(isPokemonResourceReference(text)).toBe(false);
		}
	);
});
