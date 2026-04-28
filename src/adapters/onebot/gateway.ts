import type { FastifyInstance } from 'fastify';
import type { Logger } from 'pino';
import { isIP } from 'node:net';
import type WebSocket from 'ws';
import type { AgentInputItem } from '@openai/agents';
import type { AgentRuntime } from '../../agent/agentRuntime.js';
import type { AppConfig } from '../../config/schema.js';
import type { CommandRegistry } from '../../commands/registry.js';
import type { PluginRegistry } from '../../plugins/registry.js';
import type { MemeLibrary } from '../../memes/library.js';
import type { StorageDatabase } from '../../storage/database.js';
import type { ContextMessage } from '../../storage/types.js';
import { inspectRecentImage } from '../../storage/imageTools.js';
import { OneBotConnection } from './connection.js';
import { extractImagesFromMessage } from './imageCache.js';
import { mapOneBotEvent } from './mapper.js';
import { buildOutgoingMessageSegments } from './messageBuilder.js';
import { extractPseudoDirectives } from './pseudoDirectives.js';
import { executeDirectCommand } from '../../commands/direct.js';
import type { OneBotInboundEvent } from './types.js';
import { appEventBus } from '../../events.js';

type CachedImage = {
  id: number;
  messageId?: string;
  url?: string;
  localPath?: string;
};

export class OneBotGateway {
  private readonly connections = new Map<string, OneBotConnection>();
  private readonly processedMessageIds = new Map<string, number>(); // messageId → timestamp
  private readonly DEDUP_WINDOW_MS = 15_000;

  constructor(
    private readonly options: {
      config: AppConfig;
      logger: Logger;
      agentRuntime: AgentRuntime;
      pluginRegistry: PluginRegistry;
      storage: StorageDatabase;
      memes: MemeLibrary;
      commandRegistry: CommandRegistry;
    },
  ) {
    appEventBus.on('async_agent_message', (data: { message: string; userId?: string; groupId?: string; replyMessageId?: string }) => {
      void this.sendAsyncMessage(data);
    });
  }

  private async sendAsyncMessage(data: { message: string; userId?: string; groupId?: string; replyMessageId?: string }) {
    if (!data.message.trim()) {
      return;
    }

    const segments = splitOutputSegments(data.message);
    for (const connection of this.connections.values()) {
      if (data.groupId) {
        for (let i = 0; i < segments.length; i++) {
          if (i > 0) await sleep(segmentDelay(segments[i - 1]));
          connection.sendAction({
            action: 'send_group_msg',
            params: {
              group_id: Number(data.groupId),
              message: buildOutgoingMessageSegments(segments[i], {
                memeLibrary: this.options.memes,
                memesEnabled: this.options.config.memes.enabled,
                allowedCategories: this.options.config.memes.allowedCategories,
                disabledMemes: this.options.config.memes.disabledMemes,
                replyMessageId: data.replyMessageId,
              }),
            },
          });
        }
        continue;
      }

      if (data.userId) {
        for (let i = 0; i < segments.length; i++) {
          if (i > 0) await sleep(segmentDelay(segments[i - 1]));
          connection.sendAction({
            action: 'send_private_msg',
            params: {
              user_id: Number(data.userId),
              message: buildOutgoingMessageSegments(segments[i], {
                memeLibrary: this.options.memes,
                memesEnabled: this.options.config.memes.enabled,
                allowedCategories: this.options.config.memes.allowedCategories,
                disabledMemes: this.options.config.memes.disabledMemes,
                replyMessageId: data.replyMessageId,
              }),
            },
          });
        }
      }
    }
  }

