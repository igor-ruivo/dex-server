import { ProcessingResult } from '../types';

export interface IParser {
  parse(rawData: any): Promise<ProcessingResult>;
  validate(data: any): boolean;
}

export abstract class BaseParser implements IParser {
  protected abstract parseData(rawData: any): Promise<any>;
  protected abstract validateData(data: any): boolean;

  async parse(rawData: any): Promise<ProcessingResult> {
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

  validate(data: any): boolean {
    return this.validateData(data);
  }
} 