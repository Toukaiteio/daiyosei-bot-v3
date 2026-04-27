import { describe, expect, it } from 'vitest';
import { SkillRegistry } from '../src/skills/registry.js';
import { createHealthSkill } from '../src/skills/builtin/healthSkill.js';

describe('SkillRegistry', () => {
  it('registers skills and exposes their tools', () => {
    const registry = new SkillRegistry();
    registry.register(createHealthSkill());

    expect(registry.list()).toHaveLength(1);
    expect(registry.toTools()).toHaveLength(1);
  });
});
