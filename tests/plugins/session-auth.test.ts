import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createClient } from '../../src/client.js';
import { sessionAuth, memoryStorage } from '../../src/plugins/session-auth.js';

function mockFetch(responses: Record<string, any>) {
	return vi.fn().mockImplementation(async (url: string) => {
		for (const [pattern, data] of Object.entries(responses)) {
			if (url.includes(pattern)) {
				return new Response(JSON.stringify({ data }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				});
			}
		}

		return new Response('Not Found', { status: 404 });
	});
}

describe('sessionAuth()', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('adds auth methods to client', () => {
		const client = createClient('https://api.test.com').with(sessionAuth());

		expect(typeof client.login).toBe('function');
		expect(typeof client.logout).toBe('function');
		expect(typeof client.refresh).toBe('function');
		expect(typeof client.getToken).toBe('function');
		expect(typeof client.setToken).toBe('function');
		expect(typeof client.stopRefreshing).toBe('function');
	});

	it('login stores token and returns auth data', async () => {
		const authData = {
			access_token: 'abc123',
			refresh_token: 'ref456',
			expires: 900000,
			expires_at: null,
		};

		const fetch = mockFetch({ '/auth/login': authData });
		const client = createClient('https://api.test.com', { globals: { fetch } })
			.with(sessionAuth({ autoRefresh: false }));

		const result = await client.login({ email: 'test@test.com', password: 'pass' });

		expect(result.access_token).toBe('abc123');
		expect(result.refresh_token).toBe('ref456');
		expect(await client.getToken()).toBe('abc123');
	});

	it('login sends payload to correct path', async () => {
		const fetch = mockFetch({
			'/custom/login': {
				access_token: 'token',
				refresh_token: null,
				expires: 3600000,
				expires_at: null,
			},
		});

		const client = createClient('https://api.test.com', { globals: { fetch } })
			.with(sessionAuth({ loginPath: '/custom/login', autoRefresh: false }));

		await client.login({ username: 'admin', password: 'secret' });

		const [url, init] = fetch.mock.calls[0]!;
		expect(url).toContain('/custom/login');
		expect(JSON.parse(init.body as string)).toEqual({ username: 'admin', password: 'secret' });
	});

	it('setToken sets token directly', async () => {
		const client = createClient('https://api.test.com').with(sessionAuth());

		await client.setToken('direct-token');
		expect(await client.getToken()).toBe('direct-token');
	});

	it('memoryStorage works independently', async () => {
		const storage = memoryStorage();

		expect(await storage.get()).toBeNull();

		await storage.set({
			access_token: 'test',
			refresh_token: null,
			expires: null,
			expires_at: null,
		});

		const data = await storage.get();
		expect(data?.access_token).toBe('test');

		await storage.set(null);
		expect(await storage.get()).toBeNull();
	});
});
