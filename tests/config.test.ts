import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config/index.js';
import { DEFAULT_BOT_NAME, DEFAULT_BOT_PERSONA } from '../src/config/defaultBotIdentity.js';

describe('loadConfig', () => {
  it('creates a single main model configuration by default', () => {
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue('E:/nonexistent/daiyosei-test');
    const config = loadConfig({});
    cwdSpy.mockRestore();

    expect(config.models).toHaveLength(1);
    expect(config.models[0]?.role).toBe('main');
    expect(config.models[0]?.model).toBe('gpt-5.1');
    expect(config.logging.level).toBe('info');
    expect(config.webUi.autoStart).toBe(true);
    expect(config.bot.name).toBe(DEFAULT_BOT_NAME);
    expect(config.bot.persona).toBe(DEFAULT_BOT_PERSONA);
  });
});
