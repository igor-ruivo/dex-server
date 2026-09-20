export interface SkippedFetch {
	url: string;
	status: number;
}

interface AllowedSkippedFetch {
	pattern: RegExp;
	reason: string;
}

// Every `fetchText` failure is normally treated as fatal for CI purposes —
// a 404/5xx mid-run is a signal something upstream changed and deserves a
// look, not a shrug. This is the explicit, reviewed exception list for the
// handful of fetches known to be unreliable enough that failing them is
// expected and already handled gracefully downstream (e.g. an EN-fallback),
// so they shouldn't page anyone. Anything not listed here still fails the
// generate job.
const ALLOWED_SKIPPED_FETCHES: Array<AllowedSkippedFetch> = [
	{
		pattern: /^https:\/\/pokemongo\.com\/ru\/seasons\/?$/,
		reason:
			'ru season page 404s intermittently; SeasonParser already falls back to the EN season content for it — not worth failing the run over.',
	},
];

export function validateSkippedFetches(
	skipped: ReadonlyArray<SkippedFetch>
): void {
	const unexpected = skipped.filter(
		({ url }) =>
			!ALLOWED_SKIPPED_FETCHES.some((allowed) => allowed.pattern.test(url))
	);

	if (unexpected.length > 0) {
		throw new Error(
			`${unexpected.length} unexpected fetch failure(s) (not on the allow-list — see fetch-failures-qa.ts):\n` +
				unexpected.map(({ url, status }) => `  - [${status}] ${url}`).join('\n')
		);
	}
}
