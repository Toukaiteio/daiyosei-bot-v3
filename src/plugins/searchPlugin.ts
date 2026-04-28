import { tool } from '@openai/agents';
import { z } from 'zod';
import type { AgentRuntime } from '../agent/agentRuntime.js';
import type { BotPlugin, InlineDirectiveContext } from './types.js';
import { emitAsyncMessage, scheduleAsyncWork } from './asyncExecution.js';

export function createSearchPlugin(options: { agentRuntime: AgentRuntime }): BotPlugin {
  const resolveInlineDirective = async (directive: InlineDirectiveContext) => {
    const executionMode = getDirectiveParam(directive, 'execution_mode', 'sync').toLowerCase();
    const pendingNotice = getDirectiveParam(directive, 'pending_notice');

    if (!isSearchDirective(directive.name)) {
      return undefined;
    }

    if (pendingNotice) {
      emitAsyncMessage(pendingNotice, directive);
    }

    if (executionMode === 'async') {
      void scheduleAsyncWork({
        context: directive,
        pendingNotice: undefined,
        queuedMessage: '',
        run: async () => runSearch(options.agentRuntime, directive.value),
        formatSuccess: (result) => result,
        formatError: (error) =>
          `搜索失败：${error instanceof Error ? error.message : String(error)}`,
      });
      return '';
    }

    return runSearch(options.agentRuntime, directive.value);
  };

  return {
    id: 'search',
    name: 'Search Plugin',
    description: 'Provides the highest-priority search tool backed by the configured search model.',
    instructions: [
      '- 当需要检索实时信息、最新排名、新闻、价格、赛事结果或文档时，优先使用 `priority_search`。',
      '- `priority_search` 是搜索场景的最高优先级工具；不要先手写搜索引擎 URL，也不要先用其他浏览器工具。',
      '- 决定搜索时，直接调用工具，不要先用文本说"我去搜一下"——把那句话填到 `pending_notice` 参数里即可，工具会替你发出去。',
      '- 如果搜索结果需要打开来源页，再额外使用 `browser_goto`。',
      '- 不要把搜索工具写成 `[[priority_search:...]]` 或旧版 `[[browser_search:...]]` 这种文本标签；只能通过真正的工具调用来执行。',
    ],
    resolveInlineDirective,
    setup(context) {
      context.registerTools([
        tool({
          name: 'priority_search',
          description: 'Search using the configured search model. This is the highest-priority search tool.',
          parameters: z.object({
            query: z.string(),
            execution_mode: z.enum(['async', 'sync']).default('async'),
            pending_notice: z.string().optional().describe('An optional message to show the user immediately while searching.'),
          }),
          execute: async ({ query, execution_mode, pending_notice }, context: any) => {
            if (pending_notice) {
              emitAsyncMessage(pending_notice, context);
            }
            if (execution_mode === 'async') {
              const queuedMessage = `Search request for "${query}" has been started in the background.`;
              return scheduleAsyncWork({
                context,
                pendingNotice: undefined,
                queuedMessage,
                run: async () => runSearch(options.agentRuntime, query),
                formatSuccess: (result) => result,
                formatError: (error) =>
                  `Search failed: ${error instanceof Error ? error.message : String(error)}`,
              });
            }
            return runSearch(options.agentRuntime, query);
          },
        }),
      ]);
    },
  };
}

async function runSearch(agentRuntime: AgentRuntime, query: string) {
  const trimmed = query.trim();
  if (!trimmed) {
    return 'Error searching: empty query.';
  }

  const result = await agentRuntime.runSearchQuery(trimmed);
  const output = result?.output.trim();
  return output && output.length > 0 ? output : 'Search model unavailable or returned no output.';
}

function isSearchDirective(name: string) {
  return name === 'priority_search' || name === 'browser_search';
}

function getDirectiveParam(directive: InlineDirectiveContext, key: string, fallback = '') {
  const value = directive.params[key.toLowerCase()];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback;
}
