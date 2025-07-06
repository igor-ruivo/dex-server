import { VercelRequest, VercelResponse } from '@vercel/node';
import { PokemonGoDataServer } from '../src/index';
import { createChildLogger } from '../src/utils/logger';

const logger = createChildLogger('TriggerAPI');

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const allowedOrigins = ['https://go-pokedex.com', 'http://localhost:3000'];
  const origin = req.headers.origin;

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are allowed for triggering data aggregation'
    });
    return;
  }

  try {
    logger.info('Manual data aggregation triggered via API');
    
    const server = new PokemonGoDataServer();
    await server.runManualAggregation();
    
    const status = server.getStatus();
    const fileInfo = await status.fileInfo;
    
    res.status(200).json({
      success: true,
      message: 'Data aggregation completed successfully',
      timestamp: new Date().toISOString(),
      fileInfo,
      nextRunTime: status.nextRunTime?.toISOString(),
    });
    
  } catch (error) {
    logger.error('Error during manual data aggregation:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to trigger data aggregation',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 