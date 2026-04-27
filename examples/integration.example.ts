/**
 * 集成示例：展示如何在应用中使用 Plugins 和 Skills
 * 这是一个参考实现，展示完整的集成流程
 */

import type { Logger } from 'pino';
import { tool } from '@openai/agents';
import { PluginRegistry } from '../src/plugins/registry.js';
import { SkillRegistry } from '../src/skills/registry.js';
import { createHealthSkill } from '../src/skills/builtin/healthSkill.js';

// ============ 导入示例 Plugins 和 Skills ============
// import { createWeatherPlugin } from '../plugins/weatherPlugin.example.js';
// import { createDatabasePlugin } from '../plugins/databasePlugin.example.js';
// import { createMathSkill } from '../skills/mathSkill.example.js';
// import { createTextProcessingSkill } from '../skills/textProcessingSkill.example.js';

/**
 * 初始化所有 Plugins 和 Skills
 */
export async function initializePluginsAndSkills(logger: Logger) {
  // 创建注册表
  const pluginRegistry = new PluginRegistry({ logger });
  const skillRegistry = new SkillRegistry();

  // ============ 注册内置 Plugins ============
  // 从 src/plugins/corePlugin.ts 导入（已在应用中集成）

  // ============ 注册示例 Plugins ============
  // 天气插件
  // const weatherPlugin = createWeatherPlugin();
  // pluginRegistry.register(weatherPlugin);

  // 数据库插件
  // const dbPlugin = createDatabasePlugin({ connectionString: process.env.DB_PATH });
  // pluginRegistry.register(dbPlugin);

  // ============ 注册内置 Skills ============
  const healthSkill = createHealthSkill();
  skillRegistry.register(healthSkill);

  // ============ 注册示例 Skills ============
  // 数学计算技能
  // const mathSkill = createMathSkill();
  // skillRegistry.register(mathSkill);

  // 文本处理技能
  // const textSkill = createTextProcessingSkill();
  // skillRegistry.register(textSkill);

  return { pluginRegistry, skillRegistry };
}

/**
 * 启动所有 Plugins
 */
export async function startAllPlugins(pluginRegistry: PluginRegistry, logger: Logger) {
  try {
    await pluginRegistry.startAll();
    logger.info('All plugins started successfully');
  } catch (error) {
    logger.error(error, 'Failed to start plugins');
    throw error;
  }
}

/**
 * 停止所有 Plugins
 */
export async function stopAllPlugins(pluginRegistry: PluginRegistry, logger: Logger) {
  try {
    await pluginRegistry.stopAll();
    logger.info('All plugins stopped successfully');
  } catch (error) {
    logger.error(error, 'Failed to stop plugins');
    throw error;
  }
}

/**
 * 收集所有可用的工具
 */
export function collectAllTools(pluginRegistry: PluginRegistry, skillRegistry: SkillRegistry) {
  const pluginTools = pluginRegistry.toTools();
  const skillTools = skillRegistry.toTools();
  return [...pluginTools, ...skillTools];
}

/**
 * 获取 Plugins 信息
 */
export function listPlugins(pluginRegistry: PluginRegistry) {
  return pluginRegistry.list();
}

/**
 * 获取 Skills 信息
 */
export function listSkills(skillRegistry: SkillRegistry) {
  return skillRegistry.list().map((skill) => ({
    id: skill.id,
    name: skill.name,
    description: skill.description,
    version: skill.version,
    permissions: skill.permissions,
  }));
}

/**
 * 完整的使用流程示例
 */
