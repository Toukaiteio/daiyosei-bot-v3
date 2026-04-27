import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config/index.js';
import { DEFAULT_BOT_NAME, DEFAULT_BOT_PERSONA } from '../src/config/defaultBotIdentity.js';

describe('loadConfig', () => {
  it('loads the main model from data/config.json and ignores MAIN_MODEL env', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'daiyosei-config-'));
    const dataDir = join(rootDir, 'data');
    mkdirSync(dataDir);

    writeFileSync(
      join(dataDir, 'config.json'),
      JSON.stringify(
        {
          providers: [
            {
              id: 'provider-1',
              name: 'Local Provider',
              baseUrl: 'https://example.com/v1',
              apiKey: 'cfg-key',
            },
          ],
          modelLibrary: [
            {
              id: 'model-1',
              providerId: 'provider-1',
              name: 'Configured Main',
              model: 'cfg-main-model',
              supportsVision: true,
              supportsReasoning: true,
              reasoningEffort: 'medium',
            },
          ],
          roleAssignments: {
            main: 'model-1',
          },
        },
        null,
        2,
      ),
    );

    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(rootDir);
    try {
      const config = loadConfig({
        MAIN_MODEL: 'env-main-model',
        MAIN_MODEL_BASE_URL: 'https://env.example/v1',
        MAIN_MODEL_API_KEY: 'env-key',
      });

      expect(config.models).toHaveLength(1);
      expect(config.models[0]?.role).toBe('main');
      expect(config.models[0]?.model).toBe('cfg-main-model');
      expect(config.models[0]?.baseUrl).toBe('https://example.com/v1');
      expect(config.models[0]?.apiKey).toBe('cfg-key');
      expect(config.models[0]?.supportsVision).toBe(true);
      expect(config.models[0]?.supportsReasoning).toBe(true);
      expect(config.logging.level).toBe('info');
      expect(config.webUi.autoStart).toBe(true);
      expect(config.bot.name).toBe(DEFAULT_BOT_NAME);
      expect(config.bot.persona).toBe(DEFAULT_BOT_PERSONA);
    } finally {
      cwdSpy.mockRestore();
      rmSync(rootDir, { recursive: true, force: true });
    }
  });
});
