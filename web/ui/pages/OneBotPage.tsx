import { Cable, Save, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { EmptyState } from '../components/EmptyState';
import { SectionHeader } from '../components/SectionHeader';
import { Tag } from '../components/Tag';
import type { ConfigPatch, RuntimeStatus } from '../types';

type OneBotPageProps = {
  status?: RuntimeStatus;
  isSaving: boolean;
  onSave: (patch: ConfigPatch) => Promise<void>;
};

type OneBotDraft = {
  enabled: boolean;
  host: string;
  port: number;
  path: string;
  accessToken: string;
  restrictSourceHosts: boolean;
  allowedSourceHosts: string;
  blockPublicRequests: boolean;
  wakeKeywords: string;
};

export function OneBotPage({ status, isSaving, onSave }: OneBotPageProps) {
  const [draft, setDraft] = useState<OneBotDraft>({
    enabled: true,
    host: '127.0.0.1',
    port: 6199,
    path: '/onebot/v11',
    accessToken: '',
    restrictSourceHosts: false,
    allowedSourceHosts: '',
    blockPublicRequests: true,
    wakeKeywords: '琪露诺, Cirno, 天才',
  });
  const initialized = useRef(false);

  useEffect(() => {
    if (!status || initialized.current) {
      return;
    }

    setDraft({
      enabled: status.oneBot.enabled,
      host: status.oneBot.host,
      port: status.oneBot.port,
      path: status.oneBot.path,
      accessToken: '',
      restrictSourceHosts: status.oneBot.restrictSourceHosts,
      allowedSourceHosts: status.oneBot.allowedSourceHosts.join(', '),
      blockPublicRequests: status.oneBot.blockPublicRequests,
      wakeKeywords: status.oneBot.wakeKeywords.join(', '),
    });
    initialized.current = true;
  }, [status]);

  if (!status) {
    return <EmptyState title="Loading OneBot status" description="Waiting for the runtime status endpoint." />;
  }

  const websocketUrl = `ws://${draft.host}:${draft.port}${draft.path}`;

  const save = async () => {
    const allowedSourceHosts = draft.allowedSourceHosts
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    if (draft.restrictSourceHosts && allowedSourceHosts.length === 0) {
      window.alert('Enable source host restriction only after filling at least one allowed host/IP.');
      return;
    }

    const wakeKeywords = draft.wakeKeywords
      .split(',')
      .map((kw) => kw.trim())
      .filter(Boolean);

    await onSave({
      oneBot: {
        enabled: draft.enabled,
        host: draft.host.trim() || '127.0.0.1',
        port: draft.port,
        path: draft.path.trim() || '/onebot/v11',
        accessToken: draft.accessToken.trim() || undefined,
        restrictSourceHosts: draft.restrictSourceHosts,
        allowedSourceHosts,
        blockPublicRequests: draft.blockPublicRequests,
        wakeKeywords: wakeKeywords.length > 0 ? wakeKeywords : ['琪露诺', 'Cirno', '天才'],
      },
    });
  };

  return (
    <div className="onebot-v3">
      <SectionHeader
        title="OneBot Adapter"
        description="Connection details for the OneBot gateway exposed by this runtime."
        action={
          <button className="btn-v3-primary" onClick={() => void save()} disabled={isSaving} type="button">
            <Save size={18} />
            {isSaving ? 'Saving...' : 'Save OneBot'}
          </button>
        }
      />

      <div className="dashboard-grid-v3">
        <div className="card-v3">
          <div className="card-header-v3">
            <ShieldCheck size={20} />
            <h3>Gateway Status</h3>
          </div>
          <div className="info-list-v3">
            <InfoRow label="Enabled" value={status.oneBot.enabled ? 'Active' : 'Disabled'} tone={status.oneBot.enabled ? 'success' : 'danger'} />
            <InfoRow label="Host" value={status.oneBot.host} />
            <InfoRow label="Port" value={status.oneBot.port} />
            <InfoRow label="Path" value={status.oneBot.path} />
            <InfoRow label="Access token" value={status.oneBot.accessTokenConfigured ? 'Configured' : 'Not configured'} />
            <InfoRow label="Restrict source host" value={status.oneBot.restrictSourceHosts ? 'Enabled' : 'Unlimited'} />
            <InfoRow label="Block public requests" value={status.oneBot.blockPublicRequests ? 'Yes' : 'No'} />
            <InfoRow label="Wake keywords" value={status.oneBot.wakeKeywords.join(', ') || '(none)'} />
          </div>
          <div className="tag-row-v3">
            <Tag tone={status.oneBot.enabled ? 'success' : 'danger'}>
              {status.oneBot.enabled ? 'WebSocket registered' : 'Gateway disabled'}
            </Tag>
            <Tag tone={status.oneBot.blockPublicRequests ? 'warning' : 'neutral'}>
              {status.oneBot.blockPublicRequests ? 'Public requests blocked' : 'Public requests allowed'}
            </Tag>
          </div>
        </div>

        <div className="card-v3">
          <div className="card-header-v3">
            <Cable size={20} />
            <h3>Connection URL</h3>
          </div>
          <div className="code-block-v3">{websocketUrl}</div>
          <p className="field-help">
            Point your OneBot client to this endpoint. Private and group messages will be bridged into the agent runtime.
          </p>
          <div className="provider-meta-v3">
            <Tag tone={status.oneBot.enabled ? 'success' : 'warning'}>
              {status.oneBot.enabled ? 'Gateway online' : 'Gateway not active'}
            </Tag>
          </div>
        </div>
      </div>

      <div className="card-v3">
        <div className="card-header-v3">
          <ShieldCheck size={20} />
          <h3>Gateway Configuration</h3>
        </div>
        <div className="form-v3">
          <label className="check-v3">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })}
            />
            Enable OneBot gateway
          </label>

          <div className="field-row">
            <div className="field-v3">
              <label>Host</label>
              <input value={draft.host} onChange={(event) => setDraft({ ...draft, host: event.target.value })} />
            </div>
            <div className="field-v3">
              <label>Port</label>
              <input
                type="number"
                min={1}
                max={65535}
                value={draft.port}
                onChange={(event) => setDraft({ ...draft, port: Number(event.target.value) || 6199 })}
              />
            </div>
          </div>

          <div className="field-v3">
            <label>Path</label>
            <input value={draft.path} onChange={(event) => setDraft({ ...draft, path: event.target.value })} />
          </div>

          <div className="field-v3">
            <label>Access token</label>
            <input
              type="password"
              value={draft.accessToken}
              onChange={(event) => setDraft({ ...draft, accessToken: event.target.value })}
              placeholder="Optional"
            />
            <p className="field-help">
              Leave blank to keep the current token unchanged. Enter a new value to replace it.
            </p>
          </div>

          <label className="check-v3">
            <input
              type="checkbox"
              checked={draft.restrictSourceHosts}
              onChange={(event) => setDraft({ ...draft, restrictSourceHosts: event.target.checked })}
            />
            Restrict source host
          </label>

          {draft.restrictSourceHosts ? (
            <div className="field-v3">
              <label>Allowed source hosts / IPs</label>
              <textarea
                rows={3}
                value={draft.allowedSourceHosts}
                onChange={(event) => setDraft({ ...draft, allowedSourceHosts: event.target.value })}
                placeholder="127.0.0.1, 192.168.1.20"
              />
              <p className="field-help">Comma separated list. If enabled, only these source IPs or hosts may connect.</p>
            </div>
          ) : (
            <p className="field-help">Source host restriction is disabled, so any source may connect unless public blocking applies.</p>
          )}

          <label className="check-v3">
            <input
              type="checkbox"
              checked={draft.blockPublicRequests}
              onChange={(event) => setDraft({ ...draft, blockPublicRequests: event.target.checked })}
            />
            Block public network requests
          </label>

          <div className="field-help">
            Default behavior blocks public requests and only allows local or private network clients.
          </div>

          <div className="field-v3">
            <label>Group chat wake keywords</label>
            <input
              value={draft.wakeKeywords}
              onChange={(event) => setDraft({ ...draft, wakeKeywords: event.target.value })}
              placeholder="琪露诺, Cirno, 天才"
            />
            <p className="field-help">
              Comma separated. In group chats, the bot only responds when @mentioned or when the message contains one of these keywords (case-insensitive for English). Private chat always responds. Leave blank to use defaults.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, tone }: { label: string; value: string | number; tone?: 'success' | 'danger' }) {
  return (
    <div className="info-row">
      <span className="i-label">{label}</span>
      <span className={`i-val ${tone ? `text-${tone}` : ''}`}>{value}</span>
    </div>
  );
}
