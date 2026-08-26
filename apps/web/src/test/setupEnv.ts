process.env.VITE_API_BASE_URL = 'http://localhost/api';
process.env.VITE_PSP_PUBLIC_KEY = 'pub_test_key';
process.env.VITE_PSP_TOKENIZATION_URL = 'http://localhost/psp/v1';

// Node 18+ native fetch bypasses MSW 1 — replace with XHR-based polyfill.
const wf = require('whatwg-fetch') as typeof import('whatwg-fetch');

Object.defineProperty(globalThis, 'fetch', { value: wf.fetch, writable: true, configurable: true });
Object.defineProperty(globalThis, 'Headers', { value: wf.Headers, writable: true, configurable: true });
Object.defineProperty(globalThis, 'Request', { value: wf.Request, writable: true, configurable: true });
Object.defineProperty(globalThis, 'Response', { value: wf.Response, writable: true, configurable: true });
