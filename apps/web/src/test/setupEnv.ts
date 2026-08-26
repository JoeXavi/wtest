process.env.VITE_API_BASE_URL = 'http://localhost/api';
process.env.VITE_PSP_PUBLIC_KEY = 'pub_test_key';
process.env.VITE_PSP_TOKENIZATION_URL = 'http://localhost/psp/v1';

// Node 18+ native fetch bypasses MSW 1 — replace with XHR-based polyfill.
import { fetch as xhrFetch, Headers, Request, Response } from 'whatwg-fetch';

Object.defineProperty(globalThis, 'fetch', { value: xhrFetch, writable: true });
Object.defineProperty(globalThis, 'Headers', { value: Headers, writable: true });
Object.defineProperty(globalThis, 'Request', { value: Request, writable: true });
Object.defineProperty(globalThis, 'Response', { value: Response, writable: true });
