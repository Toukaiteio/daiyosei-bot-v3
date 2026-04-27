export type CommandPermission = 'master_only' | 'everyone';

export type CommandDef = {
  trigger: string;
  description: string;
  defaultPermission: CommandPermission;
};
