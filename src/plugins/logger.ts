import type { ApiClient, ConsoleInterface } from '../types/client.js';
import type { Command } from '../types/command.js';

export interface LoggerConfig {
	logRequest?: boolean;
	logResponse?: boolean;
	logErrors?: boolean;
	logger?: ConsoleInterface;
}

export interface LoggerClient<_Schema> {
	request<Output = any>(command: Command<Output>): Promise<Output>;
}

export const logger = (config: Partial<LoggerConfig> = {}) => {
	const logRequest = config.logRequest ?? true;
	const logResponse = config.logResponse ?? true;
	const logErrors = config.logErrors ?? true;

	return <Schema>(client: ApiClient<Schema>): LoggerClient<Schema> => {
		const log = config.logger ?? client.globals.logger;
		const originalRequest = (client as any).request;

		if (typeof originalRequest !== 'function') {
			throw new Error('logger() must be composed after rest(). No .request() method found on client.');
		}

		return {
			async request<Output = any>(command: Command<Output>): Promise<Output> {
				const options = command();
				const commandThunk: Command<Output> = () => options;

				if (logRequest) {
					log.log(`[request] ${options.method ?? 'GET'} ${options.path}`);
				}

				const start = performance.now();

				try {
					const result = await originalRequest.call(this, commandThunk);
					const ms = (performance.now() - start).toFixed(1);

					if (logResponse) {
						log.log(`[response] ${options.method ?? 'GET'} ${options.path} (${ms}ms)`);
					}

					return result as Output;
				} catch (error) {
					const ms = (performance.now() - start).toFixed(1);

					if (logErrors) {
						log.error(`[error] ${options.method ?? 'GET'} ${options.path} (${ms}ms)`, error);
					}

					throw error;
				}
			},
		};
	};
};
