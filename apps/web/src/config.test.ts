import { config } from './config';

describe('config', () => {
  it('reads Vite env keys set by setupEnv', () => {
    expect(config.apiBaseUrl).toBe('http://localhost/api');
    expect(config.pspPublicKey).toBe('pub_test_key');
    expect(config.pspTokenizationUrl).toBe('http://localhost/psp/v1');
  });
});
