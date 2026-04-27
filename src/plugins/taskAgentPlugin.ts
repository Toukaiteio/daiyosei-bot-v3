import { tool, Agent, Runner, OpenAIProvider } from '@openai/agents';
import { z } from 'zod';
import type { BotPlugin } from './types.js';
import { appEventBus } from '../events.js';
import type { AgentRuntime } from '../agent/agentRuntime.js';
import type { AppConfig } from '../config/schema.js';

export function createTaskAgentPlugin(options: { agentRuntime: AgentRuntime; config: AppConfig }): BotPlugin {
  let isTaskAgentBusy = false;

  return {
    id: 'task_agent',
    name: 'Task Agent Plugin',
    description: 'Provides the ability to delegate complex tasks to an asynchronous Task Agent.',
    instructions: [
      '- 对于复杂、多步骤的调研、网页浏览或深度分析任务，优先使用 `delegate_task` 工具将其交给 Task Agent 处理。这样你可以保持对用户的响应，而 Task Agent 会在后台处理耗时任务。',
      '- 当你调用 `delegate_task` 或其他可能耗时的工具（如网页访问、命令执行）时，如果预计执行时间较长，建议填写 `pending_notice` 参数。该内容会立即发送给用户，作为“正在处理中”的反馈，提升用户体验。',
    ],
    setup(context) {
      context.registerTools([
        tool({
          name: 'delegate_task',
          description: 'Delegate a complex, multi-step task to the asynchronous Task Agent. The Task Agent will process it in the background using the reasoning model and notify the user when done. DO NOT wait for it to finish. Return immediately to the user.',
          parameters: z.object({
            task: z.string().describe('The detailed description of the complex task to delegate.'),
            pending_notice: z.string().optional().describe('An optional message to show the user immediately while the task is starting (e.g. "正在深入调查中，请稍候...")'),
            userId: z.string().optional(),
            groupId: z.string().optional(),
          }),
          execute: async ({ task, pending_notice, userId, groupId }) => {
            if (isTaskAgentBusy) {
              return 'Task Agent is currently busy processing another task. Please try to resolve the problem yourself or inform the user that they must wait.';
            }

            if (pending_notice) {
              appEventBus.emit('async_agent_message', {
                message: pending_notice,
                userId,
                groupId,
              });
            }

            // Set busy flag
            isTaskAgentBusy = true;

            // Start asynchronous processing
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            (async () => {
              try {
                await runTaskAgent(task, userId, groupId, options.config, options.agentRuntime);
              } catch (error: any) {
                appEventBus.emit('async_agent_message', {
                  message: `Task Agent encountered an unexpected fatal error: ${error.message}`,
                  userId,
                  groupId,
                });
              } finally {
                isTaskAgentBusy = false;
              }
            })();

            return `Task successfully delegated to the Task Agent. It is now running asynchronously. You should inform the user that the Task Agent is handling it and they will receive a notification later.`;
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
  // Find reasoning model
  const reasoningModel = config.models.find((m) => m.role === 'reasoning') || config.models.find((m) => m.role === 'main');
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

  // Tools for Task Agent

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
      } catch (e: any) {
        return `Subtask failed: ${e.message}`;
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
3. Use execute_subtask ONLY when you need to delegate a specific part of the task to a different model (e.g. for vision analysis or internet search if you cannot do it directly).
4. ERROR DETECTION & RETRY: If a step fails or returns unhelpful results, analyze the failure, redesign the path, and retry with a different approach or different subtask input.
5. REFUSAL: If you determine the task is completely beyond your capability after attempts, reply with a refusal message explaining why.
6. Once all steps are completed successfully, your final response should be the comprehensive report.

Do not ask the user for input during the process, as you are running in the background. Make reasonable assumptions or fail gracefully.
`,
    model: reasoningModel.model,
    tools: [
      subtaskTool,
      ...agentRuntime.getTools().filter((t) => t.name !== 'delegate_task'),
    ],
    modelSettings: reasoningModel.supportsReasoning ? { reasoning: { effort: reasoningModel.reasoningEffort } } : undefined,
  });

  const result = await runner.run(taskAgent, `Please execute the following task:\n${task}`);
  const finalReport = result.finalOutput || 'Task Agent finished without producing a report.';

  // Notify the user
  appEventBus.emit('async_agent_message', {
    message: `[Task Agent Report]\n${finalReport}`,
    userId,
    groupId,
  });

  await provider.close();
}
