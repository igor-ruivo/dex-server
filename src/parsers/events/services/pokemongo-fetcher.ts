export interface PokemonGoPost {
    url: string;
    title: string;
    type: 'post' | 'news' | 'season' | 'other';
    html: string;
}

export class PokemonGoFetcher {
    private baseUrl = 'https://pokemongolive.com';
    private newsUrl = 'https://pokemongolive.com/news';

    public async fetchAllPosts(): Promise<PokemonGoPost[]> {
        try {
            const newsPageHtml = await this.fetchPage(this.newsUrl);
            
            const postLinks = this.extractPostLinks(newsPageHtml);
            
            const postPromises = postLinks.map(async (link) => {
                try {
                    const html = await this.fetchPage(link.url);
                    return {
                        url: link.url,
                        title: link.title,
                        type: this.determinePostType(link.url, link.title),
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
            fullUrl = this.baseUrl + url;
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

    private extractPostLinks(html: string): Array<{ url: string; title: string }> {
        const links: Array<{ url: string; title: string }> = [];
        
        const linkRegex = /<a[^>]+href="([^"]*)"[^>]*class="[^"]*newsCard[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
        let match;
        
        while ((match = linkRegex.exec(html)) !== null) {
            const url = match[1];
            const linkContent = match[2];
            
            const titleMatch = linkContent.match(/<div[^>]*class="[^"]*size:heading[^"]*"[^>]*>([^<]+)<\/div>/i);
            const title = titleMatch ? titleMatch[1].trim() : 'Untitled';
            
            if (!links.some(link => link.url === url) && 
                !title.toLowerCase().includes('season') &&
                !title.toLowerCase().includes('welcome to pokémon go')) {
                links.push({ url, title });
            }
        }
        
        return links.slice(0, 32);
    }

    private determinePostType(url: string, title: string): 'post' | 'news' | 'season' | 'other' {
        if (url.includes('/post/')) {
            return 'post';
        }
        if (url.includes('/news/')) {
            return 'news';
        }
        if (title.toLowerCase().includes('season') || 
            title.toLowerCase().includes('welcome to pokémon go')) {
            return 'season';
        }
        return 'other';
    }

    public async fetchSinglePost(url: string): Promise<PokemonGoPost | null> {
        try {
            const html = await this.fetchPage(url);
            const title = this.extractTitle(html);
            const type = this.determinePostType(url, title);
            
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

    private extractTitle(html: string): string {
        const titleSelectors = [
            /<h1[^>]*>([^<]+)<\/h1>/i,
            /<title[^>]*>([^<]+)<\/title>/i,
            /<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i,
            /<meta[^>]+name="title"[^>]+content="([^"]+)"/i
        ];
        
        for (const selector of titleSelectors) {
            const match = html.match(selector);
            if (match) {
                return match[1].trim();
            }
        }
        
        return 'Untitled';
    }
} 