  register(server: FastifyInstance) {
    if (!this.options.config.oneBot.enabled) {
      return;
    }

    server.get(this.options.config.oneBot.path, { websocket: true }, (socket: WebSocket, request) => {
      const sourceHost = getRequestSourceHost(request);
      const wsSocket = resolveWebSocket(socket);

      this.options.logger.debug(
        { sourceHost, ip: request.ip, remoteAddress: request.raw.socket.remoteAddress },
        'incoming OneBot connection attempt',
      );

      if (!this.isSourceAllowed(sourceHost)) {
        this.options.logger.warn(
          {
            sourceHost,
            ip: request.ip,
            connectionPath: this.options.config.oneBot.path,
          },
          'OneBot connection rejected by source host policy',
        );
        closeWebSocketLike(wsSocket ?? socket, 1008, 'source host not allowed');
        return;
      }

      if (!wsSocket) {
        this.options.logger.error(
          {
            sourceHost,
            socketType: typeof socket,
            connectionPath: this.options.config.oneBot.path,
          },
          'OneBot connection rejected because websocket object was not usable',
        );
        closeWebSocketLike(socket, 1011, 'invalid websocket object');
        return;
      }

      const oneBotConnection = new OneBotConnection(wsSocket);
      this.connections.set(oneBotConnection.id, oneBotConnection);
      this.options.logger.info({ connectionId: oneBotConnection.id, sourceHost }, 'OneBot client connected');

      wsSocket.on('message', (payload: Buffer | string) => {
        void this.handleMessage(oneBotConnection, payload.toString());
      });

      wsSocket.on('close', () => {
        this.connections.delete(oneBotConnection.id);
        this.options.logger.info({ connectionId: oneBotConnection.id }, 'OneBot client disconnected');
      });
    });
  }

  private isSourceAllowed(sourceHost: string) {
    const config = this.options.config.oneBot;

    if (config.blockPublicRequests && isPublicAddress(sourceHost)) {
      return false;
    }

    if (!config.restrictSourceHosts) {
      return true;
    }

    const allowed = config.allowedSourceHosts.map(normalizeSourceHost).filter(Boolean);
    if (allowed.length === 0) {
      return false;
    }

    return allowed.includes(sourceHost);
  }

