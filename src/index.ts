import { logger } from './utils/logger';
import { FileManager } from './services/file-manager';
import { DataAggregator } from './services/data-aggregator';

class PokemonGoDataServer {
  private fileManager: FileManager;
  private dataAggregator: DataAggregator;

  constructor() {
    this.fileManager = new FileManager();
    this.dataAggregator = new DataAggregator();
  }

  async start(): Promise<void> {
    try {
      logger.info('Starting Pokemon GO Data Server');
      
      // Ensure output directory exists
      await this.fileManager.ensureOutputDirectory();
      
      // Run initial data aggregation if no data exists
      const existingData = await this.fileManager.readAggregatedData();
      if (!existingData) {
        logger.info('No existing data found, running initial aggregation');
        await this.runManualAggregation();
      } else {
        logger.info('Existing data found, skipping initial aggregation');
      }
      
      logger.info('Pokemon GO Data Server started successfully');
      
    } catch (error) {
      logger.error('Failed to start Pokemon GO Data Server:', error);
      process.exit(1);
    }
  }

  async runManualAggregation(): Promise<void> {
    logger.info('Running manual data aggregation');
    
    const startTime = Date.now();
    
    try {
      // Aggregate data from all sources
      const aggregatedData = await this.dataAggregator.aggregateData();
      
      // Write data to files
      await this.fileManager.writeAggregatedData(aggregatedData);
      
      // Cleanup old files
      await this.fileManager.cleanupOldFiles();
      
      const processingTime = Date.now() - startTime;
      logger.info(`Manual data aggregation completed successfully in ${processingTime}ms`);
    } catch (error) {
      logger.error('Manual data aggregation failed:', error);
      throw error;
    }
  }

  getStatus(): {
    fileInfo: Promise<{ [key: string]: { size: number; lastModified: Date } }>;
  } {
    return {
      fileInfo: this.fileManager.getDataFileInfo(),
    };
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  const server = new PokemonGoDataServer();
  server.start().catch(error => {
    logger.error('Failed to start server:', error);
    process.exit(1);
  });
}

export { PokemonGoDataServer }; 