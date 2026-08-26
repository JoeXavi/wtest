import { TextEncoder, TextDecoder } from 'node:util';
import '@testing-library/jest-dom';

Object.assign(globalThis, { TextEncoder, TextDecoder });

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      randomUUID: () => 'test-uuid-0000-0000-0000-000000000001',
    },
  });
}

process.env.VITE_API_BASE_URL = 'http://localhost/api';
process.env.VITE_PSP_PUBLIC_KEY = 'pub_test_key';
process.env.VITE_PSP_TOKENIZATION_URL = 'http://localhost/psp/v1';
