import { describe, expect, it, vi } from 'vitest';

import { POKEMON_CONFIG } from '../config/pokemon-config';
import ImageHostResolver from './image-host-resolver';

const PRIMARY = POKEMON_CONFIG.POKEMON_BASE_URL;
const FALLBACK = POKEMON_CONFIG.POKEMON_FALLBACK_BASE_URL;

/** A probe that finds the pictures in `existing` (full URLs) and 404s everything else. */
const probeOf = (existing: Array<string>) =>
	vi.fn((url: string) => Promise.resolve(existing.includes(url)));

describe('ImageHostResolver', () => {
	it('keeps the primary host when it has the picture', async () => {
		const probe = probeOf([`${PRIMARY}006_f2.png`, `${FALLBACK}006_f2.png`]);
		const resolver = new ImageHostResolver({}, probe);

		expect(await resolver.resolve(`${PRIMARY}006_f2.png`)).toBe(
			`${PRIMARY}006_f2.png`
		);
		expect(probe).toHaveBeenCalledTimes(1);
	});

	it('falls back to the other host when the primary does not have the picture', async () => {
		const resolver = new ImageHostResolver(
			{},
			probeOf([`${FALLBACK}609_f2.png`])
		);

		expect(await resolver.resolve(`${PRIMARY}609_f2.png`)).toBe(
			`${FALLBACK}609_f2.png`
		);
		expect(resolver.getCache()).toEqual({ '609_f2.png': 'fallback' });
	});

	it('also fixes an explicit primary-host URL (an override) that has moved', async () => {
		const resolver = new ImageHostResolver(
			{},
			probeOf([`${FALLBACK}080_f2.png`])
		);

		expect(await resolver.resolve(`${PRIMARY}080_f2.png`)).toBe(
			`${FALLBACK}080_f2.png`
		);
	});

	it('does not probe a picture already in the cache', async () => {
		const probe = probeOf([]);
		const resolver = new ImageHostResolver({ '609_f2.png': 'fallback' }, probe);

		expect(await resolver.resolve(`${PRIMARY}609_f2.png`)).toBe(
			`${FALLBACK}609_f2.png`
		);
		expect(probe).not.toHaveBeenCalled();
	});

	it('keeps the URL, and caches nothing, when neither host has the picture yet', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		const resolver = new ImageHostResolver({}, probeOf([]));

		expect(await resolver.resolve(`${PRIMARY}999_f9.png`)).toBe(
			`${PRIMARY}999_f9.png`
		);
		expect(resolver.getCache()).toEqual({});
		warn.mockRestore();
	});

	it('keeps the URL, and caches nothing, when a host cannot be checked', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		const resolver = new ImageHostResolver({}, () =>
			Promise.reject(new Error('503'))
		);

		expect(await resolver.resolve(`${PRIMARY}609_f2.png`)).toBe(
			`${PRIMARY}609_f2.png`
		);
		expect(resolver.getCache()).toEqual({});
		warn.mockRestore();
	});

	it('leaves URLs that are not official artwork alone', async () => {
		const probe = probeOf([]);
		const resolver = new ImageHostResolver({}, probe);

		expect(await resolver.resolve('https://i.imgur.com/Vwhh8KW.png')).toBe(
			'https://i.imgur.com/Vwhh8KW.png'
		);
		expect(probe).not.toHaveBeenCalled();
	});

	it('probes each distinct picture once, however many species share it', async () => {
		const probe = probeOf([`${PRIMARY}026_f2.png`]);
		const resolver = new ImageHostResolver({}, probe);

		const resolved = await resolver.resolveAll([
			`${PRIMARY}026_f2.png`,
			`${PRIMARY}026_f2.png`,
		]);

		expect(resolved.get(`${PRIMARY}026_f2.png`)).toBe(`${PRIMARY}026_f2.png`);
		expect(probe).toHaveBeenCalledTimes(1);
	});
});
