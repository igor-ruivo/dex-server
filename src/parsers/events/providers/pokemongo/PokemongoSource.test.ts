import { describe, expect, it } from 'vitest';

import { AvailableLocales } from '../../../services/gamemaster-translator';
import { extractLocaleFromPath } from './PokemongoSource';

describe('extractLocaleFromPath', () => {
	it('resolves plain lowercase locales via the /news/ regex shortcut', () => {
		expect(
			extractLocaleFromPath('https://pokemongo.com/de/news/some-post')
		).toBe(AvailableLocales.de);
	});

	it('resolves plain lowercase locales via the path-split fallback (/post/ URLs)', () => {
		expect(
			extractLocaleFromPath('https://pokemongo.com/ja/post/some-post')
		).toBe(AvailableLocales.ja);
	});

	// The actual bug: naively lowercasing the whole URL then casting the
	// lowercased segment `as AvailableLocales` type-checked but was wrong at
	// runtime for exactly these two locale values, since they're the only
	// ones with meaningful casing/hyphenation — silently broke title/
	// subtitle/bonuses for both in events.json (see PokemongoSource.ts's own
	// comment on extractLocaleFromPath for the full explanation).
	it('resolves es-MX back to its correct casing despite URL lowercasing', () => {
		expect(
			extractLocaleFromPath('https://pokemongo.com/es-MX/post/some-post')
		).toBe(AvailableLocales.esMx);
	});

	it('resolves zh-Hant back to its correct casing despite URL lowercasing', () => {
		expect(
			extractLocaleFromPath('https://pokemongo.com/zh-Hant/news/some-post')
		).toBe(AvailableLocales.zhHant);
	});

	it('falls back to en for an unrecognized segment', () => {
		expect(
			extractLocaleFromPath('https://pokemongo.com/not-a-locale/post/x')
		).toBe(AvailableLocales.en);
	});

	it('falls back to en for a bare /news listing URL with no locale segment', () => {
		expect(extractLocaleFromPath('https://pokemongo.com/news')).toBe(
			AvailableLocales.en
		);
	});
});
