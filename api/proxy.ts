import { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
    res.setHeader('Access-Control-Allow-Origin', 'https://go-pokedex.com');
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

        const response = await axios.get(targetUrl, { params: queryParams });

        res.status(200).json(response.data);
    } catch (error) {
        console.error('Error fetching data from external API:', error);
        res.status(500).json({ error: 'Error fetching data from the external API' });
    }
}