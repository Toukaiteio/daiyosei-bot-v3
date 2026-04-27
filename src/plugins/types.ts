import type { Tool } from '@openai/agents';
import type { CommandDef } from '../commands/types.js';

export type PluginContext = {
  registerTools(tools: Tool[]): void;
  registerCommand(command: CommandDef): void;
};

export type BotPlugin = {
  id: string;
  name: string;
  description?: string;
  version?: string;
  instructions?: string | string[];
  setup(context: PluginContext): void | Promise<void>;
  start?(): void | Promise<void>;
  stop?(): void | Promise<void>;
};
