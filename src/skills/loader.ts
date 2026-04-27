import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Logger } from 'pino';
import { skillManifestSchema } from './manifest.js';
import { createManifestSkill } from './manifestSkill.js';
import type { AgentSkill } from './types.js';

export class SkillLoader {
  constructor(private readonly options: { directory: string; logger: Logger }) {}

  async load(): Promise<AgentSkill[]> {
    const root = resolve(this.options.directory);
    const entries = await safeReadDir(root);
    const skills: AgentSkill[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const manifestPath = join(root, entry.name, 'skill.json');
      const manifest = skillManifestSchema.parse(JSON.parse(await readFile(manifestPath, 'utf8')));
      if (manifest.enabled) {
        skills.push(createManifestSkill(manifest));
      }
    }

    this.options.logger.info({ count: skills.length, directory: root }, 'loaded skills');
    return skills;
  }
}

async function safeReadDir(path: string) {
  try {
    return await readdir(path, { withFileTypes: true });
  } catch {
    return [];
  }
}
