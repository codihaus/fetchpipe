export type FetchInterface = (input: string | URL, init?: RequestInit) => Promise<Response>;

export type ConsoleInterface = {
	log: (...args: any[]) => void;
	warn: (...args: any[]) => void;
	error: (...args: any[]) => void;
};

export interface ClientGlobals {
	fetch: FetchInterface;
	URL: typeof URL;
	logger: ConsoleInterface;
}

export interface ClientOptions {
	globals?: Partial<ClientGlobals>;
}

export interface ApiClient<Schema = any> {
	url: URL;
	globals: ClientGlobals;
	with: <Extension extends object>(
		plugin: (client: ApiClient<Schema>) => Extension,
	) => this & Extension;
}
