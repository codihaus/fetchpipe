import { describe, it, expect, vi, afterEach } from 'vitest';
import { createClient } from '../src/client.js';

describe('createClient', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('creates a client with url and globals', () => {
		const client = createClient('https://api.example.com');

		expect(client.url.toString()).toBe('https://api.example.com/');
		expect(typeof client.globals.fetch).toBe('function');
		expect(client.globals.URL).toBe(globalThis.URL);
		expect(client.globals.logger).toBe(globalThis.console);
	});

	it('resolves the default fetch lazily — honors a globalThis.fetch stubbed after creation', async () => {
		const client = createClient('https://api.example.com');

		const stub = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
		vi.stubGlobal('fetch', stub);

		await client.globals.fetch('https://api.example.com/x', { method: 'GET' });

		expect(stub).toHaveBeenCalledOnce();
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
