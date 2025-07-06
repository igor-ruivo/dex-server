import { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'fs-extra';
import path from 'path';
import { createChildLogger } from '../src/utils/logger';

const logger = createChildLogger('DataAPI');

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
    const { type = 'all' } = req.query;
    const dataDir = path.join(process.cwd(), 'public', 'data');
    
    // Determine which file to serve based on type parameter
    let filePath: string;
    let contentType = 'application/json';
    
    switch (type) {
      case 'events':
        filePath = path.join(dataDir, 'events.json');
        break;
      case 'raid-bosses':
        filePath = path.join(dataDir, 'raid-bosses.json');
        break;
      case 'team-rocket':
        filePath = path.join(dataDir, 'team-rocket.json');
        break;
      case 'game-master':
        filePath = path.join(dataDir, 'game-master.json');
        break;
      case 'metadata':
        filePath = path.join(dataDir, 'metadata.json');
        break;
      case 'all':
      default:
        filePath = path.join(dataDir, 'aggregated-data.json');
        break;
    }

    // Check if file exists
    if (!await fs.pathExists(filePath)) {
      logger.warn(`Requested data file not found: ${filePath}`);
      res.status(404).json({ 
        error: 'Data not found',
        message: `The requested data type '${type}' is not available`,
        availableTypes: ['events', 'raid-bosses', 'team-rocket', 'game-master', 'metadata', 'all']
      });
      return;
    }

    // Read and serve the file
    const data = await fs.readJson(filePath);
    
    // Add cache headers for better performance
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.setHeader('Content-Type', contentType);
    
    res.status(200).json(data);
    
  } catch (error) {
    logger.error('Error serving data:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to retrieve data'
    });
  }
} 