import { ProcessingResult } from '../types';

export interface IParser {
  parse(rawData: unknown): Promise<ProcessingResult>;
  validate(data: unknown): boolean;
}

export abstract class BaseParser implements IParser {
  protected abstract parseData(rawData: unknown): Promise<unknown>;
  protected abstract validateData(data: unknown): boolean;

  async parse(rawData: unknown): Promise<ProcessingResult> {
    const startTime = Date.now();
    
    try {
      const parsedData = await this.parseData(rawData);
      
      if (!this.validateData(parsedData)) {
        throw new Error('Parsed data validation failed');
      }

      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        data: parsedData,
        source: this.constructor.name,
        timestamp: new Date().toISOString(),
        processingTime,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown parsing error',
        source: this.constructor.name,
        timestamp: new Date().toISOString(),
        processingTime,
      };
    }
  }

  validate(data: unknown): boolean {
    return this.validateData(data);
  }
} 