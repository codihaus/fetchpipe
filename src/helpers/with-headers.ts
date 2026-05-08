import type { Command } from '../types/command.js';

export function withHeaders<Output>(command: Command<Output>, headers: Record<string, string>): Command<Output> {
	return () => {
		const options = command();

		options.headers = {
			...options.headers,
			...headers,
		};

		return options;
	};
}
