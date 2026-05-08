import { describe, it, expect, vi } from 'vitest';
import { createClient } from '../../src/client.js';
import { rest } from '../../src/plugins/rest.js';
import { withHeaders } from '../../src/helpers/with-headers.js';
import { withToken } from '../../src/helpers/with-token.js';
import { withOptions } from '../../src/helpers/with-options.js';
import { endpoint } from '../../src/helpers/endpoint.js';
import type { Command } from '../../src/types/command.js';

function mockFetch(data: any = { ok: true }) {
	return vi.fn().mockResolvedValue(
		new Response(JSON.stringify(data), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		}),
	);
}

describe('command decorators', () => {
	const baseCommand: Command<{ ok: boolean }> = () => ({
		path: '/test',
		method: 'GET',
	});

	describe('withHeaders()', () => {
		it('adds headers to a command', async () => {
			const fetch = mockFetch();
			const client = createClient('https://api.test.com', { globals: { fetch } }).with(rest());

			const decorated = withHeaders(baseCommand, {
				'Accept-Language': 'vi-VN',
				'X-Custom': 'value',
			});

			await client.request(decorated);

			const [, init] = fetch.mock.calls[0]!;
			expect(init.headers?.['Accept-Language']).toBe('vi-VN');
			expect(init.headers?.['X-Custom']).toBe('value');
		});

		it('does not modify original command', () => {
			const decorated = withHeaders(baseCommand, { 'X-New': 'header' });
			const original = baseCommand();
			const modified = decorated();

			expect(original.headers).toBeUndefined();
			expect(modified.headers?.['X-New']).toBe('header');
		});
	});

	describe('withToken()', () => {
		it('adds Authorization header', async () => {
			const fetch = mockFetch();
			const client = createClient('https://api.test.com', { globals: { fetch } }).with(rest());

			const decorated = withToken(baseCommand, 'admin-token');
			await client.request(decorated);

			const [, init] = fetch.mock.calls[0]!;
			expect(init.headers?.['Authorization']).toBe('Bearer admin-token');
		});
	});

	describe('withOptions()', () => {
		it('applies RequestInit transform via function', async () => {
			const fetch = mockFetch();
			const client = createClient('https://api.test.com', { globals: { fetch } }).with(rest());

			const decorated = withOptions(baseCommand, (init) => ({
				...init,
				cache: 'no-store' as RequestCache,
			}));

			await client.request(decorated);

			const [, init] = fetch.mock.calls[0]!;
			expect(init.cache).toBe('no-store');
		});

		it('applies partial RequestInit object', async () => {
			const fetch = mockFetch();
			const client = createClient('https://api.test.com', { globals: { fetch } }).with(rest());

			const decorated = withOptions(baseCommand, { cache: 'no-store' as RequestCache });
			await client.request(decorated);

			const [, init] = fetch.mock.calls[0]!;
			expect(init.cache).toBe('no-store');
		});
	});

	describe('endpoint()', () => {
		it('creates a command from raw options', async () => {
			const fetch = mockFetch({ result: 42 });
			const client = createClient('https://api.test.com', { globals: { fetch } }).with(rest());

			const cmd = endpoint<{ result: number }>({
				path: '/custom',
				method: 'POST',
				body: JSON.stringify({ input: 'data' }),
			});

			const result = await client.request(cmd);
			expect(result).toEqual({ result: 42 });

			const [url, init] = fetch.mock.calls[0]!;
			expect(url).toContain('/custom');
			expect(init.method).toBe('POST');
		});
	});
});
