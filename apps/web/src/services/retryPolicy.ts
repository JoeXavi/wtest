import { HttpError } from './httpClient';

export const MAX_RETRIES = 5;
export const BACKOFF_MS = [1000, 2000, 4000, 8000, 16000] as const;

export function backoffDelayMs(attempt: number, retryAfterMs?: number): number {
  const base = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)]!;
  return Math.max(base, retryAfterMs ?? 0);
}

export function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

export function isRetryableError(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  if (err instanceof HttpError) return isRetryableStatus(err.status);
  return false;
}

export function isRetryableRejectPayload(payload: unknown): boolean {
  if (typeof payload === 'string') return false;
  if (payload && typeof payload === 'object') {
    const status = (payload as { status?: number }).status;
    if (status === undefined) return true;
    return isRetryableStatus(status);
  }
  return false;
}

export function rejectRetryAfterMs(payload: unknown): number | undefined {
  if (payload && typeof payload === 'object') {
    return (payload as { retryAfterMs?: number }).retryAfterMs;
  }
  return undefined;
}