  private async handleMessage(connection: OneBotConnection, payload: string) {
    const event = parseEvent(payload);
    if (!event) {
      this.options.logger.warn({ payload }, 'ignored invalid OneBot payload');
      return;
    }

    const message = mapOneBotEvent(event);
    if (!message) {
      return;
    }

    if (message.id) {
      const now = Date.now();
      for (const [id, ts] of this.processedMessageIds) {
        if (now - ts > this.DEDUP_WINDOW_MS) this.processedMessageIds.delete(id);
      }
      if (this.processedMessageIds.has(message.id)) {
        this.options.logger.debug({ messageId: message.id }, 'duplicate event dropped');
        return;
      }
      this.processedMessageIds.set(message.id, now);
    }

    if (message.userId && this.options.storage.isBanned(message.userId)) {
      this.options.logger.debug({ userId: message.userId }, 'message dropped: user is blacklisted');
      return;
    }

    // Load context BEFORE recording, so the current message isn't in history yet.
    const recentContext = this.options.storage.getRecentContext({
      userId: message.type === 'private' ? message.userId : undefined,
      groupId: message.groupId,
    });

    const createdAt = event.time ? new Date(event.time * 1000) : new Date();
    this.options.storage.recordMessage({
      messageId: message.id,
      selfId: message.selfId,
      userId: message.userId,
      groupId: message.groupId,
      type: message.type,
      role: 'user',
      text: message.text,
      raw: event,
      createdAt,
    });

    const cachedImages = extractImagesFromMessage(message, createdAt).map((image) => ({
      id: this.options.storage.recordImage(image),
      messageId: image.messageId,
      url: image.url,
      localPath: image.localPath,
    }));

    if (!message.text.trim()) {
      return;
    }

    const trimmed = message.text.trimStart();
    if (trimmed.startsWith('$$')) {
      const trigger = trimmed.slice(2).trimStart().split(/\s+/)[0]?.toLowerCase() ?? '';
      const command = this.options.commandRegistry.get(trigger);
      if (!command) {
        await this.sendDirectText(connection, message, `未知命令：${trigger}`);
        return;
      }

      const permission = this.options.commandRegistry.resolve(
        trigger,
        this.options.config.commands.commandPermissions,
      );
      if (permission === 'master_only') {
        const masters = new Set(this.options.config.commands.masters);
        if (!message.userId || !masters.has(message.userId)) {
          this.options.logger.debug({ userId: message.userId, trigger }, 'command blocked: not a master');
          return;
        }
      }

      const direct = await executeDirectCommand(
        this.options.commandRegistry,
        message.text,
        {
          userId: message.userId,
          groupId: message.groupId,
          replyMessageId: message.id,
        },
      );

      if (direct.handled) {
        const directOutput = direct.output?.trim() || direct.error?.trim() || '';
        if (!directOutput) {
          return;
        }

        this.options.storage.recordMessage({
          selfId: message.selfId,
          userId: message.type === 'private' ? message.userId : undefined,
          groupId: message.groupId,
          type: message.type,
          role: 'assistant',
          text: directOutput,
          raw: {},
          createdAt: new Date(),
        });

        const outputSegments = splitOutputSegments(directOutput);
        if (message.type === 'group' && message.groupId) {
          for (let i = 0; i < outputSegments.length; i++) {
            if (i > 0) await sleep(segmentDelay(outputSegments[i - 1]));
            connection.sendAction({
              action: 'send_group_msg',
              params: {
                group_id: Number(message.groupId),
                message: buildOutgoingMessageSegments(outputSegments[i], {
                  memeLibrary: this.options.memes,
                  memesEnabled: this.options.config.memes.enabled,
                  allowedCategories: this.options.config.memes.allowedCategories,
                  disabledMemes: this.options.config.memes.disabledMemes,
                  replyMessageId: message.id,
                }),
              },
            });
          }
          return;
        }

        if (message.type === 'private' && message.userId) {
          for (let i = 0; i < outputSegments.length; i++) {
            if (i > 0) await sleep(segmentDelay(outputSegments[i - 1]));
            connection.sendAction({
              action: 'send_private_msg',
              params: {
                user_id: Number(message.userId),
                message: buildOutgoingMessageSegments(outputSegments[i], {
                  memeLibrary: this.options.memes,
                  memesEnabled: this.options.config.memes.enabled,
                  allowedCategories: this.options.config.memes.allowedCategories,
                  disabledMemes: this.options.config.memes.disabledMemes,
                  replyMessageId: message.id,
                }),
              },
            });
          }
          return;
        }
      }
    }

    if (message.type === 'group' && !trimmed.startsWith('$$') && !isWoken(message, this.options.config.oneBot.wakeKeywords)) {
      return;
    }

    const searchOutput = await this.trySearchFirst(message);
    if (typeof searchOutput === 'string' && searchOutput.trim()) {
      const output = await this.resolveInlineToolMistakes(searchOutput, message.text, {
        userId: message.userId,
        groupId: message.groupId,
      });
      if (output.trim()) {
        this.options.storage.recordMessage({
          selfId: message.selfId,
          userId: message.type === 'private' ? message.userId : undefined,
          groupId: message.groupId,
          type: message.type,
          role: 'assistant',
          text: output,
          raw: {},
          createdAt: new Date(),
        });

        const outputSegments = splitOutputSegments(output);
        if (message.type === 'group' && message.groupId) {
          for (let i = 0; i < outputSegments.length; i++) {
            if (i > 0) await sleep(segmentDelay(outputSegments[i - 1]));
            connection.sendAction({
              action: 'send_group_msg',
              params: {
                group_id: Number(message.groupId),
                message: buildOutgoingMessageSegments(outputSegments[i], {
                  memeLibrary: this.options.memes,
                  memesEnabled: this.options.config.memes.enabled,
                  allowedCategories: this.options.config.memes.allowedCategories,
                  disabledMemes: this.options.config.memes.disabledMemes,
                  replyMessageId: message.id,
                }),
              },
            });
          }
          return;
        }

        if (message.type === 'private' && message.userId) {
          for (let i = 0; i < outputSegments.length; i++) {
            if (i > 0) await sleep(segmentDelay(outputSegments[i - 1]));
            connection.sendAction({
              action: 'send_private_msg',
              params: {
                user_id: Number(message.userId),
                message: buildOutgoingMessageSegments(outputSegments[i], {
                  memeLibrary: this.options.memes,
                  memesEnabled: this.options.config.memes.enabled,
                  allowedCategories: this.options.config.memes.allowedCategories,
                  disabledMemes: this.options.config.memes.disabledMemes,
                  replyMessageId: message.id,
                }),
              },
            });
          }
          return;
        }
      }
    }

    const imageCandidates = this.getImageInspectionCandidates(message, cachedImages);
    const imageInspection = await this.inspectCurrentImagesIfRequested(message.text, imageCandidates, {
      userId: message.userId,
      groupId: message.groupId,
    });

    const history = buildHistoryItems(recentContext, message.type === 'group');

    // Prefix the current message with user ID in group chats, consistent with history format.
    const currentText =
      message.type === 'group' && message.userId
        ? `[用户${message.userId}] ${message.text}`
        : message.text;

    const result = await this.options.agentRuntime.run({
      input: appendCachedImageContext(currentText, imageCandidates, imageInspection),
      history,
      userId: message.userId,
      groupId: message.groupId,
    });

    const output = await this.resolveInlineToolMistakes(result.output, message.text, {
      userId: message.userId,
      groupId: message.groupId,
    });
    if (!output.trim()) {
      return;
    }

    this.options.storage.recordMessage({
      selfId: message.selfId,
      userId: message.type === 'private' ? message.userId : undefined,
      groupId: message.groupId,
      type: message.type,
      role: 'assistant',
      text: output,
      raw: {},
      createdAt: new Date(),
    });

    const outputSegments = splitOutputSegments(output);

    if (message.type === 'group' && message.groupId) {
      for (let i = 0; i < outputSegments.length; i++) {
        if (i > 0) await sleep(segmentDelay(outputSegments[i - 1]));
        connection.sendAction({
          action: 'send_group_msg',
          params: {
            group_id: Number(message.groupId),
            message: buildOutgoingMessageSegments(outputSegments[i], {
              memeLibrary: this.options.memes,
              memesEnabled: this.options.config.memes.enabled,
              allowedCategories: this.options.config.memes.allowedCategories,
              disabledMemes: this.options.config.memes.disabledMemes,
              replyMessageId: message.id,
            }),
          },
        });
      }
      return;
    }

    if (message.type === 'private' && message.userId) {
      for (let i = 0; i < outputSegments.length; i++) {
        if (i > 0) await sleep(segmentDelay(outputSegments[i - 1]));
        connection.sendAction({
          action: 'send_private_msg',
          params: {
            user_id: Number(message.userId),
            message: buildOutgoingMessageSegments(outputSegments[i], {
              memeLibrary: this.options.memes,
              memesEnabled: this.options.config.memes.enabled,
              allowedCategories: this.options.config.memes.allowedCategories,
              disabledMemes: this.options.config.memes.disabledMemes,
              replyMessageId: message.id,
            }),
          },
        });
      }
    }
  }

