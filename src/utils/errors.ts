export interface ApiErrorDetail {
	message: string;
	extensions?: Record<string, any>;
}

export interface ApiErrorData {
	message: string;
	status?: number;
	code?: string;
	errors?: ApiErrorDetail[];
	response?: Response;
}

export class ApiError extends Error {
	status?: number;
	code?: string;
	errors?: ApiErrorDetail[];
	response?: Response;

	constructor(data: ApiErrorData) {
		super(data.message);
		this.name = 'ApiError';
		this.status = data.status;
		this.code = data.code;
		this.errors = data.errors;
		this.response = data.response;
	}
}

export function isApiError(err: unknown): err is ApiError {
	return err instanceof ApiError;
}
