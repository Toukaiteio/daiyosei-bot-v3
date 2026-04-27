import type { CommandContext } from './types.js';
import type { CommandRegistry } from './registry.js';

export type DirectCommandResult = {
  handled: boolean;
  trigger?: string;
  output?: string;
  error?: string;
};

export function parseDirectCommand(messageText: string): { trigger: string; rawArgs: string; args: string[] } | undefined {
  const trimmed = messageText.trimStart();
  if (!trimmed.startsWith('$$')) {
    return undefined;
  }

  const body = trimmed.slice(2).trim();
  if (!body) {
    return undefined;
  }

  const [trigger = '', ...rest] = body.split(/\s+/);
  const rawArgs = rest.join(' ').trim();
  const args = rawArgs ? rawArgs.split(/\s+/).filter(Boolean) : [];
  return {
    trigger,
    rawArgs,
    args,
  };
}

export async function executeDirectCommand(
  registry: CommandRegistry,
  messageText: string,
  context: Omit<CommandContext, 'trigger' | 'rawArgs' | 'args' | 'messageText'>,
): Promise<DirectCommandResult> {
  const parsed = parseDirectCommand(messageText);
  if (!parsed) {
    return { handled: false };
  }

  const command = registry.get(parsed.trigger);
  if (!command) {
    return {
      handled: true,
      trigger: parsed.trigger,
      error: `未知命令：${parsed.trigger}`,
    };
  }

  if (!command.execute) {
    return {
      handled: true,
      trigger: parsed.trigger,
      error: `命令未实现：${parsed.trigger}`,
    };
  }

  const output = await command.execute({
    trigger: parsed.trigger,
    rawArgs: parsed.rawArgs,
    args: parsed.args,
    messageText,
    ...context,
  });

  return {
    handled: true,
    trigger: parsed.trigger,
    output,
  };
}
