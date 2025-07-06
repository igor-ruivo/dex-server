import fs from 'fs/promises';
import path from 'path';
import { createChildLogger } from '../utils/logger';
import { config } from '../config';
import { AggregatedData } from '../types';

const logger = createChildLogger('FileManager');

export class FileManager {
  private outputDir: string;

  constructor(outputDir: string = config.outputDir) {
    this.outputDir = outputDir;
  }

  async ensureOutputDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
      logger.debug(`Output directory ensured: ${this.outputDir}`);
    } catch (error) {
      logger.error('Failed to ensure output directory:', error);
      throw error;
    }
  }

  async writeAggregatedData(data: AggregatedData): Promise<void> {
    try {
      await this.ensureOutputDirectory();
      
      // Write main aggregated data file
      const mainDataPath = path.join(this.outputDir, 'aggregated-data.json');
      await fs.writeFile(mainDataPath, JSON.stringify(data, null, 2));
      logger.info(`Main aggregated data written to: ${mainDataPath}`);

      // Write individual data files for easier consumption
      await this.writeIndividualDataFiles(data);
      
      // Write metadata file
      await this.writeMetadata(data.metadata);
      
      logger.info('All data files written successfully');
    } catch (error) {
      logger.error('Failed to write aggregated data:', error);
      throw error;
    }
  }

  private async writeIndividualDataFiles(data: AggregatedData): Promise<void> {
    const files = [
      {
        name: 'events.json',
        data: data.events,
      },
      {
        name: 'raid-bosses.json',
        data: data.raidBosses,
      },
      {
        name: 'team-rocket.json',
        data: data.teamRocket,
      },
      {
        name: 'game-master.json',
        data: data.gameMaster,
      },
    ];

    for (const file of files) {
      const filePath = path.join(this.outputDir, file.name);
      await fs.writeFile(filePath, JSON.stringify(file.data, null, 2));
      logger.debug(`Individual data file written: ${filePath}`);
    }
  }

  private async writeMetadata(metadata: AggregatedData['metadata']): Promise<void> {
    const metadataPath = path.join(this.outputDir, 'metadata.json');
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    logger.debug(`Metadata written to: ${metadataPath}`);
  }

  async readAggregatedData(): Promise<AggregatedData | null> {
    try {
      const mainDataPath = path.join(this.outputDir, 'aggregated-data.json');
      
      try {
        await fs.access(mainDataPath);
      } catch {
        logger.warn('No existing aggregated data found');
        return null;
      }

      const data = JSON.parse(await fs.readFile(mainDataPath, 'utf-8'));
      logger.debug('Successfully read existing aggregated data');
      return data;
    } catch (error) {
      logger.error('Failed to read aggregated data:', error);
      return null;
    }
  }

  async getDataFileInfo(): Promise<{ [key: string]: { size: number; lastModified: Date } }> {
    try {
      const files = await fs.readdir(this.outputDir);
      const fileInfo: { [key: string]: { size: number; lastModified: Date } } = {};

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.outputDir, file);
          const stats = await fs.stat(filePath);
          
          fileInfo[file] = {
            size: stats.size,
            lastModified: stats.mtime,
          };
        }
      }

      return fileInfo;
    } catch (error) {
      logger.error('Failed to get file info:', error);
      return {};
    }
  }

  async cleanupOldFiles(maxAgeHours: number = 24): Promise<void> {
    try {
      const files = await fs.readdir(this.outputDir);
      const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.outputDir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime.getTime() < cutoffTime) {
            await fs.unlink(filePath);
            logger.debug(`Cleaned up old file: ${file}`);
          }
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup old files:', error);
    }
  }
} 