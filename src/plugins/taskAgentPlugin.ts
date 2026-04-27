import { Agent, OpenAIProvider, Runner, tool } from '@openai/agents';
import { z } from 'zod';
import type { AgentRuntime } from '../agent/agentRuntime.js';
import type { AppConfig } from '../config/schema.js';
import { emitAsyncMessage, scheduleAsyncWork } from './asyncExecution.js';
import type { BotPlugin } from './types.js';

export function createTaskAgentPlugin(options: { agentRuntime: AgentRuntime; config: AppConfig }): BotPlugin {
  let isTaskAgentBusy = false;

  return {
    id: 'task_agent',
    name: 'Task Agent Plugin',
    description: 'Provides the ability to delegate complex tasks to an asynchronous Task Agent.',
    instructions: [
      '- Use `delegate_task` for complex or multi-step work.',
      '- For tools that support it, default to `execution_mode=async` when the work may take noticeable time.',
      '- Use `sync` only when you need the result immediately and expect it to finish quickly.',
      '- If you choose async mode, you may also provide `pending_notice` as immediate feedback before the task starts.',
      '- Output plain text only. Do not use Markdown headings, bullet lists, code fences, tables, or block quotes in the final report.',
    ],
    setup(context) {
      context.registerTools([
        tool({
          name: 'delegate_task',
          description:
            'Delegate a complex, multi-step task to the Task Agent. In async mode the task runs in the background and notifies the user when done. In sync mode it waits and returns the report directly.',
          parameters: z.object({
            task: z.string().describe('The detailed description of the complex task to delegate.'),
            execution_mode: z.enum(['async', 'sync']).default('async'),
            pending_notice: z.string().optional().describe('An optional message to show the user immediately while the task is starting.'),
            userId: z.string().optional(),
            groupId: z.string().optional(),
          }),
          execute: async ({ task, execution_mode, pending_notice, userId, groupId }) => {
            if (isTaskAgentBusy) {
              return 'Task Agent is currently busy processing another task. Please wait.';
            }

            if (execution_mode === 'sync') {
              if (pending_notice) {
                emitAsyncMessage(pending_notice, { userId, groupId });
              }

              isTaskAgentBusy = true;
              try {
                return sanitizePlainText(await runTaskAgent(task, userId, groupId, options.config, options.agentRuntime));
              } finally {
                isTaskAgentBusy = false;
              }
            }

            isTaskAgentBusy = true;
            return scheduleAsyncWork({
              context: { userId, groupId },
              pendingNotice: pending_notice,
              queuedMessage: 'Task successfully delegated to the Task Agent. It is now running asynchronously.',
              run: async () => {
                try {
                  return sanitizePlainText(await runTaskAgent(task, userId, groupId, options.config, options.agentRuntime));
                } finally {
                  isTaskAgentBusy = false;
                }
              },
              formatSuccess: (finalReport) => `[Task Agent Report]\n${sanitizePlainText(finalReport)}`,
              formatError: (error) =>
                `Task Agent encountered an unexpected fatal error: ${error instanceof Error ? error.message : String(error)}`,
            });
          },
        }),
      ]);
    },
  };
}

async function runTaskAgent(
  task: string,
  userId: string | undefined,
  groupId: string | undefined,
  config: AppConfig,
  agentRuntime: AgentRuntime,
) {
  const reasoningModel =
    config.models.find((model) => model.role === 'reasoning') || config.models.find((model) => model.role === 'main');
  if (!reasoningModel) {
    throw new Error('No reasoning or main model configured.');
  }

  const provider = new OpenAIProvider({
    apiKey: reasoningModel.apiKey,
    baseURL: reasoningModel.baseUrl,
    useResponses: reasoningModel.useResponsesApi,
  });

  const runner = new Runner({
    modelProvider: provider,
    tracingDisabled: true,
  });

  const subtaskTool = tool({
    name: 'execute_subtask',
    description: 'Execute a subtask using a specific model role ("main", "search", "vision", "reasoning").',
    parameters: z.object({
      role: z.enum(['main', 'search', 'vision', 'reasoning']),
      input: z.string().describe('The input/prompt for the subtask'),
    }),
    execute: async ({ role, input }) => {
      try {
        const response = await agentRuntime.run({
          input,
          preferredRole: role,
          userId,
          groupId,
        });
        return `Subtask completed. Result:\n${response.output}`;
      } catch (error: any) {
        return `Subtask failed: ${error.message}`;
      }
    },
  });

  const taskAgent = new Agent({
    name: 'Task Agent',
    instructions: `You are an asynchronous Task Agent. Your job is to process complex tasks broken down into steps.
You have access to all tools.
Requirements:
1. Break down the task into logical steps.
2. For each step, determine the best tool or subtask role to use.
3. Use execute_subtask ONLY when you need to delegate a specific part of the task to a different model.
4. If a step fails or returns unhelpful results, analyze the failure, redesign the path, and retry with a different approach.
5. If you cannot complete the task after reasonable attempts, reply with a refusal message explaining why.
6. Once all steps are completed successfully, your final response should be the comprehensive report.

Do not ask the user for input during the process, as you are running in the background. Make reasonable assumptions or fail gracefully.
`,
    model: reasoningModel.model,
    tools: [subtaskTool, ...agentRuntime.getTools().filter((tool) => tool.name !== 'delegate_task')],
    modelSettings: reasoningModel.supportsReasoning
      ? { reasoning: { effort: reasoningModel.reasoningEffort } }
      : undefined,
  });

  const result = await runner.run(taskAgent, `Please execute the following task:\n${task}`);
  const finalReport = result.finalOutput || 'Task Agent finished without producing a report.';

  await provider.close();
  return finalReport;
}

function sanitizePlainText(input: string) {
  return input
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```[a-zA-Z0-9_-]*\n?/g, '').replace(/```/g, ''))
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
