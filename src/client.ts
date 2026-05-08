import type { ClientGlobals, ClientOptions, ApiClient } from './types/client.js';

const defaultGlobals: ClientGlobals = {
	fetch: globalThis.fetch,
	URL: globalThis.URL,
	logger: globalThis.console,
};

export const createClient = <Schema = any>(url: string, options: ClientOptions = {}): ApiClient<Schema> => {
	const globals = options.globals ? { ...defaultGlobals, ...options.globals } : defaultGlobals;

	return {
		globals,
		url: new globals.URL(url),
		with(plugin) {
			return {
				...this,
				...plugin(this),
			};
		},
	};
};
