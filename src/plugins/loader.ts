import { pathToFileURL } from 'node:url';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Logger } from 'pino';
import { pluginManifestSchema } from './manifest.js';
import type { BotPlugin } from './types.js';
import type { PluginFactoryOptions } from './types.js';

type PluginModule = {
  default?: BotPlugin | ((options: PluginFactoryOptions) => BotPlugin | Promise<BotPlugin>);
  plugin?: BotPlugin | ((options: PluginFactoryOptions) => BotPlugin | Promise<BotPlugin>);
};

export class PluginLoader {
  constructor(
    private readonly options: {
      directory: string;
      logger: Logger;
      getPluginConfig?: (pluginId: string) => unknown;
    },
  ) {}

  async load(): Promise<BotPlugin[]> {
    const root = resolve(this.options.directory);
    const entries = await safeReadDir(root);
    const plugins: BotPlugin[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const manifestPath = join(root, entry.name, 'plugin.json');
      const manifest = pluginManifestSchema.parse(JSON.parse(await readFile(manifestPath, 'utf8')));
      if (!manifest.enabled) {
        continue;
      }

      if (!manifest.entry) {
        plugins.push({
          id: manifest.id,
          name: manifest.name,
          description: manifest.description,
          version: manifest.version,
          setup: () => undefined,
        });
        continue;
      }

      const modulePath = pathToFileURL(join(root, entry.name, manifest.entry)).href;
      const mod = (await import(modulePath)) as PluginModule;
      const candidate = mod.plugin ?? mod.default;
      const plugin =
        typeof candidate === 'function'
          ? await candidate({
              manifest,
              config: this.options.getPluginConfig?.(manifest.id),
              getConfig: () => this.options.getPluginConfig?.(manifest.id),
            })
          : candidate;
      if (!plugin) {
        throw new Error(`Plugin entry did not export a plugin: ${modulePath}`);
      }

      plugins.push({
        ...plugin,
        id: plugin.id || manifest.id,
        name: plugin.name || manifest.name,
        description: plugin.description ?? manifest.description,
        version: plugin.version ?? manifest.version,
      });
    }

    this.options.logger.info({ count: plugins.length, directory: root }, 'loaded plugins');
    return plugins;
  }
}

async function safeReadDir(path: string) {
  try {
    return await readdir(path, { withFileTypes: true });
  } catch {
    return [];
  }
}
