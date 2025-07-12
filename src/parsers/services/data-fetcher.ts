export interface IDataFetcher {
	fetchJson<T>(url: string): Promise<T>;
	fetchText(url: string): Promise<string>;
}

export class HttpDataFetcher implements IDataFetcher {
	private headers = {
		'User-Agent':
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
		'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
		'Accept-Language': 'en-US,en;q=0.9',
	};

	fetchJson = async <T>(url: string) => {
		const response = await fetch(url, {
			headers: this.headers,
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
		}

		return response.json() as T;
	};

	fetchText = async (url: string) => {
		const response = await fetch(url, {
			headers: this.headers,
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
		}

		return response.text();
	};
}