  private getImageInspectionCandidates(message: { segments: { type: string; data: Record<string, unknown> }[] }, cachedImages: CachedImage[]) {
    if (cachedImages.length > 0) {
      return cachedImages;
    }

    const replyMessageIds = extractReplyMessageIds(message.segments);
    if (replyMessageIds.length === 0) {
      return [];
    }

    const referencedImages: CachedImage[] = [];
    for (const replyMessageId of replyMessageIds) {
      for (const image of this.options.storage.findImagesByMessageId(replyMessageId)) {
        referencedImages.push({
          id: image.id,
          messageId: image.messageId,
          url: image.url,
          localPath: image.localPath,
        });
      }
    }

    return referencedImages;
  }

  private async sendDirectText(
    connection: OneBotConnection,
    message: { id?: string; type: 'group' | 'private'; groupId?: string; userId?: string; selfId?: string },
    text: string,
  ) {
    const output = text.trim();
    if (!output) {
      return;
    }

    this.options.storage.recordMessage({
      selfId: message.selfId,
      userId: message.type === 'private' ? message.userId : undefined,
      groupId: message.groupId,
      type: message.type,
      role: 'assistant',
      text: output,
      raw: {},
      createdAt: new Date(),
    });

    const outputSegments = splitOutputSegments(output);
    if (message.type === 'group' && message.groupId) {
      for (let i = 0; i < outputSegments.length; i++) {
        if (i > 0) await sleep(segmentDelay(outputSegments[i - 1]));
        connection.sendAction({
          action: 'send_group_msg',
          params: {
            group_id: Number(message.groupId),
            message: buildOutgoingMessageSegments(outputSegments[i], {
              memeLibrary: this.options.memes,
              memesEnabled: this.options.config.memes.enabled,
              allowedCategories: this.options.config.memes.allowedCategories,
              disabledMemes: this.options.config.memes.disabledMemes,
              replyMessageId: message.id,
            }),
          },
        });
      }
      return;
    }

    if (message.type === 'private' && message.userId) {
      for (let i = 0; i < outputSegments.length; i++) {
        if (i > 0) await sleep(segmentDelay(outputSegments[i - 1]));
        connection.sendAction({
          action: 'send_private_msg',
          params: {
            user_id: Number(message.userId),
            message: buildOutgoingMessageSegments(outputSegments[i], {
              memeLibrary: this.options.memes,
              memesEnabled: this.options.config.memes.enabled,
              allowedCategories: this.options.config.memes.allowedCategories,
              disabledMemes: this.options.config.memes.disabledMemes,
              replyMessageId: message.id,
            }),
          },
        });
      }
    }
  }

