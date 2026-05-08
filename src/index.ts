export { createClient } from './client.js';

export { rest, bearerAuth, sessionAuth, memoryStorage, retry, logger } from './plugins/index.js';
export type {
	RestConfig,
	RestClient,
	BearerAuthClient,
	TokenGetter,
	SessionAuthConfig,
	SessionAuthClient,
	AuthData,
	AuthStorage,
	RetryConfig,
	RetryClient,
	LoggerConfig,
	LoggerClient,
} from './plugins/index.js';

export { withHeaders, withToken, withOptions, endpoint } from './helpers/index.js';

export { ApiError, isApiError } from './utils/errors.js';
export type { ApiErrorData, ApiErrorDetail } from './utils/errors.js';
export { extractJson, extractWrapped, extractRaw } from './utils/response.js';
export type { ResponseExtractor } from './utils/response.js';
export type { ExtractResponseOption } from './utils/request.js';

export type {
	ApiClient,
	ClientGlobals,
	ClientOptions,
	FetchInterface,
	ConsoleInterface,
	Command,
	RequestOptions,
	HttpMethod,
	RequestTransformer,
	ResponseTransformer,
	RequestInterceptor,
	ResponseInterceptor,
	Plugin,
} from './types/index.js';
