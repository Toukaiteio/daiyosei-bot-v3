import type { Logger } from 'pino';
import type { Tool } from '@openai/agents';
import type { BotPlugin } from './types.js';
import type { CommandRegistry } from '../commands/registry.js';

export class PluginRegistry {
  private readonly logger: Logger;
  private readonly plugins = new Map<string, BotPlugin>();
  private readonly tools: Tool[] = [];
  private commandRegistry?: CommandRegistry;

  constructor(options: { logger: Logger; commandRegistry?: CommandRegistry }) {
    this.logger = options.logger;
    this.commandRegistry = options.commandRegistry;
  }

  register(plugin: BotPlugin) {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin already registered: ${plugin.id}`);
    }

    this.plugins.set(plugin.id, plugin);
    void plugin.setup({
      registerTools: (tools) => this.tools.push(...tools),
      registerCommand: (command) => this.commandRegistry?.register(command),
    });
    this.logger.info({ plugin: plugin.id }, 'plugin registered');
  }

  toTools() {
    return [...this.tools];
  }

  getPlugin(id: string) {
    return this.plugins.get(id);
  }

  getInjectedInstructions(): string[] {
    const all: string[] = [];
    for (const plugin of this.plugins.values()) {
      if (plugin.instructions) {
        if (Array.isArray(plugin.instructions)) {
          all.push(...plugin.instructions);
        } else {
          all.push(plugin.instructions);
        }
      }
    }
    return all;
  }

  list() {
    return [...this.plugins.values()].map((plugin) => ({
      id: plugin.id,
      name: plugin.name,
      description: plugin.description ?? '',
      version: plugin.version ?? '0.0.0',
    }));
  }

  async startAll() {
    for (const plugin of this.plugins.values()) {
      await plugin.start?.();
    }
  }

  async stopAll() {
    for (const plugin of [...this.plugins.values()].reverse()) {
      await plugin.stop?.();
    }
  }
}
