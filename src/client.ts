import type { ClientGlobals, ClientOptions, ApiClient } from './types/client.js';

export const createClient = <Schema = any>(url: string, options: ClientOptions = {}): ApiClient<Schema> => {
	const injected = options.globals;

	const globals: ClientGlobals = {
		// Resolve lazily per call: a fetch installed after import (polyfill, test
		// stub, instrumented fetch) is honored, and the global receiver is kept so
		// native browser fetch does not throw "Illegal invocation".
		fetch: injected?.fetch ?? ((input, init) => globalThis.fetch(input, init)),
		URL: injected?.URL ?? globalThis.URL,
		logger: injected?.logger ?? globalThis.console,
	};

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
