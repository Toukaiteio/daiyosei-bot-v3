import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config/index.js';

describe('loadConfig', () => {
  it('creates a single main model configuration by default', () => {
    const config = loadConfig({});

    expect(config.models).toHaveLength(1);
    expect(config.models[0]?.role).toBe('main');
    expect(config.models[0]?.model).toBe('gpt-5.1');
    expect(config.logging.level).toBe('info');
    expect(config.webUi.autoStart).toBe(true);
  });
});
