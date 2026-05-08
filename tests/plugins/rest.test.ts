import { describe, it, expect, vi } from 'vitest';
import { createClient } from '../../src/client.js';
import { rest } from '../../src/plugins/rest.js';
import type { Command } from '../../src/types/command.js';

function mockFetch(data: any, status = 200) {
	return vi.fn().mockResolvedValue(
		new Response(JSON.stringify(data), {
			status,
			headers: { 'Content-Type': 'application/json' },
		}),
	);
}

describe('rest()', () => {
	it('adds .request() method to client', () => {
		const client = createClient('https://api.test.com').with(rest());
		expect(typeof client.request).toBe('function');
	});

	it('executes a GET command', async () => {
		const fetch = mockFetch({ id: 1, name: 'test' });
		const client = createClient('https://api.test.com', { globals: { fetch } }).with(rest());

		const getItem: Command<{ id: number; name: string }> = () => ({
			path: '/items/1',
			method: 'GET',
		});

		const result = await client.request(getItem);

		expect(result).toEqual({ id: 1, name: 'test' });
		expect(fetch).toHaveBeenCalledOnce();

		const [url, init] = fetch.mock.calls[0]!;
		expect(url).toBe('https://api.test.com/items/1');
		expect(init.method).toBe('GET');
		expect(init.headers?.['Content-Type']).toBe('application/json');
	});

	it('executes a POST command with body', async () => {
		const fetch = mockFetch({ id: 2 });
		const client = createClient('https://api.test.com', { globals: { fetch } }).with(rest());

		const createItem: Command<{ id: number }> = () => ({
			path: '/items',
			method: 'POST',
			body: JSON.stringify({ name: 'new' }),
		});

		const result = await client.request(createItem);
		expect(result).toEqual({ id: 2 });

		const [, init] = fetch.mock.calls[0]!;
		expect(init.method).toBe('POST');
		expect(init.body).toBe('{"name":"new"}');
	});

	it('uses extractResponse: wrapped:data', async () => {
		const fetch = mockFetch({ data: [1, 2, 3] });
		const client = createClient('https://api.test.com', { globals: { fetch } })
			.with(rest({ extractResponse: 'wrapped:data' }));

		const result = await client.request(() => ({ path: '/items', method: 'GET' }));
		expect(result).toEqual([1, 2, 3]);
	});

	it('applies query params', async () => {
		const fetch = mockFetch({ items: [] });
		const client = createClient('https://api.test.com', { globals: { fetch } }).with(rest());

		await client.request(() => ({
			path: '/items',
			method: 'GET',
			params: { page: 1, limit: 20 },
		}));

		const [url] = fetch.mock.calls[0]!;
		expect(url).toContain('page=1');
		expect(url).toContain('limit=20');
	});

	it('auto-attaches token from getToken via duck typing', async () => {
		const fetch = mockFetch({ ok: true });
		const client = createClient('https://api.test.com', { globals: { fetch } })
			.with(rest())
			.with(() => ({
				async getToken() {
					return 'my-secret-token';
				},
			}));

		await client.request(() => ({ path: '/secure', method: 'GET' }));

		const [, init] = fetch.mock.calls[0]!;
		expect(init.headers?.['Authorization']).toBe('Bearer my-secret-token');
	});

	it('does not override explicit Authorization header', async () => {
		const fetch = mockFetch({ ok: true });
		const client = createClient('https://api.test.com', { globals: { fetch } })
			.with(rest())
			.with(() => ({
				async getToken() {
					return 'auto-token';
				},
			}));

		await client.request(() => ({
			path: '/secure',
			method: 'GET',
			headers: { Authorization: 'Bearer explicit-token' },
		}));

		const [, init] = fetch.mock.calls[0]!;
		expect(init.headers?.['Authorization']).toBe('Bearer explicit-token');
	});

	it('calls onRequest hook', async () => {
		const fetch = mockFetch({ ok: true });
		const onRequest = vi.fn((init: RequestInit) => ({
			...init,
			headers: { ...init.headers as Record<string, string>, 'X-Custom': 'value' },
		}));

		const client = createClient('https://api.test.com', { globals: { fetch } })
			.with(rest({ onRequest }));

		await client.request(() => ({ path: '/test', method: 'GET' }));

		expect(onRequest).toHaveBeenCalledOnce();
		const [, init] = fetch.mock.calls[0]!;
		expect(init.headers?.['X-Custom']).toBe('value');
	});

	it('removes Content-Type for multipart/form-data', async () => {
		const fetch = mockFetch({ ok: true });
		const client = createClient('https://api.test.com', { globals: { fetch } }).with(rest());

		await client.request(() => ({
			path: '/upload',
			method: 'POST',
			headers: { 'Content-Type': 'multipart/form-data' },
			body: new FormData(),
		}));

		const [, init] = fetch.mock.calls[0]!;
		expect(init.headers?.['Content-Type']).toBeUndefined();
	});

	it('merges base url path with command path', async () => {
		const fetch = mockFetch({ ok: true });
		const client = createClient('https://api.test.com/v2', { globals: { fetch } }).with(rest());

		await client.request(() => ({ path: '/items', method: 'GET' }));

		const [url] = fetch.mock.calls[0]!;
		expect(url).toBe('https://api.test.com/v2/items');
	});
});
