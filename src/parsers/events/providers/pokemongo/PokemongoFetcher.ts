import { JSDOM } from 'jsdom';
import { PokemonGoPost } from '../../../types/events';
import { HttpDataFetcher } from '../../../services/data-fetcher';
import { LANGUAGE_EN, LANGUAGE_PT_BR } from '../../config/constants';

export class PokemonGoFetcher {
    private baseUrl = 'https://pokemongo.com';
    private newsUrl = 'https://pokemongo.com/news';

    public async fetchAllPosts(): Promise<PokemonGoPost[]> {
        try {
            const newsPageHtml = await this.fetchPage(this.newsUrl);
            const postLinks = this.extractPostLinks(newsPageHtml);
            const postPromises = postLinks.map(async (link) => {
                try {
                    const html = await this.fetchPage(link);
                    return {
                        url: link,
                        type: this.determinePostType(link),
                        html
                    };
                } catch (error) {
                    return null;
                }
            });
            const results = await Promise.all(postPromises);
            const posts = results.filter(post => post !== null) as PokemonGoPost[];
            return posts;
        } catch (error) {
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

    private extractPostLinks(html: string): Array<string> {
        const links: Array<string> = [];
        const dom = new JSDOM(html);
        const document = dom.window.document;
        // Select all <a> elements with href containing /en/post/ or /news/
        const cardLinks = Array.from(document.querySelectorAll('a')) as Element[];
        const filteredLinks = cardLinks.filter((a: Element) => {
            const href = a.getAttribute('href') || '';
            return /\/en\/post\//.test(href) || /\/news\//.test(href);
        });
        filteredLinks.forEach((a: Element) => {
            let url = a.getAttribute('href') || '';
            if (url.startsWith('/')) url = this.baseUrl + url;
            if (!url.startsWith('http')) url = this.baseUrl + '/' + url.replace(/^\//, '');
           
            if (!links.some(link => link === url)) {
                links.push(url);

                const ptBRCounterpart = url.includes(`/${LANGUAGE_EN}/`) ? url.replaceAll(`/${LANGUAGE_EN}/`, `/${LANGUAGE_PT_BR}/`) : url.replaceAll('/news/', `/${LANGUAGE_PT_BR}/news/`);
                links.push(ptBRCounterpart);
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

    public async fetchSinglePost(url: string): Promise<PokemonGoPost | null> {
        try {
            const html = await this.fetchPage(url);
            const type = this.determinePostType(url);
            
            return {
                url,
                type,
                html
            };
        } catch (error) {
            return null;
        }
    }
} 