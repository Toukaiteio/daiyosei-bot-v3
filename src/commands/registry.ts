import type { CommandDef, CommandPermission } from './types.js';

export class CommandRegistry {
  private readonly commands = new Map<string, CommandDef>();

  register(command: CommandDef) {
    this.commands.set(command.trigger.toLowerCase(), command);
  }

  resolve(trigger: string, overrides: Record<string, string>): CommandPermission {
    const t = trigger.toLowerCase();
    const override = overrides[t];
    if (override === 'everyone' || override === 'master_only') {
      return override;
    }
    return this.commands.get(t)?.defaultPermission ?? 'master_only';
  }

  list(): CommandDef[] {
    return [...this.commands.values()];
  }
}
