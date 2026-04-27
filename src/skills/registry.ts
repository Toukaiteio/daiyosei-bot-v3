import type { Tool } from '@openai/agents';
import type { AgentSkill } from './types.js';

export class SkillRegistry {
  private readonly skills = new Map<string, AgentSkill>();

  register(skill: AgentSkill) {
    if (this.skills.has(skill.id)) {
      throw new Error(`Skill already registered: ${skill.id}`);
    }

    this.skills.set(skill.id, skill);
  }

  list() {
    return [...this.skills.values()];
  }

  toTools(): Tool[] {
    return this.list().flatMap((skill) => skill.tools());
  }
}
