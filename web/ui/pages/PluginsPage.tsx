import { Box, Plug, Plus, Save, Terminal } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DEFAULT_PLUGIN_MANIFEST } from '../constants';
import { SectionHeader } from '../components/SectionHeader';
import { Tag } from '../components/Tag';
import type { Plugin } from '../types';
import { downloadTextFile } from '../utils/download';

type PluginsPageProps = {
  plugins?: { plugins: Plugin[]; tools: string[] };
};

type PluginManifestDraft = {
  id: string;
  name: string;
  description: string;
  version: string;
  entry: string;
  enabled: boolean;
};

export function PluginsPage({ plugins }: PluginsPageProps) {
  const [draft, setDraft] = useState<PluginManifestDraft>(DEFAULT_PLUGIN_MANIFEST);

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
