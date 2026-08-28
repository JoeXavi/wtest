/**
 * Runtime config — lazy getters so Jest setupFiles can set process.env first.
 *
 * Each key MUST be a literal `process.env.VITE_*` so Vite `define` can inline
 * values at build time. Dynamic access (`process.env[key]`) is NOT replaced
 * and becomes empty in the browser.
 */
export const config = {
  get apiBaseUrl() {
    return process.env.VITE_API_BASE_URL || '/api';
  },
  get pspPublicKey() {
    return process.env.VITE_PSP_PUBLIC_KEY || '';
  },
  get pspTokenizationUrl() {
    return process.env.VITE_PSP_TOKENIZATION_URL || '';
  },
};
