/**
 * 改进的 OpenMemory HTTP 客户端
 * 兼容 CaviraOSS/OpenMemory 官方 API
 * 参考: https://github.com/CaviraOSS/OpenMemory
 */

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
 * OpenMemory API 兼容客户端
 *
 * 配置示例（.env）:
 * OPENMEMORY_BASE_URL=http://localhost:8080
 * OPENMEMORY_API_KEY=your-api-key-optional
 */
export class OpenMemoryClient {
  private readonly baseUrl: string | undefined;
  private readonly apiKey: string | undefined;

  constructor(options: { baseUrl?: string; apiKey?: string }) {
    this.baseUrl = options.baseUrl;
    this.apiKey = options.apiKey;
  }

  isConfigured() {
    return Boolean(this.baseUrl);
  }

  async search(query: MemoryQuery): Promise<MemoryResult[]> {
    if (!this.isConfigured()) {
      return [];
    }

    try {
      const response = await this.request<unknown>('/api/memory/search', {
        method: 'POST',
        body: {
          query: query.query,
          user_id: query.userId,
          group_id: query.groupId,
          limit: query.limit ?? 5,
        },
      });

      return normalizeMemoryResults(response);
    } catch (error) {
      console.error('OpenMemory search error:', error);
      return [];
    }
  }

  async add(input: MemoryAddInput): Promise<void> {
    if (!this.isConfigured()) {
      return;
    }

    try {
      await this.request('/api/memory/add', {
        method: 'POST',
        body: {
          content: input.content,
          user_id: input.userId,
          group_id: input.groupId,
          metadata: input.metadata ?? {},
        },
      });
    } catch (error) {
      console.error('OpenMemory add error:', error);
    }
  }

  /**
   * 获取特定内存条目
   * 对应 OpenMemory API: GET /api/memory/:id
   */
  async get(memoryId: string): Promise<MemoryResult | null> {
    if (!this.isConfigured()) {
      return null;
    }

    try {
      const response = await this.request<unknown>(`/api/memory/${memoryId}`, {
        method: 'GET',
      });

      const results = normalizeMemoryResults(response);
      return results[0] ?? null;
    } catch (error) {
      console.error('OpenMemory get error:', error);
      return null;
    }
  }

  /**
   * 删除内存条目
   * 对应 OpenMemory API: DELETE /api/memory/:id
   */
  async delete(memoryId: string): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    try {
      await this.request(`/api/memory/${memoryId}`, {
        method: 'DELETE',
      });
      return true;
    } catch (error) {
      console.error('OpenMemory delete error:', error);
      return false;
    }
  }

  /**
   * 加强内存重要性（Reinforce）
   * 对应 OpenMemory API: POST /api/memory/:id/reinforce
   */
  async reinforce(memoryId: string): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    try {
      await this.request(`/api/memory/${memoryId}/reinforce`, {
        method: 'POST',
        body: {},
      });
      return true;
    } catch (error) {
      console.error('OpenMemory reinforce error:', error);
      return false;
    }
  }

  private async request<T>(
    path: string,
    options: { method: 'POST' | 'GET' | 'DELETE'; body?: Record<string, unknown> },
  ): Promise<T> {
    if (!this.baseUrl) {
      throw new Error('OpenMemory baseUrl is not configured');
    }

    const url = new URL(path, this.baseUrl);

    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };

    // 添加认证令牌（如果提供）
    if (this.apiKey) {
      headers.authorization = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(url, {
      method: options.method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      throw new Error(
        `OpenMemory API error: ${response.status} ${response.statusText}`
      );
    }

    // 某些DELETE操作可能不返回响应体
    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }
}

/**
 * 规范化内存搜索结果
 * 处理多种可能的响应格式
 */
function normalizeMemoryResults(value: unknown): MemoryResult[] {
  if (!value) {
    return [];
  }

  // 格式 1: 直接数组
  if (Array.isArray(value)) {
    return value.map(normalizeMemoryResult);
  }

  // 格式 2: { results: [...] }
  if (isRecord(value) && Array.isArray(value.results)) {
    return value.results.map(normalizeMemoryResult);
  }

  // 格式 3: { memories: [...] }
  if (isRecord(value) && Array.isArray(value.memories)) {
    return value.memories.map(normalizeMemoryResult);
  }

  // 格式 4: { data: [...] }
  if (isRecord(value) && Array.isArray(value.data)) {
    return value.data.map(normalizeMemoryResult);
  }

  return [];
}

/**
 * 规范化单条内存记录
 * 处理不同的字段名约定
 */
function normalizeMemoryResult(value: unknown): MemoryResult {
  if (!isRecord(value)) {
    return { content: String(value) };
  }

  return {
    id: stringifyOptional(value.id),
    // 支持多种内容字段名
    content: String(
      value.content ??
      value.memory ??
      value.text ??
      value.message ??
      ''
    ),
    // 分数/相关度
    score: typeof value.score === 'number' ? value.score : undefined,
    // 元数据
    metadata: isRecord(value.metadata) ? value.metadata : undefined,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringifyOptional(value: unknown): string | undefined {
  return value === undefined || value === null ? undefined : String(value);
}
