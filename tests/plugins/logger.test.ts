import { describe, it, expect, vi } from 'vitest';
import { createClient } from '../../src/client.js';
import { rest } from '../../src/plugins/rest.js';
import { logger } from '../../src/plugins/logger.js';

function mockFetch(data: any, status = 200) {
	return vi.fn().mockResolvedValue(
		new Response(JSON.stringify(data), {
			status,
			headers: { 'Content-Type': 'application/json' },
		}),
	);
}

describe('logger()', () => {
	it('throws if composed without rest()', () => {
		expect(() => {
			createClient('https://api.test.com').with(logger());
		}).toThrow('logger() must be composed after rest()');
	});

	it('logs request and response', async () => {
		const mockLogger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
		const fetch = mockFetch({ ok: true });

		const client = createClient('https://api.test.com', { globals: { fetch } })
			.with(rest())
			.with(logger({ logger: mockLogger }));

		await client.request(() => ({ path: '/test', method: 'POST' }));

		expect(mockLogger.log).toHaveBeenCalledTimes(2);
		expect(mockLogger.log.mock.calls[0]![0]).toContain('[request]');
		expect(mockLogger.log.mock.calls[0]![0]).toContain('POST');
		expect(mockLogger.log.mock.calls[1]![0]).toContain('[response]');
	});

	it('logs errors', async () => {
		const mockLogger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
		const fetch = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ errors: [{ message: 'fail' }] }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' },
			}),
		);

		const client = createClient('https://api.test.com', { globals: { fetch } })
			.with(rest())
			.with(logger({ logger: mockLogger }));

		await expect(
			client.request(() => ({ path: '/fail', method: 'GET' })),
		).rejects.toThrow();

		expect(mockLogger.log).toHaveBeenCalledTimes(1);
		expect(mockLogger.error).toHaveBeenCalledTimes(1);
		expect(mockLogger.error.mock.calls[0]![0]).toContain('[error]');
	});

	it('respects logRequest: false', async () => {
		const mockLogger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
		const fetch = mockFetch({ ok: true });

		const client = createClient('https://api.test.com', { globals: { fetch } })
			.with(rest())
			.with(logger({ logger: mockLogger, logRequest: false }));

		await client.request(() => ({ path: '/test', method: 'GET' }));

		expect(mockLogger.log).toHaveBeenCalledTimes(1);
		expect(mockLogger.log.mock.calls[0]![0]).toContain('[response]');
	});
});
