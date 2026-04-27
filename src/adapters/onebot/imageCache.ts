import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import type { BotMessage, OneBotMessageSegment } from './types.js';
import type { StoredImage } from '../../storage/types.js';

export function extractImagesFromMessage(message: BotMessage, createdAt: Date): StoredImage[] {
  const localPaths = extractLocalImagePaths(message.raw);
  return message.segments
    .filter((segment) => segment.type === 'image')
    .map((segment, index) => segmentToStoredImage(message, segment, createdAt, localPaths[index]));
}

function segmentToStoredImage(
  message: BotMessage,
  segment: OneBotMessageSegment,
  createdAt: Date,
  localPath: string | undefined,
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
    localPath,
    fileId,
    raw: { segment, localPath },
    createdAt,
  };
}

function extractLocalImagePaths(raw: unknown) {
  const paths: string[] = [];
  collectLocalImagePaths(raw, paths);
  return [...new Set(paths)].filter((path) => existsSync(path));
}

function collectLocalImagePaths(value: unknown, paths: string[]) {
  if (!value || typeof value !== 'object') {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectLocalImagePaths(item, paths);
    }
    return;
  }

  const record = value as Record<string, unknown>;
  const sourcePath = readString(record.sourcePath) ?? readString(record.source_path);
  if (sourcePath && looksLikeImagePath(sourcePath)) {
    paths.push(sourcePath);
  }

  for (const child of Object.values(record)) {
    collectLocalImagePaths(child, paths);
  }
}

function looksLikeImagePath(value: string) {
  return /\.(?:png|jpe?g|gif|webp|bmp|avif)$/i.test(value);
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
