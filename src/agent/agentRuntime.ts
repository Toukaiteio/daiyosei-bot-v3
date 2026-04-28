import { Agent, OpenAIProvider, Runner, type AgentInputItem, type ModelSettings, type Tool } from '@openai/agents';
import type { Logger } from 'pino';
import { buildInstructions } from './instructions.js';
import { ModelRouter } from './modelRouter.js';
import type { AgentRequest, AgentResponse } from './types.js';
import type { AppConfig, ModelProfile } from '../config/schema.js';
import type { PluginRegistry } from '../plugins/registry.js';
import type { SkillRegistry } from '../skills/registry.js';

export type AgentRuntimeOptions = {
  config: AppConfig;
  logger: Logger;
  skills: SkillRegistry;
  plugins: PluginRegistry;
};

export class AgentRuntime {
  private readonly config: AppConfig;
  private readonly logger: Logger;
  private readonly skills: SkillRegistry;
  private readonly plugins: PluginRegistry;
  private readonly router: ModelRouter;
  private readonly providers = new Map<string, OpenAIProvider>();

  constructor(options: AgentRuntimeOptions) {
    this.config = options.config;
    this.logger = options.logger;
    this.skills = options.skills;
    this.plugins = options.plugins;
    this.router = new ModelRouter(options.config);
  }

  async run(request: AgentRequest): Promise<AgentResponse> {
    const model = this.router.get(request.preferredRole ?? 'main');
    const agent = this.createAgent(model);
    const runner = new Runner({
      modelProvider: this.getProvider(model),
      tracingDisabled: true,
    });
    const input: AgentInputItem[] | string =
      request.history && request.history.length > 0
        ? [...request.history, { role: 'user' as const, content: request.input }]
        : request.input;

    const result = await runner.run(agent, input, {
      context: {
        userId: request.userId,
        groupId: request.groupId,
      },
    });

    return {
      output: String(result.finalOutput ?? ''),
      model,
    };
  }

  async runSearchQuery(query: string): Promise<AgentResponse | undefined> {
    const model = this.router.getForSearch();
    if (!model) {
      return undefined;
    }

    this.logger.info({ role: model.role, model: model.model, query }, 'routing query to search model');

    const agent = new Agent({
      name: `${this.config.bot.name} Search`,
      instructions: [
        'You are a dedicated search assistant.',
        'Use your available search capability to gather current information before answering.',
        'Answer the user query using concise, factual, up-to-date information.',
        'If the search results do not support a reliable answer, say so plainly instead of guessing.',
      ].join('\n'),
      model: model.model,
      modelSettings: this.toModelSettings(model),
      tools: [],
    });

    const runner = new Runner({
      modelProvider: this.getProvider(model),
      tracingDisabled: true,
    });

    const result = await runner.run(agent, query);
    return {
      output: String(result.finalOutput ?? ''),
      model,
    };
  }

  getTools(): Tool[] {
    return [...this.skills.toTools(), ...this.plugins.toTools()] as Tool[];
  }

  async close() {
    await Promise.all([...this.providers.values()].map((provider) => provider.close()));
  }

  private createAgent(model: ModelProfile) {
    const tools = [...this.skills.toTools(), ...this.plugins.toTools()] as Tool[];

    return new Agent({
      name: this.config.bot.name,
      instructions: buildInstructions(this.config, this.plugins.getInjectedInstructions()),
      model: model.model,
      modelSettings: this.toModelSettings(model),
      tools,
    });
  }

  private getProvider(model: ModelProfile) {
    const cacheKey = `${model.baseUrl}:${model.apiKey}:${model.useResponsesApi}`;
    const existing = this.providers.get(cacheKey);
    if (existing) {
      return existing;
    }

    const provider = new OpenAIProvider({
      apiKey: model.apiKey,
      baseURL: model.baseUrl,
      useResponses: model.useResponsesApi,
    });
    this.providers.set(cacheKey, provider);
    this.logger.info({ role: model.role, model: model.model }, 'created model provider');
    return provider;
  }

  private toModelSettings(model: ModelProfile): ModelSettings {
    if (!model.supportsReasoning) {
      return {};
    }

    return {
      reasoning: {
        effort: model.reasoningEffort,
      },
    };
  }
}
