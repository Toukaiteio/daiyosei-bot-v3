import { tool } from '@openai/agents';
import { z } from 'zod';
import puppeteer, { type Browser, type Page } from 'puppeteer';
import { resolve } from 'node:path';
import type { AgentRuntime } from '../agent/agentRuntime.js';
import type { BotPlugin, InlineDirectiveContext } from './types.js';
import type { SandboxPolicy } from '../sandbox/policy.js';
import { emitAsyncMessage, scheduleAsyncWork } from './asyncExecution.js';

export function createBrowserPlugin(options: { sandboxPolicy: SandboxPolicy; agentRuntime: AgentRuntime }): BotPlugin {
  let browser: Browser | null = null;
  let page: Page | null = null;

  const resolveInlineDirective = async (directive: InlineDirectiveContext) => {
    const executionMode = getDirectiveParam(directive, 'execution_mode', 'sync').toLowerCase();
    const pendingNotice = getDirectiveParam(directive, 'pending_notice');

    switch (directive.name) {
      case 'browser_goto':
        if (pendingNotice) {
          emitAsyncMessage(pendingNotice, directive);
        }
        if (executionMode === 'async') {
          void scheduleAsyncWork({
            context: directive,
            pendingNotice: undefined,
            queuedMessage: '',
            run: async () => gotoUrl(directive.value, directive.question),
            formatSuccess: (result) => result,
            formatError: (error) =>
              `浏览器打开失败：${error instanceof Error ? error.message : String(error)}`,
          });
          return '';
        }
        return gotoUrl(directive.value, directive.question);
      case 'browser_search':
        if (pendingNotice) {
          emitAsyncMessage(pendingNotice, directive);
        }
        if (executionMode === 'async') {
          void scheduleAsyncWork({
            context: directive,
            pendingNotice: undefined,
            queuedMessage: '',
            run: async () => searchWeb(directive.value),
            formatSuccess: (result) => result,
            formatError: (error) =>
              `浏览器搜索失败：${error instanceof Error ? error.message : String(error)}`,
          });
          return '';
        }
        return searchWeb(directive.value);
      case 'browser_read_text':
        return readCurrentPageText(directive.value || 'body');
      case 'browser_click':
        return clickSelector(directive.value);
      case 'browser_type':
        return typeIntoSelector(directive.value);
      case 'browser_evaluate':
        return evaluateScript(directive.value);
      case 'browser_screenshot_to_sandbox':
        return saveScreenshotToSandbox(directive.value);
      default:
        return undefined;
    }
  };

  return {
    id: 'browser',
    name: 'Headless Browser Plugin',
    description: 'Provides a headless Chrome browser (Puppeteer) for the AI to interact with web pages directly.',
    instructions: [
      '- 用 `browser_goto` + `browser_read_text` 查询实时信息（新闻、价格、天气、文档等），不要以"查不了外部信息"为由拒绝用户。',
      '- 优先用 `browser_search` 做搜索，再用 `browser_goto` 打开结果页或原始来源。',
      '- 决定搜索时，直接调用工具，不要先用文本说"我去搜一下"——把那句话填到 `pending_notice` 参数里即可，工具会替你发出去。',
      '- 网页访问可能较慢，调用 `browser_goto` 时默认使用 `execution_mode=async`，必须同时填写 `pending_notice` 告知用户正在处理。',
      '- 如果只是搜索关键词，优先调用 `browser_search`，不要自己手写搜索引擎 URL。',
      '- 不要把浏览器工具写成 `[[browser_search:...]]`、`[[browser_goto:...]]`、`[[browser_read_text]]` 这种文本标签；只能通过真正的工具调用来执行。',
    ],
    resolveInlineDirective,
    async start() {
      try {
        browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        });
        page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
      } catch (err) {
        console.error('Failed to launch browser plugin:', err);
      }
    },
    async stop() {
      if (browser) {
        await browser.close();
        browser = null;
        page = null;
      }
    },
    setup(context) {
      context.registerTools([
        tool({
          name: 'browser_goto',
          description: 'Navigate the headless browser to a specific URL.',
          parameters: z.object({
            url: z.url(),
            execution_mode: z.enum(['async', 'sync']).default('async'),
            pending_notice: z.string().optional().describe('An optional message to show the user immediately while the browser is navigating (e.g. "正在打开网页，请稍候...")'),
          }),
          execute: async ({ url, execution_mode, pending_notice }, context: any) => {
            if (!page) return 'Browser not initialized.';
            if (execution_mode === 'async') {
              return scheduleAsyncWork({
                context,
                pendingNotice: pending_notice,
                queuedMessage: `Browser navigation to ${url} has been started in the background.`,
                run: async () => {
                  await page!.goto(url, { waitUntil: 'networkidle2' });
                  const title = await page!.title();
                  return `Successfully navigated to ${url}. Page title: "${title}"`;
                },
                formatSuccess: (result) => `[Browser Task Completed]\n${result}`,
                formatError: (error) =>
                  `[Browser Task Failed] ${error instanceof Error ? error.message : String(error)}`,
              });
            }
            try {
              await page.goto(url, { waitUntil: 'networkidle2' });
              const title = await page.title();
              return `Successfully navigated to ${url}. Page title: "${title}"`;
            } catch (err: any) {
              return `Error navigating to ${url}: ${err.message}`;
            }
          },
        }),

        tool({
          name: 'browser_search',
          description: 'Search using the configured search model and return its answer directly.',
          parameters: z.object({
            query: z.string(),
            execution_mode: z.enum(['async', 'sync']).default('async'),
            pending_notice: z.string().optional().describe('An optional message to show the user immediately while the browser is searching.'),
          }),
          execute: async ({ query, execution_mode, pending_notice }, context: any) => {
            if (pending_notice) {
              emitAsyncMessage(pending_notice, context);
            }
            if (execution_mode === 'async') {
              const queuedMessage = `Browser search for "${query}" has been started in the background.`;
              return scheduleAsyncWork({
                context,
                pendingNotice: undefined,
                queuedMessage,
                run: async () => searchWeb(query),
                formatSuccess: (result) => result,
                formatError: (error) =>
                  `Browser search failed: ${error instanceof Error ? error.message : String(error)}`,
              });
            }
            return searchWeb(query);
          },
        }),

        tool({
          name: 'browser_read_text',
          description: 'Extract text content from the current web page or a specific CSS selector.',
          parameters: z.object({
            selector: z.string().optional().describe('CSS selector to extract text from. Defaults to "body".'),
          }),
          execute: async ({ selector = 'body' }) => {
            if (!page) return 'Browser not initialized.';
            try {
              const text = await page.$eval(selector, (el) => (el as HTMLElement).innerText);
              return text.substring(0, 4000); // Limit output length
            } catch (err: any) {
              return `Error reading text from ${selector}: ${err.message}`;
            }
          },
        }),

        tool({
          name: 'browser_click',
          description: 'Click on a specific element on the page using a CSS selector.',
          parameters: z.object({ selector: z.string() }),
          execute: async ({ selector }) => {
            if (!page) return 'Browser not initialized.';
            try {
              await page.click(selector);
              await new Promise((r) => setTimeout(r, 1000)); // wait a bit for navigation or ui changes
              return `Clicked on ${selector}`;
            } catch (err: any) {
              return `Error clicking on ${selector}: ${err.message}`;
            }
          },
        }),

        tool({
          name: 'browser_type',
          description: 'Type text into an input field on the page using a CSS selector.',
          parameters: z.object({
            selector: z.string(),
            text: z.string(),
          }),
          execute: async ({ selector, text }) => {
            if (!page) return 'Browser not initialized.';
            try {
              await page.type(selector, text);
              return `Typed text into ${selector}`;
            } catch (err: any) {
              return `Error typing into ${selector}: ${err.message}`;
            }
          },
        }),

        tool({
          name: 'browser_evaluate',
          description: 'Evaluate a javascript expression in the context of the page and return the result. Useful for extracting complex data or DOM state.',
          parameters: z.object({
            script: z.string().describe('The JavaScript expression to evaluate. Should return a stringifiable value.'),
          }),
          execute: async ({ script }) => {
            if (!page) return 'Browser not initialized.';
            try {
              const result = await page.evaluate(script);
              return String(result).substring(0, 2000);
            } catch (err: any) {
              return `Error evaluating script: ${err.message}`;
            }
          },
        }),

        tool({
          name: 'browser_screenshot_to_sandbox',
          description: 'Take a screenshot of the current page and save it to a relative path in the sandbox workspace.',
          parameters: z.object({
            path: z.string().describe('Relative path in the sandbox to save the screenshot (e.g., "screenshot.png")'),
          }),
          execute: async ({ path }) => {
            if (!page) return 'Browser not initialized.';
            const { workspaceRoot } = options.sandboxPolicy.describe();
            const absolutePath = resolve(workspaceRoot, path);

            const decision = options.sandboxPolicy.canWrite(absolutePath);
            if (!decision.allowed) {
              return `Error: ${decision.reason}`;
            }

            try {
              await page.screenshot({ path: absolutePath, fullPage: true });
              return `Successfully saved screenshot to ${path}`;
            } catch (err: any) {
              return `Error taking screenshot: ${err.message}`;
            }
          },
        }),
      ]);
    },
  };

  async function gotoUrl(url: string, question?: string) {
    if (!page) return 'Browser not initialized.';
    if (!url.trim()) {
      return 'Error navigating to empty URL.';
    }
    try {
      await page.goto(url, { waitUntil: 'networkidle2' });
      const title = await page.title();
      return [
        `Opened ${url}.`,
        title ? `Page title: "${title}"` : '',
        question ? `Search context: ${question}` : '',
      ]
        .filter(Boolean)
        .join(' ');
    } catch (err: any) {
      return `Error navigating to ${url}: ${err.message}`;
    }
  }

  async function searchWeb(query: string) {
    const trimmed = query.trim();
    if (!trimmed) {
      return 'Error searching: empty query.';
    }

    const searchModelResult = await options.agentRuntime.runSearchQuery(trimmed);
    const searchModelText = searchModelResult?.output.trim();
    if (searchModelText) {
      return searchModelText;
    }

    return 'Search model unavailable or returned no output.';
  }

  async function readCurrentPageText(selector = 'body') {
    if (!page) return 'Browser not initialized.';
    try {
      const text = await page.$eval(selector, (el) => (el as HTMLElement).innerText);
      return text.substring(0, 4000);
    } catch (err: any) {
      return `Error reading text from ${selector}: ${err.message}`;
    }
  }

  async function clickSelector(selector: string) {
    if (!page) return 'Browser not initialized.';
    try {
      await page.click(selector);
      await new Promise((r) => setTimeout(r, 1000));
      return `Clicked on ${selector}`;
    } catch (err: any) {
      return `Error clicking on ${selector}: ${err.message}`;
    }
  }

  async function typeIntoSelector(payload: string) {
    if (!page) return 'Browser not initialized.';
    const [selector, ...rest] = payload.split('|');
    const text = rest.join('|').trim();
    if (!selector || !text) {
      return 'Error typing: expected "selector|text".';
    }

    try {
      await page.type(selector.trim(), text);
      return `Typed text into ${selector.trim()}`;
    } catch (err: any) {
      return `Error typing into ${selector.trim()}: ${err.message}`;
    }
  }

  async function evaluateScript(script: string) {
    if (!page) return 'Browser not initialized.';
    if (!script.trim()) {
      return 'Error evaluating script: empty script.';
    }

    try {
      const result = await page.evaluate(script);
      return String(result).substring(0, 2000);
    } catch (err: any) {
      return `Error evaluating script: ${err.message}`;
    }
  }

  async function saveScreenshotToSandbox(path: string) {
    if (!page) return 'Browser not initialized.';
    const safePath = path.trim();
    if (!safePath) {
      return 'Error taking screenshot: empty path.';
    }

    const { workspaceRoot } = options.sandboxPolicy.describe();
    const absolutePath = resolve(workspaceRoot, safePath);

    const decision = options.sandboxPolicy.canWrite(absolutePath);
    if (!decision.allowed) {
      return `Error: ${decision.reason}`;
    }

    try {
      await page.screenshot({ path: absolutePath, fullPage: true });
      return `Successfully saved screenshot to ${safePath}`;
    } catch (err: any) {
      return `Error taking screenshot: ${err.message}`;
    }
  }

  function getDirectiveParam(directive: InlineDirectiveContext, key: string, fallback = '') {
    const value = directive.params[key.toLowerCase()];
    return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback;
  }
}
