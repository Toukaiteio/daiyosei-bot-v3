import { createHash } from 'node:crypto';
import type { BotMessage, OneBotMessageSegment } from './types.js';
import type { StoredImage } from '../../storage/types.js';

export function extractImagesFromMessage(message: BotMessage, createdAt: Date): StoredImage[] {
  return message.segments
    .filter((segment) => segment.type === 'image')
    .map((segment) => segmentToStoredImage(message, segment, createdAt));
}

function segmentToStoredImage(
  message: BotMessage,
  segment: OneBotMessageSegment,
  createdAt: Date,
): StoredImage {
  const url = readString(segment.data.url);
  const fileId = readString(segment.data.file_id) ?? readString(segment.data.file);
  const imageHash = readString(segment.data.md5) ?? hashImageIdentity(url, fileId, message.id);

  return {
    imageHash,
    messageId: message.id,
    userId: message.userId,
    groupId: message.groupId,
    url,
    fileId,
    raw: segment,
    createdAt,
  };
}

function readString(value: unknown) {
  if (typeof value !== 'string' || value.length === 0) {
    return undefined;
  }
  return value;
}

function hashImageIdentity(url: string | undefined, fileId: string | undefined, messageId: string | undefined) {
  return createHash('sha256').update(`${url ?? ''}:${fileId ?? ''}:${messageId ?? ''}`).digest('hex');
}
