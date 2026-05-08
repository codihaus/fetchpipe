import { describe, it, expect } from 'vitest';
import { createClient } from '../src/client.js';

describe('createClient', () => {
	it('creates a client with url and globals', () => {
		const client = createClient('https://api.example.com');

		expect(client.url.toString()).toBe('https://api.example.com/');
		expect(client.globals.fetch).toBe(globalThis.fetch);
		expect(client.globals.URL).toBe(globalThis.URL);
		expect(client.globals.logger).toBe(globalThis.console);
	});

	it('accepts custom globals', () => {
		const customFetch = async () => new Response();
		const client = createClient('https://api.example.com', {
			globals: { fetch: customFetch },
		});

		expect(client.globals.fetch).toBe(customFetch);
		expect(client.globals.URL).toBe(globalThis.URL);
	});

	it('.with() merges plugin extensions onto client', () => {
		const client = createClient('https://api.example.com')
			.with((_client) => ({
				hello() {
					return 'world';
				},
			}));

		expect(client.hello()).toBe('world');
		expect(client.url.toString()).toBe('https://api.example.com/');
	});

	it('.with() chains multiple plugins', () => {
		const client = createClient('https://api.example.com')
			.with(() => ({ a: 1 }))
			.with(() => ({ b: 2 }));

		expect(client.a).toBe(1);
		expect(client.b).toBe(2);
	});

	it('preserves base url with path', () => {
		const client = createClient('https://api.example.com/v2');
		expect(client.url.pathname).toBe('/v2');
	});
});
