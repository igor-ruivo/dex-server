import { JSDOM } from 'jsdom';

import { HttpDataFetcher } from '../../../services/data-fetcher';
import { AvailableLocales } from '../../../services/gamemaster-translator';
import { ExtractedPostLink, PokemonGoPost } from '../../../types/events';

export class PokemonGoFetcher {
    private baseUrl = 'https://pokemongo.com';
    private newsUrl = 'https://pokemongo.com/news';

    public async fetchAllPosts(): Promise<Array<PokemonGoPost>> {
        try {
            const newsPageHtml = await this.fetchPage(this.newsUrl);
            const postLinks = this.extractPostLinks(newsPageHtml);
            const postPromises = postLinks.map(async (link) => {
                try {
                    const html = await this.fetchPage(link.url);
                    return {
                        url: link.url,
                        type: this.determinePostType(link.url),
                        html,
                        locale: link.locale
                    };
                } catch (error) {
                    console.error(error);
                    return null;
                }
            });
            const results = await Promise.all(postPromises);
            const posts = results.filter(post => post !== null) as Array<PokemonGoPost>;
            return posts;
        } catch (error) {
            console.error(error);
            return [];
        }
    }

    private async fetchPage(url: string): Promise<string> {
        let fullUrl = url;
        if (url.startsWith('/')) {
            fullUrl = this.baseUrl + '/' + url;
        }

        const dataFetcher = new HttpDataFetcher();

        const text = await dataFetcher.fetchText(fullUrl);
        return text;
    }

    private extractPostLinks(html: string): Array<ExtractedPostLink> {
        const links: Array<ExtractedPostLink> = [];
        const dom = new JSDOM(html);
        const document = dom.window.document;
        // Select all <a> elements with href containing /en/post/ or /news/
        const cardLinks = Array.from(document.querySelectorAll('a')) as Array<Element>;
        const filteredLinks = cardLinks.filter((a: Element) => {
            const href = a.getAttribute('href') ?? '';
            return href.includes('/en/post/') || href.includes('/news/');
        });
        filteredLinks.forEach((a: Element) => {
            let url = a.getAttribute('href') ?? '';
            if (url.startsWith('/')) url = this.baseUrl + url;
            if (!url.startsWith('http')) url = this.baseUrl + '/' + url.replace(/^\//, '');
           
            if (!links.some(link => link.url === url)) {
                links.push({
                    url: url,
                    locale: AvailableLocales.en
                });

                // Add links for all AvailableLocales except the one already present in the URL
                const availableLocales = Object.values(AvailableLocales);
                availableLocales.forEach((locale) => {
                    if (locale === AvailableLocales.en) {
                        return;
                    }

                    let localeUrl: string;
                    if (url.includes(`/${AvailableLocales.en}/`)) {
                        localeUrl = url.replaceAll(`/${AvailableLocales.en}/`, `/${locale}/`);
                    } else {
                        localeUrl = url.replace('/news/', `/${locale}/news/`);
                    }
                    if (!links.some(l => l.url === localeUrl)) {
                        links.push({
                            url: localeUrl,
                            locale
                        });
                    }
                });
            }
        });
        return links;
    }

    private determinePostType(url: string): 'post' | 'news' {
        if (url.includes('/post/')) {
            return 'post';
        }
        
        return 'news';
    }
} 