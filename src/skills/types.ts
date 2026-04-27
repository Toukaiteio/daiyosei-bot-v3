import type { Tool } from '@openai/agents';

export type AgentSkill = {
  id: string;
  name: string;
  description: string;
  version: string;
  permissions: string[];
  tools(): Tool[];
};
