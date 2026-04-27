import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  appConfigSchema,
  reasoningEffortSchema,
  type AppConfig,
  type ModelProfile,
  type ModelRole,
} from './schema.js';

type Env = Record<string, string | undefined>;

export function loadConfig(env: Env): AppConfig {
  const persistentPath = join(process.cwd(), 'data', 'config.json');
  let persistentConfig: any = {};
  if (existsSync(persistentPath)) {
    try {
      persistentConfig = JSON.parse(readFileSync(persistentPath, 'utf8'));
    } catch {
      // ignore
    }
  }

  const mainModel = readModelProfile(env, 'MAIN', 'main');
  const optionalModels = [
    readOptionalModelProfile(env, 'SEARCH', 'search'),
    readOptionalModelProfile(env, 'VISION', 'vision'),
    readOptionalModelProfile(env, 'REASONING', 'reasoning'),
  ].filter((profile): profile is ModelProfile => Boolean(profile));

  const providers = Array.isArray(persistentConfig.providers) ? persistentConfig.providers : [];
  const modelLibrary = Array.isArray(persistentConfig.modelLibrary) ? persistentConfig.modelLibrary : [];
  const roleAssignments = (persistentConfig.roleAssignments && typeof persistentConfig.roleAssignments === 'object') ? persistentConfig.roleAssignments : {};
  const persistentOneBot = persistentConfig.oneBot && typeof persistentConfig.oneBot === 'object' ? persistentConfig.oneBot : {};
  const persistentMemes = persistentConfig.memes && typeof persistentConfig.memes === 'object' ? persistentConfig.memes : {};
  const persistentCommands = persistentConfig.commands && typeof persistentConfig.commands === 'object' ? persistentConfig.commands : {};

  // Derive models array from roleAssignments, modelLibrary, and providers
  let derivedModels: ModelProfile[] = [];
  
  if (Object.keys(roleAssignments).length > 0 && modelLibrary.length > 0 && providers.length > 0) {
    for (const [role, modelId] of Object.entries(roleAssignments)) {
      const modelDef = modelLibrary.find((m: any) => m.id === modelId);
      if (modelDef) {
        const provider = providers.find((p: any) => p.id === modelDef.providerId);
        if (provider) {
          derivedModels.push({
            role: role as ModelRole,
            name: modelDef.name,
            model: modelDef.model,
            baseUrl: provider.baseUrl,
            apiKey: provider.apiKey,
            supportsVision: Boolean(modelDef.supportsVision),
            supportsReasoning: Boolean(modelDef.supportsReasoning),
            reasoningEffort: (modelDef.reasoningEffort as any) ?? 'medium',
            useResponsesApi: false,
          });
        }
      }
    }
  }

  // Fallback to env-based models if none derived or if main is missing
  if (derivedModels.length === 0 || !derivedModels.some(m => m.role === 'main')) {
    // If we have some derived models but no 'main', add the .env main model
    if (derivedModels.length > 0 && !derivedModels.some(m => m.role === 'main')) {
      derivedModels.push(mainModel);
    } else if (derivedModels.length === 0) {
      derivedModels = [mainModel, ...optionalModels];
    }
  }

  const openMemoryBaseUrl = env.OPENMEMORY_BASE_URL && env.OPENMEMORY_BASE_URL.trim() !== '' ? env.OPENMEMORY_BASE_URL : undefined;

  const config = {
    nodeEnv: env.NODE_ENV,
    http: {
      host: env.HTTP_HOST,
      port: env.HTTP_PORT,
    },
    bot: {
      name: persistentConfig.bot?.name ?? env.BOT_NAME,
      persona: persistentConfig.bot?.persona ?? env.BOT_PERSONA,
    },
    paths: {
      pluginsDir: env.PLUGINS_DIR,
      skillsDir: env.SKILLS_DIR,
    },
    logging: {
      level: persistentConfig.logging?.level ?? env.LOG_LEVEL,
    },
    webUi: {
      autoStart: parseBoolean(env.WEBUI_AUTO_START, true),
    },
    storage: {
      dbPath: env.STORAGE_DB_PATH,
    },
    providers,
    modelLibrary,
    roleAssignments,
    models: derivedModels,
    oneBot: {
      enabled: toBoolean(persistentOneBot.enabled, env.ONEBOT_ENABLED, true),
      host: toString(persistentOneBot.host, env.ONEBOT_HOST, '127.0.0.1'),
      port: toNumber(persistentOneBot.port, env.ONEBOT_PORT, 6199),
      path: toString(persistentOneBot.path, env.ONEBOT_PATH, '/onebot/v11'),
      accessToken: toString(persistentOneBot.accessToken, env.ONEBOT_ACCESS_TOKEN, undefined),
      restrictSourceHosts: toBoolean(persistentOneBot.restrictSourceHosts, env.ONEBOT_RESTRICT_SOURCE_HOSTS, false),
      allowedSourceHosts: parseStringList(
        persistentOneBot.allowedSourceHosts,
        env.ONEBOT_ALLOWED_SOURCE_HOSTS,
      ),
      blockPublicRequests: toBoolean(
        persistentOneBot.blockPublicRequests,
        env.ONEBOT_BLOCK_PUBLIC_REQUESTS,
        true,
      ),
      wakeKeywords: (() => {
        const kw = parseStringList(persistentOneBot.wakeKeywords, env.ONEBOT_WAKE_KEYWORDS);
        return kw.length > 0 ? kw : undefined;
      })(),
    },
    memes: {
      enabled: toBoolean(persistentMemes.enabled, env.MEMES_ENABLED, true),
      allowedCategories: parseStringList(
        persistentMemes.allowedCategories,
        env.MEMES_ALLOWED_CATEGORIES,
      ),
      disabledMemes: parseStringList(
        persistentMemes.disabledMemes,
        env.MEMES_DISABLED_MEMES,
      ),
    },
    commands: {
      masters: (() => {
        const list = parseStringList(persistentCommands.masters, env.BOT_MASTERS);
        return list.length > 0 ? list : undefined;
      })(),
      commandPermissions: (persistentCommands.commandPermissions && typeof persistentCommands.commandPermissions === 'object')
        ? persistentCommands.commandPermissions
        : undefined,
    },
    sandbox: {
      workspaceRoot: env.SANDBOX_WORKSPACE_ROOT,
      allowNetwork: parseBoolean(env.SANDBOX_ALLOW_NETWORK, false),
      allowPersistentWrites: parseBoolean(env.SANDBOX_ALLOW_PERSISTENT_WRITES, false),
      maxExecutionMs: toNumber(undefined, env.SANDBOX_MAX_EXECUTION_MS, 10000),
    },
    openMemory: {
      baseUrl: openMemoryBaseUrl,
      apiKey: env.OPENMEMORY_API_KEY,
    },
  };

  try {
    return appConfigSchema.parse(config);
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      console.error('Config validation failed:', JSON.stringify((error as any).errors, null, 2));
    }
    throw error;
  }
}

