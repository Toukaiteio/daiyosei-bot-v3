import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createLogger } from '../src/logger.js';
import { SkillLoader } from '../src/skills/loader.js';

describe('SkillLoader', () => {
  it('loads manifest skills and exposes tools', async () => {
    const root = await mkdtemp(join(tmpdir(), 'daiyosei-skill-'));
    try {
      await mkdir(join(root, 'demo'));
      await writeFile(
        join(root, 'demo', 'skill.json'),
        JSON.stringify({
          id: 'demo.solve',
          name: 'Demo Solve',
          instruction: 'Break the task into clear steps.',
        }),
      );

      const skills = await new SkillLoader({ directory: root, logger: createLogger() }).load();
      expect(skills).toHaveLength(1);
      expect(skills[0]?.tools()).toHaveLength(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
