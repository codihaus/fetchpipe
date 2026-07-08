import type { ApiClient } from '../types/client.js';
import type { Command } from '../types/command.js';
import { ApiError } from '../utils/errors.js';

export interface RetryConfig {
	maxRetries?: number;
	baseDelay?: number;
	maxDelay?: number;
	retryOn?: (error: any, attempt: number) => boolean;
	/** Observability hook fired before each backoff sleep. Fire-and-forget — exceptions are swallowed. */
	onRetry?: (error: any, attempt: number, delayMs: number) => void;
	/** Add randomness to the backoff delay to avoid thundering-herd. `true` = full jitter (0..delay). */
	jitter?: boolean | ((delayMs: number) => number);
	/** Injectable sleep for deterministic tests. Defaults to `setTimeout`. */
	sleep?: (ms: number) => Promise<void>;
}

export interface RetryClient<_Schema> {
	request<Output = any>(command: Command<Output>): Promise<Output>;
}

function defaultRetryOn(error: any): boolean {
	if (error instanceof ApiError) {
		if (error.status && error.status >= 500) return true;
		if (error.code === 'NETWORK_ERROR') return true;
	}

	return false;
}

function defaultSleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export const retry = (config: Partial<RetryConfig> = {}) => {
	const maxRetries = config.maxRetries ?? 3;
	const baseDelay = config.baseDelay ?? 300;
	const maxDelay = config.maxDelay ?? 10000;
	const retryOn = config.retryOn ?? defaultRetryOn;
	const sleep = config.sleep ?? defaultSleep;

	const applyJitter = (delay: number): number => {
		if (config.jitter === true) return Math.random() * delay;
		if (typeof config.jitter === 'function') return config.jitter(delay);
		return delay;
	};

	return <Schema>(client: ApiClient<Schema>): RetryClient<Schema> => {
		const originalRequest = (client as any).request;

		if (typeof originalRequest !== 'function') {
			throw new Error('retry() must be composed after rest(). No .request() method found on client.');
		}

		return {
			async request<Output = any>(command: Command<Output>): Promise<Output> {
				let lastError: any;

				for (let attempt = 0; attempt <= maxRetries; attempt++) {
					try {
						return await originalRequest.call(this, command);
					} catch (error) {
						lastError = error;

						if (attempt < maxRetries && retryOn(error, attempt)) {
							const delay = applyJitter(Math.min(baseDelay * 2 ** attempt, maxDelay));

							if (config.onRetry) {
								try {
									config.onRetry(error, attempt, delay);
								} catch {
									// An observability hook must never break the request path.
								}
							}

							await sleep(delay);
							continue;
						}

						throw error;
					}
				}

				throw lastError;
			},
		};
	};
};