  private async resolveInlineToolMistakes(
    output: string,
    question: string,
    context: { userId?: string; groupId?: string },
  ) {
    const directives = extractPseudoDirectives(output);
    if (directives.length === 0) {
      return output;
    }

    let resolved = output;
    for (const directive of directives) {
      this.options.logger.warn(
        { directive: directive.name, raw: directive.raw },
        'model emitted inline pseudo directive',
      );

      let replacement: string | undefined;
      if (directive.name === 'inspect_recent_image') {
        const imageId = Number(directive.value);
        if (!Number.isInteger(imageId) || imageId <= 0) {
          replacement = `图片查看失败：无效的 imageId`;
        } else {
          const inspected = await inspectRecentImage(this.options.storage, this.options.config, {
            imageId,
            question,
          });
          replacement = inspected.ok && inspected.answer
            ? inspected.answer
            : `图片查看失败：${inspected.error ?? 'unknown error'}`;
        }
      } else if (isSearchDirectiveName(directive.name)) {
        replacement = await this.resolveSearchPseudoDirective(directive, question, context);
      } else {
        replacement = await this.resolveBrowserPseudoDirective(directive, question, context);
      }

      if (typeof replacement === 'string') {
        resolved = resolved.replace(directive.raw, replacement);
      }
    }

    return resolved;
  }

  private async resolveBrowserPseudoDirective(
    directive: { name: string; value: string; params: Record<string, string>; raw: string },
    question: string,
    context: { userId?: string; groupId?: string },
  ) {
    const browserPlugin = this.options.pluginRegistry.getPlugin('browser');
    const resolver = browserPlugin?.resolveInlineDirective;

    if (!resolver) {
      return `浏览器工具调用未执行：${directive.name}${directive.value ? `:${directive.value}` : ''}`;
    }

    const result = await resolver({
      name: directive.name,
      value: directive.value,
      params: directive.params,
      raw: directive.raw,
      question,
      userId: context.userId,
      groupId: context.groupId,
    });

    if (directive.params.execution_mode?.toLowerCase() === 'async') {
      return typeof result === 'string' ? result : '';
    }

    if (typeof result !== 'string' || result.trim() === '') {
      return `浏览器工具调用未执行：${directive.name}${directive.value ? `:${directive.value}` : ''}`;
    }

    return result;
  }

  private async resolveSearchPseudoDirective(
    directive: { name: string; value: string; params: Record<string, string>; raw: string },
    question: string,
    context: { userId?: string; groupId?: string },
  ) {
    const searchPlugin = this.options.pluginRegistry.getPlugin('search');
    const resolver = searchPlugin?.resolveInlineDirective;

    if (!resolver) {
      return `搜索工具调用未执行：${directive.name}${directive.value ? `:${directive.value}` : ''}`;
    }

    const result = await resolver({
      name: directive.name,
      value: directive.value,
      params: directive.params,
      raw: directive.raw,
      question,
      userId: context.userId,
      groupId: context.groupId,
    });

    if (directive.params.execution_mode?.toLowerCase() === 'async') {
      return typeof result === 'string' ? result : '';
    }

    if (typeof result !== 'string' || result.trim() === '') {
      return `搜索工具调用未执行：${directive.name}${directive.value ? `:${directive.value}` : ''}`;
    }

    return result;
  }

