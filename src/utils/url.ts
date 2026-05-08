const SEPARATOR = '/';

function mergePaths(a: string, b: string): string {
	if (a.endsWith(SEPARATOR)) a = a.slice(0, -1);
	if (!b.startsWith(SEPARATOR)) b = SEPARATOR + b;
	return a + b;
}

function serializeParams(params: Record<string, any>): Record<string, string> {
	const result: Record<string, string> = {};

	for (const [key, value] of Object.entries(params)) {
		if (value === undefined || value === null) continue;

		if (typeof value === 'object' && !Array.isArray(value)) {
			for (const [subKey, subValue] of Object.entries(value)) {
				if (subValue !== undefined && subValue !== null) {
					result[`${key}[${subKey}]`] = String(subValue);
				}
			}
		} else if (Array.isArray(value)) {
			result[key] = value.map(String).join(',');
		} else {
			result[key] = String(value);
		}
	}

	return result;
}

export function buildUrl(base: URL, path: string, params?: Record<string, any>): URL {
	const fullPath = base.pathname === SEPARATOR ? path : mergePaths(base.pathname, path);
	const url = new globalThis.URL(fullPath, base);

	if (params) {
		for (const [key, value] of Object.entries(serializeParams(params))) {
			url.searchParams.set(key, value);
		}
	}

	return url;
}
