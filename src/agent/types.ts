import type { AgentInputItem } from '@openai/agents';
import type { ModelProfile, ModelRole } from '../config/schema.js';

export type AgentRequest = {
  input: string;
  history?: AgentInputItem[];
  userId?: string;
  groupId?: string;
  preferredRole?: ModelRole;
};

export type AgentResponse = {
  output: string;
  model: ModelProfile;
};
