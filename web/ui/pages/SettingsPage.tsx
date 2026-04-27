import { Save, Settings, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { DEFAULT_BOT_NAME, DEFAULT_BOT_PERSONA } from '../../../src/config/defaultBotIdentity';
import { LOG_LEVELS } from '../constants';
import { SectionHeader } from '../components/SectionHeader';
import { Selector } from '../components/Selector';
import type { ConfigPatch, RuntimeStatus } from '../types';

type SettingsPageProps = {
  status?: RuntimeStatus;
  isSaving: boolean;
  onSave: (patch: ConfigPatch) => Promise<void>;
};

export function SettingsPage({ status, isSaving, onSave }: SettingsPageProps) {
  const [botName, setBotName] = useState(DEFAULT_BOT_NAME);
  const [persona, setPersona] = useState(DEFAULT_BOT_PERSONA);
  const [logLevel, setLogLevel] = useState<(typeof LOG_LEVELS)[number]>('info');
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (!status || hasInitialized.current) {
      return;
    }

    setBotName(status.bot.name);
    setPersona(status.bot.persona);
    setLogLevel((status.logging.level as (typeof LOG_LEVELS)[number]) ?? 'info');
    hasInitialized.current = true;
  }, [status]);

  const saveSettings = async () => {
    if (!status) {
      return;
    }

    await onSave({
      bot: {
        name: botName.trim() || DEFAULT_BOT_NAME,
        persona: persona.trim() || DEFAULT_BOT_PERSONA,
      },
      logging: {
        level: logLevel,
      },
    });
  };

  return (
    <div className="settings-v3">
      <SectionHeader
        title="Settings"
        description="Edit the runtime identity and logging level without touching config files."
        action={
          <button className="btn-v3-primary" onClick={saveSettings} disabled={isSaving || !status} type="button">
            <Save size={18} />
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        }
      />

      <div className="settings-grid-v3">
        <div className="card-v3">
          <div className="card-header-v3">
            <Settings size={20} />
            <h3>Bot Identity</h3>
          </div>
          <div className="form-v3">
            <div className="field-v3">
              <label>Name</label>
              <input value={botName} onChange={(event) => setBotName(event.target.value)} />
            </div>
            <div className="field-v3">
              <label>Persona</label>
              <textarea
                rows={5}
                value={persona}
                onChange={(event) => setPersona(event.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="card-v3">
          <div className="card-header-v3">
            <ShieldCheck size={20} />
            <h3>Logging</h3>
          </div>
          <div className="form-v3">
            <div className="field-v3">
              <label>Level</label>
              <Selector
                value={logLevel}
                onChange={(val) => setLogLevel(val as typeof logLevel)}
                options={LOG_LEVELS.map((level) => ({
                  value: level,
                  label: level,
                }))}
              />
            </div>
            <p className="field-help">
              Logging is persisted to `data/config.json` and applied to the running server immediately after save.
            </p>
          </div>
        </div>

        <div className="card-v3">
          <div className="card-header-v3">
            <Settings size={20} />
            <h3>Runtime Summary</h3>
          </div>
          <div className="info-list-v3">
            <InfoRow label="HTTP" value={status ? `${status.http.host}:${status.http.port}` : 'Loading'} />
            <InfoRow label="Web UI" value={status?.webUi.serving ? 'Serving' : 'Build missing'} />
            <InfoRow label="Web root" value={status?.webUi.rootAvailable ? 'dist-web/index.html available' : 'Build dist-web first'} />
            <InfoRow label="Plugins dir" value={status?.paths.pluginsDir ?? 'Loading'} />
            <InfoRow label="Skills dir" value={status?.paths.skillsDir ?? 'Loading'} />
            <InfoRow label="Storage" value={status?.paths.dbPath ?? 'Loading'} />
            <InfoRow label="OpenMemory" value={status?.openMemory.mode === 'remote' ? status.openMemory.baseUrl ?? 'Remote' : 'Local Mode'} />
            <InfoRow
              label="Memes"
              value={
                status?.memes.enabled
                  ? status.memes.allowedCategories.length > 0
                    ? `Restricted to ${status.memes.allowedCategories.join(', ')}`
                    : 'All categories'
                  : 'Disabled'
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-row">
      <span className="i-label">{label}</span>
      <span className="i-val">{value}</span>
    </div>
  );
}
