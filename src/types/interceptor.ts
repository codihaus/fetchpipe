export type RequestInterceptor = (init: RequestInit) => RequestInit | Promise<RequestInit>;
export type ResponseInterceptor<T = any> = (data: T, init: RequestInit) => T | Promise<T>;
