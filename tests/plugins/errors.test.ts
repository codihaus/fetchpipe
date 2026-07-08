import { describe, it, expect, vi } from 'vitest';
import { createClient } from '../../src/client.js';
import { rest } from '../../src/plugins/rest.js';
import { isApiError } from '../../src/utils/errors.js';

function jsonResponse(data: any, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

describe('error taxonomy', () => {
	it('tags non-2xx responses with HTTP_ERROR and a status', async () => {
		const fetch = vi.fn().mockResolvedValue(jsonResponse({ message: 'Not found' }, 404));
		const client = createClient('https://api.test.com', { globals: { fetch } }).with(rest());

		await expect(client.request(() => ({ path: '/x', method: 'GET' }))).rejects.toMatchObject({
			code: 'HTTP_ERROR',
			status: 404,
			message: 'Not found',
		});
	});

	it('tags fetch rejections with NETWORK_ERROR', async () => {
		const fetch = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
		const client = createClient('https://api.test.com', { globals: { fetch } }).with(rest());

		await expect(client.request(() => ({ path: '/x', method: 'GET' }))).rejects.toMatchObject({
			code: 'NETWORK_ERROR',
		});
	});

	it('tags an AbortError rejection with ABORTED', async () => {
		const fetch = vi.fn().mockImplementation(() => {
			const err = new Error('aborted');
			err.name = 'AbortError';
			return Promise.reject(err);
		});
		const client = createClient('https://api.test.com', { globals: { fetch } }).with(rest());

		await expect(client.request(() => ({ path: '/x', method: 'GET' }))).rejects.toMatchObject({
			code: 'ABORTED',
		});
	});

	it('tags a malformed 2xx body with PARSE_ERROR', async () => {
		const fetch = vi.fn().mockResolvedValue(
			new Response('{ not json', { status: 200, headers: { 'Content-Type': 'application/json' } }),
		);
		const client = createClient('https://api.test.com', { globals: { fetch } }).with(rest());

		await expect(client.request(() => ({ path: '/x', method: 'GET' }))).rejects.toMatchObject({
			code: 'PARSE_ERROR',
		});
	});

	it('preserves a body snippet on HTTP errors', async () => {
		const fetch = vi.fn().mockResolvedValue(jsonResponse({ error: { message: 'Bad key' } }, 401));
		const client = createClient('https://api.test.com', { globals: { fetch } }).with(rest());

		try {
			await client.request(() => ({ path: '/x', method: 'GET' }));
			expect.unreachable();
		} catch (err) {
			expect(isApiError(err)).toBe(true);
			if (isApiError(err)) {
				expect(err.message).toBe('Bad key'); // reads error.message
				expect(err.body).toContain('Bad key');
			}
		}
	});
});

describe('RequestOptions.signal passthrough', () => {
	it('forwards the caller signal into fetch init', async () => {
		const fetch = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
		const client = createClient('https://api.test.com', { globals: { fetch } }).with(rest());
		const controller = new AbortController();

		await client.request(() => ({ path: '/x', method: 'GET', signal: controller.signal }));

		const [, init] = fetch.mock.calls[0]!;
		expect(init.signal).toBe(controller.signal);
	});
});

describe('rest({ extractError })', () => {
	it('uses a custom error extractor for non-2xx responses', async () => {
		const fetch = vi.fn().mockResolvedValue(jsonResponse({ detail: 'nope' }, 422));

		const client = createClient('https://api.test.com', { globals: { fetch } }).with(
			rest({
				extractError: (response, body) => ({
					message: (body as any)?.detail ?? 'unknown',
					status: response.status,
					code: 'HTTP_ERROR',
				}),
			}),
		);

		await expect(client.request(() => ({ path: '/x', method: 'GET' }))).rejects.toMatchObject({
			message: 'nope',
			status: 422,
		});
	});
});
