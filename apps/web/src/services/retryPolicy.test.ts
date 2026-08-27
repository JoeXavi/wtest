import { HttpError } from './httpClient';
import {
  BACKOFF_MS,
  backoffDelayMs,
  isRetryableError,
  isRetryableRejectPayload,
  isRetryableStatus,
  MAX_RETRIES,
  rejectRetryAfterMs,
} from './retryPolicy';

describe('retryPolicy', () => {
  it('defines five backoff steps ending at 16s', () => {
    expect(BACKOFF_MS).toEqual([1000, 2000, 4000, 8000, 16000]);
    expect(MAX_RETRIES).toBe(5);
  });

  it('backoffDelayMs follows the sequence', () => {
    expect(backoffDelayMs(0)).toBe(1000);
    expect(backoffDelayMs(1)).toBe(2000);
    expect(backoffDelayMs(4)).toBe(16000);
    expect(backoffDelayMs(99)).toBe(16000);
  });

  it('backoffDelayMs honors Retry-After when larger than base', () => {
    expect(backoffDelayMs(0, 5000)).toBe(5000);
    expect(backoffDelayMs(2, 3000)).toBe(4000);
  });

  it('isRetryableStatus classifies status codes', () => {
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(500)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
    expect(isRetryableStatus(404)).toBe(false);
    expect(isRetryableStatus(409)).toBe(false);
    expect(isRetryableStatus(400)).toBe(false);
  });

  it('isRetryableError handles network and HttpError', () => {
    expect(isRetryableError(new TypeError('fetch failed'))).toBe(true);
    expect(isRetryableError(new HttpError('rate limited', 429))).toBe(true);
    expect(isRetryableError(new HttpError('not found', 404))).toBe(false);
  });

  it('isRetryableRejectPayload handles thunk payloads', () => {
    expect(isRetryableRejectPayload({ message: 'oops' })).toBe(true);
    expect(isRetryableRejectPayload({ message: 'oops', status: 500 })).toBe(true);
    expect(isRetryableRejectPayload({ message: 'oops', status: 429 })).toBe(true);
    expect(isRetryableRejectPayload({ message: 'oops', status: 404 })).toBe(false);
    expect(isRetryableRejectPayload('Missing checkout details')).toBe(false);
  });

  it('rejectRetryAfterMs reads retryAfterMs from payload', () => {
    expect(rejectRetryAfterMs({ retryAfterMs: 4000 })).toBe(4000);
    expect(rejectRetryAfterMs({ message: 'x' })).toBeUndefined();
  });
});
