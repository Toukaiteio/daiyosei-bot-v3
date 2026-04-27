import { z } from 'zod';

export const reasoningEffortSchema = z.enum(['none', 'minimal', 'low', 'medium', 'high', 'xhigh']);
export const logLevelSchema = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']);

export const modelRoleSchema = z.enum(['main', 'search', 'vision', 'reasoning']);

export const modelProfileSchema = z.object({
  role: modelRoleSchema,
  name: z.string().min(1),
  baseUrl: z.string().url(),
  apiKey: z.string(),
  model: z.string().min(1),
  supportsVision: z.boolean().default(false),
  supportsReasoning: z.boolean().default(false),
  reasoningEffort: reasoningEffortSchema.default('medium'),
  useResponsesApi: z.boolean().default(false),
});

export const sandboxConfigSchema = z.object({
  workspaceRoot: z.string().default(process.cwd()),
  allowNetwork: z.boolean().default(false),
  allowPersistentWrites: z.boolean().default(false),
  maxExecutionMs: z.coerce.number().int().positive().default(10_000),
});

export const oneBotConfigSchema = z.object({
  enabled: z.coerce.boolean().default(true),
  host: z.string().default('127.0.0.1'),
  port: z.coerce.number().int().positive().default(6199),
  path: z.string().default('/onebot/v11'),
  accessToken: z.string().optional(),
  restrictSourceHosts: z.boolean().default(false),
  allowedSourceHosts: z.array(z.string().min(1)).default([]),
  blockPublicRequests: z.boolean().default(true),
  wakeKeywords: z.array(z.string().min(1)).default(['琪露诺', 'Cirno', '天才']),
});

export const commandsConfigSchema = z.object({
  masters: z.array(z.string().min(1)).default([]),
  commandPermissions: z.record(z.string(), z.enum(['master_only', 'everyone'])).default({}),
});

export const memeConfigSchema = z.object({
  enabled: z.boolean().default(true),
  allowedCategories: z.array(z.string().min(1)).default([]),
  disabledMemes: z.array(z.string().min(1)).default([]),
});

export const appConfigSchema = z.object({
  nodeEnv: z.string().default('development'),
  http: z.object({
    host: z.string().default('127.0.0.1'),
    port: z.coerce.number().int().positive().default(3000),
  }),
  bot: z.object({
    name: z.string().default('Daiyosei'),
    persona: z.string().default('Cirno-inspired problem solving agent'),
  }),
  paths: z.object({
    pluginsDir: z.string().default('plugins'),
    skillsDir: z.string().default('skills'),
  }),
  logging: z.object({
    level: logLevelSchema.default('info'),
  }),
  webUi: z.object({
    autoStart: z.boolean().default(true),
  }),
  storage: z.object({
    dbPath: z.string().default('data/daiyosei.db'),
  }),
  providers: z.array(z.object({
    id: z.string(),
    name: z.string(),
    baseUrl: z.string().url(),
    apiKey: z.string(),
  })).default([]),
  modelLibrary: z.array(z.object({
    id: z.string(),
    providerId: z.string(),
    name: z.string(),
    model: z.string(),
    supportsVision: z.boolean().default(false),
    supportsReasoning: z.boolean().default(false),
    reasoningEffort: reasoningEffortSchema.default('medium'),
  })).default([]),
  roleAssignments: z.record(z.string(), z.string()).default({}),
  models: z.array(modelProfileSchema).min(1),
  oneBot: oneBotConfigSchema,
  commands: commandsConfigSchema.default({ masters: [], commandPermissions: {} }),
  memes: memeConfigSchema,
  sandbox: sandboxConfigSchema,
  openMemory: z.object({
    baseUrl: z.string().url().optional(),
    apiKey: z.string().optional(),
  }),
});

export type ReasoningEffort = z.infer<typeof reasoningEffortSchema>;
export type LogLevel = z.infer<typeof logLevelSchema>;
export type ModelRole = z.infer<typeof modelRoleSchema>;
export type ModelProfile = z.infer<typeof modelProfileSchema>;
export type MemeConfig = z.infer<typeof memeConfigSchema>;
export type CommandsConfig = z.infer<typeof commandsConfigSchema>;
export type AppConfig = z.infer<typeof appConfigSchema>;
