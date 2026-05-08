export function isFetchResponse(value: unknown): value is Response {
	if (typeof value !== 'object' || !value) return false;

	return (
		'headers' in value &&
		'ok' in value &&
		'json' in value &&
		typeof (value as any).json === 'function' &&
		'text' in value &&
		typeof (value as any).text === 'function'
	);
}

export type ResponseExtractor = (response: Response) => Promise<any>;

export const extractJson: ResponseExtractor = async (response) => {
	if (response.status === 204) return null;

	const contentType = response.headers.get('Content-Type')?.toLowerCase();

	if (contentType?.startsWith('application/json')) {
		const result = await response.json();
		if (!response.ok) throw result;
		return result;
	}

	if (contentType?.startsWith('text/')) {
		const text = await response.text();
		if (!response.ok) throw text;
		return text;
	}

	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	return response;
};

export function extractWrapped(key: string): ResponseExtractor {
	return async (response) => {
		if (response.status === 204) return null;

		const contentType = response.headers.get('Content-Type')?.toLowerCase();

		if (contentType?.startsWith('application/json')) {
			const result = await response.json();
			if (!response.ok || 'errors' in result) throw result;
			if (key in result) return result[key];
			return result;
		}

		if (contentType?.startsWith('text/')) {
			const text = await response.text();
			if (!response.ok) throw text;
			return text;
		}

		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		return response;
	};
}

export const extractRaw: ResponseExtractor = async (response) => {
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	return response;
};
