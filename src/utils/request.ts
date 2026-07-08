import type { FetchInterface } from '../types/client.js';
import { ApiError, type ApiErrorData } from './errors.js';
import { type ResponseExtractor, extractJson, extractWrapped, isFetchResponse } from './response.js';

export type ExtractResponseOption = 'json' | 'raw' | `wrapped:${string}` | ResponseExtractor;

/**
 * Turns a non-2xx `Response` (and the value its extractor threw) into the
 * `ApiErrorData` used to build the thrown `ApiError`. Override via
 * `rest({ extractError })` to keep provider-specific error bodies faithful.
 */
export type ErrorExtractor = (response: Response, body: unknown) => ApiErrorData | Promise<ApiErrorData>;

const MAX_BODY_SNIPPET = 2048;

function bodySnippet(value: unknown): string | undefined {
	if (value == null) return undefined;

	let text: string;
	if (typeof value === 'string') {
		text = value;
	} else {
		try {
			text = JSON.stringify(value);
		} catch {
			text = String(value);
		}
	}

	if (!text) return undefined;
	return text.length > MAX_BODY_SNIPPET ? text.slice(0, MAX_BODY_SNIPPET) : text;
}

export const defaultExtractError: ErrorExtractor = (response, body) => {
	const data: ApiErrorData = {
		message: '',
		code: 'HTTP_ERROR',
		status: isFetchResponse(response) ? response.status : undefined,
		response: isFetchResponse(response) ? response : undefined,
		body: bodySnippet(body),
	};

	if (body && typeof body === 'object') {
		const record = body as any;

		if (Array.isArray(record.errors)) {
			data.errors = record.errors;
		}

		if (typeof record.message === 'string') {
			data.message = record.message;
		} else if (record.error && typeof record.error.message === 'string') {
			data.message = record.error.message;
		}
	} else if (typeof body === 'string' && body) {
		data.message = body;
	}

	if (!data.message && data.errors?.[0]?.message) {
		data.message = data.errors[0].message;
	}

	if (!data.message) {
		const statusText = isFetchResponse(response) ? response.statusText : '';
		data.message = statusText || `Request failed with status ${data.status ?? 'unknown'}`;
	}

	return data;
};

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
	extractError: ErrorExtractor = defaultExtractError,
): Promise<Output> {
	let response: Response;

	try {
		response = (await fetcher(url, options)) as Response;
	} catch (err) {
		const aborted = err instanceof Error && err.name === 'AbortError';

		throw new ApiError({
			message: err instanceof Error ? err.message : 'Network request failed',
			code: aborted ? 'ABORTED' : 'NETWORK_ERROR',
		});
	}

	try {
		return (await extractor(response)) as Output;
	} catch (reason) {
		if (reason instanceof ApiError) throw reason;

		if (isFetchResponse(response) && !response.ok) {
			throw new ApiError(await extractError(response, reason));
		}

		// Response was 2xx but the extractor failed — malformed body.
		throw new ApiError({
			message: reason instanceof Error ? reason.message : 'Failed to parse response',
			code: 'PARSE_ERROR',
			status: isFetchResponse(response) ? response.status : undefined,
			response: isFetchResponse(response) ? response : undefined,
			body: bodySnippet(reason),
		});
	}
}
