import { appEventBus } from '../events.js';

export type AsyncToolContext = {
  userId?: string;
  groupId?: string;
  replyMessageId?: string;
};

export function emitAsyncMessage(message: string, context?: AsyncToolContext) {
  if (!message.trim()) {
    return;
  }

  appEventBus.emit('async_agent_message', {
    message,
    userId: context?.userId,
    groupId: context?.groupId,
    replyMessageId: context?.replyMessageId,
  });
}

export function scheduleAsyncWork<T>(options: {
  context?: AsyncToolContext;
  pendingNotice?: string;
  queuedMessage: string;
  run: () => Promise<T>;
  formatSuccess: (result: T) => string;
  formatError: (error: unknown) => string;
}) {
  if (options.pendingNotice) {
    emitAsyncMessage(options.pendingNotice, options.context);
  }

  void (async () => {
    try {
      const result = await options.run();
      emitAsyncMessage(options.formatSuccess(result), options.context);
    } catch (error) {
      emitAsyncMessage(options.formatError(error), options.context);
    }
  })();

  return options.queuedMessage;
}
