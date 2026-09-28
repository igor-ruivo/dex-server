import { JSDOM } from 'jsdom';

import type HttpDataFetcher from '../../../services/data-fetcher';
import { AvailableLocales } from '../../../services/gamemaster-translator';
import type { PokemonGoPost } from '../../../types/events';

interface ListingLink {
	slug: string;
}

class PokemonGoFetcher {
	private baseUrl = 'https://pokemongo.com';

	constructor(private readonly dataFetcher: HttpDataFetcher) {}

	async fetchAllPosts(): Promise<Array<PokemonGoPost>> {
		try {
			const locales = Object.values(AvailableLocales);
			// The ground truth for "is this event published in language X" is
			// whether X's own news listing page (e.g. pokemongo.com/pt-BR/news)
			// actually links to it — not whether a URL built by string-
			// substituting the English one happens to return 200. A missing
			// translation can silently redirect to a generic page (a false
			// positive for "it exists") or the substituted URL shape can simply
			// be wrong for that locale (a false negative) — fetching each
			// locale's real listing page sidesteps both failure modes, and gives
			// us the real per-locale URL to fetch directly instead of a guess.
			//
			// Always `/${locale}/news`, even for English — the bare, unprefixed
			// `/news` can come back geo/Accept-Language-negotiated into a
			// non-English page (seen live: a fully Chinese post surfacing as the
			// "English" one), where the explicit `/en/news` reliably doesn't.
			const listingPages = await Promise.all(
				locales.map(async (locale) => {
					try {
						const html = await this.fetchPage(`${this.baseUrl}/${locale}/news`);
						return { locale, links: this.extractListingLinks(html) };
					} catch {
						return { locale, links: [] as Array<ListingLink> };
					}
				})
			);

			const enListing = listingPages.find(
				(p) => p.locale === AvailableLocales.en
			);
			if (!enListing) {
				return [];
			}
			// Same cap as before — which events exist at all is still driven by
			// the English listing.
			const enLinks = enListing.links.slice(0, 30);

			const postPromises = enLinks.flatMap((enLink) =>
				listingPages.map(async ({ locale, links }) => {
					const match =
						locale === AvailableLocales.en
							? enLink
							: links.find((l) => l.slug === enLink.slug);
					if (!match) {
						return null;
					}
					// The listing page's own hrefs are bare/unprefixed
					// (`/news/<slug>`) even when the *listing* page itself was
					// fetched from an explicit `/en/news` — and fetching that bare
					// URL directly is exactly where geo/Accept-Language
					// negotiation can quietly swap in a different language (seen
					// live: a fully Chinese post surfacing as the "English" one).
					// Reconstructing an explicitly locale-prefixed URL from the
					// matched slug — confirmed live to work the same as the
					// listing pages do — removes that ambiguity for the actual
					// content fetch too, not just for finding the event.
					const url = `${this.baseUrl}/${locale}/${match.slug}`;
					try {
						const html = await this.fetchPage(url);
						return {
							url,
							type: this.determinePostType(url),
							html,
							locale,
						};
					} catch {
						return null;
					}
				})
			);

			const results = await Promise.all(postPromises);
			return results.filter((post): post is PokemonGoPost => post !== null);
		} catch (error) {
			console.error(error);
			return [];
		}
	}

	private async fetchPage(url: string) {
		let fullUrl = url;
		if (url.startsWith('/')) {
			fullUrl = this.baseUrl + '/' + url;
		}

		const text = await this.dataFetcher.fetchText(fullUrl);
		return text;
	}

	// Normalizes a post URL (whatever locale prefix or absence of one it has)
	// down to a bare "post/<slug>" or "news/<slug>" key, so the same event can
	// be matched across every locale's own listing page regardless of that
	// locale's URL shape (`/pt-br/post/x`, `/post/x`, `/en/post/x`, …).
	private slugOf(url: string): string {
		const path = url.toLowerCase().replace(/^https?:\/\/[^/]+/, '');
		const match = /\/(post|news)\/([^/?#]+)/.exec(path);
		return match ? `${match[1]}/${match[2]}` : path;
	}

	private extractListingLinks(html: string): Array<ListingLink> {
		const dom = new JSDOM(html);
		const document = dom.window.document;
		const anchors = Array.from(
			document.querySelectorAll('a')
		) as Array<Element>;

		const seen = new Set<string>();
		const links: Array<ListingLink> = [];
		for (const a of anchors) {
			const href = a.getAttribute('href') ?? '';
			if (!href.includes('/post/') && !href.includes('/news/')) {
				continue;
			}

			const slug = this.slugOf(href);
			if (seen.has(slug)) {
				continue;
			}
			seen.add(slug);
			links.push({ slug });
		}
		return links;
	}

	private determinePostType(url: string): 'post' | 'news' {
		if (url.includes('/post/')) {
			return 'post';
		}

		return 'news';
	}
}

export default PokemonGoFetcher;
