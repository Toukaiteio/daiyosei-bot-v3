import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentRuntime } from '../src/agent/agentRuntime.js';

const agentConfigs: any[] = [];
const providerConfigs: any[] = [];
const runMock = vi.fn(async (_agent: unknown, input: string) => ({
  finalOutput: `final:${input}`,
}));

vi.mock('@openai/agents', () => {
  class MockAgent {
    constructor(config: any) {
      agentConfigs.push(config);
    }
  }

  class MockRunner {
    constructor(public readonly options: any) {}

    run = runMock;
  }

  const webSearchTool = vi.fn((options: any = {}) => ({
    type: 'hosted_tool',
    name: options.name ?? 'web_search',
    providerData: {
      type: 'web_search',
      search_context_size: options.searchContextSize ?? 'medium',
    },
  }));

  class OpenAIProvider {
    constructor(options: any) {
      providerConfigs.push(options);
    }

    close = vi.fn();
  }

  return {
    Agent: MockAgent,
    OpenAIProvider,
    Runner: MockRunner,
    webSearchTool,
  };
});

beforeEach(() => {
  agentConfigs.length = 0;
  providerConfigs.length = 0;
  runMock.mockClear();
});

describe('search model', () => {
  it('routes to the configured search model without injecting local tools', async () => {
    const runtime = new AgentRuntime({
      config: {
        bot: {
          name: 'Cirno',
          persona: 'persona',
        },
        models: [
          {
            role: 'search',
            name: 'search',
            baseUrl: 'https://api.openai.com/v1',
            apiKey: 'test-key',
            model: 'gpt-5.1',
            supportsVision: false,
            supportsReasoning: false,
            reasoningEffort: 'medium',
            useResponsesApi: true,
          },
        ],
      } as any,
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        trace: vi.fn(),
      } as any,
      skills: {
        toTools: () => [],
      } as any,
      plugins: {
        toTools: () => [],
        getInjectedInstructions: () => [],
      } as any,
    });

    const result = await runtime.runSearchQuery('2025 hltv top1');

    expect(result?.output).toBe('final:2025 hltv top1');
    expect(providerConfigs[0]).toMatchObject({
      apiKey: 'test-key',
      baseURL: 'https://api.openai.com/v1',
      useResponses: true,
    });
    expect(agentConfigs[0]?.tools).toEqual([]);
    expect(String(agentConfigs[0]?.instructions)).toContain('available search capability');
  });

  it('still routes to a configured search model even without the Responses API', async () => {
    const runtime = new AgentRuntime({
      config: {
        bot: {
          name: 'Cirno',
          persona: 'persona',
        },
        models: [
          {
            role: 'search',
            name: 'search',
            baseUrl: 'https://api.openai.com/v1',
            apiKey: 'test-key',
            model: 'gpt-5.1',
            supportsVision: false,
            supportsReasoning: false,
            reasoningEffort: 'medium',
            useResponsesApi: false,
          },
        ],
      } as any,
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        trace: vi.fn(),
      } as any,
      skills: {
        toTools: () => [],
      } as any,
      plugins: {
        toTools: () => [],
        getInjectedInstructions: () => [],
      } as any,
    });

    const result = await runtime.runSearchQuery('2025 hltv top1');

    expect(result?.output).toBe('final:2025 hltv top1');
    expect(agentConfigs[0]?.tools).toEqual([]);
    expect(String(agentConfigs[0]?.instructions)).toContain('available search capability');
  });
});
