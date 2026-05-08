import { describe, it, expect, vi } from 'vitest';
import { createClient } from '../../src/client.js';
import { rest } from '../../src/plugins/rest.js';
import { retry } from '../../src/plugins/retry.js';
import { ApiError } from '../../src/utils/errors.js';

describe('retry()', () => {
	it('throws if composed without rest()', () => {
		expect(() => {
			createClient('https://api.test.com').with(retry());
		}).toThrow('retry() must be composed after rest()');
	});

	it('retries on 500 errors', async () => {
		let callCount = 0;

		const fetch = vi.fn().mockImplementation(async () => {
			callCount++;

			if (callCount < 3) {
				return new Response(JSON.stringify({ errors: [{ message: 'Server Error' }] }), {
					status: 500,
					headers: { 'Content-Type': 'application/json' },
				});
			}

			return new Response(JSON.stringify({ ok: true }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});
		});

		const client = createClient('https://api.test.com', { globals: { fetch } })
			.with(rest())
			.with(retry({ maxRetries: 3, baseDelay: 10, maxDelay: 50 }));

		const result = await client.request(() => ({ path: '/test', method: 'GET' }));

		expect(result).toEqual({ ok: true });
		expect(callCount).toBe(3);
	});

	it('stops retrying after maxRetries', async () => {
		const fetch = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ errors: [{ message: 'Server Error' }] }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' },
			}),
		);

		const client = createClient('https://api.test.com', { globals: { fetch } })
			.with(rest())
			.with(retry({ maxRetries: 2, baseDelay: 10 }));

		await expect(
			client.request(() => ({ path: '/fail', method: 'GET' })),
		).rejects.toThrow();

		expect(fetch).toHaveBeenCalledTimes(3);
	});

	it('does not retry on 4xx errors by default', async () => {
		const fetch = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ errors: [{ message: 'Not Found' }] }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' },
			}),
		);

		const client = createClient('https://api.test.com', { globals: { fetch } })
			.with(rest())
			.with(retry({ maxRetries: 3, baseDelay: 10 }));

		await expect(
			client.request(() => ({ path: '/missing', method: 'GET' })),
		).rejects.toThrow();

		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it('uses custom retryOn function', async () => {
		let callCount = 0;

		const fetch = vi.fn().mockImplementation(async () => {
			callCount++;

			if (callCount < 2) {
				return new Response(JSON.stringify({ errors: [{ message: 'Rate limited' }] }), {
					status: 429,
					headers: { 'Content-Type': 'application/json' },
				});
			}

			return new Response(JSON.stringify({ ok: true }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});
		});

		const client = createClient('https://api.test.com', { globals: { fetch } })
			.with(rest())
			.with(retry({
				maxRetries: 3,
				baseDelay: 10,
				retryOn: (error) => error instanceof ApiError && error.status === 429,
			}));

		const result = await client.request(() => ({ path: '/limited', method: 'GET' }));
		expect(result).toEqual({ ok: true });
	});

	it('succeeds on first try without retrying', async () => {
		const fetch = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ data: 'ok' }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			}),
		);

		const client = createClient('https://api.test.com', { globals: { fetch } })
			.with(rest())
			.with(retry({ maxRetries: 3 }));

		const result = await client.request(() => ({ path: '/ok', method: 'GET' }));
		expect(result).toEqual({ data: 'ok' });
		expect(fetch).toHaveBeenCalledTimes(1);
	});
});
