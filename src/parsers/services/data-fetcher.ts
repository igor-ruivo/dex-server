export interface IDataFetcher {
	fetchJson<T>(url: string): Promise<T>;
	/** Never throws on a non-2xx response (after retries) — logs it and
	 *  returns `''` instead. See the class doc comment for why this is
	 *  asymmetric with `fetchJson`. */
	fetchText(url: string): Promise<string>;
	/** Every `fetchText` call that ended in a non-2xx response (post-retry),
	 *  in call order — inspect this after a run to see what got skipped. */
	getSkippedFetches(): ReadonlyArray<{ url: string; status: number }>;
	/** Widens the progress denominator by `count` — for callers whose own
	 *  fetch count isn't knowable in advance (see `FIXED_KNOWN_FETCHES`'s own
	 *  comment): call this the moment the real count becomes known (e.g.
	 *  right after parsing a listing/manifest page, before firing the
	 *  Promise.all of detail-page fetches it drives), so the progress log's
	 *  "/ N" reflects this actual run, not a guess made before it started. */
	announceExpectedFetches(count: number): void;
}

interface HostLimits {
	/** Max requests to this host in flight at once. */
	concurrency: number;
	/** Minimum gap between dispatching one request to this host and the next
	 *  — concurrency alone doesn't bound requests/sec if each one resolves
	 *  fast, which is exactly what still tripped 429s at concurrency 3. */
	minIntervalMs: number;
}

const DEFAULT_LIMITS: HostLimits = { concurrency: 6, minIntervalMs: 150 };

/** pokemongo.com sits behind bot/WAF-style protection that 429s well before
 *  a plain concurrency cap would suggest — confirmed by getting 429'd on a
 *  fresh IP (via VPN) even serialized at concurrency 3. `minIntervalMs`
 *  (what actually paces requests/sec against the WAF) is unchanged here —
 *  concurrency 2 just lets a second, slower-to-respond request overlap
 *  instead of blocking the next dispatch, still never firing two dispatches
 *  less than 300ms apart. The other hosts (raw.githubusercontent.com,
 *  leekduck.com) haven't shown this and keep the default. */
const HOST_LIMITS: Record<string, HostLimits> = {
	'pokemongo.com': { concurrency: 2, minIntervalMs: 300 },
};

const MAX_RETRIES = 7;
const BASE_BACKOFF_MS = 1500;
const MAX_BACKOFF_MS = 30000;

/**
 * Every fetch count that's actually knowable before a run starts — i.e.
 * everything that isn't "however many events/raids happen to be live on
 * LeekDuck right now" (EventsParser, BossesParser — those call
 * `announceExpectedFetches` themselves for their own dynamic portion, once
 * they've parsed their own listing/manifest page and know their real count
 * for this run):
 *   - GameMasterTranslator (PokeMiners i18n, one per AvailableLocales member): 15
 *   - MovesProvider (PokeMiners game_masters latest.json): 1
 *   - GameMasterParser (pvpoke gamemaster/pokemon.json): 1
 *   - PvPParser (one per League — GREAT/ULTRA/MASTER): 3
 *   - PokemonGoFetcher (1 listing page + up to 30 posts x 15 locales,
 *     `.slice(0, 30)`-capped so this is a real upper bound, not a guess): 451
 *   - SeasonParser (one per AvailableLocales member): 15
 *   - EventsParser's own listing page (its per-event pages are dynamic,
 *     announced separately): 1
 *   - BossesParser's own manifest fetch (its per-rotation fragment pages
 *     are dynamic, announced separately): 1
 *   - EggsParser (single LeekDuck page): 1
 *   - RocketLineupsParser (single LeekDuck page): 1
 * Total: 15+1+1+3+451+15+1+1+1+1 = 490.
 */
