import type { FastifyInstance } from 'fastify';
import type { Logger } from 'pino';
import { isIP } from 'node:net';
import type WebSocket from 'ws';
import type { AgentRuntime } from '../../agent/agentRuntime.js';
import type { AppConfig } from '../../config/schema.js';
import type { CommandRegistry } from '../../commands/registry.js';
import type { MemeLibrary } from '../../memes/library.js';
import type { StorageDatabase } from '../../storage/database.js';
import { OneBotConnection } from './connection.js';
import { extractImagesFromMessage } from './imageCache.js';
import { mapOneBotEvent } from './mapper.js';
import { buildOutgoingMessageSegments } from './messageBuilder.js';
import type { OneBotInboundEvent } from './types.js';
import { appEventBus } from '../../events.js';

export class OneBotGateway {
  private readonly connections = new Map<string, OneBotConnection>();

  constructor(
    private readonly options: {
      config: AppConfig;
      logger: Logger;
      agentRuntime: AgentRuntime;
      storage: StorageDatabase;
      memes: MemeLibrary;
      commandRegistry: CommandRegistry;
    },
  ) {
    appEventBus.on('async_agent_message', (data: { message: string; userId?: string; groupId?: string; replyMessageId?: string }) => {
      this.sendAsyncMessage(data);
    });
  }

  private sendAsyncMessage(data: { message: string; userId?: string; groupId?: string; replyMessageId?: string }) {
    if (!data.message.trim()) return;

    for (const connection of this.connections.values()) {
      if (data.groupId) {
        connection.sendAction({
          action: 'send_group_msg',
          params: {
            group_id: Number(data.groupId),
            message: buildOutgoingMessageSegments(data.message, {
              memeLibrary: this.options.memes,
              memesEnabled: this.options.config.memes.enabled,
              allowedCategories: this.options.config.memes.allowedCategories,
              disabledMemes: this.options.config.memes.disabledMemes,
              replyMessageId: data.replyMessageId,
            }),
          },
        });
        continue;
      }

      if (data.userId) {
        connection.sendAction({
          action: 'send_private_msg',
          params: {
            user_id: Number(data.userId),
            message: buildOutgoingMessageSegments(data.message, {
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

    if (message.userId && this.options.storage.isBanned(message.userId)) {
      this.options.logger.debug({ userId: message.userId }, 'message dropped: user is blacklisted');
      return;
    }

    const createdAt = event.time ? new Date(event.time * 1000) : new Date();
    this.options.storage.recordMessage({
      messageId: message.id,
      selfId: message.selfId,
      userId: message.userId,
      groupId: message.groupId,
      type: message.type,
      text: message.text,
      raw: event,
      createdAt,
    });
    for (const image of extractImagesFromMessage(message, createdAt)) {
      this.options.storage.recordImage(image);
    }

    if (!message.text.trim()) {
      return;
    }

    const trimmed = message.text.trimStart();
    if (trimmed.startsWith('$$')) {
      const trigger = trimmed.slice(2).trimStart().split(/\s+/)[0]?.toLowerCase() ?? '';
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
    }

    if (message.type === 'group' && !isWoken(message, this.options.config.oneBot.wakeKeywords)) {
      return;
    }

    const result = await this.options.agentRuntime.run({
      input: message.text,
      userId: message.userId,
      groupId: message.groupId,
    });

    if (!result.output.trim()) {
      return;
    }

    if (message.type === 'group' && message.groupId) {
      connection.sendAction({
        action: 'send_group_msg',
        params: {
          group_id: Number(message.groupId),
          message: buildOutgoingMessageSegments(result.output, {
            memeLibrary: this.options.memes,
            memesEnabled: this.options.config.memes.enabled,
            allowedCategories: this.options.config.memes.allowedCategories,
            disabledMemes: this.options.config.memes.disabledMemes,
            replyMessageId: message.id,
          }),
        },
      });
      return;
    }

    if (message.type === 'private' && message.userId) {
      connection.sendAction({
        action: 'send_private_msg',
        params: {
          user_id: Number(message.userId),
          message: buildOutgoingMessageSegments(result.output, {
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
