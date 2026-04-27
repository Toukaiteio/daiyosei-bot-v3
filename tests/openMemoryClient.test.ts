import { describe, expect, it } from 'vitest';
import { OpenMemoryClient } from '../src/memory/openMemoryClient.js';

describe('OpenMemoryClient', () => {
  it('returns empty results when not configured', async () => {
    const client = new OpenMemoryClient({});

    await expect(client.search({ userId: 'u1', query: 'prefs' })).resolves.toEqual([]);
  });
});
