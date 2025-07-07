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
        const now = () => new Date().toISOString();
        try {
            // console.log(`[${now()}] [fetchAllPosts] Fetching Pokemon GO news page...`);
            const newsPageHtml = await this.fetchPage(this.newsUrl);
            
            // console.log(`[${now()}] [fetchAllPosts] Extracting post links...`);
            const postLinks = this.extractPostLinks(newsPageHtml);
            
            // console.log(`[${now()}] [fetchAllPosts] Found ${postLinks.length} posts to fetch`);
            
            // Fetch all posts in parallel instead of sequentially
            // console.log(`[${now()}] [fetchAllPosts] Starting parallel fetches...`);
            const fetchStart = Date.now();
            
            const postPromises = postLinks.map(async (link, idx) => {
                const t0 = Date.now();
                // console.log(`[${now()}] [fetchAllPosts] [${idx}] Starting fetch: ${link.title}`);
                try {
                    const html = await this.fetchPage(link.url);
                    const t1 = Date.now();
                    // console.log(`[${now()}] [fetchAllPosts] [${idx}] Fetch complete (${t1-t0}ms): ${link.title}`);
                    return {
                        url: link.url,
                        title: link.title,
                        type: this.determinePostType(link.url, link.title),
                        html
                    };
                } catch (error) {
                    const t1 = Date.now();
                    // console.error(`[${now()}] [fetchAllPosts] [${idx}] Failed to fetch ${link.url} (${t1-t0}ms):`, error);
                    return null;
                }
            });
            
            const results = await Promise.all(postPromises);
            const fetchEnd = Date.now();
            // console.log(`[${now()}] [fetchAllPosts] All fetches complete. Total time: ${fetchEnd-fetchStart}ms`);
            
            const posts = results.filter(post => post !== null) as PokemonGoPost[];
            // console.log(`[${now()}] [fetchAllPosts] Successfully fetched ${posts.length} posts`);
            return posts;
        } catch (error) {
            // console.error(`[${now()}] [fetchAllPosts] Failed to fetch Pokemon GO posts:`, error);
            return [];
        }
    }

    private async fetchPage(url: string): Promise<string> {
        const now = () => new Date().toISOString();
        const t0 = Date.now();
        
        // If the url is relative, prepend the baseUrl
        let fullUrl = url;
        if (url.startsWith('/')) {
            fullUrl = this.baseUrl + url;
        }
        
        // console.log(`[${now()}] [fetchPage] Starting HTTP request to: ${fullUrl}`);
        
        const response = await fetch(fullUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });
        
        const t1 = Date.now();
        // console.log(`[${now()}] [fetchPage] HTTP response received (${t1-t0}ms): ${response.status} ${response.statusText}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const text = await response.text();
        const t2 = Date.now();
        // console.log(`[${now()}] [fetchPage] Text downloaded (${t2-t1}ms), total time: ${t2-t0}ms, size: ${text.length} chars`);
        
        return text;
    }

    private extractPostLinks(html: string): Array<{ url: string; title: string }> {
        const links: Array<{ url: string; title: string }> = [];
        
        // Extract links from the news page using the correct selector
        // Look for <a> tags with class containing "newsCard"
        const linkRegex = /<a[^>]+href="([^"]*)"[^>]*class="[^"]*newsCard[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
        let match;
        
        while ((match = linkRegex.exec(html)) !== null) {
            const url = match[1];
            const linkContent = match[2];
            
            // Extract title from the link content
            // Look for the heading text within the link
            const titleMatch = linkContent.match(/<div[^>]*class="[^"]*size:heading[^"]*"[^>]*>([^<]+)<\/div>/i);
            const title = titleMatch ? titleMatch[1].trim() : 'Untitled';
            
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
            // console.error(`Failed to fetch single post ${url}:`, error);
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