  private async trySearchFirst(message: {
    text: string;
    id?: string;
    userId?: string;
    groupId?: string;
  }) {
    if (!shouldRouteToSearchModel(message.text)) {
      return undefined;
    }

    const searchPlugin = this.options.pluginRegistry.getPlugin('search');
    if (!searchPlugin?.resolveInlineDirective) {
      this.options.logger.warn(
        { query: message.text, userId: message.userId, groupId: message.groupId },
        'search request matched but search plugin is unavailable',
      );
      return undefined;
    }

    this.options.logger.info(
      { query: message.text, userId: message.userId, groupId: message.groupId },
      'routing message to search workflow',
    );

    const result = await searchPlugin.resolveInlineDirective({
      name: 'priority_search',
      value: message.text,
      params: {
        execution_mode: 'sync',
        pending_notice: '正在搜索，请稍候...',
      },
      raw: `[[priority_search:${message.text}]]`,
      question: message.text,
      userId: message.userId,
      groupId: message.groupId,
    });

    return typeof result === 'string' ? result : undefined;
  }

  private async inspectCurrentImagesIfRequested(
    text: string,
    cachedImages: CachedImage[],
    context: { userId?: string; groupId?: string },
  ) {
    if (cachedImages.length === 0 || !shouldAutoInspectImage(text)) {
      return undefined;
    }

    const image = cachedImages[0];
    this.options.logger.info({ imageId: image.id }, 'auto inspecting message image before agent response');
    appEventBus.emit('async_agent_message', {
      message: '让我先看看这张图',
      userId: context.userId,
      groupId: context.groupId,
    });

    const inspected = await withTimeout(
      inspectRecentImage(this.options.storage, this.options.config, {
        imageId: image.id,
        question: text,
      }),
      45_000,
      'Image inspection timed out after 45 seconds',
    );

    if (inspected.ok && inspected.answer) {
      return `Image inspection result for imageId=${image.id}:\n${inspected.answer}`;
    }

    return `Image inspection failed for imageId=${image.id}: ${inspected.error ?? 'unknown error'}`;
  }
}

function appendCachedImageContext(
  text: string,
  cachedImages: CachedImage[],
  imageInspection?: string,
) {
  if (cachedImages.length === 0) {
    return text;
  }

  const notes = cachedImages
    .map((image) => {
      const source = image.localPath ? 'local_file' : image.url ? 'url' : 'unknown';
      return `- imageId=${image.id}, source=${source}`;
    })
    .join('\n');

  const inspectionNote = imageInspection
    ? `\n\nThe image has already been inspected locally. Use this result directly and keep the reply concise and natural.\n${imageInspection}`
    : '';

  return `${text}\n\n<System note: The current message contains cached image(s). Use an actual tool call to inspect_recent_image with the listed imageId if the user asks about image content. Never print the tool name or write [[inspect_recent_image:...]] in the chat reply.\n${notes}${inspectionNote}\n>`;
}

function shouldAutoInspectImage(text: string) {
  const normalized = text.trim().toLowerCase();
  const patterns = [
    /看.*图/,
    /看看.*图/,
    /查看.*图/,
    /识图/,
    /图里/,
    /图中/,
    /这张图/,
    /这图/,
    /这个图/,
    /这张照片/,
    /这个表情/,
    /帮我看.*图/,
    /帮我看.*照片/,
    /what.*(image|picture|photo)/,
    /(image|picture|photo).*(what|describe|tell|see)/,
  ];
  return patterns.some((pattern) => pattern.test(normalized));
}

function shouldRouteToSearchModel(text: string) {
  const normalized = text.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  const patterns = [
    /(^|[\s,，。！？!?])(搜索|搜一下|搜一搜|查一下|查查|查询|帮我查|帮我搜|找一下|看看)([\s,，。！？!?]|$)/,
    /(去年|今年|最新|最近|当前|现在|排名|榜单|top\s?\d+|top\d+|top\s?1|top1|冠军|选手|战队|赛事|狙击手)/,
  ];

  return patterns.some((pattern) => pattern.test(normalized));
}

