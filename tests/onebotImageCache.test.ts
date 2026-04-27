import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extractImagesFromMessage } from '../src/adapters/onebot/imageCache.js';
import type { BotMessage } from '../src/adapters/onebot/types.js';

describe('extractImagesFromMessage', () => {
  it('converts OneBot image segments into cached image records', () => {
    const message: BotMessage = {
      id: '42',
      type: 'group',
      userId: '1001',
      groupId: '2002',
      text: '',
      segments: [
        { type: 'text', data: { text: 'ignored' } },
        { type: 'image', data: { file: 'abc.jpg', url: 'https://example.test/a.jpg', md5: 'md5' } },
      ],
      raw: { post_type: 'message', message_type: 'group' },
    };

    expect(extractImagesFromMessage(message, new Date('2026-01-01T00:00:00.000Z'))).toMatchObject([
      {
        imageHash: 'md5',
        messageId: '42',
        userId: '1001',
        groupId: '2002',
        fileId: 'abc.jpg',
        url: 'https://example.test/a.jpg',
      },
    ]);
  });

  it('uses NapCat local sourcePath when available', () => {
    const dir = mkdtempSync(join(tmpdir(), 'daiyosei-image-cache-'));
    const localPath = join(dir, 'cached.jpg');
    writeFileSync(localPath, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    const message: BotMessage = {
      id: '43',
      type: 'private',
      userId: '1001',
      text: '',
      segments: [
        { type: 'image', data: { file: 'cached.jpg', url: 'https://example.test/cached.jpg' } },
      ],
      raw: {
        post_type: 'message',
        message_type: 'private',
        raw: {
          elements: [
            {
              picElement: {
                sourcePath: localPath,
              },
            },
          ],
        },
      } as any,
    };

    expect(extractImagesFromMessage(message, new Date('2026-01-01T00:00:00.000Z'))[0]).toMatchObject({
      localPath,
    });
  });
});
