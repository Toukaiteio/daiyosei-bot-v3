import { Plus, Save, ShieldAlert, ShieldCheck, Trash2, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { EmptyState } from '../components/EmptyState';
import { SectionHeader } from '../components/SectionHeader';
import { Tag } from '../components/Tag';
import type { ConfigPatch, RuntimeStatus } from '../types';

type CommandsPageProps = {
  status?: RuntimeStatus;
  isSaving: boolean;
  onSave: (patch: ConfigPatch) => Promise<void>;
};

export function CommandsPage({ status, isSaving, onSave }: CommandsPageProps) {
  const [masters, setMasters] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<Record<string, string>>({});
  const [newMaster, setNewMaster] = useState('');
  const initialized = useRef(false);

  useEffect(() => {
    if (!status || initialized.current) return;
    setMasters(status.commands.masters);
    setPermissions({ ...status.commands.commandPermissions });
    initialized.current = true;
  }, [status]);

  if (!status) {
    return <EmptyState title="Loading command config" description="Waiting for runtime status." />;
  }

  const save = async () => {
    await onSave({ commands: { masters, commandPermissions: permissions } });
  };

  const addMaster = () => {
    const id = newMaster.trim();
    if (!id || masters.includes(id)) return;
    setMasters([...masters, id]);
    setNewMaster('');
  };

  const removeMaster = (id: string) => {
    setMasters(masters.filter((m) => m !== id));
  };

  const setPermission = (trigger: string, value: string) => {
    setPermissions((prev) => ({ ...prev, [trigger]: value }));
  };

  const resetPermission = (trigger: string) => {
    setPermissions((prev) => {
      const next = { ...prev };
      delete next[trigger];
      return next;
    });
  };

  return (
    <div className="commands-page-v3">
      <SectionHeader
        title="Commands & Permissions"
        description="Configure master users and per-command permission levels. Commands start with $$."
        action={
          <button className="btn-v3-primary" onClick={() => void save()} disabled={isSaving} type="button">
            <Save size={18} />
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        }
      />

      <div className="dashboard-grid-v3">
        {/* Master list */}
        <div className="card-v3">
          <div className="card-header-v3">
            <Users size={20} />
            <h3>Master Users</h3>
          </div>
          <p className="card-desc">
            Masters can run any <code>master_only</code> command. Non-masters are silently blocked at the gateway.
          </p>
          <div className="field-row" style={{ marginTop: 16 }}>
            <input
              value={newMaster}
              onChange={(e) => setNewMaster(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addMaster(); }}
              placeholder="QQ number / user ID"
              style={{ flex: 1 }}
            />
            <button className="btn-v3-primary" onClick={addMaster} type="button">
              <Plus size={16} />
              Add
            </button>
          </div>
          <div className="master-list-v3">
            {masters.length === 0 ? (
              <p className="field-help" style={{ marginTop: 12 }}>No masters configured. All $$ commands are blocked.</p>
            ) : (
              masters.map((id) => (
                <div key={id} className="master-row-v3">
                  <code>{id}</code>
                  <button className="icon-btn-v3 danger" onClick={() => removeMaster(id)} type="button" aria-label="Remove master">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Command permission table */}
        <div className="card-v3">
          <div className="card-header-v3">
            <ShieldAlert size={20} />
            <h3>Command Permissions</h3>
          </div>
          <p className="card-desc">
            Override the default permission for each registered command. Unset = use the plugin's default.
          </p>
          <div className="cmd-table-v3">
            {status.commands.registered.length === 0 ? (
              <EmptyState title="No commands registered" description="Built-in plugins will appear here once loaded." />
            ) : (
              status.commands.registered.map((cmd) => {
                const override = permissions[cmd.trigger];
                const effective = override ?? cmd.defaultPermission;
                return (
                  <div key={cmd.trigger} className="cmd-row-v3">
                    <div className="cmd-info">
                      <code className="cmd-trigger">$${cmd.trigger}</code>
                      <span className="cmd-desc">{cmd.description}</span>
                      <Tag tone="neutral">default: {cmd.defaultPermission}</Tag>
                    </div>
                    <div className="cmd-controls">
                      <select
                        value={override ?? ''}
                        onChange={(e) => {
                          if (e.target.value === '') {
                            resetPermission(cmd.trigger);
                          } else {
                            setPermission(cmd.trigger, e.target.value);
                          }
                        }}
                        className={`cmd-select ${effective === 'everyone' ? 'perm-everyone' : 'perm-master'}`}
                      >
                        <option value="">use default ({cmd.defaultPermission})</option>
                        <option value="master_only">master_only</option>
                        <option value="everyone">everyone</option>
                      </select>
                      <div className="cmd-badge">
                        {effective === 'master_only' ? (
                          <Tag tone="warning">master only</Tag>
                        ) : (
                          <Tag tone="success"><ShieldCheck size={11} style={{ display: 'inline', marginRight: 3 }} />everyone</Tag>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
