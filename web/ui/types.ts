export type TabId =
  | 'dashboard'
  | 'settings'
  | 'providers'
  | 'memory'
  | 'memes'
  | 'plugins'
  | 'skills'
  | 'onebot'
  | 'commands'
  | 'logs';

export type HealthResponse = {
  ok: boolean;
};

export type Skill = {
  id: string;
  name: string;
  description: string;
  version: string;
  permissions: string[];
};

export type Plugin = {
  id: string;
  name: string;
  description: string;
  version: string;
};

export type Provider = {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
};

export type ModelLibraryItem = {
  id: string;
  providerId: string;
  name: string;
  model: string;
  supportsVision: boolean;
  supportsReasoning: boolean;
  reasoningEffort: 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
};

export type RuntimeModel = {
  role: string;
  name: string;
  model: string;
  baseUrl: string;
  supportsVision: boolean;
  supportsReasoning: boolean;
  reasoningEffort: string;
};

export type RuntimeStatus = {
  bot: {
    name: string;
    persona: string;
  };
  http: {
    host: string;
    port: number;
  };
  logging: {
    level: string;
  };
  webUi: {
    autoStart: boolean;
    serving: boolean;
    rootAvailable: boolean;
  };
  oneBot: {
    enabled: boolean;
    path: string;
    host: string;
    port: number;
    accessTokenConfigured: boolean;
    restrictSourceHosts: boolean;
    allowedSourceHosts: string[];
    blockPublicRequests: boolean;
    wakeKeywords: string[];
  };
  memes: {
    enabled: boolean;
    allowedCategories: string[];
    availableCategories: string[];
    total: number;
    active: number;
    disabled: number;
    animated: number;
    disabledMemes: string[];
  };
  providers: Provider[];
  modelLibrary: ModelLibraryItem[];
  roleAssignments: Record<string, string>;
  models: RuntimeModel[];
  storage: {
    messages: number;
    images: number;
  };
  openMemory: {
    configured: boolean;
    mode: 'local' | 'remote';
    baseUrl?: string;
    apiKeyConfigured: boolean;
  };
  commands: {
    masters: string[];
    commandPermissions: Record<string, string>;
    registered: Array<{
      trigger: string;
      description: string;
      defaultPermission: string;
      effectivePermission: string;
    }>;
  };
  paths: {
    pluginsDir: string;
    skillsDir: string;
    dbPath: string;
  };
};

export type LogEntry = {
  level: number;
  time: number;
  pid: number;
  hostname: string;
  msg: string;
  [key: string]: unknown;
};

export type RecentImage = {
  id: number;
  imageHash: string;
  messageId?: string;
  userId?: string;
  groupId?: string;
  url?: string;
  fileId?: string;
  summary?: string;
  ocrText?: string;
  tags: string[];
  createdAt: string;
};

export type MemeAsset = {
  id: string;
  category: string;
  name: string;
  filename: string;
  relativePath: string;
  extension: string;
  mimeType: string;
  animated: boolean;
  size: number;
  url: string;
  disabled: boolean;
};

export type MemeCategorySummary = {
  category: string;
  count: number;
};

export type MemeLibraryResponse = {
  root: string;
  categories: MemeCategorySummary[];
  memes: MemeAsset[];
  config: {
    enabled: boolean;
    allowedCategories: string[];
    disabledMemes: string[];
  };
};

export type ConfigPatch = {
  bot?: Partial<RuntimeStatus['bot']>;
  logging?: Partial<RuntimeStatus['logging']>;
  providers?: Provider[];
  modelLibrary?: ModelLibraryItem[];
  roleAssignments?: Record<string, string>;
  oneBot?: Partial<RuntimeStatus['oneBot']>;
  commands?: Partial<Pick<RuntimeStatus['commands'], 'masters' | 'commandPermissions'>>;
  memes?: Partial<Pick<RuntimeStatus['memes'], 'enabled' | 'allowedCategories' | 'disabledMemes'>>;
};
