import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSearchPlugin } from '../src/plugins/searchPlugin.js';

const registeredTools: any[] = [];
const runSearchQuery = vi.fn(async (query: string) => ({
  output: `answer:${query}`,
}));

vi.mock('@openai/agents', () => {
  const tool = vi.fn((config: any) => config);
  return { tool };
});

beforeEach(() => {
  registeredTools.length = 0;
  runSearchQuery.mockClear();
});

describe('search plugin', () => {
  it('registers the highest-priority search tool', () => {
    const plugin = createSearchPlugin({
      agentRuntime: {
        runSearchQuery,
      } as any,
    });

    plugin.setup({
      registerTools: (tools) => registeredTools.push(...tools),
      registerCommand: vi.fn(),
    });

    expect(registeredTools).toHaveLength(1);
    expect(registeredTools[0]?.name).toBe('priority_search');
    expect(registeredTools[0]?.description).toContain('highest-priority search tool');
  });

  it('routes search directives through the configured search model', async () => {
    const plugin = createSearchPlugin({
      agentRuntime: {
        runSearchQuery,
      } as any,
    });

    await expect(
      plugin.resolveInlineDirective?.({
        name: 'priority_search',
        value: '2025 hltv top1',
        params: {},
        raw: '[[priority_search:2025 hltv top1]]',
        question: '2025 hltv top1',
      }),
    ).resolves.toBe('answer:2025 hltv top1');

    expect(runSearchQuery).toHaveBeenCalledWith('2025 hltv top1');
  });
});
