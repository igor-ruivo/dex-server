import { logger } from './utils/logger';
import { Scheduler } from './services/scheduler';
import { FileManager } from './services/file-manager';
import { DataAggregator } from './services/data-aggregator';

class PokemonGoDataServer {
  private scheduler: Scheduler;
  private fileManager: FileManager;
  private dataAggregator: DataAggregator;

  constructor() {
    this.scheduler = new Scheduler();
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
        await this.scheduler.runImmediate();
      } else {
        logger.info('Existing data found, skipping initial aggregation');
      }
      
      // Start the scheduler
      this.scheduler.start();
      
      logger.info('Pokemon GO Data Server started successfully');
      
      // Handle graceful shutdown
      this.setupGracefulShutdown();
      
    } catch (error) {
      logger.error('Failed to start Pokemon GO Data Server:', error);
      process.exit(1);
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully`);
      
      try {
        this.scheduler.stop();
        logger.info('Scheduler stopped');
        
        // Give some time for ongoing operations to complete
        setTimeout(() => {
          logger.info('Shutdown complete');
          process.exit(0);
        }, 1000);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  async runManualAggregation(): Promise<void> {
    logger.info('Running manual data aggregation');
    await this.scheduler.runImmediate();
  }

  getStatus(): {
    schedulerRunning: boolean;
    nextRunTime: Date | null;
    fileInfo: Promise<{ [key: string]: { size: number; lastModified: Date } }>;
  } {
    return {
      schedulerRunning: this.scheduler.isRunning(),
      nextRunTime: this.scheduler.getNextRunTime(),
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