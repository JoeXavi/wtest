/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_API_TOKEN: string;
  readonly VITE_PSP_PUBLIC_KEY: string;
  readonly VITE_PSP_TOKENIZATION_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module 'whatwg-fetch' {
  export const fetch: typeof globalThis.fetch;
  export const Headers: typeof globalThis.Headers;
  export const Request: typeof globalThis.Request;
  export const Response: typeof globalThis.Response;
}
