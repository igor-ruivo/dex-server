import { describe, expect, it } from 'vitest';

import {
	hasExplicitShinyMarker,
	isPokemonResourceReference,
} from './pokemon-matcher';

describe('isPokemonResourceReference', () => {
	it.each([
		'Manectric Mega Energy',
		'Manectric Candy',
		'Candy for catching Pokémon',
		'Pokémon GO Energy',
	])('rejects resource references: %s', (text) => {
		expect(isPokemonResourceReference(text)).toBe(true);
	});

	describe('hasExplicitShinyMarker', () => {
		it('marks only names ending with an asterisk', () => {
			expect(hasExplicitShinyMarker('Bramblin')).toBe(false);
			expect(hasExplicitShinyMarker('Bramblin*')).toBe(true);
			expect(
				hasExplicitShinyMarker(
					'If you’re lucky, you may encounter a Shiny one!'
				)
			).toBe(false);
		});
	});

	it.each(['Mega Manectric', 'Manectric', 'Manectric in raids'])(
		'keeps encounter references: %s',
		(text) => {
			expect(isPokemonResourceReference(text)).toBe(false);
		}
	);
});
