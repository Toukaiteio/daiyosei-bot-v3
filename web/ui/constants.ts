import {
  Activity,
  Cable,
  Database,
  LayoutDashboard,
  Plug,
  ShieldAlert,
  Smile,
  Settings,
  Terminal,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { TabId } from './types';

export const APP_VERSION = 'v0.1.0-alpha';

export const NAV_ITEMS: Array<{
  id: TabId;
  label: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Runtime overview and quick status',
    icon: LayoutDashboard,
  },
  {
    id: 'settings',
    label: 'Settings',
    description: 'Bot identity, logging, and runtime summary',
    icon: Settings,
  },
  {
    id: 'providers',
    label: 'Providers',
    description: 'Model providers, libraries, and role bindings',
    icon: Activity,
  },
  {
    id: 'memory',
    label: 'Memory',
    description: 'OpenMemory status and cached image records',
    icon: Database,
  },
  {
    id: 'memes',
    label: 'Memes',
    description: 'Meme library, categories, and preview gallery',
    icon: Smile,
  },
  {
    id: 'plugins',
    label: 'Plugins',
    description: 'Loaded plugins and manifest helper',
    icon: Plug,
  },
  {
    id: 'skills',
    label: 'Skills',
    description: 'Installed skills and manifest helper',
    icon: Wrench,
  },
  {
    id: 'onebot',
    label: 'OneBot',
    description: 'OneBot gateway status and connection details',
    icon: Cable,
  },
  {
    id: 'commands',
    label: 'Commands',
    description: 'Command permissions, master list, and $$ prefix rules',
    icon: ShieldAlert,
  },
  {
    id: 'logs',
    label: 'Logs',
    description: 'Live runtime logs',
    icon: Terminal,
  },
];

export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

export const MODEL_REASONING_LEVELS = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh'] as const;

export const DEFAULT_PROVIDER = {
  id: '',
  name: '',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
};

export const DEFAULT_MODEL = {
  id: '',
  providerId: '',
  name: '',
  model: '',
  supportsVision: false,
  supportsReasoning: false,
  reasoningEffort: 'medium' as const,
};

export const DEFAULT_SKILL_MANIFEST = {
  id: '',
  name: '',
  description: '',
  version: '0.0.0',
  permissions: '',
  instruction: 'Describe the behavior and the constraints for this skill.',
  enabled: true,
};

export const DEFAULT_PLUGIN_MANIFEST = {
  id: '',
  name: '',
  description: '',
  version: '0.0.0',
  entry: '',
  enabled: true,
};

export const DEFAULT_CS2_GUESS_PLUGIN_CONFIG = {
  enabled: true,
  gameDurationMinutes: 5,
  maxGuesses: 15,
};
