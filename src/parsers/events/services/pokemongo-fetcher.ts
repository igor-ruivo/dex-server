import { JSDOM } from 'jsdom';

export interface PokemonGoPost {
    url: string;
    title: string;
    type: 'post' | 'news' | 'season' | 'other';
    html: string;
}

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
        // Remove static HTML injection for /news/ events
        // Always fetch the real HTML from the live site
        let fullUrl = url;
        if (url.startsWith('/')) {
            fullUrl = this.baseUrl + '/' + url;
        }
        const response = await fetch(fullUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const text = await response.text();
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

                const ptBRCounterpart = url.includes('/en/') ? url.replaceAll('/en/', '/pt_BR/') : url.replaceAll('/news/', '/pt_BR/news/');
                links.push(ptBRCounterpart);
            }
        });
        // Debug: print all extracted links
        console.log('Extracted event links:', links);
        return links;
    }

    private determinePostType(url: string): 'post' | 'news' | 'season' | 'other' {
        if (url.includes('/post/')) {
            return 'post';
        }
        if (url.includes('/news/')) {
            return 'news';
        }
        return 'other';
    }

    public async fetchSinglePost(url: string): Promise<PokemonGoPost | null> {
        try {
            const html = await this.fetchPage(url);
            const title = this.extractTitle(url, html);
            const type = this.determinePostType(url);
            
            return {
                url,
                title,
                type,
                html
            };
        } catch (error) {
            return null;
        }
    }

    private extractTitle(url: string, html: string): string {
        const dom = new JSDOM(html);
        const document = dom.window.document;

        if (url.includes('/news/')) {
            return Array.from(document.querySelector('article[aria-labelledby=news-title]')?.querySelectorAll('*') || []).filter(a => Array.from(a.classList).some(c => c.includes('_title_')))[0].textContent || '';
        }

        if (url.includes('/post/')) {
            return document.querySelectorAll('h2.blogPost__title')[0].textContent || '';
        }
        
        return 'Untitled';
    }
} 