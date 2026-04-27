import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { ContextMessage, RecentImage, RecentImageQuery, StoredChatMessage, StoredImage } from './types.js';

type ImageRow = {
  id: number;
  image_hash: string;
  message_id: string | null;
  user_id: string | null;
  group_id: string | null;
  url: string | null;
  local_path: string | null;
  file_id: string | null;
  summary: string | null;
  ocr_text: string | null;
  tags_json: string;
  created_at: string;
};

export class StorageDatabase {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    const resolvedPath = resolve(dbPath);
    mkdirSync(dirname(resolvedPath), { recursive: true });
    this.db = new Database(resolvedPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
  }

  migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id TEXT,
        self_id TEXT,
        user_id TEXT,
        group_id TEXT,
        type TEXT NOT NULL,
        text TEXT NOT NULL,
        raw_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_chat_messages_context
        ON chat_messages(group_id, user_id, created_at);

      CREATE TABLE IF NOT EXISTS image_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        image_hash TEXT NOT NULL,
        message_id TEXT,
        user_id TEXT,
        group_id TEXT,
        url TEXT,
        local_path TEXT,
        file_id TEXT,
        summary TEXT,
        ocr_text TEXT,
        tags_json TEXT NOT NULL DEFAULT '[]',
        raw_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_image_cache_context
        ON image_cache(group_id, user_id, created_at);

      CREATE INDEX IF NOT EXISTS idx_image_cache_hash
        ON image_cache(image_hash);

      CREATE INDEX IF NOT EXISTS idx_chat_messages_group
        ON chat_messages(group_id, created_at);

