import cron from 'node-cron';
import { createChildLogger } from '../utils/logger';
import { config } from '../config';
import { DataAggregator } from './data-aggregator';
import { FileManager } from './file-manager';

const logger = createChildLogger('Scheduler');

export class Scheduler {
  private dataAggregator: DataAggregator;
  private fileManager: FileManager;
  private cronJob: cron.ScheduledTask | null = null;
  private nextRunTime: Date | null = null;

  constructor() {
    this.dataAggregator = new DataAggregator();
    this.fileManager = new FileManager();
  }

  start(): void {
    logger.info(`Starting scheduler with cron schedule: ${config.cronSchedule}`);
    
    this.cronJob = cron.schedule(config.cronSchedule, async () => {
      await this.runDataAggregation();
      this.updateNextRunTime();
    }, {
      scheduled: true,
      timezone: 'UTC',
    });

    // Calculate initial next run time
    this.updateNextRunTime();
    
    logger.info('Scheduler started successfully');
  }

  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      this.nextRunTime = null;
      logger.info('Scheduler stopped');
    }
  }

  async runDataAggregation(): Promise<void> {
    logger.info('Starting scheduled data aggregation');
    const startTime = Date.now();

    try {
      // Aggregate data from all sources
      const aggregatedData = await this.dataAggregator.aggregateData();
      
      // Write data to files
      await this.fileManager.writeAggregatedData(aggregatedData);
      
      // Cleanup old files
      await this.fileManager.cleanupOldFiles();
      
      const processingTime = Date.now() - startTime;
      logger.info(`Scheduled data aggregation completed successfully in ${processingTime}ms`);
    } catch (error) {
      logger.error('Scheduled data aggregation failed:', error);
      
      // Try to read existing data as fallback
      try {
        const existingData = await this.fileManager.readAggregatedData();
        if (existingData) {
          logger.info('Using existing data as fallback');
        }
      } catch (fallbackError) {
        logger.error('Fallback to existing data also failed:', fallbackError);
      }
    }
  }

  async runImmediate(): Promise<void> {
    logger.info('Running immediate data aggregation');
    await this.runDataAggregation();
  }

  getNextRunTime(): Date | null {
    return this.nextRunTime;
  }

  isRunning(): boolean {
    return this.cronJob !== null;
  }

  private updateNextRunTime(): void {
    // Simple calculation for daily at 6 AM UTC
    const now = new Date();
    const nextRun = new Date(now);
    
    // Set to 6 AM UTC
    nextRun.setUTCHours(6, 0, 0, 0);
    
    // If it's already past 6 AM today, set to tomorrow
    if (nextRun <= now) {
      nextRun.setUTCDate(nextRun.getUTCDate() + 1);
    }
    
    this.nextRunTime = nextRun;
  }
} 