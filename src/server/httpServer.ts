import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import Fastify, { type FastifyInstance, type FastifyReply } from 'fastify';
import type { Logger } from 'pino';
import type { AgentRuntime } from '../agent/agentRuntime.js';
import type { AppConfig } from '../config/schema.js';
import type { MemeLibrary } from '../memes/library.js';
import type { PluginRegistry } from '../plugins/registry.js';
import type { SkillRegistry } from '../skills/registry.js';
import type { StorageDatabase } from '../storage/database.js';
import { OneBotGateway } from '../adapters/onebot/gateway.js';
import type { CommandRegistry } from '../commands/registry.js';
import { getRecentLogs } from '../logger.js';

type ConfigUpdateRequest = {
  bot?: Partial<AppConfig['bot']>;
  logging?: Partial<AppConfig['logging']>;
  providers?: AppConfig['providers'];
  modelLibrary?: AppConfig['modelLibrary'];
  roleAssignments?: AppConfig['roleAssignments'];
  oneBot?: Partial<AppConfig['oneBot']>;
  commands?: Partial<AppConfig['commands']>;
  memes?: Partial<AppConfig['memes']>;
};

export class HttpServer {
  private readonly config: AppConfig;
  private readonly logger: Logger;
  private readonly webUiRoot: string;
  private readonly webUiAssetsRoot: string;
  private readonly webUiEnabled: boolean;
  private readonly memes: MemeLibrary;
  private readonly server: FastifyInstance;

