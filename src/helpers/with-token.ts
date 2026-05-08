import type { Command } from '../types/command.js';

export function withToken<Output>(command: Command<Output>, token: string): Command<Output> {
	return () => {
		const options = command();

		if (token) {
			if (!options.headers) options.headers = {};
			options.headers['Authorization'] = `Bearer ${token}`;
		}

		return options;
	};
}
