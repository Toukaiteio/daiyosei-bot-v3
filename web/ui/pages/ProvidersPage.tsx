import { ChevronDown, ChevronUp, Edit3, Plus, RefreshCw, Save, Search, Server, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_MODEL, DEFAULT_PROVIDER, MODEL_REASONING_LEVELS } from '../constants';
import { fetchProviderModelIds } from '../api';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { SectionHeader } from '../components/SectionHeader';
import { Tag } from '../components/Tag';
import { Selector } from '../components/Selector';
import type { ConfigPatch, ModelLibraryItem, Provider, RuntimeStatus } from '../types';

type ProvidersPageProps = {
  status?: RuntimeStatus;
  isSaving: boolean;
  onSave: (patch: ConfigPatch) => Promise<void>;
};

type ProviderDraft = Provider;
type ModelDraft = ModelLibraryItem;

export function ProvidersPage({ status, isSaving, onSave }: ProvidersPageProps) {
  const providers = status?.providers ?? [];
  const modelLibrary = status?.modelLibrary ?? [];
  const roleAssignments = status?.roleAssignments ?? {};

  const [providerModal, setProviderModal] = useState<'add' | 'edit' | null>(null);
  const [providerDraft, setProviderDraft] = useState<ProviderDraft>(DEFAULT_PROVIDER);
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);

  const [modelModal, setModelModal] = useState<'add' | 'edit' | null>(null);
  const [modelDraft, setModelDraft] = useState<ModelDraft>(DEFAULT_MODEL);
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);

  type DiscoverState = { providerId: string; models: string[]; isLoading: boolean };
  const [discoverState, setDiscoverState] = useState<DiscoverState | null>(null);

  useEffect(() => {
    if (!providerModal) {
      setEditingProviderId(null);
    }
  }, [providerModal]);

  useEffect(() => {
    if (!modelModal) {
      setEditingModelId(null);
    }
  }, [modelModal]);

  const selectedProvider = useMemo(
    () => providers.find((provider) => provider.id === modelDraft.providerId),
    [modelDraft.providerId, providers],
  );

  const openAddProvider = () => {
    setProviderDraft({
      id: crypto.randomUUID(),
      name: '',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
    });
    setProviderModal('add');
  };

  const openEditProvider = (provider: Provider) => {
    setProviderDraft(provider);
    setEditingProviderId(provider.id);
    setProviderModal('edit');
  };

  const saveProvider = async () => {
    const nextProviders = editingProviderId
      ? providers.map((provider) => (provider.id === editingProviderId ? providerDraft : provider))
      : [...providers, providerDraft];
    await onSave({ providers: nextProviders });
    setProviderModal(null);
  };

  const deleteProvider = async (id: string) => {
    if (!window.confirm('Delete this provider and all its models?')) {
      return;
    }

    const nextProviders = providers.filter((provider) => provider.id !== id);
    const removedModelIds = new Set(
      modelLibrary.filter((model) => model.providerId === id).map((model) => model.id),
    );
    const nextModelLibrary = modelLibrary.filter((model) => model.providerId !== id);
    const nextRoleAssignments = Object.fromEntries(
      Object.entries(roleAssignments).filter(([, modelId]) => !removedModelIds.has(modelId)),
    );

    await onSave({
      providers: nextProviders,
      modelLibrary: nextModelLibrary,
      roleAssignments: nextRoleAssignments,
    });
  };

  const openAddModel = (providerId?: string) => {
    setFetchedModels([]);
    setModelDraft({
      ...DEFAULT_MODEL,
      id: crypto.randomUUID(),
      providerId: providerId ?? providers[0]?.id ?? '',
    });
    setModelModal('add');
  };

  const openEditModel = (model: ModelLibraryItem) => {
    setFetchedModels([]);
    setModelDraft(model);
    setEditingModelId(model.id);
    setModelModal('edit');
  };

  const saveModel = async () => {
    const nextModelLibrary = editingModelId
      ? modelLibrary.map((model) => (model.id === editingModelId ? modelDraft : model))
      : [...modelLibrary, modelDraft];
    await onSave({ modelLibrary: nextModelLibrary });
    setModelModal(null);
  };

  const deleteModel = async (id: string) => {
    if (!window.confirm('Delete this model?')) {
      return;
    }

    const nextModelLibrary = modelLibrary.filter((model) => model.id !== id);
    const nextRoleAssignments = Object.fromEntries(
      Object.entries(roleAssignments).filter(([, modelId]) => modelId !== id),
    );

    await onSave({ modelLibrary: nextModelLibrary, roleAssignments: nextRoleAssignments });
  };

  const fetchModels = async () => {
    if (!selectedProvider) {
      return;
    }

    setIsFetchingModels(true);
    try {
      setFetchedModels(await fetchProviderModelIds(selectedProvider));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Model discovery failed');
    } finally {
      setIsFetchingModels(false);
    }
  };

  const toggleDiscover = async (provider: Provider) => {
    if (discoverState?.providerId === provider.id) {
      setDiscoverState(null);
      return;
    }
    setDiscoverState({ providerId: provider.id, models: [], isLoading: true });
    try {
      const ids = await fetchProviderModelIds(provider);
      setDiscoverState({ providerId: provider.id, models: ids, isLoading: false });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Model discovery failed');
      setDiscoverState(null);
    }
  };

  const quickAddModel = (providerId: string, modelId: string) => {
    setFetchedModels([]);
    setModelDraft({
      ...DEFAULT_MODEL,
      id: crypto.randomUUID(),
      providerId,
      model: modelId,
      name: modelId,
    });
    setModelModal('add');
  };

  const assignRole = async (role: string, modelId: string) => {
    await onSave({
      roleAssignments: {
        ...roleAssignments,
        [role]: modelId,
      },
    });
  };

  return (
    <div className="providers-v3">
      <SectionHeader
        title="AI Providers"
        description="Manage OpenAI-compatible providers, library entries, and role bindings."
        action={
          <button className="btn-v3-primary" onClick={openAddProvider} type="button">
            <Plus size={18} />
            Add Provider
          </button>
        }
      />

      {providers.length === 0 ? (
        <EmptyState
          title="No providers configured"
          description="Create a provider first, then add models and bind them to roles."
          action={
            <button className="btn-v3-outline" onClick={openAddProvider} type="button">
              <Plus size={16} />
              Add provider
            </button>
          }
        />
      ) : null}

      <div className="provider-list-v3">
        {providers.map((provider) => (
          <div key={provider.id} className="provider-section-v3">
            <div className="provider-info-v3">
              <div className="provider-title">
                <Server size={20} />
                <h3>{provider.name}</h3>
                <div className="provider-actions">
                  <button onClick={() => openEditProvider(provider)} type="button" aria-label="Edit provider">
                    <Edit3 size={14} />
                  </button>
                  <button className="danger" onClick={() => deleteProvider(provider.id)} type="button" aria-label="Delete provider">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <code className="p-url">{provider.baseUrl}</code>
              <div className="provider-meta-v3">
                <Tag tone={provider.apiKey ? 'success' : 'warning'}>
                  {provider.apiKey ? 'API key configured' : 'Missing API key'}
                </Tag>
                <Tag tone="neutral">{modelLibrary.filter((model) => model.providerId === provider.id).length} models</Tag>
              </div>
              <div className="provider-btns-v3">
                <button className="btn-v3-outline" onClick={() => openAddModel(provider.id)} type="button">
                  <Plus size={16} />
                  Add Model
                </button>
                <button
                  className="btn-v3-outline"
                  onClick={() => void toggleDiscover(provider)}
                  type="button"
                  disabled={discoverState?.isLoading && discoverState.providerId === provider.id}
                >
                  {discoverState?.providerId === provider.id ? (
                    discoverState.isLoading ? (
                      <RefreshCw size={14} className="spin" />
                    ) : (
                      <ChevronUp size={14} />
                    )
                  ) : (
                    <Search size={14} />
                  )}
                  {discoverState?.providerId === provider.id && !discoverState.isLoading ? 'Hide' : 'Discover'}
                </button>
              </div>

              {discoverState?.providerId === provider.id && !discoverState.isLoading && (
                <div className="discover-panel-v3">
                  {discoverState.models.length === 0 ? (
                    <span className="discover-empty">No models returned</span>
                  ) : (
                    discoverState.models.map((id) => {
                      const alreadyAdded = modelLibrary.some(
                        (m) => m.providerId === provider.id && m.model === id,
                      );
                      return (
                        <div key={id} className="discover-row-v3">
                          <code>{id}</code>
                          <button
                            className="btn-v3-outline"
                            onClick={() => quickAddModel(provider.id, id)}
                            disabled={alreadyAdded}
                            type="button"
                          >
                            {alreadyAdded ? 'Added' : <><Plus size={12} /> Add</>}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            <div className="provider-models-v3">
              {modelLibrary.filter((model) => model.providerId === provider.id).map((model) => (
                <div key={model.id} className="model-chip-v3">
                  <div className="m-chip-header">
                    <strong>{model.name}</strong>
                    <div className="m-chip-actions">
                      <button onClick={() => openEditModel(model)} type="button" aria-label="Edit model">
                        <Edit3 size={12} />
                      </button>
                      <button className="danger" onClick={() => deleteModel(model.id)} type="button" aria-label="Delete model">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <code>{model.model}</code>
                  <div className="m-chip-flags">
                    {model.supportsVision ? <span className="f-v">Vision</span> : null}
                    {model.supportsReasoning ? (
                      <span className="f-r">Reasoning: {model.reasoningEffort}</span>
                    ) : null}
                  </div>
                </div>
              ))}
              {modelLibrary.filter((model) => model.providerId === provider.id).length === 0 ? (
                <EmptyState
                  title="No models"
                  description="Create the first model entry for this provider."
                />
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div className="assignment-v3">
        <h3>Role Binding</h3>
        <div className="assignment-row-v3">
          {['main', 'search', 'vision', 'reasoning'].map((role) => (
            <div key={role} className="assign-cell">
              <label>{role}</label>
              <Selector
                value={roleAssignments[role] ?? ''}
                onChange={(val) => void assignRole(role, val)}
                options={[
                  { value: '', label: 'None' },
                  ...modelLibrary.map((model) => ({
                    value: model.id,
                    label: model.name,
                  })),
                ]}
              />
            </div>
          ))}
        </div>
      </div>

      {providerModal ? (
        <Modal title={providerModal === 'edit' ? 'Edit Provider' : 'Add Provider'} onClose={() => setProviderModal(null)}>
          <div className="form-v3">
            <div className="field-v3">
              <label>Name</label>
              <input value={providerDraft.name} onChange={(event) => setProviderDraft({ ...providerDraft, name: event.target.value })} />
            </div>
            <div className="field-v3">
              <label>Base URL</label>
              <input value={providerDraft.baseUrl} onChange={(event) => setProviderDraft({ ...providerDraft, baseUrl: event.target.value })} />
            </div>
            <div className="field-v3">
              <label>API Key</label>
              <input
                type="password"
                value={providerDraft.apiKey}
                onChange={(event) => setProviderDraft({ ...providerDraft, apiKey: event.target.value })}
              />
            </div>
            <button className="btn-v3-primary" onClick={() => void saveProvider()} disabled={isSaving} type="button">
              <Save size={18} />
              {isSaving ? 'Saving...' : 'Save Provider'}
            </button>
          </div>
        </Modal>
      ) : null}

      {modelModal ? (
        <Modal title={modelModal === 'edit' ? 'Edit Model' : 'Add Model'} onClose={() => setModelModal(null)}>
          <div className="form-v3">
            <div className="field-v3">
              <label>Provider</label>
              <Selector
                value={modelDraft.providerId}
                onChange={(val) => setModelDraft({ ...modelDraft, providerId: val })}
                placeholder="Select a provider"
                options={providers.map((provider) => ({
                  value: provider.id,
                  label: provider.name,
                }))}
              />
            </div>
            <div className="field-v3">
              <label>Display Name</label>
              <input value={modelDraft.name} onChange={(event) => setModelDraft({ ...modelDraft, name: event.target.value })} />
            </div>
            <div className="field-v3">
              <label>Model ID</label>
              <div className="field-row">
                <input value={modelDraft.model} onChange={(event) => setModelDraft({ ...modelDraft, model: event.target.value })} list="models-list" />
                <button className="fetch-btn" onClick={() => void fetchModels()} disabled={isFetchingModels} type="button">
                  <RefreshCw size={14} className={isFetchingModels ? 'spin' : ''} />
                </button>
              </div>
              <datalist id="models-list">
                {fetchedModels.map((id) => (
                  <option key={id} value={id} />
                ))}
              </datalist>
            </div>
            <div className="field-row-v3">
              <label className="check-v3">
                <input
                  type="checkbox"
                  checked={modelDraft.supportsVision}
                  onChange={(event) => setModelDraft({ ...modelDraft, supportsVision: event.target.checked })}
                />
                Vision
              </label>
              <label className="check-v3">
                <input
                  type="checkbox"
                  checked={modelDraft.supportsReasoning}
                  onChange={(event) => setModelDraft({ ...modelDraft, supportsReasoning: event.target.checked })}
                />
                Reasoning
              </label>
            </div>
            {modelDraft.supportsReasoning ? (
              <div className="field-v3">
                <label>Reasoning Effort</label>
                <Selector
                  value={modelDraft.reasoningEffort}
                  onChange={(val) =>
                    setModelDraft({
                      ...modelDraft,
                      reasoningEffort: val as ModelLibraryItem['reasoningEffort'],
                    })
                  }
                  options={MODEL_REASONING_LEVELS.map((level) => ({
                    value: level,
                    label: level,
                  }))}
                />
              </div>
            ) : null}
            <button className="btn-v3-primary" onClick={() => void saveModel()} disabled={isSaving} type="button">
              <Save size={18} />
              {isSaving ? 'Saving...' : 'Save Model'}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

