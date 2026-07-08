export interface ApiErrorDetail {
	message: string;
	extensions?: Record<string, any>;
}

/**
 * Stable error taxonomy emitted by fetchpipe core. Part of the public
 * (semver-relevant) contract — consumers may switch on these in `retryOn`
 * or when mapping errors into their own domain errors.
 *
 * | code            | meaning                                             |
 * |-----------------|-----------------------------------------------------|
 * | `HTTP_ERROR`    | non-2xx response with `status` set                  |
 * | `NETWORK_ERROR` | fetch rejected (DNS, connection reset, TLS...)      |
 * | `TIMEOUT`       | aborted by the `timeout()` plugin                   |
 * | `ABORTED`       | aborted by a caller-supplied signal                 |
 * | `PARSE_ERROR`   | extractor failed on a 2xx body (invalid JSON etc.)  |
 */
export type ApiErrorCode = 'HTTP_ERROR' | 'NETWORK_ERROR' | 'TIMEOUT' | 'ABORTED' | 'PARSE_ERROR';

export interface ApiErrorData {
	message: string;
	status?: number;
	// Allow the documented codes with autocomplete, but do not forbid custom codes.
	code?: ApiErrorCode | (string & {});
	errors?: ApiErrorDetail[];
	response?: Response;
	/** Bounded snippet of the raw response body, preserved for diagnostics. */
	body?: string;
}

export class ApiError extends Error {
	status?: number;
	code?: ApiErrorCode | (string & {});
	errors?: ApiErrorDetail[];
	response?: Response;
	body?: string;

	constructor(data: ApiErrorData) {
		super(data.message);
		this.name = 'ApiError';
		this.status = data.status;
		this.code = data.code;
		this.errors = data.errors;
		this.response = data.response;
		this.body = data.body;
	}
}

export function isApiError(err: unknown): err is ApiError {
	return err instanceof ApiError;
}
