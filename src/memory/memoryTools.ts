import { tool } from '@openai/agents';
import { z } from 'zod';
import type { OpenMemoryClient } from './openMemoryClient.js';

export function createMemoryTools(memory: OpenMemoryClient) {
  return [
    tool({
      name: 'search_user_memory',
      description: 'Search cross-group long-term memory for a user. Returns relevant memories based on semantic similarity.',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID to search memories for' },
          query: { type: 'string', description: 'Search query to find relevant memories' },
          groupId: { type: 'string', description: 'Optional group ID to filter memories within a group' },
          limit: { type: 'integer', minimum: 1, maximum: 20, description: 'Maximum number of results to return (default: 5)' },
        },
        required: ['userId', 'query'],
        additionalProperties: false,
      },
      execute: async (input: any) => {
        return await memory.search(input);
      },
    }),

    tool({
      name: 'store_user_memory',
      description: 'Store an important long-term memory for a user. The memory will be automatically classified and indexed for future retrieval.',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID to store memory for' },
          content: { type: 'string', description: 'The memory content to store. Be concise and clear.' },
          groupId: { type: 'string', description: 'Optional group ID to organize memories into groups' },
          metadata: { type: 'object', description: 'Optional metadata to attach to the memory' },
        },
        required: ['userId', 'content'],
        additionalProperties: false,
      },
      execute: async (input: any) => {
        await memory.add(input);
        return {
          success: true,
          message: memory.isConfigured() ? 'Memory stored remotely' : 'Memory stored locally',
          configured: memory.isConfigured(),
        };
      },
    }),

    tool({
      name: 'delete_user_memory',
      description: 'Delete a specific memory by ID. Use this to remove outdated or incorrect information.',
      parameters: {
        type: 'object',
        properties: {
          memoryId: { type: 'string', description: 'ID of the memory to delete' },
        },
        required: ['memoryId'],
        additionalProperties: false,
      },
      execute: async (input: any) => {
        const success = await memory.delete(input.memoryId);
        return {
          success,
          message: success ? 'Memory deleted successfully' : 'Failed to delete memory',
        };
      },
    }),

    tool({
      name: 'reinforce_user_memory',
      description: 'Reinforce a memory by ID to increase its importance and reduce decay.',
      parameters: {
        type: 'object',
        properties: {
          memoryId: { type: 'string', description: 'ID of the memory to reinforce' },
        },
        required: ['memoryId'],
        additionalProperties: false,
      },
      execute: async (input: any) => {
        const success = await memory.reinforce(input.memoryId);
        return {
          success,
          message: success ? 'Memory reinforced successfully' : 'Failed to reinforce memory',
        };
      },
    }),
  ];
}
