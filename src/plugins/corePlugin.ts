import { tool } from '@openai/agents';
import { z } from 'zod';
import type { AppConfig, MemeConfig } from '../config/schema.js';
import { createMemoryTools } from '../memory/memoryTools.js';
import type { OpenMemoryClient } from '../memory/openMemoryClient.js';
import type { MemeLibrary } from '../memes/library.js';
import { createImageHistoryTools } from '../storage/imageTools.js';
import type { StorageDatabase } from '../storage/database.js';
import type { SandboxPolicy } from '../sandbox/policy.js';
import type { SkillRegistry } from '../skills/registry.js';
import type { BotPlugin } from './types.js';

export function createCorePlugin(options: {
  skills: SkillRegistry;
  sandboxPolicy: SandboxPolicy;
  memory: OpenMemoryClient;
  storage: StorageDatabase;
  config: AppConfig;
  memes: MemeLibrary;
  memeConfig: MemeConfig;
}): BotPlugin {
  return {
    id: 'core',
    name: 'Core runtime tools',
    instructions: [
      '- For images in group chats, do not inspect every image by default. Use cached image history tools first when the image is relevant to the task.',
    ],
    setup(context) {
      context.registerTools([
        tool({
          name: 'list_skills',
          description: 'List installed agent skills and their capabilities.',
          parameters: z.object({}),
          execute: () => options.skills.list().map((skill) => ({
            id: skill.id,
            name: skill.name,
            description: skill.description,
          })),
        }),
        tool({
          name: 'inspect_sandbox_policy',
          description: 'Inspect the current sandbox policy before planning filesystem or command actions.',
          parameters: z.object({}),
          execute: () => options.sandboxPolicy.describe(),
        }),
        tool({
          name: 'list_memes',
          description: 'List the available meme image assets, grouped by category.',
          parameters: z.object({}),
          execute: () => {
            const disabledMemes = new Set(
              options.memeConfig.disabledMemes
                .map((value) => value.trim().replaceAll('\\', '/').toLowerCase())
                .filter(Boolean),
            );
            const allowedCategories = new Set(
              options.memeConfig.allowedCategories
                .map((value) => value.trim().toLowerCase())
                .filter(Boolean),
            );
            const memes = options.memes.all().filter((meme) => {
              if (allowedCategories.size > 0) {
                return allowedCategories.has(meme.category.toLowerCase());
              }
              return true;
            });
            const categories = [...new Set(memes.map((meme) => meme.category))].sort((left, right) =>
              left.localeCompare(right),
            );
            return {
              root: options.memes.getRoot(),
              enabled: options.memeConfig.enabled,
              allowedCategories: options.memeConfig.allowedCategories,
              disabledMemes: options.memeConfig.disabledMemes,
              categories: categories.map((category) => ({
                category,
                count: memes.filter((meme) => meme.category === category).length,
              })),
              memes: memes.map((meme) => ({
                id: meme.id,
                category: meme.category,
                name: meme.name,
                filename: meme.filename,
                relativePath: meme.relativePath,
                mimeType: meme.mimeType,
                animated: meme.animated,
                size: meme.size,
                disabled: disabledMemes.has(meme.id.toLowerCase()),
              })),
            };
          },
        }),
        ...createMemoryTools(options.memory),
        ...createImageHistoryTools(options.storage, options.config),
      ]);
    },
  };
}
