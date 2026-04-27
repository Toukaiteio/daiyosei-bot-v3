import type { AppConfig, ModelProfile, ModelRole } from './schema.js';

type ModelDerivationInput = Pick<AppConfig, 'providers' | 'modelLibrary' | 'roleAssignments' | 'models'>;

export function deriveModelsFromLibrary(input: ModelDerivationInput): AppConfig['models'] {
  const { providers, modelLibrary, roleAssignments, models: fallbackModels } = input;

  const derivedModels: ModelProfile[] = [];

  if (Object.keys(roleAssignments).length > 0 && modelLibrary.length > 0 && providers.length > 0) {
    for (const [role, modelId] of Object.entries(roleAssignments)) {
      const modelDef = modelLibrary.find((model) => model.id === modelId);
      if (!modelDef) {
        continue;
      }

      const provider = providers.find((item) => item.id === modelDef.providerId);
      if (!provider) {
        continue;
      }

      derivedModels.push({
        role: role as ModelRole,
        name: modelDef.name,
        model: modelDef.model,
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        supportsVision: Boolean(modelDef.supportsVision),
        supportsReasoning: Boolean(modelDef.supportsReasoning),
        reasoningEffort: modelDef.reasoningEffort ?? 'medium',
        useResponsesApi: false,
      });
    }
  }

  if (derivedModels.length === 0) {
    return fallbackModels;
  }

  if (!derivedModels.some((model) => model.role === 'main')) {
    const fallbackMain = fallbackModels.find((model) => model.role === 'main');
    if (fallbackMain) {
      derivedModels.push(fallbackMain);
    }
  }

  return derivedModels;
}
