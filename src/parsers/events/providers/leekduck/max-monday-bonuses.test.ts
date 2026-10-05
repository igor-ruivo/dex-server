import { describe, expect, it } from 'vitest';

import { AvailableLocales } from '../../../services/gamemaster-translator';
import { MAX_MONDAY_BONUSES } from './max-monday-bonuses';

describe('what a Max Monday brings, kept as scraped', () => {
	it('has English, and every other locale that had a post: three bullet points then the asterisk footnote', () => {
		expect(MAX_MONDAY_BONUSES[AvailableLocales.en]).toBeDefined();
		for (const [locale, blocks] of Object.entries(MAX_MONDAY_BONUSES)) {
			expect(
				blocks.map((b) => b.kind),
				locale
			).toEqual(['item', 'item', 'item', 'note']);
			expect(
				blocks.every((b) => b.runs.length > 0),
				locale
			).toBe(true);
		}
	});

	it('has the English text', () => {
		const english = MAX_MONDAY_BONUSES[AvailableLocales.en] ?? [];
		expect(english.map((b) => b.runs.map((r) => r.text).join(''))[0]).toBe(
			'Power Spots will refresh more frequently.'
		);
	});
});
