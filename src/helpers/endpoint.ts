import type { RequestOptions, Command } from '../types/command.js';

export function endpoint<Output = unknown>(options: RequestOptions): Command<Output> {
	return () => options;
}
