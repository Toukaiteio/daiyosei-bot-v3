import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildOutgoingMessageSegments, textSegment } from '../src/adapters/onebot/messageBuilder.js';
import { createMemeLibrary } from '../src/memes/library.js';

describe('OneBot outgoing message builder', () => {
  it('keeps plain text as a text segment', () => {
    expect(buildOutgoingMessageSegments('hello')).toEqual([textSegment('hello')]);
  });

  it('parses emoji shortcuts into unicode emoji text', () => {
    expect(buildOutgoingMessageSegments('hi [[emoji:smile]]')).toEqual([
      textSegment('hi '),
      textSegment('😄'),
    ]);
  });

  it('parses face directives into OneBot face segments', () => {
    expect(buildOutgoingMessageSegments('[[face:14]]')).toEqual([
      { type: 'face', data: { id: 14 } },
    ]);
  });

  it('parses meme directives into OneBot image segments when the meme library is available', () => {
    const root = mkdtempSync(join(tmpdir(), 'daiyosei-memes-'));
    try {
      mkdirSync(join(root, 'happy'), { recursive: true });
      const memePath = join(root, 'happy', 'smile.gif');
      writeFileSync(memePath, 'gif');
      const library = createMemeLibrary(root);

      expect(buildOutgoingMessageSegments('yay [[meme:happy]]', { memeLibrary: library })).toEqual([
        textSegment('yay '),
        { type: 'image', data: { file: memePath, type: 'image/gif' } },
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('keeps meme directives as text when the category is not allowed', () => {
    const root = mkdtempSync(join(tmpdir(), 'daiyosei-memes-'));
    try {
      mkdirSync(join(root, 'happy'), { recursive: true });
      const memePath = join(root, 'happy', 'smile.gif');
      writeFileSync(memePath, 'gif');
      const library = createMemeLibrary(root);

      expect(
        buildOutgoingMessageSegments('[[meme:happy]]', {
          memeLibrary: library,
          allowedCategories: ['sad'],
        }),
      ).toEqual([textSegment('[[meme:happy]]')]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('parses image and reply directives into OneBot segments', () => {
    expect(buildOutgoingMessageSegments('[[reply]] [[image:https://example.test/meme.gif]]', {
      replyMessageId: '12345',
    })).toEqual([
      { type: 'reply', data: { id: '12345' } },
      textSegment(' '),
      { type: 'image', data: { file: 'https://example.test/meme.gif', url: 'https://example.test/meme.gif' } },
    ]);
  });
});
