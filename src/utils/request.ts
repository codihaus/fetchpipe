import type { FetchInterface } from '../types/client.js';
import { ApiError } from './errors.js';
import { type ResponseExtractor, extractJson, extractWrapped, isFetchResponse } from './response.js';

export type ExtractResponseOption = 'json' | 'raw' | `wrapped:${string}` | ResponseExtractor;

export function resolveExtractor(option?: ExtractResponseOption): ResponseExtractor {
	if (!option || option === 'json') return extractJson;

	if (option === 'raw') {
		return async (response) => {
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			return response;
		};
	}

	if (typeof option === 'string' && option.startsWith('wrapped:')) {
		return extractWrapped(option.slice(8));
	}

	return option as ResponseExtractor;
}

export async function request<Output = any>(
	url: string,
	options: RequestInit,
	fetcher: FetchInterface,
	extractor: ResponseExtractor,
): Promise<Output> {
	let response: Response;

	try {
		response = (await fetcher(url, options)) as Response;
	} catch (err) {
		throw new ApiError({
			message: err instanceof Error ? err.message : 'Network request failed',
			code: 'NETWORK_ERROR',
		});
	}

	try {
		return (await extractor(response)) as Output;
	} catch (reason) {
		if (reason instanceof ApiError) throw reason;

		const result: { message: string; errors?: any[]; status?: number; response?: Response } = {
			message: '',
			status: isFetchResponse(response) ? response.status : undefined,
			response: isFetchResponse(response) ? response : undefined,
		};

		if (reason && typeof reason === 'object') {
			if ('errors' in reason && Array.isArray((reason as any).errors)) {
				result.errors = (reason as any).errors;
			}

			if ('message' in reason) {
				result.message = String((reason as any).message);
			}
		}

		if (!result.message && result.errors?.[0]?.message) {
			result.message = result.errors[0].message;
		}

		if (!result.message) {
			result.message = `Request failed with status ${result.status ?? 'unknown'}`;
		}

		throw new ApiError(result);
	}
}
