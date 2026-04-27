import { tool } from '@openai/agents';
import { z } from 'zod';
import type { SkillManifest } from './manifest.js';
import type { AgentSkill } from './types.js';

export function createManifestSkill(manifest: SkillManifest): AgentSkill {
  return {
    id: manifest.id,
    name: manifest.name,
    description: manifest.description,
    version: manifest.version,
    permissions: manifest.permissions,
    tools() {
      return [
        tool({
          name: `use_skill_${toToolName(manifest.id)}`,
          description: `Use skill: ${manifest.description || manifest.name}`,
          parameters: z.object({
            task: z.string().describe('The task this skill should help solve.'),
          }),
          execute: ({ task }) => ({
            skill: manifest.name,
            task,
            instruction: manifest.instruction,
            permissions: manifest.permissions,
          }),
        }),
      ];
    },
  };
}

function toToolName(id: string) {
  return id.replace(/[^a-zA-Z0-9_]/g, '_');
}