const FIXED_KNOWN_FETCHES = 490;
const PROGRESS_LOG_EVERY = 10;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Per-host concurrency + minimum-interval pacing, plus 429 retry with
 * exponential backoff (honoring `Retry-After` when present). Centralized
 * here rather than in each caller: every parser already fans out
 * `Promise.all` over every `AvailableLocales` member for a handful of hosts —
 * going from 2 locales to 15 turned those into 15x (or, for
 * PokemonGoFetcher's up to 30 posts x 15 locales, ~450x) requests to the
 * same host, which is what started 429ing. Gating it here means no caller
 * needs to know or care.
 *
 * `fetchText` vs `fetchJson` on failure: `fetchText` feeds HTML-scraped
 * content (LeekDuck pages, pokemongo.com posts/seasons) — losing one page is
 * losing one event/season's worth of nice-to-have data, so it logs and
 * returns `''` instead of aborting the entire generate run over it.
 * `fetchJson` feeds structural data (game master, PvP, moves, the PokeMiners
 * i18n dictionaries) that everything downstream assumes is actually
 * shaped correctly — a "successful" empty/partial result there is worse
 * than a loud failure, so it still throws.
 */
class HttpDataFetcher implements IDataFetcher {
	private headers = {
		'User-Agent':
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
		'Accept':
			'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
		'Accept-Language': 'en-US,en;q=0.9',
	};

	private inFlightByHost = new Map<string, number>();
	private queueByHost = new Map<string, Array<() => void>>();
	private nextDispatchAtByHost = new Map<string, number>();

	private totalFetches = 0;
	private expectedTotal = FIXED_KNOWN_FETCHES;
	private skippedFetches: Array<{ url: string; status: number }> = [];

	private limitsFor(host: string): HostLimits {
		return HOST_LIMITS[host] ?? DEFAULT_LIMITS;
	}

	private async acquireSlot(host: string): Promise<() => void> {
		const { concurrency } = this.limitsFor(host);
		const current = this.inFlightByHost.get(host) ?? 0;
		if (current < concurrency) {
			this.inFlightByHost.set(host, current + 1);
			return () => this.releaseSlot(host);
		}

		return new Promise((resolve) => {
			const queue = this.queueByHost.get(host) ?? [];
			queue.push(() => {
				this.inFlightByHost.set(host, (this.inFlightByHost.get(host) ?? 0) + 1);
				resolve(() => this.releaseSlot(host));
			});
			this.queueByHost.set(host, queue);
		});
	}

	private releaseSlot(host: string): void {
		const current = (this.inFlightByHost.get(host) ?? 1) - 1;
		this.inFlightByHost.set(host, Math.max(current, 0));

		const next = this.queueByHost.get(host)?.shift();
		if (next) {
			next();
		}
	}

	/** Serializes dispatch timing across every request to `host` (not just
	 *  the ones currently holding a concurrency slot) so two requests can
	 *  never fire less than `minIntervalMs` apart, regardless of concurrency. */
	private async awaitPacing(host: string): Promise<void> {
		const { minIntervalMs } = this.limitsFor(host);
		if (minIntervalMs <= 0) {
			return;
		}

		const now = Date.now();
		const earliest = this.nextDispatchAtByHost.get(host) ?? now;
		const dispatchAt = Math.max(now, earliest);
		this.nextDispatchAtByHost.set(host, dispatchAt + minIntervalMs);

		const waitMs = dispatchAt - now;
		if (waitMs > 0) {
			await sleep(waitMs);
		}
	}

	private logProgress(): void {
		this.totalFetches++;
		if (this.totalFetches % PROGRESS_LOG_EVERY === 0) {
			console.log(
				`[fetch progress] ${this.totalFetches} / ~${this.expectedTotal}`
			);
		}
	}

	announceExpectedFetches(count: number): void {
		this.expectedTotal += count;
	}

	private async fetchWithLimitAndRetry(url: string): Promise<Response> {
		const host = new URL(url).host;
		const release = await this.acquireSlot(host);

		try {
			for (let attempt = 0; ; attempt++) {
				await this.awaitPacing(host);
				this.logProgress();
				const response = await fetch(url, { headers: this.headers });
				if (response.status !== 429 || attempt >= MAX_RETRIES) {
					return response;
				}

				const retryAfterHeader = response.headers.get('retry-after');
				const retryAfterMs = retryAfterHeader
					? Number(retryAfterHeader) * 1000
					: null;
				const backoffMs = Math.min(
					retryAfterMs && !Number.isNaN(retryAfterMs)
						? retryAfterMs
						: BASE_BACKOFF_MS * 2 ** attempt,
					MAX_BACKOFF_MS
				);
				await sleep(backoffMs + Math.random() * 250);
			}
		} finally {
			release();
		}
	}

	async fetchJson<T>(url: string) {
		const response = await this.fetchWithLimitAndRetry(url);

		if (!response.ok) {
			throw new Error(
				`Failed to fetch data: ${response.status} ${response.statusText}`
			);
		}

		return response.json() as T;
	}

	async fetchText(url: string) {
		const response = await this.fetchWithLimitAndRetry(url);

		if (!response.ok) {
			console.error(
				`[fetch skipped] ${response.status} ${response.statusText} — ${url}`
			);
			this.skippedFetches.push({ url, status: response.status });
			return '';
		}

		return response.text();
	}

	getSkippedFetches() {
		return this.skippedFetches;
	}
}

export default HttpDataFetcher;
