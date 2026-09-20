import { describe, expect, it } from 'vitest';

import { validateSkippedFetches } from './fetch-failures-qa';

describe('validateSkippedFetches', () => {
	it('passes when nothing was skipped', () => {
		expect(() => validateSkippedFetches([])).not.toThrow();
	});

	it('passes when the only skipped fetch is the known-flaky ru season page', () => {
		expect(() =>
			validateSkippedFetches([
				{ url: 'https://pokemongo.com/ru/seasons', status: 404 },
			])
		).not.toThrow();
	});

	it('throws when an unlisted fetch is skipped', () => {
		expect(() =>
			validateSkippedFetches([
				{ url: 'https://pokemongo.com/de/seasons', status: 404 },
			])
		).toThrow(/de\/seasons/);
	});

	it('throws when a mix of allowed and unlisted fetches are skipped, naming only the unlisted one', () => {
		expect(() =>
			validateSkippedFetches([
				{ url: 'https://pokemongo.com/ru/seasons', status: 404 },
				{ url: 'https://leekduck.com/events', status: 500 },
			])
		).toThrow(/leekduck\.com\/events/);
	});

	it('does not treat a similarly-shaped but different URL as the allowed exception', () => {
		expect(() =>
			validateSkippedFetches([
				{ url: 'https://pokemongo.com/ru/seasons/extra', status: 404 },
			])
		).toThrow(/ru\/seasons\/extra/);
	});
});
