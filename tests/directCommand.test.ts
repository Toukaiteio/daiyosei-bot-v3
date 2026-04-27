import { describe, expect, it } from 'vitest';
import { CommandRegistry } from '../src/commands/registry.js';
import { executeDirectCommand, parseDirectCommand } from '../src/commands/direct.js';

describe('direct command execution', () => {
  it('parses $$ commands without involving the model', () => {
    expect(parseDirectCommand('$$猜 khaN')).toEqual({
      trigger: '猜',
      rawArgs: 'khaN',
      args: ['khaN'],
    });
  });

  it('executes registered commands directly', async () => {
    const registry = new CommandRegistry();
    registry.register({
      trigger: 'banned',
      description: 'List banned users',
      defaultPermission: 'master_only',
      execute: () => 'blacklist result',
    });

    const result = await executeDirectCommand(registry, '$$banned', {
      userId: '123',
      groupId: '456',
    });

    expect(result.handled).toBe(true);
    expect(result.output).toBe('blacklist result');
  });
});
