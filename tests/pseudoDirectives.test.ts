import { describe, expect, it } from 'vitest';
import { extractPseudoDirectives } from '../src/adapters/onebot/pseudoDirectives.js';
import { createBrowserPlugin } from '../src/plugins/browserPlugin.js';

describe('pseudo directives', () => {
  it('extracts browser pseudo directives from model output', () => {
    const directives = extractPseudoDirectives(
      '好，我帮你查一下。\n\n[[browser_goto: https://example.com | pending_notice:正在打开网页 | execution_mode:async]]\n[[browser_read_text]]',
    );

    expect(directives).toEqual([
      {
        name: 'browser_goto',
        value: 'https://example.com',
        params: {
          pending_notice: '正在打开网页',
          execution_mode: 'async',
        },
        raw: '[[browser_goto: https://example.com | pending_notice:正在打开网页 | execution_mode:async]]',
      },
      {
        name: 'browser_read_text',
        value: '',
        params: {},
        raw: '[[browser_read_text]]',
      },
    ]);
  });

  it('returns a clear failure when the browser has not started', async () => {
    const plugin = createBrowserPlugin({
      agentRuntime: {
        runSearchQuery: async () => undefined,
      } as any,
      sandboxPolicy: {
        describe: () => ({
          workspaceRoot: 'E:/workspace',
          allowNetwork: false,
          allowPersistentWrites: false,
          maxExecutionMs: 10_000,
        }),
        canWrite: () => ({ allowed: true }),
      },
    });

    await expect(
      plugin.resolveInlineDirective?.({
        name: 'browser_goto',
        value: 'https://example.com',
        params: {},
        raw: '[[browser_goto: https://example.com]]',
        question: '请帮我搜索',
      }),
    ).resolves.toBe('Browser not initialized.');
  });
});
