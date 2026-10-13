import { POKEMON_CONFIG } from '../config/pokemon-config';

/** Which of the two official-artwork hosts serves a given picture. */
export type ImageHost = 'primary' | 'fallback';

/** Official-artwork file name (e.g. `609_f2.png`) -> the host that serves it. */
export type ImageHostCache = Record<string, ImageHost>;

/** `true` when the picture exists, `false` when the host says it doesn't (a 404). Throws when it can't tell. */
export type ImageProbe = (url: string) => Promise<boolean>;

const MAX_PROBE_ATTEMPTS = 4;
const PROBE_BACKOFF_MS = 1000;
const PROBE_CONCURRENCY = 8;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const httpProbe: ImageProbe = async (url) => {
	for (let attempt = 1; ; attempt++) {
		try {
			const response = await fetch(url, { method: 'HEAD' });
			if (response.ok) {
				return true;
			}
			if (response.status === 404) {
				return false;
			}
			throw new Error(`${response.status} ${response.statusText}`);
		} catch (error) {
			if (attempt >= MAX_PROBE_ATTEMPTS) {
				throw error;
			}
			await sleep(PROBE_BACKOFF_MS * attempt);
		}
	}
};

/**
 * Pokémon.com is moving its Pokédex artwork from `assets.pokemon.com` to `www.pokemon.com/static-assets` — but only the newer
 * pictures, so which host serves a given picture can't be derived from the Pokémon. Instead of listing the exceptions by hand,
 * every official-artwork URL the parser builds (always against the primary host) is checked: the primary host first, then the
 * fallback host when the primary doesn't have it.
 *
 * What's found is kept in `cache`, so only a picture never seen before costs any request, and a picture neither host has yet
 * (artwork that hasn't shipped) isn't cached, so it's looked up again on the next run. URLs that aren't official artwork (the
 * imgur / PokeAPI overrides) are returned untouched.
 */
class ImageHostResolver {
	private readonly baseUrls: Record<ImageHost, string> = {
		primary: POKEMON_CONFIG.POKEMON_BASE_URL,
		fallback: POKEMON_CONFIG.POKEMON_FALLBACK_BASE_URL,
	};

	/** Official-artwork URLs no host was found to serve (`missing`), or that couldn't be checked (`unchecked`). */
	private readonly unresolved = new Map<string, 'missing' | 'unchecked'>();

	constructor(
		private readonly cache: ImageHostCache = {},
		private readonly probe: ImageProbe = httpProbe
	) {}

	getUnresolved(): ReadonlyMap<string, 'missing' | 'unchecked'> {
		return this.unresolved;
	}

	/** The cache, with its keys sorted, so that what's written to disk only changes when a picture is added. */
	getCache(): ImageHostCache {
		return Object.fromEntries(
			Object.entries(this.cache).sort(([a], [b]) => a.localeCompare(b))
		);
	}

	/** Resolves every URL, probing each distinct unknown picture once, a few at a time. */
	async resolveAll(urls: Array<string>): Promise<Map<string, string>> {
		const distinct = [...new Set(urls)];
		const resolved = new Map<string, string>();

		let next = 0;
		const worker = async () => {
			while (next < distinct.length) {
				const url = distinct[next++];
				resolved.set(url, await this.resolve(url));
			}
		};
		await Promise.all(
			Array.from({ length: PROBE_CONCURRENCY }, () => worker())
		);

		return resolved;
	}

	async resolve(url: string): Promise<string> {
		const fileName = this.fileNameOf(url);
		if (!fileName) {
			return url;
		}

		const known = this.cache[fileName];
		if (known) {
			return this.baseUrls[known] + fileName;
		}

		for (const host of ['primary', 'fallback'] as const) {
			const candidate = this.baseUrls[host] + fileName;
			try {
				if (await this.probe(candidate)) {
					this.cache[fileName] = host;
					return candidate;
				}
			} catch (error) {
				console.warn(
					`Couldn't check whether ${candidate} exists, keeping ${url}:`,
					error
				);
				this.unresolved.set(url, 'unchecked');
				return url;
			}
		}

		console.warn(`${fileName} exists on neither artwork host, keeping ${url}`);
		this.unresolved.set(url, 'missing');
		return url;
	}

	private fileNameOf(url: string): string | null {
		for (const base of Object.values(this.baseUrls)) {
			if (url.startsWith(base)) {
				return url.slice(base.length);
			}
		}
		return null;
	}
}

export default ImageHostResolver;
