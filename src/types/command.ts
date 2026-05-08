export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export interface RequestOptions {
	path: string;
	method?: HttpMethod;
	params?: Record<string, any>;
	headers?: Record<string, string>;
	body?: BodyInit | null;
	onRequest?: RequestTransformer;
	onResponse?: ResponseTransformer;
}

export type RequestTransformer = (init: RequestInit) => RequestInit | Promise<RequestInit>;
export type ResponseTransformer<Output = any> = (data: any, init: RequestInit) => Output | Promise<Output>;

export interface Command<_Output = unknown> {
	(): RequestOptions;
}
