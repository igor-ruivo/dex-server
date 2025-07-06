import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
    const allowedOrigins = ['https://go-pokedex.com', 'http://localhost:3000'];
    const origin = req.headers.origin;

    if (origin && allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        const { targetUrl, ...queryParams } = req.query;

        if (typeof targetUrl !== 'string' || !/^https?:\/\//.test(targetUrl)) {
            res.status(400).json({ error: `Invalid target URL...: ${targetUrl}` });
            return;
        }

        // Build URL with query parameters
        const url = new URL(targetUrl);
        Object.entries(queryParams).forEach(([key, value]) => {
            if (typeof value === 'string') {
                url.searchParams.append(key, value);
            }
        });

        const response = await fetch(url.toString());

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.text();
        res.status(200).json(data);
    } catch (error) {
        console.error('Error fetching data from external API:', error);
        res.status(500).json({ error: 'Error fetching data from the external API' });
    }
}