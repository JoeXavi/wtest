import { config } from '@/config';

function parseRetryAfterMs(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (!Number.isNaN(seconds) && seconds > 0) {
    return seconds * 1000;
  }
  const dateMs = Date.parse(header);
  if (!Number.isNaN(dateMs)) {
    const delta = dateMs - Date.now();
    return delta > 0 ? delta : undefined;
  }
  return undefined;
}

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export async function httpClient<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (config.apiToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${config.apiToken}`);
  }

  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    ...init,
    headers,
  });

  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : undefined;

  if (!response.ok) {
    const message =
      typeof data === 'object' &&
      data !== null &&
      'message' in data &&
      typeof (data as { message: unknown }).message === 'string'
        ? (data as { message: string }).message
        : `Request failed (${response.status})`;
    throw new HttpError(
      message,
      response.status,
      data,
      parseRetryAfterMs(response.headers.get('Retry-After')),
    );
  }

  return data as T;
}
