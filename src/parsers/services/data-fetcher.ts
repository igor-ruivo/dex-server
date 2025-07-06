export interface DataFetcher {
  fetch<T>(url: string): Promise<T>;
}

export class HttpDataFetcher implements DataFetcher {
  async fetch<T>(url: string): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
    }
    return response.json() as T;
  }
} 