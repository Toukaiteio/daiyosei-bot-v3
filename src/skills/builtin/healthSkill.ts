import { tool } from '@openai/agents';
import { z } from 'zod';
import type { AgentSkill } from '../types.js';

export function createHealthSkill(): AgentSkill {
  return {
    id: 'builtin.health',
    name: 'Health Check',
    description: 'Basic runtime health and identity checks.',
    version: '0.1.0',
    permissions: [],
    tools() {
      return [
        tool({
          name: 'runtime_health',
          description: 'Return basic runtime health information.',
          parameters: z.object({}),
          execute: () => ({
            ok: true,
            service: 'daiyosei-bot-v3',
            timestamp: new Date().toISOString(),
          }),
        }),
      ];
    },
  };
}
