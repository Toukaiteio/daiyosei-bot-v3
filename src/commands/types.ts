export type CommandPermission = 'master_only' | 'everyone';

export type CommandContext = {
  trigger: string;
  rawArgs: string;
  args: string[];
  messageText: string;
  userId?: string;
  groupId?: string;
  replyMessageId?: string;
};

export type CommandHandler = (context: CommandContext) => string | Promise<string>;

export type CommandDef = {
  trigger: string;
  description: string;
  defaultPermission: CommandPermission;
  execute?: CommandHandler;
};
