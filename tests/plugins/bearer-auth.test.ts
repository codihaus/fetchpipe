import { describe, it, expect } from 'vitest';
import { createClient } from '../../src/client.js';
import { bearerAuth } from '../../src/plugins/bearer-auth.js';

describe('bearerAuth()', () => {
	it('returns static token', async () => {
		const client = createClient('https://api.test.com').with(bearerAuth('my-token'));

		expect(await client.getToken()).toBe('my-token');
	});

	it('allows setting a new token', async () => {
		const client = createClient('https://api.test.com').with(bearerAuth('initial'));

		client.setToken('updated');
		expect(await client.getToken()).toBe('updated');
	});

	it('accepts a getter function', async () => {
		let count = 0;
		const client = createClient('https://api.test.com')
			.with(bearerAuth(() => `token-${++count}`));

		expect(await client.getToken()).toBe('token-1');
		expect(await client.getToken()).toBe('token-2');
	});

	it('accepts an async getter function', async () => {
		const client = createClient('https://api.test.com')
			.with(bearerAuth(async () => 'async-token'));

		expect(await client.getToken()).toBe('async-token');
	});

	it('getter can return null', async () => {
		const client = createClient('https://api.test.com')
			.with(bearerAuth(() => null));

		expect(await client.getToken()).toBeNull();
	});
});