function readModelProfile(env: Env, prefix: string, role: ModelProfile['role']): ModelProfile {
  return {
    role,
    name: env[`${prefix}_MODEL_NAME`] ?? role,
    baseUrl: env[`${prefix}_MODEL_BASE_URL`] ?? env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
    apiKey: env[`${prefix}_MODEL_API_KEY`] ?? env.OPENAI_API_KEY ?? 'missing-api-key',
    model: env[`${prefix}_MODEL`] ?? env.OPENAI_MODEL ?? 'gpt-5.1',
    supportsVision: parseBoolean(env[`${prefix}_MODEL_SUPPORTS_VISION`], false),
    supportsReasoning: parseBoolean(env[`${prefix}_MODEL_SUPPORTS_REASONING`], true),
    reasoningEffort: reasoningEffortSchema.parse(env[`${prefix}_MODEL_REASONING_EFFORT`] ?? 'medium'),
    useResponsesApi: parseBoolean(env[`${prefix}_MODEL_USE_RESPONSES_API`], false),
  };
}

function readOptionalModelProfile(
  env: Env,
  prefix: string,
  role: ModelProfile['role'],
): ModelProfile | undefined {
  if (!env[`${prefix}_MODEL`] && !env[`${prefix}_MODEL_API_KEY`] && !env[`${prefix}_MODEL_BASE_URL`]) {
    return undefined;
  }

  return readModelProfile(env, prefix, role);
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) {
    return fallback;
  }
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function toBoolean(persistentValue: unknown, envValue: string | undefined, fallback: boolean) {
  if (typeof persistentValue === 'boolean') {
    return persistentValue;
  }
  return parseBoolean(envValue, fallback);
}

function toString(persistentValue: unknown, envValue: string | undefined, fallback: string | undefined) {
  if (typeof persistentValue === 'string' && persistentValue.trim() !== '') {
    return persistentValue;
  }
  if (typeof envValue === 'string' && envValue.trim() !== '') {
    return envValue;
  }
  return fallback;
}

function toNumber(persistentValue: unknown, envValue: string | undefined, fallback: number) {
  if (typeof persistentValue === 'number' && Number.isFinite(persistentValue)) {
    return persistentValue;
  }
  if (typeof envValue === 'string' && envValue.trim() !== '') {
    const parsed = Number(envValue);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function parseStringList(persistentValue: unknown, envValue: string | undefined) {
  if (Array.isArray(persistentValue)) {
    return persistentValue.map((value) => String(value).trim()).filter(Boolean);
  }

  if (typeof envValue === 'string' && envValue.trim() !== '') {
    return envValue
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
  }

  return [];
}
