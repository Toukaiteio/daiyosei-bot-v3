import { Memory } from 'openmemory-js';

export type MemoryQuery = {
  userId: string;
  query: string;
  groupId?: string;
  limit?: number;
};

export type MemoryAddInput = {
  userId: string;
  content: string;
  groupId?: string;
  metadata?: Record<string, unknown>;
};

export type MemoryResult = {
  id?: string;
  content: string;
  score?: number;
  metadata?: Record<string, unknown>;
};

/**
 * OpenMemory 客户端
 * 基于官方 openmemory-js SDK
 *
 * 支持两种模式：
 * 1. 本地模式（默认）- 使用本地 SQLite 数据库
 * 2. 远程模式 - 连接到远程 OpenMemory 服务器
 *
 * 配置示例（.env）:
 * OPENMEMORY_BASE_URL=http://localhost:8080  # 远程服务器 URL（可选）
 * OPENMEMORY_API_KEY=your-api-key            # API 密钥（可选）
 */
export class OpenMemoryClient {
  private memory: Memory;
  private isRemoteMode: boolean;

  constructor(private readonly options: { baseUrl?: string; apiKey?: string }) {
    this.isRemoteMode = Boolean(this.options.baseUrl);

    if (this.isRemoteMode) {
      this.memory = new Memory({
        mode: 'remote',
        serverUrl: this.options.baseUrl!,
        apiKey: this.options.apiKey,
      });
    } else {
      this.memory = new Memory({
        mode: 'local',
      });
    }
  }

  /**
   * 检查是否为远程模式（服务器已配置）
   */
  isConfigured() {
    return this.isRemoteMode;
  }

  /**
   * 搜索用户的长期记忆
   */
  async search(query: MemoryQuery): Promise<MemoryResult[]> {
    try {
      const results = await this.memory.search(query.query, {
        user_id: query.userId,
        group_id: query.groupId,
        limit: query.limit ?? 5,
      });

      return normalizeMemoryResults(results);
    } catch (error) {
      console.error('OpenMemory search error:', error);
      return [];
    }
  }

  /**
   * 存储用户的长期记忆
   */
  async add(input: MemoryAddInput): Promise<void> {
    try {
      await this.memory.add(input.content, {
        user_id: input.userId,
        group_id: input.groupId,
        metadata: input.metadata,
      });
    } catch (error) {
      console.error('OpenMemory add error:', error);
    }
  }

  /**
   * 删除特定的记忆
   */
  async delete(memoryId: string): Promise<boolean> {
    try {
      await this.memory.delete(memoryId);
      return true;
    } catch (error) {
      console.error('OpenMemory delete error:', error);
      return false;
    }
  }

  /**
   * 加强记忆的重要性（增加 salience）
   */
  async reinforce(memoryId: string): Promise<boolean> {
    try {
      await this.memory.reinforce(memoryId);
      return true;
    } catch (error) {
      console.error('OpenMemory reinforce error:', error);
      return false;
    }
  }

  /**
   * 获取 Memory 实例（用于高级操作）
   */
  getMemoryInstance(): Memory {
    return this.memory;
  }
}

/**
 * 规范化内存搜索结果
 */
function normalizeMemoryResults(results: unknown): MemoryResult[] {
  if (!Array.isArray(results)) {
    return [];
  }

  return results.map(normalizeMemoryResult);
}

/**
 * 规范化单条内存记录
 */
function normalizeMemoryResult(value: unknown): MemoryResult {
  if (!isRecord(value)) {
    return { content: String(value) };
  }

  return {
    id: stringifyOptional(value.id),
    content: String(value.content ?? value.memory ?? value.text ?? ''),
    score: typeof value.score === 'number' ? value.score : undefined,
    metadata: isRecord(value.metadata) ? value.metadata : undefined,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringifyOptional(value: unknown): string | undefined {
  return value === undefined || value === null ? undefined : String(value);
}
