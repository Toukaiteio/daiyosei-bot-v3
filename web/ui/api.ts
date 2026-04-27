import type {
  ConfigPatch,
  HealthResponse,
  LogEntry,
  MemeLibraryResponse,
  Plugin,
  Provider,
  RecentImage,
  RuntimeStatus,
  Skill,
} from './types';

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

export function fetchHealth() {
  return fetchJson<HealthResponse>('/health');
}

export function fetchStatus() {
  return fetchJson<RuntimeStatus>('/api/status');
}

export function fetchSkills() {
  return fetchJson<{ skills: Skill[] }>('/api/skills');
}

export function fetchPlugins() {
  return fetchJson<{ plugins: Plugin[]; tools: string[] }>('/api/plugins');
}

export function fetchLogs() {
  return fetchJson<{ logs: LogEntry[] }>('/api/logs');
}

export function fetchMemes() {
  return fetchJson<MemeLibraryResponse>('/api/memes');
}

export function fetchRecentImages(params: {
  userId?: string;
  groupId?: string;
  since?: string;
  limit?: number;
}) {
  const query = new URLSearchParams();
  if (params.userId) query.set('userId', params.userId);
  if (params.groupId) query.set('groupId', params.groupId);
  if (params.since) query.set('since', params.since);
  if (typeof params.limit === 'number') query.set('limit', String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return fetchJson<{ images: RecentImage[] }>(`/api/images/recent${suffix}`);
}

export async function fetchProviderModelIds(provider: Provider): Promise<string[]> {
  const response = await fetchJson<unknown>('/api/proxy/models', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
    }),
  });

  const errorMessage = extractModelFetchError(response);
  if (errorMessage) {
    throw new Error(errorMessage);
  }

  return extractModelIds(response);
}

export function updateConfig(patch: ConfigPatch) {
  return fetch('/api/config', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(patch),
  }).then(async (response) => {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.json() as Promise<{ ok: boolean }>;
  });
}

function extractModelFetchError(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  if ('error' in payload && typeof (payload as { error?: unknown }).error === 'string') {
    return (payload as { error: string }).error;
  }

  return undefined;
}

function extractModelIds(payload: unknown): string[] {
  if (Array.isArray(payload)) {
    return payload
      .map((entry) => {
        if (typeof entry === 'string') {
          return entry;
        }
        if (entry && typeof entry === 'object' && 'id' in entry) {
          return String((entry as { id?: unknown }).id ?? '');
        }
        return '';
      })
      .filter(Boolean);
  }

  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const maybeData = (payload as { data?: unknown }).data;
  if (Array.isArray(maybeData)) {
    return extractModelIds(maybeData);
  }

  const maybeModels = (payload as { models?: unknown }).models;
  if (Array.isArray(maybeModels)) {
    return extractModelIds(maybeModels);
  }

  return [];
}
