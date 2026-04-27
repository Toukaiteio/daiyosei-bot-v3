import { mkdirSync, rmSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createMemeLibrary } from '../src/memes/library.js';

describe('MemeLibrary', () => {
  it('scans meme assets recursively and groups them by category', () => {
    const root = mkdtempSync(join(tmpdir(), 'daiyosei-meme-library-'));
    try {
      mkdirSync(join(root, 'happy'), { recursive: true });
      mkdirSync(join(root, 'sad', 'deep'), { recursive: true });
      writeFileSync(join(root, 'happy', 'smile.gif'), 'gif');
      writeFileSync(join(root, 'sad', 'deep', 'cry.png'), 'png');

      const library = createMemeLibrary(root);

      expect(library.listCategories()).toEqual(['happy', 'sad']);
      expect(library.list()).toHaveLength(2);
      expect(
        library.list({
          disabledMemes: ['happy/smile.gif'],
        }),
      ).toEqual([
        expect.objectContaining({
          category: 'sad',
          relativePath: 'sad/deep/cry.png',
        }),
      ]);
      expect(library.findById('happy/smile.gif')).toMatchObject({
        category: 'happy',
        animated: true,
        mimeType: 'image/gif',
      });
      expect(library.pickRandom({ category: 'sad' })).toMatchObject({
        category: 'sad',
        relativePath: 'sad/deep/cry.png',
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
