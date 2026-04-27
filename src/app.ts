import type { Logger } from 'pino';
import { resolve } from 'node:path';
import { AgentRuntime } from './agent/agentRuntime.js';
import { CommandRegistry } from './commands/registry.js';
import { createCorePlugin } from './plugins/corePlugin.js';
import { createSandboxPlugin } from './plugins/sandboxPlugin.js';
import { createBrowserPlugin } from './plugins/browserPlugin.js';
import { createTaskAgentPlugin } from './plugins/taskAgentPlugin.js';
import { createBlacklistPlugin } from './plugins/blacklistPlugin.js';
import { PluginRegistry } from './plugins/registry.js';
import { PluginLoader } from './plugins/loader.js';
import { SkillRegistry } from './skills/registry.js';
import { createHealthSkill } from './skills/builtin/healthSkill.js';
import { SkillLoader } from './skills/loader.js';
import { SandboxPolicy } from './sandbox/policy.js';
import { HttpServer } from './server/httpServer.js';
import type { AppConfig } from './config/schema.js';
import { OpenMemoryClient } from './memory/openMemoryClient.js';
import { StorageDatabase } from './storage/database.js';
import { createMemeLibrary } from './memes/library.js';

export type AppDependencies = {
  config: AppConfig;
  logger: Logger;
};

export async function createApp({ config, logger }: AppDependencies) {
  logger.info(
    {
      skillsDir: config.paths.skillsDir,
      pluginsDir: config.paths.pluginsDir,
      storage: config.storage.dbPath,
      oneBotEnabled: config.oneBot.enabled,
    },
    'initializing app runtime',
  );

  const skills = new SkillRegistry();
  skills.register(createHealthSkill());
  logger.info('loading skill manifests');
  for (const skill of await new SkillLoader({
    directory: config.paths.skillsDir,
    logger,
  }).load()) {
    skills.register(skill);
  }

  logger.info('initializing storage');
  const sandboxPolicy = new SandboxPolicy(config.sandbox);
  const memory = new OpenMemoryClient(config.openMemory);
  const storage = new StorageDatabase(config.storage.dbPath);
  const memes = createMemeLibrary(resolve(process.cwd(), 'assets', 'memes'));
  storage.migrate();
  logger.info('loading plugin manifests');
  const commandRegistry = new CommandRegistry();
  const plugins = new PluginRegistry({ logger, commandRegistry });

  const agentRuntime = new AgentRuntime({
    config,
    logger,
    skills,
    plugins,
  });

  plugins.register(createCorePlugin({ skills, sandboxPolicy, memory, storage, config, memes, memeConfig: config.memes }));
  plugins.register(createSandboxPlugin({ sandboxPolicy }));
  plugins.register(createBrowserPlugin({ sandboxPolicy, agentRuntime }));
  plugins.register(createTaskAgentPlugin({ agentRuntime, config }));
  plugins.register(createBlacklistPlugin({ storage }));
  for (const plugin of await new PluginLoader({
    directory: config.paths.pluginsDir,
    logger,
    getPluginConfig: (pluginId) => config.pluginConfigs[pluginId],
  }).load()) {
    plugins.register(plugin);
  }



  const server = new HttpServer({ config, logger, agentRuntime, plugins, skills, storage, memes, commandRegistry });

  return {
    async start() {
      logger.info('starting plugin runtime');
      await plugins.startAll();
      logger.info('starting HTTP and OneBot gateway');
      await server.start();
      logger.info('daiyosei bot foundation started');
    },
    async stop() {
      await server.stop();
      await plugins.stopAll();
      await agentRuntime.close();
      storage.close();
    },
  };
}
