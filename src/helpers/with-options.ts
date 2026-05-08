import type { Command, RequestTransformer } from '../types/command.js';

export function withOptions<Output>(
	command: Command<Output>,
	extraOptions: RequestTransformer | Partial<RequestInit>,
): Command<Output> {
	return () => {
		const options = command();

		if (typeof extraOptions === 'function') {
			options.onRequest = extraOptions;
		} else {
			options.onRequest = (init) => ({
				...init,
				...extraOptions,
			});
		}

		return options;
	};
}
