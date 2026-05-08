import type { ApiClient } from '../types/client.js';
import { buildUrl } from '../utils/url.js';
import { request, resolveExtractor } from '../utils/request.js';
import type { ExtractResponseOption } from '../utils/request.js';

export interface AuthData {
	access_token: string | null;
	refresh_token: string | null;
	expires: number | null;
	expires_at: number | null;
}

export interface AuthStorage {
	get: () => Promise<AuthData | null> | AuthData | null;
	set: (value: AuthData | null) => Promise<unknown> | unknown;
}

export interface SessionAuthConfig {
	loginPath?: string;
	refreshPath?: string;
	logoutPath?: string;
	autoRefresh?: boolean;
	msRefreshBeforeExpires?: number;
	storage?: AuthStorage;
	credentials?: RequestCredentials;
	extractResponse?: ExtractResponseOption;
}

export interface SessionAuthClient<_Schema> {
	login(payload: Record<string, any>): Promise<AuthData>;
	logout(): Promise<void>;
	refresh(): Promise<AuthData>;
	getToken(): Promise<string | null>;
	setToken(token: string | null): Promise<void>;
	stopRefreshing(): void;
}

export function memoryStorage(): AuthStorage {
	let store: AuthData | null = null;

	return {
		async get() {
			return store;
		},
		async set(value: AuthData | null) {
			store = value;
		},
	};
}

const MAX_TIMEOUT = 2 ** 31 - 1;

const defaultConfig: Required<Pick<SessionAuthConfig, 'loginPath' | 'refreshPath' | 'logoutPath' | 'autoRefresh' | 'msRefreshBeforeExpires'>> = {
	loginPath: '/auth/login',
	refreshPath: '/auth/refresh',
	logoutPath: '/auth/logout',
	autoRefresh: true,
	msRefreshBeforeExpires: 30000,
};

export const sessionAuth = (config: SessionAuthConfig = {}) => {
	return <Schema>(client: ApiClient<Schema>): SessionAuthClient<Schema> => {
		const cfg = { ...defaultConfig, ...config };
		const storage = cfg.storage ?? memoryStorage();
		const extractor = resolveExtractor(cfg.extractResponse ?? 'wrapped:data');

		let refreshPromise: Promise<AuthData> | null = null;
		let refreshTimeout: ReturnType<typeof setTimeout> | null = null;

		const resetStorage = async () =>
			storage.set({ access_token: null, refresh_token: null, expires: null, expires_at: null });

		const activeRefresh = async () => {
			try {
				await refreshPromise;
			} finally {
				refreshPromise = null;
			}
		};

		const refreshIfExpired = async () => {
			const authData = await storage.get();

			if (refreshPromise || !authData?.expires_at) {
				return activeRefresh();
			}

			if (authData.expires_at < new Date().getTime() + cfg.msRefreshBeforeExpires) {
				refresh().catch(() => {});
			}

			return activeRefresh();
		};

		const setCredentials = async (data: AuthData) => {
			const expires = data.expires ?? 0;
			data.expires_at = new Date().getTime() + expires;
			await storage.set(data);

			if (cfg.autoRefresh && expires > cfg.msRefreshBeforeExpires && expires < MAX_TIMEOUT) {
				if (refreshTimeout) clearTimeout(refreshTimeout);

				refreshTimeout = setTimeout(() => {
					refreshTimeout = null;
					refresh().catch(() => {});
				}, expires - cfg.msRefreshBeforeExpires);
			}
		};

		const makeFetchOptions = (body: Record<string, any>): RequestInit => {
			const opts: RequestInit = {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			};

			if (cfg.credentials) {
				opts.credentials = cfg.credentials;
			}

			return opts;
		};

		const refresh = async (): Promise<AuthData> => {
			const doRefresh = async (): Promise<AuthData> => {
				const authData = await storage.get();
				const body: Record<string, any> = {};

				if (authData?.refresh_token) {
					body['refresh_token'] = authData.refresh_token;
				}

				const url = buildUrl(client.url, cfg.refreshPath);
				const data = await request<AuthData>(url.toString(), makeFetchOptions(body), client.globals.fetch, extractor);

				await resetStorage();
				await setCredentials(data);

				return data;
			};

			refreshPromise = doRefresh();
			return refreshPromise;
		};

		return {
			async login(payload: Record<string, any>): Promise<AuthData> {
				const url = buildUrl(client.url, cfg.loginPath);
				const data = await request<AuthData>(url.toString(), makeFetchOptions(payload), client.globals.fetch, extractor);

				await resetStorage();
				await setCredentials(data);

				return data;
			},

			async logout(): Promise<void> {
				const authData = await storage.get();
				const body: Record<string, any> = {};

				if (authData?.refresh_token) {
					body['refresh_token'] = authData.refresh_token;
				}

				const url = buildUrl(client.url, cfg.logoutPath);
				await request(url.toString(), makeFetchOptions(body), client.globals.fetch, extractor);

				this.stopRefreshing();
				await resetStorage();
			},

			refresh,

			async getToken(): Promise<string | null> {
				await refreshIfExpired().catch(() => {});
				const data = await storage.get();
				return data?.access_token ?? null;
			},

			async setToken(token: string | null): Promise<void> {
				await storage.set({
					access_token: token,
					refresh_token: null,
					expires: null,
					expires_at: null,
				});
			},

			stopRefreshing() {
				if (refreshTimeout) {
					clearTimeout(refreshTimeout);
					refreshTimeout = null;
				}
			},
		};
	};
};
