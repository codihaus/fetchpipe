import { describe, it, expect, vi, afterEach } from 'vitest';
import { createClient } from '../../src/client.js';
import { rest } from '../../src/plugins/rest.js';
import { timeout } from '../../src/plugins/timeout.js';
import { retry } from '../../src/plugins/retry.js';
import { isApiError } from '../../src/utils/errors.js';

function jsonResponse(data: any, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

/** A fetch that resolves only when its signal aborts (rejects with AbortError) or after `delay` ms. */
function slowFetch(delay: number, data: any = { ok: true }) {
	return vi.fn().mockImplementation((_url: string, init: RequestInit) => {
		return new Promise<Response>((resolve, reject) => {
			const timer = setTimeout(() => resolve(jsonResponse(data)), delay);
			init.signal?.addEventListener('abort', () => {
				clearTimeout(timer);
				const err = new Error('The operation was aborted');
				err.name = 'AbortError';
				reject(err);
			});
		});
	});
}

describe('timeout()', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('throws if composed without rest()', () => {
		expect(() => {
			createClient('https://api.test.com').with(timeout({ ms: 100 }));
		}).toThrow('timeout() must be composed after rest()');
	});

	it('fires with a TIMEOUT code when the request exceeds ms', async () => {
		vi.useFakeTimers();
		const fetch = slowFetch(5000);

		const client = createClient('https://api.test.com', { globals: { fetch } })
			.with(rest())
			.with(timeout({ ms: 1000 }));

		const promise = client.request(() => ({ path: '/slow', method: 'GET' }));
		const assertion = expect(promise).rejects.toMatchObject({ code: 'TIMEOUT' });

		await vi.advanceTimersByTimeAsync(1000);
		await assertion;
	});

	it('passes through fast responses without aborting', async () => {
		const fetch = slowFetch(0, { id: 1 });

		const client = createClient('https://api.test.com', { globals: { fetch } })
			.with(rest())
			.with(timeout({ ms: 1000 }));

		const result = await client.request(() => ({ path: '/fast', method: 'GET' }));
		expect(result).toEqual({ id: 1 });
	});

	it('creates a fresh controller per attempt — retry after a timeout succeeds', async () => {
		vi.useFakeTimers();
		let call = 0;

		const fetch = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
			call++;
			const isSlow = call === 1;

			return new Promise<Response>((resolve, reject) => {
				const timer = setTimeout(() => resolve(jsonResponse({ ok: true })), isSlow ? 5000 : 0);
				init.signal?.addEventListener('abort', () => {
					clearTimeout(timer);
					const err = new Error('aborted');
					err.name = 'AbortError';
					reject(err);
				});
			});
		});

		const client = createClient('https://api.test.com', { globals: { fetch } })
			.with(rest())
			.with(timeout({ ms: 1000 }))
			.with(retry({
				maxRetries: 2,
				baseDelay: 10,
				retryOn: (e) => isApiError(e) && e.code === 'TIMEOUT',
			}));

		const promise = client.request(() => ({ path: '/flaky', method: 'GET' }));

		await vi.advanceTimersByTimeAsync(1000); // first attempt times out
		await vi.advanceTimersByTimeAsync(10); // backoff, second attempt fires fast
		await vi.runAllTimersAsync();

		expect(await promise).toEqual({ ok: true });
		expect(call).toBe(2);
	});

	it('per-command timeoutMs overrides the default', async () => {
		vi.useFakeTimers();
		const fetch = slowFetch(5000);

		const client = createClient('https://api.test.com', { globals: { fetch } })
			.with(rest())
			.with(timeout({ ms: 10_000 }));

		const promise = client.request(() => ({ path: '/slow', method: 'GET', timeoutMs: 500 }));
		const assertion = expect(promise).rejects.toMatchObject({ code: 'TIMEOUT' });

		await vi.advanceTimersByTimeAsync(500);
		await assertion;
	});

	it('a caller abort surfaces as ABORTED, not TIMEOUT', async () => {
		const fetch = slowFetch(5000);
		const controller = new AbortController();

		const client = createClient('https://api.test.com', { globals: { fetch } })
			.with(rest())
			.with(timeout({ ms: 10_000 }));

		const promise = client.request(() => ({ path: '/slow', method: 'GET', signal: controller.signal }));
		controller.abort();

		await expect(promise).rejects.toMatchObject({ code: 'ABORTED' });
	});
});
