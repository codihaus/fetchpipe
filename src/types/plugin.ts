import type { ApiClient } from './client.js';

export type Plugin<Schema, Extension extends object> = (client: ApiClient<Schema>) => Extension;
