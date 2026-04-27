import { Box, Plug, Save, Terminal } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_PLUGIN_MANIFEST } from '../constants';
import { SectionHeader } from '../components/SectionHeader';
import { Tag } from '../components/Tag';
import { DEFAULT_CS2_GUESS_PLUGIN_CONFIG } from '../constants';
import type { ConfigPatch, Plugin, RuntimeStatus } from '../types';
import { downloadTextFile } from '../utils/download';

type PluginsPageProps = {
  plugins?: { plugins: Plugin[]; tools: string[] };
  status?: RuntimeStatus;
  isSaving: boolean;
  onSave: (patch: ConfigPatch) => Promise<void>;
};

type PluginManifestDraft = {
  id: string;
  name: string;
  description: string;
  version: string;
  entry: string;
  enabled: boolean;
};

type Cs2GuessPluginConfig = {
  enabled: boolean;
  gameDurationMinutes: number;
  maxGuesses: number;
};

function normalizeCs2Config(value: unknown): Cs2GuessPluginConfig {
  const source = value && typeof value === 'object' ? value as Partial<Cs2GuessPluginConfig> : {};
  return {
    enabled: typeof source.enabled === 'boolean' ? source.enabled : DEFAULT_CS2_GUESS_PLUGIN_CONFIG.enabled,
    gameDurationMinutes:
      typeof source.gameDurationMinutes === 'number'
        ? source.gameDurationMinutes
        : DEFAULT_CS2_GUESS_PLUGIN_CONFIG.gameDurationMinutes,
    maxGuesses:
      typeof source.maxGuesses === 'number' ? source.maxGuesses : DEFAULT_CS2_GUESS_PLUGIN_CONFIG.maxGuesses,
  };
}

export function PluginsPage({ plugins, status, isSaving, onSave }: PluginsPageProps) {
  const [draft, setDraft] = useState<PluginManifestDraft>(DEFAULT_PLUGIN_MANIFEST);
  const [cs2Config, setCs2Config] = useState<Cs2GuessPluginConfig>(DEFAULT_CS2_GUESS_PLUGIN_CONFIG);
  const hasInitializedConfig = useRef(false);

  useEffect(() => {
    if (!status || hasInitializedConfig.current) {
      return;
    }

    setCs2Config(normalizeCs2Config(status.pluginConfigs?.['cs2-player-guess']));
    hasInitializedConfig.current = true;
  }, [status]);

  const preview = useMemo(
    () =>
      JSON.stringify(
        {
          id: draft.id,
          name: draft.name,
          description: draft.description,
          version: draft.version,
          entry: draft.entry || undefined,
          enabled: draft.enabled,
        },
        null,
        2,
      ),
    [draft],
  );

  const copyManifest = async () => {
    try {
      await navigator.clipboard.writeText(preview);
    } catch {
      window.alert('Clipboard access was denied. Use the JSON preview below.');
    }
  };

  const savePluginConfig = async () => {
    await onSave({
      pluginConfigs: {
        ...(status?.pluginConfigs ?? {}),
        'cs2-player-guess': {
          enabled: cs2Config.enabled,
          gameDurationMinutes: Math.max(1, Math.round(cs2Config.gameDurationMinutes)),
          maxGuesses: Math.max(1, Math.round(cs2Config.maxGuesses)),
        },
      },
    });
  };

  return (
    <div className="list-page-v3">
      <SectionHeader
        title="System Plugins"
        description="Loaded plugin packages and a manifest helper for creating new ones."
      />

      <div className="dashboard-grid-v3">
        <div className="card-v3">
          <div className="card-header-v3">
            <Terminal size={18} />
            <h3>Registered Tools</h3>
          </div>
          <div className="tool-list-v3">
            {(plugins?.tools ?? []).map((tool) => (
              <Tag key={tool} tone="accent">
                {tool}
              </Tag>
            ))}
            {(plugins?.tools ?? []).length === 0 ? (
              <p className="empty-v3">No tools registered.</p>
            ) : null}
          </div>
        </div>

        <div className="card-v3">
          <div className="card-header-v3">
            <Box size={18} />
            <h3>CS2 Guess Config</h3>
          </div>
          <div className="form-v3">
            <label className="check-v3">
              <input
                type="checkbox"
                checked={cs2Config.enabled}
                onChange={(event) => setCs2Config({ ...cs2Config, enabled: event.target.checked })}
              />
              Enabled
            </label>
            <div className="field-row">
              <div className="field-v3">
                <label>Game Duration (minutes)</label>
                <input
                  type="number"
                  min={1}
                  value={cs2Config.gameDurationMinutes}
                  onChange={(event) =>
                    setCs2Config({ ...cs2Config, gameDurationMinutes: Number(event.target.value) })
                  }
                />
              </div>
              <div className="field-v3">
                <label>Max Guesses</label>
                <input
                  type="number"
                  min={1}
                  value={cs2Config.maxGuesses}
                  onChange={(event) => setCs2Config({ ...cs2Config, maxGuesses: Number(event.target.value) })}
                />
              </div>
            </div>
            <p className="empty-v3">Answer pool is fixed to players with active_weight >= 100.</p>
            <div className="form-actions-v3">
              <button className="btn-v3-primary" onClick={() => void savePluginConfig()} disabled={isSaving || !status} type="button">
                <Save size={18} />
                {isSaving ? 'Saving...' : 'Save Plugin Config'}
              </button>
            </div>
          </div>
        </div>

        <div className="card-v3">
          <div className="card-header-v3">
            <Box size={18} />
            <h3>Manifest Helper</h3>
          </div>
          <div className="form-v3">
            <div className="field-v3">
              <label>Plugin ID</label>
              <input value={draft.id} onChange={(event) => setDraft({ ...draft, id: event.target.value })} />
            </div>
            <div className="field-v3">
              <label>Name</label>
              <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
            </div>
            <div className="field-v3">
              <label>Description</label>
              <input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
            </div>
            <div className="field-row">
              <div className="field-v3">
                <label>Version</label>
                <input value={draft.version} onChange={(event) => setDraft({ ...draft, version: event.target.value })} />
              </div>
              <div className="field-v3">
                <label>Entry</label>
                <input
                  value={draft.entry}
                  onChange={(event) => setDraft({ ...draft, entry: event.target.value })}
                  placeholder="Optional"
                />
              </div>
            </div>
            <label className="check-v3">
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })}
              />
              Enabled
            </label>
            <textarea className="manifest-preview-v3" readOnly value={preview} rows={10} />
            <div className="form-actions-v3">
              <button className="btn-v3-outline" onClick={() => void copyManifest()} type="button">
                Copy JSON
              </button>
              <button
                className="btn-v3-primary"
                onClick={() => downloadTextFile('plugin.json', preview)}
                type="button"
              >
                <Save size={18} />
                Download plugin.json
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card-v3">
        <div className="card-header-v3">
          <Plug size={18} />
          <h3>Loaded Plugins</h3>
        </div>
        <div className="grid-v3">
          {(plugins?.plugins ?? []).map((plugin) => (
            <div key={plugin.id} className="card-v3">
              <div className="card-header-v3">
                <Plug size={18} />
                <h3>
                  {plugin.name} <span className="v-tag">v{plugin.version}</span>
                </h3>
              </div>
              <p className="card-desc">{plugin.description}</p>
            </div>
          ))}
          {(plugins?.plugins ?? []).length === 0 ? (
            <div className="empty-grid-v3">No plugins loaded.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
