import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PluginLoader } from '../src/plugins/loader.js';
import { createLogger } from '../src/logger.js';

describe('PluginLoader', () => {
  it('loads plugin manifests without code entries', async () => {
    const root = await mkdtemp(join(tmpdir(), 'daiyosei-plugin-'));
    try {
      await mkdir(join(root, 'demo'));
      await writeFile(
        join(root, 'demo', 'plugin.json'),
        JSON.stringify({ id: 'demo', name: 'Demo Plugin', version: '1.0.0' }),
      );

      const plugins = await new PluginLoader({ directory: root, logger: createLogger() }).load();
      expect(plugins).toHaveLength(1);
      expect(plugins[0]?.id).toBe('demo');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