export async function exampleUsage() {
  // 这是伪代码示例，展示整个流程

  // 1. 初始化 logger（在实际应用中）
  // const logger = createLogger();

  // 2. 初始化 Plugins 和 Skills
  // const { pluginRegistry, skillRegistry } = await initializePluginsAndSkills(logger);

  // 3. 启动 Plugins
  // await startAllPlugins(pluginRegistry, logger);

  // 4. 列出可用资源
  // const plugins = listPlugins(pluginRegistry);
  // const skills = listSkills(skillRegistry);
  // console.log('Available Plugins:', plugins);
  // console.log('Available Skills:', skills);

  // 5. 收集工具
  // const allTools = collectAllTools(pluginRegistry, skillRegistry);
  // console.log(`Total tools available: ${allTools.length}`);

  // 6. 集成到 Agent SDK
  // const client = new Anthropic();
  // const response = await client.beta.assistants.basicMessages.create({
  //   model: 'gpt-4',
  //   system: 'You are a helpful assistant with access to various tools.',
  //   tools: allTools,
  //   messages: [
  //     {
  //       role: 'user',
  //       content: 'Get current weather for New York and calculate 2+2',
  //     },
  //   ],
  // });

  // 7. 处理响应...

  // 8. 清理
  // await stopAllPlugins(pluginRegistry, logger);
}

// ============ 使用示例：创建自定义 Plugin 集合 ============

/**
 * 为特定场景创建 Plugin 集合
 */
export function createPluginCollectionForDataAnalysis() {
  const pluginRegistry = new PluginRegistry({ logger: console as any });

  // 只加载数据相关的 plugins
  // const dbPlugin = createDatabasePlugin();
  // const weatherPlugin = createWeatherPlugin();
  // pluginRegistry.register(dbPlugin);

  return pluginRegistry;
}

/**
 * 为特定场景创建 Skill 集合
 */
export function createSkillCollectionForScientificComputation() {
  const skillRegistry = new SkillRegistry();

  // 只加载科学计算相关的 skills
  // const mathSkill = createMathSkill();
  // skillRegistry.register(mathSkill);

  return skillRegistry;
}

// ============ API 端点示例 ============

/**
 * 这些函数可以在 src/server/httpServer.ts 中作为 API 端点使用
 */

export function createPluginApiRoutes(pluginRegistry: PluginRegistry) {
  return {
    // GET /api/plugins
    listPlugins: () => pluginRegistry.list(),

    // GET /api/plugins/:id
    getPlugin: (id: string) => {
      const plugins = pluginRegistry.list();
      return plugins.find((p) => p.id === id);
    },
  };
}

export function createSkillApiRoutes(skillRegistry: SkillRegistry) {
  return {
    // GET /api/skills
    listSkills: () =>
      skillRegistry.list().map((skill) => ({
        id: skill.id,
        name: skill.name,
        description: skill.description,
        version: skill.version,
        permissions: skill.permissions,
      })),

    // GET /api/skills/:id
    getSkill: (id: string) => {
      const skills = skillRegistry.list();
      const skill = skills.find((s) => s.id === id);
      if (!skill) return null;

      return {
        id: skill.id,
        name: skill.name,
        description: skill.description,
        version: skill.version,
        permissions: skill.permissions,
        tools: skill.tools().map((t) => ({
          name: t.name,
          description: t.description,
        })),
      };
    },
  };
}

// ============ 动态加载示例 ============

/**
 * 从文件系统动态加载 Plugins（高级示例）
 */
export async function dynamicallyLoadPlugins(
  pluginDir: string,
  pluginRegistry: PluginRegistry,
  logger: Logger
) {
  // 使用 fs.readdirSync 扫描 plugins 目录
  // 导入每个 plugin 并注册

  // 伪代码：
  // const files = fs.readdirSync(pluginDir);
  // for (const file of files) {
  //   if (file.endsWith('.js') && !file.endsWith('.example.js')) {
  //     const module = await import(path.join(pluginDir, file));
  //     const createPlugin = module.default;
  //     const plugin = createPlugin();
  //     pluginRegistry.register(plugin);
  //     logger.info(`Loaded plugin: ${plugin.id}`);
  //   }
  // }
}

/**
 * 从文件系统动态加载 Skills（高级示例）
 */
export async function dynamicallyLoadSkills(
  skillDir: string,
  skillRegistry: SkillRegistry,
  logger: Logger
) {
  // 类似于 dynamicallyLoadPlugins
  // 扫描 skills 目录并导入每个 skill
}
