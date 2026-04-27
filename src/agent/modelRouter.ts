import type { AppConfig, ModelProfile, ModelRole } from '../config/schema.js';

export class ModelRouter {
  private readonly config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
  }

  get(role: ModelRole = 'main'): ModelProfile {
    return this.getProfile(role) ?? this.getProfile('main') ?? failNoMainModel();
  }

  getForVision(): ModelProfile | undefined {
    const vision = this.getProfile('vision');
    if (vision) {
      return vision;
    }

    const main = this.get('main');
    return main.supportsVision ? main : undefined;
  }

  getForReasoning(): ModelProfile {
    return this.getProfile('reasoning') ?? this.get('main');
  }

  getForSearch(): ModelProfile | undefined {
    return this.getProfile('search');
  }

  private getProfile(role: ModelRole): ModelProfile | undefined {
    return this.config.models.find((profile) => profile.role === role);
  }
}

function failNoMainModel(): never {
  throw new Error('No main model configured');
}
