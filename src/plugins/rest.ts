import type { ApiClient } from '../types/client.js';
import type { Command } from '../types/command.js';
import type { RequestInterceptor, ResponseInterceptor } from '../types/interceptor.js';
import { buildUrl } from '../utils/url.js';
import { request, resolveExtractor, type ExtractResponseOption, type ErrorExtractor } from '../utils/request.js';

export interface RestConfig {
	credentials?: RequestCredentials;
	onRequest?: RequestInterceptor;
	onResponse?: ResponseInterceptor;
	extractResponse?: ExtractResponseOption;
	/** Build the thrown `ApiError` from a non-2xx response — keeps provider error bodies faithful. */
	extractError?: ErrorExtractor;
}

export interface RestClient<_Schema> {
	request<Output = any>(command: Command<Output>): Promise<Output>;
}

export const rest = (config: Partial<RestConfig> = {}) => {
	return <Schema>(client: ApiClient<Schema>): RestClient<Schema> => {
		const extractor = resolveExtractor(config.extractResponse);

		return {
			async request<Output = any>(this: any, command: Command<Output>): Promise<Awaited<Output>> {
				const options = command();

				if (!options.headers) {
					options.headers = {};
				}

				if (!('Content-Type' in options.headers)) {
					options.headers['Content-Type'] = 'application/json';
				} else if (options.headers['Content-Type'] === 'multipart/form-data') {
					delete options.headers['Content-Type'];
				}

				if ('getToken' in this && !('Authorization' in options.headers)) {
					const token = await (this as any).getToken();

					if (token) {
						options.headers['Authorization'] = `Bearer ${token}`;
					}
				}

				const requestUrl = buildUrl(client.url, options.path, options.params);

				let fetchOptions: RequestInit = {
					method: options.method ?? 'GET',
					headers: options.headers ?? {},
				};

				if ('credentials' in config && config.credentials) {
					fetchOptions.credentials = config.credentials;
				}

				if (options.body) {
					fetchOptions.body = options.body;
				}

				if (options.signal) {
					fetchOptions.signal = options.signal;
				}

				if (options.onRequest) {
					fetchOptions = await options.onRequest(fetchOptions);
				}

				if (config.onRequest) {
					fetchOptions = await config.onRequest(fetchOptions);
				}

				let result = await request<Output>(
					requestUrl.toString(),
					fetchOptions,
					client.globals.fetch,
					extractor,
					config.extractError,
				);

				if (options.onResponse) {
					result = await options.onResponse(result, fetchOptions);
				}

				if (config.onResponse) {
					result = await config.onResponse(result, fetchOptions) as Awaited<Output>;
				}

				return result;
			},
		};
	};
};
