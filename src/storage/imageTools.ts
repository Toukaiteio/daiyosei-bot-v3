import { tool } from '@openai/agents';
import { Buffer } from 'node:buffer';
import type { AppConfig, ModelProfile } from '../config/schema.js';
import type { StorageDatabase } from './database.js';

const maxImageBytes = 10 * 1024 * 1024;

export function createImageHistoryTools(storage: StorageDatabase, config?: AppConfig) {
  return [
    tool({
      name: 'find_recent_images',
      description:
        'Find cached images from recent chat history by group, user, and optional ISO timestamp. Use this before deciding whether an image needs vision inspection.',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
          groupId: { type: 'string' },
          since: { type: 'string', format: 'date-time' },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        },
        required: [],
        additionalProperties: false,
      },
      execute: ({ userId, groupId, since, limit }: any) =>
        storage.findRecentImages({
          userId,
          groupId,
          limit,
          since: since ? new Date(since) : undefined,
        }),
    }),
    ...(config ? [createInspectRecentImageTool(storage, config)] : []),
  ];
}

function createInspectRecentImageTool(storage: StorageDatabase, config: AppConfig) {
  return tool({
    name: 'inspect_recent_image',
    description:
      'Download a cached chat image locally and inspect it with the configured vision model. Use this when the user asks what is in a sent image, sticker, meme, or QQ expression.',
    parameters: {
      type: 'object',
      properties: {
        imageId: { type: 'integer', minimum: 1 },
        messageId: { type: 'string' },
        url: { type: 'string' },
        question: { type: 'string' },
      },
      required: [],
      additionalProperties: false,
    },
    execute: async ({ imageId, messageId, url, question }: any) => {
      const image = resolveImage(storage, { imageId, messageId });
      const sourceUrl = normalizeImageUrl(url || image?.url);
      if (!sourceUrl) {
        return {
          ok: false,
          error:
            'No downloadable image URL was found. Call find_recent_images first and pass imageId, messageId, or a direct URL.',
        };
      }

      const model = selectVisionModel(config);
      if (!model) {
        return {
          ok: false,
          error:
            'No vision-capable model is configured. Assign a model with supportsVision=true to the vision role or main role.',
        };
      }

      try {
        const downloaded = await downloadImageAsDataUrl(sourceUrl);
        const answer = await inspectWithVisionModel(
          model,
          downloaded.dataUrl,
          question || 'Describe this image in the same language as the user. Mention if it looks like a sticker, meme, or expression.',
        );
        return {
          ok: true,
          imageId: image?.id,
          messageId: image?.messageId,
          sourceUrl,
          contentType: downloaded.contentType,
          bytes: downloaded.bytes,
          model: model.model,
          answer,
        };
      } catch (error) {
        return {
          ok: false,
          imageId: image?.id,
          messageId: image?.messageId,
          sourceUrl,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
}

function resolveImage(
  storage: StorageDatabase,
  query: { imageId?: number; messageId?: string },
) {
  if (Number.isInteger(query.imageId) && query.imageId && query.imageId > 0) {
    return storage.findImageById(query.imageId);
  }
  if (query.messageId) {
    return storage.findImageByMessageId(query.messageId);
  }
  return undefined;
}

function selectVisionModel(config: AppConfig): ModelProfile | undefined {
  return (
    config.models.find((model) => model.role === 'vision' && model.supportsVision) ||
    config.models.find((model) => model.role === 'main' && model.supportsVision) ||
    config.models.find((model) => model.supportsVision)
  );
}

function normalizeImageUrl(value?: string) {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('/')) return undefined;
  return trimmed;
}

async function downloadImageAsDataUrl(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
        referer: 'https://im.qq.com/',
      },
    });
    if (!response.ok) {
      throw new Error(`Image download failed with HTTP ${response.status}`);
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0) {
      throw new Error('Image download returned an empty body');
    }
    if (bytes.length > maxImageBytes) {
      throw new Error(`Image is too large: ${bytes.length} bytes, max ${maxImageBytes}`);
    }

    const contentType = normalizeContentType(response.headers.get('content-type')) || sniffImageMime(bytes);
    if (!contentType.startsWith('image/')) {
      throw new Error(`Downloaded content is not an image: ${contentType}`);
    }

    return {
      contentType,
      bytes: bytes.length,
      dataUrl: `data:${contentType};base64,${bytes.toString('base64')}`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeContentType(value: string | null) {
  return value?.split(';')[0]?.trim().toLowerCase() || '';
}

function sniffImageMime(bytes: Buffer) {
  if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'image/jpeg';
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (bytes.subarray(0, 6).toString('ascii') === 'GIF87a' || bytes.subarray(0, 6).toString('ascii') === 'GIF89a') {
    return 'image/gif';
  }
  if (bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }
  return 'application/octet-stream';
}

async function inspectWithVisionModel(model: ModelProfile, dataUrl: string, question: string) {
  const response = await fetch(`${model.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${model.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: model.model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: question },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });
  const text = await response.text();
  let payload: any;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = undefined;
  }
  if (!response.ok) {
    throw new Error(`Vision API failed with HTTP ${response.status}: ${text.slice(0, 500)}`);
  }

  const content = payload?.choices?.[0]?.message?.content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .filter(Boolean)
      .join('\n');
  }
  if (typeof content === 'string' && content.trim()) {
    return content;
  }
  throw new Error('Vision API returned no text content');
}
