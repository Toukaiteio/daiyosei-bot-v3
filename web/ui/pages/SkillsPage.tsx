import { Save, Wrench } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DEFAULT_SKILL_MANIFEST } from '../constants';
import { SectionHeader } from '../components/SectionHeader';
import { Tag } from '../components/Tag';
import type { Skill } from '../types';
import { downloadTextFile } from '../utils/download';

type SkillsPageProps = {
  skills?: { skills: Skill[] };
};

type SkillManifestDraft = {
  id: string;
  name: string;
  description: string;
  version: string;
  permissions: string;
  instruction: string;
  enabled: boolean;
};

export function SkillsPage({ skills }: SkillsPageProps) {
  const [draft, setDraft] = useState<SkillManifestDraft>(DEFAULT_SKILL_MANIFEST);

  const preview = useMemo(
    () =>
      JSON.stringify(
        {
          id: draft.id,
          name: draft.name,
          description: draft.description,
          version: draft.version,
          permissions: draft.permissions
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean),
          instruction: draft.instruction,
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
        title="Agent Skills"
        description="Installed skill manifests and a helper to compose new skill.json files."
      />

      <div className="dashboard-grid-v3">
        <div className="card-v3">
          <div className="card-header-v3">
            <Wrench size={18} />
            <h3>Skill Manifest Helper</h3>
          </div>
          <div className="form-v3">
            <div className="field-v3">
              <label>Skill ID</label>
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
                <label>Permissions</label>
                <input
                  value={draft.permissions}
                  onChange={(event) => setDraft({ ...draft, permissions: event.target.value })}
                  placeholder="comma,separated,permissions"
                />
              </div>
            </div>
            <div className="field-v3">
              <label>Instruction</label>
              <textarea
                rows={5}
                value={draft.instruction}
                onChange={(event) => setDraft({ ...draft, instruction: event.target.value })}
              />
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
                onClick={() => downloadTextFile('skill.json', preview)}
                type="button"
              >
                <Save size={18} />
                Download skill.json
              </button>
            </div>
          </div>
          <p className="field-help">
            Place the file under `skills/&lt;skill-id&gt;/skill.json`, then restart the server to load it.
          </p>
        </div>

        <div className="card-v3">
          <div className="card-header-v3">
            <Wrench size={18} />
            <h3>Loaded Skills</h3>
          </div>
          <div className="grid-v3">
            {(skills?.skills ?? []).map((skill) => (
              <div key={skill.id} className="card-v3">
                <div className="card-header-v3">
                  <Wrench size={18} />
                  <h3>
                    {skill.name} <span className="v-tag">v{skill.version}</span>
                  </h3>
                </div>
                <p className="card-desc">{skill.description}</p>
                <div className="p-tags">
                  {skill.permissions.map((permission) => (
                    <Tag key={permission} tone="accent">
                      {permission}
                    </Tag>
                  ))}
                </div>
              </div>
            ))}
            {(skills?.skills ?? []).length === 0 ? <div className="empty-grid-v3">No skills loaded.</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
