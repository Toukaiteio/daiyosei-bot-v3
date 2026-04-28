import { tool } from '@openai/agents';
import { z } from 'zod';
import { resolve, join } from 'node:path';
import { readFile, writeFile, readdir, rm } from 'node:fs/promises';
import type { SandboxPolicy } from '../sandbox/policy.js';
import type { BotPlugin } from './types.js';
import { emitAsyncMessage, scheduleAsyncWork } from './asyncExecution.js';
import { execa } from 'execa';

export function createSandboxPlugin(options: { sandboxPolicy: SandboxPolicy }): BotPlugin {
  return {
    id: 'sandbox',
    name: 'Sandbox Capabilities Plugin',
    description: 'Provides tools for file system and command execution within the sandbox environment.',
    instructions: [
      '- Dangerous filesystem, deletion, persistent writes, and command execution must go through sandbox tools.',
      '- Always respect the sandbox policy. Check inspect_sandbox_policy if you need to know what operations are allowed.',
      '- 如果执行的命令可能耗时较长，调用 `run_command` 时默认使用 `execution_mode=async`，并可选填写 `pending_notice`。',
    ],
    setup(context) {
      context.registerTools([
        tool({
          name: 'read_file',
          description: 'Read the contents of a file within the sandbox.',
          parameters: z.object({
            path: z.string().describe('The relative path to the file to read'),
          }),
          execute: async ({ path }) => {
            const { workspaceRoot } = options.sandboxPolicy.describe();
            const absolutePath = resolve(workspaceRoot, path);
            
            const decision = options.sandboxPolicy.canRead(absolutePath);
            if (!decision.allowed) {
              return `Error: ${decision.reason}`;
            }

            try {
              return await readFile(absolutePath, 'utf8');
            } catch (error) {
              return `Error reading file: ${error instanceof Error ? error.message : String(error)}`;
            }
          },
        }),

        tool({
          name: 'delete_file',
          description: 'Delete a file or directory within the sandbox.',
          parameters: z.object({
            path: z.string().describe('The relative path to the file or directory to delete'),
          }),
          execute: async ({ path }) => {
            const { workspaceRoot } = options.sandboxPolicy.describe();
            const absolutePath = resolve(workspaceRoot, path);

            const decision = options.sandboxPolicy.canDelete(absolutePath);
            if (!decision.allowed) {
              return `Error: ${decision.reason}`;
            }

            try {
              await rm(absolutePath, { recursive: true, force: true });
              return `Successfully deleted ${path}`;
            } catch (error) {
              return `Error deleting: ${error instanceof Error ? error.message : String(error)}`;
            }
          },
        }),

        tool({
          name: 'write_file',
          description: 'Write content to a file within the sandbox.',
          parameters: z.object({
            path: z.string().describe('The relative path to the file to write'),
            content: z.string().describe('The content to write to the file'),
          }),
          execute: async ({ path, content }) => {
            const { workspaceRoot } = options.sandboxPolicy.describe();
            const absolutePath = resolve(workspaceRoot, path);
            
            const decision = options.sandboxPolicy.canWrite(absolutePath);
            if (!decision.allowed) {
              return `Error: ${decision.reason}`;
            }

            try {
              await writeFile(absolutePath, content, 'utf8');
              return `Successfully wrote to ${path}`;
            } catch (error) {
              return `Error writing file: ${error instanceof Error ? error.message : String(error)}`;
            }
          },
        }),

        tool({
          name: 'list_dir',
          description: 'List the contents of a directory within the sandbox.',
          parameters: z.object({
            path: z.string().default('.').describe('The relative path to the directory to list'),
          }),
          execute: async ({ path }) => {
            const { workspaceRoot } = options.sandboxPolicy.describe();
            const absolutePath = resolve(workspaceRoot, path);
            
            const decision = options.sandboxPolicy.canRead(absolutePath);
            if (!decision.allowed) {
              return `Error: ${decision.reason}`;
            }

            try {
              const entries = await readdir(absolutePath, { withFileTypes: true });
              return entries.map((entry) => ({
                name: entry.name,
                isDirectory: entry.isDirectory(),
                isFile: entry.isFile(),
              }));
            } catch (error) {
              return `Error listing directory: ${error instanceof Error ? error.message : String(error)}`;
            }
          },
        }),

        tool({
          name: 'run_command',
          description: 'Run a shell command within the sandbox workspace.',
          parameters: z.object({
            command: z.string().describe('The shell command to execute'),
            execution_mode: z.enum(['async', 'sync']).default('async'),
            pending_notice: z.string().optional().describe('An optional message to show the user immediately while the command is running (e.g. "正在执行命令，请稍候...")'),
          }),
          execute: async ({ command, execution_mode, pending_notice }, context: any) => {
            if (pending_notice) {
              emitAsyncMessage(pending_notice, context);
            }
            const decision = options.sandboxPolicy.canExecute();
            if (!decision.allowed) {
              return `Error: ${decision.reason}`;
            }

            if (execution_mode === 'async') {
              return scheduleAsyncWork({
                context,
                queuedMessage: `Command has been started in the background: ${command}`,
                run: async () => {
                  const { workspaceRoot, maxExecutionMs } = options.sandboxPolicy.describe();
                  const { stdout, stderr } = await execa({ shell: true, cwd: workspaceRoot, timeout: maxExecutionMs })(command);

                  return {
                    stdout: stdout.trim(),
                    stderr: stderr.trim(),
                  };
                },
                formatSuccess: (result) =>
                  `[Command Completed]\nStdout:\n${result.stdout || '(empty)'}\nStderr:\n${result.stderr || '(empty)'}`,
                formatError: (error) =>
                  `[Command Failed] ${error instanceof Error ? error.message : String(error)}`,
              });
            }

            const { workspaceRoot, maxExecutionMs } = options.sandboxPolicy.describe();

            try {
              const { stdout, stderr } = await execa({ shell: true, cwd: workspaceRoot, timeout: maxExecutionMs })(command);
              
              return {
                stdout: stdout.trim(),
                stderr: stderr.trim(),
              };
            } catch (error: any) {
              return `Command execution failed: ${error.message}\nStdout: ${error.stdout || '(empty)'}\nStderr: ${error.stderr || '(empty)'}`;
            }
          },
        }),
      ]);
    },
  };
}
