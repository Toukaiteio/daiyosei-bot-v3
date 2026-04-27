import { tool } from '@openai/agents';
import { z } from 'zod';
import type { StorageDatabase } from '../storage/database.js';
import type { BotPlugin } from './types.js';

export function createBlacklistPlugin(options: { storage: StorageDatabase }): BotPlugin {
  return {
    id: 'blacklist',
    name: 'User blacklist',
    description: 'Built-in blacklist for silencing users or bots. Messages from banned users are dropped before reaching the agent.',
    version: '1.0.0',
    setup(context) {
      context.registerCommand({ trigger: 'ban', description: 'Add a user to the blacklist', defaultPermission: 'master_only' });
      context.registerCommand({ trigger: 'unban', description: 'Remove a user from the blacklist', defaultPermission: 'master_only' });
      context.registerCommand({ trigger: 'banned', description: 'List all blacklisted users', defaultPermission: 'master_only' });

      context.registerTools([
        tool({
          name: 'ban_user',
          description: 'Add a user to the blacklist. Their messages will be silently dropped. Triggered by $$ban <user_id>.',
          parameters: z.object({
            user_id: z.string().min(1).describe('QQ number / user ID to ban'),
            reason: z.string().optional().describe('Optional reason for the ban'),
          }),
          execute: ({ user_id, reason }) => {
            options.storage.banUser(user_id, reason);
            return { ok: true, message: `User ${user_id} has been added to the blacklist.` };
          },
        }),

        tool({
          name: 'unban_user',
          description: 'Remove a user from the blacklist. Triggered by $$unban <user_id>.',
          parameters: z.object({
            user_id: z.string().min(1).describe('QQ number / user ID to unban'),
          }),
          execute: ({ user_id }) => {
            const removed = options.storage.unbanUser(user_id);
            return {
              ok: removed,
              message: removed
                ? `User ${user_id} has been removed from the blacklist.`
                : `User ${user_id} was not in the blacklist.`,
            };
          },
        }),

        tool({
          name: 'list_banned',
          description: 'List all users currently on the blacklist. Triggered by $$banned.',
          parameters: z.object({}),
          execute: () => {
            const entries = options.storage.listBanned();
            return {
              count: entries.length,
              entries,
            };
          },
        }),
      ]);
    },
  };
}
