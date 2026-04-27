import type { Tool } from '@openai/agents';
import type { CommandDef } from '../commands/types.js';

export type PluginContext = {
  registerTools(tools: Tool[]): void;
  registerCommand(command: CommandDef): void;
};

export type PluginFactoryOptions = {
  manifest: {
    id: string;
    name: string;
    description: string;
    version: string;
    entry?: string;
  };
  config: unknown;
  getConfig(): unknown;
};

export type InlineDirectiveContext = {
  name: string;
  value: string;
  params: Record<string, string>;
  raw: string;
  question: string;
  userId?: string;
  groupId?: string;
};

export type BotPlugin = {
  id: string;
  name: string;
  description?: string;
  version?: string;
  instructions?: string | string[];
  resolveInlineDirective?(directive: InlineDirectiveContext): Promise<string | undefined> | string | undefined;
  setup(context: PluginContext): void | Promise<void>;
  start?(): void | Promise<void>;
  stop?(): void | Promise<void>;
};