  constructor(options: {
    config: AppConfig;
    logger: Logger;
    agentRuntime: AgentRuntime;
    plugins: PluginRegistry;
    skills: SkillRegistry;
    storage: StorageDatabase;
    memes: MemeLibrary;
    commandRegistry: CommandRegistry;
  }) {
    this.config = options.config;
    this.logger = options.logger;
    this.webUiRoot = resolve(process.cwd(), 'dist-web');
    this.webUiAssetsRoot = resolve(this.webUiRoot, 'assets');
    this.webUiEnabled = options.config.webUi.autoStart && existsSync(join(this.webUiRoot, 'index.html'));
    this.memes = options.memes;
    this.server = Fastify({
      logger: { level: options.logger.level },
    });
    void this.server.register(cors, { origin: true });
    void this.server.register(async (instance) => {
      await instance.register(websocket);
      new OneBotGateway({
        config: options.config,
        logger: options.logger,
        agentRuntime: options.agentRuntime,
        storage: options.storage,
        memes: options.memes,
        commandRegistry: options.commandRegistry,
      }).register(instance);
    });

    this.server.get('/health', async () => ({ ok: true }));
    this.server.get('/api/status', async () => {
      return {
        bot: options.config.bot,
        http: options.config.http,
        logging: {
          level: options.config.logging.level,
        },
        webUi: {
          autoStart: options.config.webUi.autoStart,
          serving: this.webUiEnabled,
          rootAvailable: existsSync(join(this.webUiRoot, 'index.html')),
        },
        oneBot: {
          enabled: options.config.oneBot.enabled,
          host: options.config.oneBot.host,
          port: options.config.oneBot.port,
          path: options.config.oneBot.path,
          accessTokenConfigured: Boolean(options.config.oneBot.accessToken),
          restrictSourceHosts: options.config.oneBot.restrictSourceHosts,
          allowedSourceHosts: options.config.oneBot.allowedSourceHosts,
          blockPublicRequests: options.config.oneBot.blockPublicRequests,
          wakeKeywords: options.config.oneBot.wakeKeywords,
        },
        memes: {
          enabled: options.config.memes.enabled,
          allowedCategories: options.config.memes.allowedCategories,
          disabledMemes: options.config.memes.disabledMemes,
          availableCategories: options.memes.listCategories({
            allowedCategories: options.config.memes.allowedCategories,
            disabledMemes: options.config.memes.disabledMemes,
          }),
          total: options.memes.all().length,
          active: options.memes.list({
            allowedCategories: options.config.memes.allowedCategories,
            disabledMemes: options.config.memes.disabledMemes,
          }).length,
          disabled: options.config.memes.disabledMemes.length,
          animated: options.memes
            .list({
              allowedCategories: options.config.memes.allowedCategories,
              disabledMemes: options.config.memes.disabledMemes,
            })
            .filter((meme) => meme.animated).length,
        },
        providers: (options.config as any).providers || [],
        modelLibrary: (options.config as any).modelLibrary || [],
        roleAssignments: (options.config as any).roleAssignments || {},
        models: options.config.models.map((model) => ({
          role: model.role,
          name: model.name,
          model: model.model,
          baseUrl: model.baseUrl,
          supportsVision: model.supportsVision,
          supportsReasoning: model.supportsReasoning,
          reasoningEffort: model.reasoningEffort,
        })),
        storage: options.storage.stats(),
        openMemory: {
          configured: true,
          mode: options.config.openMemory.baseUrl ? 'remote' : 'local',
          baseUrl: options.config.openMemory.baseUrl,
          apiKeyConfigured: Boolean(options.config.openMemory.apiKey),
        },
        commands: {
          masters: options.config.commands.masters,
          commandPermissions: options.config.commands.commandPermissions,
          registered: options.commandRegistry.list().map((cmd) => ({
            trigger: cmd.trigger,
            description: cmd.description,
            defaultPermission: cmd.defaultPermission,
            effectivePermission: options.config.commands.commandPermissions[cmd.trigger] ?? cmd.defaultPermission,
          })),
        },
        paths: {
          pluginsDir: options.config.paths.pluginsDir,
          skillsDir: options.config.paths.skillsDir,
          dbPath: options.config.storage.dbPath,
        },
      };
    });
    this.server.get('/api/plugins', async () => ({
      plugins: options.plugins.list(),
      tools: options.plugins.toTools().map((item) => item.name),
    }));
    this.server.get<{
      Querystring: { userId?: string; groupId?: string; since?: string; limit?: string };
    }>('/api/images/recent', async (request) => ({
      images: options.storage.findRecentImages({
        userId: request.query.userId,
        groupId: request.query.groupId,
        since: request.query.since ? new Date(request.query.since) : undefined,
        limit: request.query.limit ? Number(request.query.limit) : undefined,
      }),
    }));
    this.server.get('/api/skills', async () => ({
      skills: options.skills.list().map((skill) => ({
        id: skill.id,
        name: skill.name,
        description: skill.description,
        version: skill.version,
        permissions: skill.permissions,
      })),
    }));
    this.server.get('/api/logs', async () => ({
      logs: getRecentLogs(),
    }));
    this.server.get('/api/memes', async () => {
      const snapshot = options.memes.snapshot();
      return {
        root: snapshot.root,
        categories: snapshot.categories.map((category) => ({
          category,
          count: snapshot.memes.filter((meme) => meme.category === category).length,
        })),
        memes: options.memes.all().map((meme) => ({
          id: meme.id,
          category: meme.category,
          name: meme.name,
          filename: meme.filename,
          relativePath: meme.relativePath,
          extension: meme.extension,
          mimeType: meme.mimeType,
          animated: meme.animated,
          size: meme.size,
          disabled: options.config.memes.disabledMemes
            .map((value) => value.trim().replaceAll('\\', '/').toLowerCase())
            .includes(meme.id.toLowerCase()),
          url: memeAssetUrl(meme.relativePath),
        })),
        config: options.config.memes,
      };
    });
    this.server.get<{ Params: { '*': string } }>('/api/memes/assets/*', async (request, reply) => {
      const assetPath = String(request.params['*'] ?? '');
      return this.sendMemeAsset(assetPath, reply);
    });
    this.server.get('/api/config', async () => {
      const persistentPath = join(process.cwd(), 'data', 'config.json');
      if (existsSync(persistentPath)) {
        return JSON.parse(await readFile(persistentPath, 'utf8'));
      }
      return {
        bot: options.config.bot,
        logging: options.config.logging,
        providers: (options.config as any).providers || [],
        modelLibrary: (options.config as any).modelLibrary || [],
        roleAssignments: (options.config as any).roleAssignments || {},
        models: options.config.models,
        memes: options.config.memes,
        oneBot: {
          ...options.config.oneBot,
          accessToken: undefined,
        },
      };
    });
    this.server.post<{ Body: ConfigUpdateRequest }>('/api/config', async (request) => {
      const persistentPath = join(process.cwd(), 'data', 'config.json');
      const updates = request.body;
      
      let currentConfig: any = {};
      if (existsSync(persistentPath)) {
        currentConfig = JSON.parse(await readFile(persistentPath, 'utf8'));
      }

      // Merge logic - prioritize incoming updates
      const mergedConfig = {
        ...currentConfig,
        bot: { ...(currentConfig.bot || {}), ...(updates.bot || {}) },
        logging: { ...(currentConfig.logging || {}), ...(updates.logging || {}) },
        providers: updates.providers ?? currentConfig.providers ?? [],
        modelLibrary: updates.modelLibrary ?? currentConfig.modelLibrary ?? [],
        roleAssignments: updates.roleAssignments ?? currentConfig.roleAssignments ?? {},
        memes: { ...(currentConfig.memes || {}), ...(updates.memes || {}) },
        oneBot: { ...(currentConfig.oneBot || {}), ...(updates.oneBot || {}) },
        commands: { ...(currentConfig.commands || {}), ...(updates.commands || {}) },
      };

      // Update in-memory config object for immediate feedback
      if (updates.bot) {
        options.config.bot.name = updates.bot.name ?? options.config.bot.name;
        options.config.bot.persona = updates.bot.persona ?? options.config.bot.persona;
      }
      if (updates.logging) {
        options.config.logging.level = updates.logging.level ?? options.config.logging.level;
      }
      if (updates.providers) (options.config as any).providers = updates.providers;
      if (updates.modelLibrary) (options.config as any).modelLibrary = updates.modelLibrary;
      if (updates.roleAssignments) (options.config as any).roleAssignments = updates.roleAssignments;
      if (updates.memes) {
        options.config.memes.enabled = updates.memes.enabled ?? options.config.memes.enabled;
        options.config.memes.allowedCategories =
          updates.memes.allowedCategories ?? options.config.memes.allowedCategories;
        options.config.memes.disabledMemes =
          updates.memes.disabledMemes ?? options.config.memes.disabledMemes;
      }
      if (updates.oneBot) {
        options.config.oneBot.enabled = updates.oneBot.enabled ?? options.config.oneBot.enabled;
        options.config.oneBot.host = updates.oneBot.host ?? options.config.oneBot.host;
        options.config.oneBot.port = updates.oneBot.port ?? options.config.oneBot.port;
        options.config.oneBot.path = updates.oneBot.path ?? options.config.oneBot.path;
        options.config.oneBot.accessToken = updates.oneBot.accessToken ?? options.config.oneBot.accessToken;
        options.config.oneBot.restrictSourceHosts =
          updates.oneBot.restrictSourceHosts ?? options.config.oneBot.restrictSourceHosts;
        options.config.oneBot.allowedSourceHosts =
          updates.oneBot.allowedSourceHosts ?? options.config.oneBot.allowedSourceHosts;
        options.config.oneBot.blockPublicRequests =
          updates.oneBot.blockPublicRequests ?? options.config.oneBot.blockPublicRequests;
        options.config.oneBot.wakeKeywords =
          updates.oneBot.wakeKeywords ?? options.config.oneBot.wakeKeywords;
      }
      if (updates.commands) {
        options.config.commands.masters =
          updates.commands.masters ?? options.config.commands.masters;
        options.config.commands.commandPermissions =
          updates.commands.commandPermissions ?? options.config.commands.commandPermissions;
      }

      await writeFile(persistentPath, JSON.stringify(mergedConfig, null, 2));
      return { ok: true };
    });
    this.server.post<{ Body: { baseUrl: string; apiKey: string } }>('/api/proxy/models', async (request) => {
      const { baseUrl, apiKey } = request.body;
      try {
        const response = await fetch(`${baseUrl.replace(/\/$/, '')}/models`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return data;
      } catch (error: any) {
        return { error: error.message };
      }
    });
    this.server.post<{ Body: { input: string; userId?: string; groupId?: string } }>(
      '/api/agent/run',
      async (request) => options.agentRuntime.run(request.body),
    );

    if (this.webUiEnabled) {
      this.registerWebUiRoutes();
    } else if (options.config.webUi.autoStart) {
      this.logger.warn(
        {
          root: this.webUiRoot,
        },
        'web UI auto-start is enabled, but dist-web/index.html was not found. Run npm run web:build first.',
      );
    }
  }

  async start() {
    this.logger.info(
      {
        host: this.config.http.host,
        port: this.config.http.port,
      },
      'starting HTTP server',
    );
    try {
      await this.server.listen({
        host: this.config.http.host,
        port: this.config.http.port,
      });
    } catch (error) {
      if (isAddressInUseError(error)) {
        const message = `HTTP port ${this.config.http.port} is already in use. Stop the other process or set HTTP_PORT to a different value.`;
        this.logger.error(
          {
            host: this.config.http.host,
            port: this.config.http.port,
            suggestion: 'Set HTTP_PORT=3001 or stop the process using the port.',
          },
          message,
        );
        throw new Error(message, { cause: error });
      }
      throw error;
    }
    this.logger.info(
      {
        host: this.config.http.host,
        port: this.config.http.port,
      },
      'HTTP server started',
    );
  }

  async stop() {
    await this.server.close();
  }

  private registerWebUiRoutes() {
    this.server.get('/', async (_, reply) => this.sendWebUiIndex(reply));
    this.server.get<{ Params: { '*': string } }>('/assets/*', async (request, reply) => {
      const assetPath = String(request.params['*'] ?? '');
      return this.sendWebUiAsset(assetPath, reply);
    });

    this.server.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith('/api/') || request.url === '/health') {
        reply.code(404);
        return reply.send({ message: 'Not found' });
      }

      if (request.url.startsWith('/assets/')) {
        reply.code(404);
        return reply.send({ message: 'Asset not found' });
      }

      return this.sendWebUiIndex(reply);
    });
  }

  private async sendWebUiIndex(reply: FastifyReply) {
    const indexPath = join(this.webUiRoot, 'index.html');
    reply.type('text/html; charset=utf-8');
    return reply.send(await readFile(indexPath, 'utf8'));
  }

  private async sendWebUiAsset(assetPath: string, reply: FastifyReply) {
    const safePath = resolve(this.webUiAssetsRoot, assetPath);
    if (
      safePath !== this.webUiAssetsRoot &&
      !safePath.startsWith(`${this.webUiAssetsRoot}\\`) &&
      !safePath.startsWith(`${this.webUiAssetsRoot}/`)
    ) {
      reply.code(400);
      return reply.send({ message: 'Invalid asset path' });
    }

    const contentType = contentTypeFromPath(assetPath);
    if (!contentType) {
      reply.code(415);
      return reply.send({ message: 'Unsupported asset type' });
    }

    reply.type(contentType);
    try {
      return reply.send(await readFile(safePath));
    } catch {
      reply.code(404);
      return reply.send({ message: 'Asset not found' });
    }
  }

  private async sendMemeAsset(assetPath: string, reply: FastifyReply) {
    const root = this.memes.getRoot();
    const safePath = resolve(root, assetPath);
    if (safePath !== root && !safePath.startsWith(`${root}\\`) && !safePath.startsWith(`${root}/`)) {
      reply.code(400);
      return reply.send({ message: 'Invalid meme asset path' });
    }

    const contentType = contentTypeFromPath(assetPath);
    if (!contentType) {
      reply.code(415);
      return reply.send({ message: 'Unsupported meme asset type' });
    }

    reply.type(contentType);
    try {
      return reply.send(await readFile(safePath));
    } catch {
      reply.code(404);
      return reply.send({ message: 'Meme asset not found' });
    }
  }
}

function isAddressInUseError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'EADDRINUSE'
  );
}

function contentTypeFromPath(assetPath: string) {
  switch (extname(assetPath).toLowerCase()) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
      return 'application/javascript; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.gif':
      return 'image/gif';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.ico':
      return 'image/x-icon';
    case '.map':
      return 'application/json; charset=utf-8';
    default:
      return undefined;
  }
}

function memeAssetUrl(relativePath: string) {
  return `/api/memes/assets/${relativePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')}`;
}
