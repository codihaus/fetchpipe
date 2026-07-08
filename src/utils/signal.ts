/**
 * Combine multiple abort signals into one that aborts as soon as any input
 * aborts. Uses the native `AbortSignal.any` when available (Node 20.3+, modern
 * browsers) and falls back to manual wiring for older runtimes (Node 18).
 */
export function anySignal(signals: Array<AbortSignal | undefined>): AbortSignal | undefined {
	const valid = signals.filter((signal): signal is AbortSignal => Boolean(signal));

	if (valid.length === 0) return undefined;
	if (valid.length === 1) return valid[0];

	if (typeof (AbortSignal as any).any === 'function') {
		return (AbortSignal as any).any(valid);
	}

	const controller = new AbortController();

	const onAbort = function (this: AbortSignal) {
		controller.abort((this as any).reason);
		for (const signal of valid) {
			signal.removeEventListener('abort', onAbort);
		}
	};

	for (const signal of valid) {
		if (signal.aborted) {
			controller.abort((signal as any).reason);
			break;
		}
		signal.addEventListener('abort', onAbort);
	}

	return controller.signal;
}
