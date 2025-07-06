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
            console.log('Fetching Pokemon GO news page...');
            const newsPageHtml = await this.fetchPage(this.newsUrl);
            
            console.log('Extracting post links...');
            const postLinks = this.extractPostLinks(newsPageHtml);
            
            console.log(`Found ${postLinks.length} posts to fetch`);
            
            const posts: PokemonGoPost[] = [];
            
            for (const link of postLinks) {
                try {
                    console.log(`Fetching: ${link.title}`);
                    const html = await this.fetchPage(link.url);
                    posts.push({
                        url: link.url,
                        title: link.title,
                        type: this.determinePostType(link.url, link.title),
                        html
                    });
                } catch (error) {
                    console.error(`Failed to fetch ${link.url}:`, error);
                }
            }
            
            console.log(`Successfully fetched ${posts.length} posts`);
            return posts;
        } catch (error) {
            console.error('Failed to fetch Pokemon GO posts:', error);
            return [];
        }
    }

    private async fetchPage(url: string): Promise<string> {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.text();
    }

    private extractPostLinks(html: string): Array<{ url: string; title: string }> {
        const links: Array<{ url: string; title: string }> = [];
        
        // Extract links from the news page
        // Look for links that contain /post/ or /news/
        const linkRegex = /<a[^>]+href="([^"]*(?:\/post\/|\/news\/)[^"]*)"[^>]*>([^<]+)<\/a>/gi;
        let match;
        
        while ((match = linkRegex.exec(html)) !== null) {
            const url = match[1];
            const title = match[2].trim();
            
            // Skip if it's already in our list or if it's a season post
            if (!links.some(link => link.url === url) && 
                !title.toLowerCase().includes('season') &&
                !title.toLowerCase().includes('welcome to pokémon go')) {
                links.push({ url, title });
            }
        }
        
        return links.slice(0, 32); // Limit to first 32 posts as mentioned
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
            console.error(`Failed to fetch single post ${url}:`, error);
            return null;
        }
    }

    private extractTitle(html: string): string {
        // Try to extract title from various possible locations
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