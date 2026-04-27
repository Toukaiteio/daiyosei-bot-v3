import type { ModelProfile, ModelRole } from '../config/schema.js';

export type AgentRequest = {
  input: string;
  userId?: string;
  groupId?: string;
  preferredRole?: ModelRole;
};

export type AgentResponse = {
  output: string;
  model: ModelProfile;
};
