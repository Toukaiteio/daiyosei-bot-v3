import type { StorageDatabase } from '../storage/database.js';
import type { BotPlugin } from './types.js';

export function createBlacklistPlugin(options: { storage: StorageDatabase }): BotPlugin {
  return {
    id: 'blacklist',
    name: 'User blacklist',
    description: 'Built-in blacklist for silencing users or bots. Messages from banned users are dropped before reaching the agent.',
    version: '1.0.0',
    setup(context) {
      context.registerCommand({
        trigger: 'ban',
        description: 'Add a user to the blacklist',
        defaultPermission: 'master_only',
        execute: ({ rawArgs }) => {
          const [userId, ...reasonParts] = rawArgs.split(/\s+/).filter(Boolean);
          if (!userId) {
            return '用法：$$ban <user_id> [reason]';
          }

          const reason = reasonParts.join(' ').trim();
          options.storage.banUser(userId, reason || undefined);
          return `User ${userId} has been added to the blacklist.`;
        },
      });

      context.registerCommand({
        trigger: 'unban',
        description: 'Remove a user from the blacklist',
        defaultPermission: 'master_only',
        execute: ({ rawArgs }) => {
          const [userId] = rawArgs.split(/\s+/).filter(Boolean);
          if (!userId) {
            return '用法：$$unban <user_id>';
          }

          const removed = options.storage.unbanUser(userId);
          return removed
            ? `User ${userId} has been removed from the blacklist.`
            : `User ${userId} was not in the blacklist.`;
        },
      });

      context.registerCommand({
        trigger: 'banned',
        description: 'List all blacklisted users',
        defaultPermission: 'master_only',
        execute: () => {
          const entries = options.storage.listBanned();
          if (entries.length === 0) {
            return '当前没有黑名单用户。';
          }

          return ['黑名单用户：', ...entries.map((entry) => `- ${entry.userId}${entry.reason ? ` (${entry.reason})` : ''}`)].join('\n');
        },
      });

    },
  };
}
