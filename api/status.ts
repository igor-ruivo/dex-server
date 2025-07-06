import { VercelRequest, VercelResponse } from '@vercel/node';
import { PokemonGoDataServer } from '../src/index';
import { createChildLogger } from '../src/utils/logger';

const logger = createChildLogger('StatusAPI');

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

  if (req.method !== 'GET') {
    res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only GET requests are allowed for status checks'
    });
    return;
  }

  try {
    logger.debug('Status check requested');
    
    const server = new PokemonGoDataServer();
    const status = server.getStatus();
    const fileInfo = await status.fileInfo;
    
    res.status(200).json({
      status: 'operational',
      timestamp: new Date().toISOString(),
      data: {
        files: fileInfo,
        totalFiles: Object.keys(fileInfo).length,
        totalSize: Object.values(fileInfo).reduce((sum, file) => sum + file.size, 0),
      },
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.version,
      },
      info: {
        message: 'Data updates are handled by GitHub Actions (daily at 6 AM UTC)',
        triggerEndpoint: '/api/trigger',
        dataEndpoint: '/api/data',
      },
    });
    
  } catch (error) {
    logger.error('Error during status check:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to retrieve system status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 