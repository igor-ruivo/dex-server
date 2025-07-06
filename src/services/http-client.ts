import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { createChildLogger } from '../utils/logger';
import { config } from '../config';

const logger = createChildLogger('HttpClient');

export class HttpClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      timeout: config.timeout,
      headers: {
        'User-Agent': 'Pokemon-GO-Dex-Server/1.0.0',
        'Accept': 'application/json, text/html, */*',
      },
    });

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug(`Making request to: ${config.url}`);
        return config;
      },
      (error) => {
        logger.error('Request error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.debug(`Response received from: ${response.config.url} (${response.status})`);
        return response;
      },
      (error) => {
        logger.error(`Response error from ${error.config?.url}:`, error.message);
        return Promise.reject(error);
      }
    );
  }

  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.client.get(url, config);
      return response.data;
    } catch (error) {
      logger.error(`Failed to fetch ${url}:`, error);
      throw error;
    }
  }

  async getWithRetry<T = any>(
    url: string,
    maxRetries: number = config.maxRetries,
    requestConfig?: AxiosRequestConfig
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.debug(`Attempt ${attempt}/${maxRetries} for ${url}`);
        return await this.get<T>(url, requestConfig);
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
    throw lastError!;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const httpClient = new HttpClient(); 