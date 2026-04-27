import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { StorageDatabase } from '../src/storage/database.js';

const tempDirs: string[] = [];

describe('StorageDatabase', () => {
  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('records messages and indexes recent images by context', () => {
    const dir = mkdtempSync(join(tmpdir(), 'daiyosei-storage-'));
    tempDirs.push(dir);
    const storage = new StorageDatabase(join(dir, 'bot.db'));
    storage.migrate();

    storage.recordMessage({
      messageId: 'm1',
      userId: 'u1',
      groupId: 'g1',
      type: 'group',
      text: 'look',
      raw: { ok: true },
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    storage.recordImage({
      imageHash: 'hash-1',
      messageId: 'm1',
      userId: 'u1',
      groupId: 'g1',
      url: 'https://example.test/image.png',
      raw: { type: 'image' },
      createdAt: new Date('2026-01-01T00:00:01.000Z'),
    });

    expect(storage.stats()).toEqual({ messages: 1, images: 1 });
    expect(storage.findRecentImages({ groupId: 'g1', userId: 'u1' })).toMatchObject([
      {
        imageHash: 'hash-1',
        messageId: 'm1',
        userId: 'u1',
        groupId: 'g1',
        url: 'https://example.test/image.png',
      },
    ]);

    storage.close();
  });
});
