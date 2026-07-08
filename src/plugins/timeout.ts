import type { ApiClient } from '../types/client.js';
import type { Command } from '../types/command.js';
import { ApiError, isApiError } from '../utils/errors.js';
import { anySignal } from '../utils/signal.js';

export interface TimeoutConfig {
	/** Default timeout in ms applied to every request. Per-command `timeoutMs` overrides it. */
	ms?: number;
}

export interface TimeoutClient<_Schema> {
	request<Output = any>(command: Command<Output>): Promise<Output>;
}

/**
 * Bounds each request in time by aborting via a fresh `AbortController` per
 * attempt. Compose after `rest()` and — for timeout-per-attempt semantics —
 * before `retry()`: `rest() → timeout() → retry()`.
 *
 * On timeout, throws `ApiError` with `code: 'TIMEOUT'`. A caller-supplied
 * `RequestOptions.signal` is combined with the timeout signal (first to fire
 * wins); a caller abort surfaces as `code: 'ABORTED'`.
 */
export const timeout = (config: Partial<TimeoutConfig> = {}) => {
	const defaultMs = config.ms;

	return <Schema>(client: ApiClient<Schema>): TimeoutClient<Schema> => {
		const originalRequest = (client as any).request;

		if (typeof originalRequest !== 'function') {
			throw new Error('timeout() must be composed after rest(). No .request() method found on client.');
		}

		return {
			async request<Output = any>(command: Command<Output>): Promise<Output> {
				const options = command();
				const ms = options.timeoutMs ?? defaultMs;

				if (!ms || ms <= 0) {
					return originalRequest.call(this, command);
				}

				const controller = new AbortController();
				const timer = setTimeout(() => controller.abort(), ms);
				const signal = anySignal([options.signal, controller.signal]);
				const timedCommand: Command<Output> = () => ({ ...options, signal });

				try {
					return await originalRequest.call(this, timedCommand);
				} catch (error) {
					// Only our controller firing counts as a timeout; a caller abort stays ABORTED.
					if (controller.signal.aborted && isApiError(error) && error.code === 'ABORTED') {
						throw new ApiError({
							message: `Request timed out after ${ms}ms`,
							code: 'TIMEOUT',
						});
					}

					throw error;
				} finally {
					clearTimeout(timer);
				}
			},
		};
	};
};
