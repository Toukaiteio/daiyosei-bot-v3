import { tool } from '@openai/agents';
import { z } from 'zod';
import puppeteer, { type Browser, type Page } from 'puppeteer';
import { resolve } from 'node:path';
import { appEventBus } from '../events.js';
import type { BotPlugin } from './types.js';
import type { SandboxPolicy } from '../sandbox/policy.js';

export function createBrowserPlugin(options: { sandboxPolicy: SandboxPolicy }): BotPlugin {
  let browser: Browser | null = null;
  let page: Page | null = null;

  return {
    id: 'browser',
    name: 'Headless Browser Plugin',
    description: 'Provides a headless Chrome browser (Puppeteer) for the AI to interact with web pages directly.',
    instructions: [
      '- 网页访问可能受网络影响较慢，调用 `browser_goto` 时建议填写 `pending_notice` 给用户即时反馈。',
    ],
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
            url: z.string().url(),
            pending_notice: z.string().optional().describe('An optional message to show the user immediately while the browser is navigating (e.g. "正在打开网页，请稍候...")'),
          }),
          execute: async ({ url, pending_notice }, context: any) => {
            if (pending_notice) {
              appEventBus.emit('async_agent_message', {
                message: pending_notice,
                userId: context?.userId,
                groupId: context?.groupId,
              });
            }
            if (!page) return 'Browser not initialized.';
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
}
