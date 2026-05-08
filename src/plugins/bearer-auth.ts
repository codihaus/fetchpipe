import type { ApiClient } from '../types/client.js';

export type TokenGetter = string | (() => string | null | Promise<string | null>);

export interface BearerAuthClient {
	getToken(): Promise<string | null>;
	setToken(token: string | null): void;
}

export const bearerAuth = (tokenOrGetter: TokenGetter) => {
	return <Schema>(_client: ApiClient<Schema>): BearerAuthClient => {
		let currentToken: string | null = typeof tokenOrGetter === 'string' ? tokenOrGetter : null;
		const isGetter = typeof tokenOrGetter === 'function';

		return {
			async getToken() {
				if (isGetter) {
					return tokenOrGetter();
				}

				return currentToken;
			},
			setToken(token: string | null) {
				currentToken = token;
			},
		};
	};
};
