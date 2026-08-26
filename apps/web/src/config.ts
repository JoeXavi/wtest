function read(key: string, fallback = ''): string {
  if (typeof process !== 'undefined' && process.env[key]) {
    return process.env[key]!;
  }
  return fallback;
}

/** Runtime config — lazy getters so Jest setup can set process.env first. */
export const config = {
  get apiBaseUrl() {
    return read('VITE_API_BASE_URL', '/api');
  },
  get pspPublicKey() {
    return read('VITE_PSP_PUBLIC_KEY', '');
  },
  get pspTokenizationUrl() {
    return read('VITE_PSP_TOKENIZATION_URL', '');
  },
};
