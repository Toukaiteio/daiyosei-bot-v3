import { describe, expect, it } from 'vitest';
import { textSegment } from '../src/adapters/onebot/messageBuilder.js';

describe('OneBot message builder', () => {
  it('builds text segments compatible with OneBot v11', () => {
    expect(textSegment('ok')).toEqual({ type: 'text', data: { text: 'ok' } });
  });
});