      CREATE TABLE IF NOT EXISTS user_blacklist (
        user_id TEXT PRIMARY KEY,
        reason TEXT,
        banned_at TEXT NOT NULL
      );
    `);
    this.addColumnIfMissing('image_cache', 'local_path', 'TEXT');
    this.addColumnIfMissing('chat_messages', 'role', "TEXT NOT NULL DEFAULT 'user'");
  }

  recordMessage(message: StoredChatMessage) {
    this.db
      .prepare(
        `
        INSERT INTO chat_messages (
          message_id, self_id, user_id, group_id, type, role, text, raw_json, created_at
        ) VALUES (
          @messageId, @selfId, @userId, @groupId, @type, @role, @text, @rawJson, @createdAt
        )
      `,
      )
      .run({
        messageId: message.messageId ?? null,
        selfId: message.selfId ?? null,
        userId: message.userId ?? null,
        groupId: message.groupId ?? null,
        type: message.type,
        role: message.role ?? 'user',
        text: message.text,
        rawJson: JSON.stringify(message.raw),
        createdAt: message.createdAt.toISOString(),
      });
  }

  getRecentContext(opts: { userId?: string; groupId?: string; limit?: number }): ContextMessage[] {
    const limit = Math.min(opts.limit ?? 20, 50);
    type ContextRow = { role: string; user_id: string | null; text: string; created_at: string };
    let rows: ContextRow[];

    if (opts.groupId) {
      rows = this.db
        .prepare(
          `SELECT role, user_id, text, created_at FROM chat_messages
           WHERE group_id = @groupId
           ORDER BY created_at DESC, id DESC LIMIT @limit`,
        )
        .all({ groupId: opts.groupId, limit }) as ContextRow[];
    } else if (opts.userId) {
      rows = this.db
        .prepare(
          `SELECT role, user_id, text, created_at FROM chat_messages
           WHERE group_id IS NULL AND user_id = @userId
           ORDER BY created_at DESC, id DESC LIMIT @limit`,
        )
        .all({ userId: opts.userId, limit }) as ContextRow[];
    } else {
      return [];
    }

    return rows.reverse().map((row) => ({
      role: row.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      userId: row.user_id ?? undefined,
      text: row.text,
      createdAt: row.created_at,
    }));
  }

  recordImage(image: StoredImage): number {
    const result = this.db
      .prepare(
        `
        INSERT INTO image_cache (
          image_hash, message_id, user_id, group_id, url, local_path, file_id,
          summary, ocr_text, tags_json, raw_json, created_at
        ) VALUES (
          @imageHash, @messageId, @userId, @groupId, @url, @localPath, @fileId,
          @summary, @ocrText, @tagsJson, @rawJson, @createdAt
        )
      `,
      )
      .run({
        imageHash: image.imageHash,
        messageId: image.messageId,
        userId: image.userId,
        groupId: image.groupId,
        url: image.url,
        localPath: image.localPath,
        fileId: image.fileId,
        summary: image.summary,
        ocrText: image.ocrText,
        tagsJson: JSON.stringify(image.tags ?? []),
        rawJson: JSON.stringify(image.raw),
        createdAt: image.createdAt.toISOString(),
      });
    return Number(result.lastInsertRowid);
  }

  findRecentImages(query: RecentImageQuery = {}): RecentImage[] {
    const clauses: string[] = [];
    const params: Record<string, unknown> = {
      limit: Math.min(Math.max(query.limit ?? 20, 1), 100),
    };

    if (query.userId) {
      clauses.push('user_id = @userId');
      params.userId = query.userId;
    }
    if (query.groupId) {
      clauses.push('group_id = @groupId');
      params.groupId = query.groupId;
    }
    if (query.since) {
      clauses.push('created_at >= @since');
      params.since = query.since.toISOString();
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = this.db
      .prepare(`SELECT * FROM image_cache ${where} ORDER BY created_at DESC, id DESC LIMIT @limit`)
      .all(params) as ImageRow[];

    return rows.map(mapImageRow);
  }

  findImageById(id: number): RecentImage | undefined {
    const row = this.db.prepare('SELECT * FROM image_cache WHERE id = @id').get({ id }) as
      | ImageRow
      | undefined;
    return row ? mapImageRow(row) : undefined;
  }

  findImageByMessageId(messageId: string): RecentImage | undefined {
    const row = this.db
      .prepare('SELECT * FROM image_cache WHERE message_id = @messageId ORDER BY created_at DESC, id DESC LIMIT 1')
      .get({ messageId }) as ImageRow | undefined;
    return row ? mapImageRow(row) : undefined;
  }

  findImagesByMessageId(messageId: string): RecentImage[] {
    const rows = this.db
      .prepare('SELECT * FROM image_cache WHERE message_id = @messageId ORDER BY created_at DESC, id DESC')
      .all({ messageId }) as ImageRow[];
    return rows.map(mapImageRow);
  }

  banUser(userId: string, reason?: string) {
    this.db
      .prepare(
        `INSERT INTO user_blacklist (user_id, reason, banned_at)
         VALUES (@userId, @reason, @bannedAt)
         ON CONFLICT(user_id) DO UPDATE SET reason = @reason, banned_at = @bannedAt`,
      )
      .run({ userId, reason: reason ?? null, bannedAt: new Date().toISOString() });
  }

  unbanUser(userId: string): boolean {
    const result = this.db.prepare('DELETE FROM user_blacklist WHERE user_id = @userId').run({ userId });
    return result.changes > 0;
  }

  isBanned(userId: string): boolean {
    const row = this.db
      .prepare('SELECT 1 FROM user_blacklist WHERE user_id = @userId')
      .get({ userId });
    return row !== undefined;
  }

  listBanned(): { userId: string; reason?: string; bannedAt: string }[] {
    const rows = this.db
      .prepare('SELECT user_id, reason, banned_at FROM user_blacklist ORDER BY banned_at DESC')
      .all() as { user_id: string; reason: string | null; banned_at: string }[];
    return rows.map((row) => ({
      userId: row.user_id,
      reason: row.reason ?? undefined,
      bannedAt: row.banned_at,
    }));
  }

  stats() {
    const messages = this.db.prepare('SELECT COUNT(*) AS count FROM chat_messages').get() as {
      count: number;
    };
    const images = this.db.prepare('SELECT COUNT(*) AS count FROM image_cache').get() as {
      count: number;
    };

    return {
      messages: messages.count,
      images: images.count,
    };
  }

  close() {
    this.db.close();
  }

  private addColumnIfMissing(table: string, column: string, definition: string) {
    const rows = this.db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (rows.some((row) => row.name === column)) {
      return;
    }
    this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function mapImageRow(row: ImageRow): RecentImage {
  return {
    id: row.id,
    imageHash: row.image_hash,
    messageId: row.message_id ?? undefined,
    userId: row.user_id ?? undefined,
    groupId: row.group_id ?? undefined,
    url: row.url ?? undefined,
    localPath: row.local_path ?? undefined,
    fileId: row.file_id ?? undefined,
    summary: row.summary ?? undefined,
    ocrText: row.ocr_text ?? undefined,
    tags: parseTags(row.tags_json),
    createdAt: row.created_at,
  };
}

function parseTags(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
