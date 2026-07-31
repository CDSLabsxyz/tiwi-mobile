/**
 * Transient-network-failure detection.
 *
 * Background pollers (notifications, balances, …) keep running while the device
 * is offline, on a captive portal, or switching networks. Those failures are
 * expected and already handled — logging them with `console.error` pops React
 * Native's red LogBox overlay on every poll, which buries real errors.
 *
 * Use `logNetworkAwareError` so a dropped request degrades to a warning while
 * genuine bugs still surface as errors.
 */

const TRANSIENT_PATTERNS = [
    'network request failed',
    'network error',
    'failed to fetch',
    'timeout',
    'timed out',
    'aborted',
    'connection refused',
    'connection reset',
    'unable to resolve host',
    'the internet connection appears to be offline',
];

/** True when the error is a dropped/unreachable request rather than a bug. */
export function isTransientNetworkError(error: unknown): boolean {
    if (!error) return false;

    if (error instanceof Error && error.name === 'AbortError') return true;

    const message =
        error instanceof Error
            ? error.message
            : typeof error === 'string'
                ? error
                : typeof (error as { message?: unknown })?.message === 'string'
                    ? ((error as { message: string }).message)
                    : '';

    const normalized = message.toLowerCase();
    return TRANSIENT_PATTERNS.some((pattern) => normalized.includes(pattern));
}

/**
 * Log an error, downgrading connectivity blips to `console.warn` so they don't
 * raise a red box. Anything else is still a `console.error`.
 */
export function logNetworkAwareError(context: string, error: unknown): void {
    if (isTransientNetworkError(error)) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`${context} (offline or unreachable): ${message}`);
        return;
    }
    console.error(context, error);
}
