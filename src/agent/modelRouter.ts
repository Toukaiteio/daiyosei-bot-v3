import type { AppConfig, ModelProfile, ModelRole } from '../config/schema.js';

export class ModelRouter {
  private readonly profiles: Map<ModelRole, ModelProfile>;

  constructor(config: AppConfig) {
    this.profiles = new Map(config.models.map((profile) => [profile.role, profile]));
  }

  get(role: ModelRole = 'main'): ModelProfile {
    return this.profiles.get(role) ?? this.profiles.get('main') ?? failNoMainModel();
  }

  getForVision(): ModelProfile | undefined {
    const vision = this.profiles.get('vision');
    if (vision) {
      return vision;
    }

    const main = this.get('main');
    return main.supportsVision ? main : undefined;
  }

  getForReasoning(): ModelProfile {
    return this.profiles.get('reasoning') ?? this.get('main');
  }
}

function failNoMainModel(): never {
  throw new Error('No main model configured');
}
