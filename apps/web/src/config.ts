const env = (
  globalThis as unknown as {
    __NORTE_ENV__?: Record<string, string>;
  }
).__NORTE_ENV__;

function read(key: string, fallback: string): string {
  if (env?.[key]) return env[key]!;
  if (typeof process !== 'undefined' && process.env[key]) return process.env[key]!;
  return fallback;
}

export const config = {
  apiBaseUrl: read('VITE_API_BASE_URL', '/api'),
  pspPublicKey: read('VITE_PSP_PUBLIC_KEY', ''),
  pspTokenizationUrl: read('VITE_PSP_TOKENIZATION_URL', ''),
};
