import { createChildLogger } from '../utils/logger';
import { config } from '../config';

const logger = createChildLogger('HttpClient');

export class HttpClient {
  async get<T = unknown>(url: string, options?: RequestInit): Promise<T> {
    try {
      logger.debug(`Making request to: ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Pokemon-GO-Dex-Server/1.0.0',
          'Accept': 'application/json, text/html, */*',
          ...options?.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      logger.debug(`Response received from: ${url} (${response.status})`);
      
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return await response.json();
      } else {
        return await response.text() as T;
      }
    } catch (error) {
      logger.error(`Failed to fetch ${url}:`, error);
      throw error;
    }
  }

  async getWithRetry<T = unknown>(
    url: string,
    maxRetries: number = config.maxRetries,
    options?: RequestInit
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.debug(`Attempt ${attempt}/${maxRetries} for ${url}`);
        return await this.get<T>(url, options);
      } catch (error) {
        lastError = error as Error;
        logger.warn(`Attempt ${attempt} failed for ${url}:`, error);
        
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Exponential backoff
          await this.sleep(delay);
        }
      }
    }

    logger.error(`All ${maxRetries} attempts failed for ${url}`);
    throw lastError || new Error('Unknown error occurred');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const httpClient = new HttpClient(); 