function extractReplyMessageIds(segments: { type: string; data: Record<string, unknown> }[]) {
  return segments
    .filter((segment) => segment.type === 'reply')
    .map((segment) => readString(segment.data.id))
    .filter((value): value is string => Boolean(value));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function readString(value: unknown) {
  if (typeof value !== 'string' || value.length === 0) {
    return undefined;
  }
  return value;
}

function isSearchDirectiveName(name: string) {
  return name === 'priority_search' || name === 'browser_search';
}

function isWoken(message: { selfId?: string; text: string; segments: { type: string; data: Record<string, unknown> }[] }, wakeKeywords: string[]): boolean {
  if (message.selfId) {
    const mentioned = message.segments.some(
      (seg) => seg.type === 'at' && String(seg.data.qq) === message.selfId,
    );
    if (mentioned) return true;
  }

  const lowerText = message.text.toLowerCase();
  return wakeKeywords.some((kw) => lowerText.includes(kw.toLowerCase()));
}

const CONTEXT_TIME_WINDOW_MS = 2 * 60 * 60 * 1000; // only include messages from the last 2 hours

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function segmentDelay(previousSegment: string): number {
  // Base 400 ms + 25 ms per character, capped at 1500 ms.
  return Math.min(400 + previousSegment.length * 25, 1500);
}

function buildHistoryItems(context: ContextMessage[], isGroup: boolean): AgentInputItem[] {
  const cutoff = Date.now() - CONTEXT_TIME_WINDOW_MS;

  return context
    .filter((msg) => new Date(msg.createdAt).getTime() >= cutoff)
    .map((msg) => {
      if (msg.role === 'assistant') {
        return {
          role: 'assistant' as const,
          status: 'completed' as const,
          content: [{ type: 'output_text' as const, text: msg.text }],
        };
      }

      const userTag = isGroup && msg.userId ? ` [用户${msg.userId}]` : '';
      return { role: 'user' as const, content: `${userTag} ${msg.text}`.trim() };
    });
}

function splitOutputSegments(output: string): string[] {
  return output
    .split('[NEXT]')
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function parseEvent(payload: string): OneBotInboundEvent | undefined {
  try {
    return JSON.parse(payload) as OneBotInboundEvent;
  } catch {
    return undefined;
  }
}

function normalizeSourceHost(value: string | undefined) {
  if (!value) {
    return '';
  }

  const normalized = value.trim().toLowerCase();
  if (normalized.startsWith('::ffff:')) {
    return normalized.slice(7);
  }

  return normalized;
}

function getRequestSourceHost(request: {
  ip?: string;
  raw: {
    socket: {
      remoteAddress?: string;
    };
  };
}) {
  return normalizeSourceHost(request.ip || request.raw.socket.remoteAddress);
}

function closeWebSocketLike(socket: unknown, code: number, reason: string) {
  if (socket && typeof socket === 'object') {
    if ('close' in socket && typeof socket.close === 'function') {
      socket.close(code, reason);
      return;
    }

    if ('destroy' in socket && typeof socket.destroy === 'function') {
      socket.destroy();
      return;
    }

    if ('end' in socket && typeof socket.end === 'function') {
      socket.end();
      return;
    }
  }
}

function resolveWebSocket(socket: unknown): WebSocket | undefined {
  if (isWebSocketLike(socket)) {
    return socket as WebSocket;
  }

  if (
    socket &&
    typeof socket === 'object' &&
    'socket' in socket &&
    isWebSocketLike((socket as { socket?: unknown }).socket)
  ) {
    return (socket as { socket: WebSocket }).socket;
  }

  return undefined;
}

function isWebSocketLike(value: unknown) {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return (
    'on' in value &&
    typeof value.on === 'function' &&
    'send' in value &&
    typeof value.send === 'function'
  );
}

function isPublicAddress(value: string) {
  if (!value) {
    return true;
  }

  const normalized = normalizeSourceHost(value);
  if (normalized === 'localhost') {
    return false;
  }

  if (normalized === '::1' || normalized === '127.0.0.1') {
    return false;
  }

  const version = isIP(normalized);
  if (version === 4) {
    return !isPrivateIpv4(normalized);
  }

  if (version === 6) {
    return !isPrivateIpv6(normalized);
  }

  return true;
}

function isPrivateIpv4(value: string) {
  const parts = value.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return false;
  }

  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function isPrivateIpv6(value: string) {
  return (
    value === '::1' ||
    value.startsWith('fc') ||
    value.startsWith('fd') ||
    value.startsWith('fe80:') ||
    value.startsWith('fe90:') ||
    value.startsWith('fea0:') ||
    value.startsWith('feb0:')
  );
}
