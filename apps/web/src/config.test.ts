import { config } from './config';

const ENV_KEYS = [
  'VITE_API_BASE_URL',
  'VITE_PSP_PUBLIC_KEY',
  'VITE_PSP_TOKENIZATION_URL',
] as const;

const defaults: Record<(typeof ENV_KEYS)[number], string | undefined> = {
  VITE_API_BASE_URL: process.env.VITE_API_BASE_URL,
  VITE_PSP_PUBLIC_KEY: process.env.VITE_PSP_PUBLIC_KEY,
  VITE_PSP_TOKENIZATION_URL: process.env.VITE_PSP_TOKENIZATION_URL,
};

describe('config', () => {
  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = defaults[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('reads Vite env keys set by setupEnv', () => {
    expect(config.apiBaseUrl).toBe('http://localhost/api');
    expect(config.pspPublicKey).toBe('pub_test_key');
    expect(config.pspTokenizationUrl).toBe('http://localhost/psp/v1');
  });

  it('falls back when Vite env keys are unset', () => {
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }

    expect(config.apiBaseUrl).toBe('/api');
    expect(config.pspPublicKey).toBe('');
    expect(config.pspTokenizationUrl).toBe('');
  });
});
