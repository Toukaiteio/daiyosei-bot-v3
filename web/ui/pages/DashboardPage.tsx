import { Activity, Cpu, Database, HardDrive, Sparkles, Terminal, Wrench, Zap } from 'lucide-react';
import type { HealthResponse, Plugin, RuntimeStatus, Skill, TabId } from '../types';
import { EmptyState } from '../components/EmptyState';
import { SectionHeader } from '../components/SectionHeader';
import { StatCard } from '../components/StatCard';
import { Tag } from '../components/Tag';

type DashboardPageProps = {
  health?: HealthResponse;
  status?: RuntimeStatus;
  plugins?: { plugins: Plugin[]; tools: string[] };
  skills?: { skills: Skill[] };
  onNavigate: (tab: TabId) => void;
};

export function DashboardPage({ health, status, plugins, skills, onNavigate }: DashboardPageProps) {
  return (
    <div className="dashboard-v3">
      <div className="stats-row">
        <StatCard
          icon={<Activity size={18} />}
          label="Connectivity"
          value={health?.ok ? 'Connected' : 'Offline'}
          status={health?.ok ? 'success' : 'danger'}
        />
        <StatCard icon={<HardDrive size={18} />} label="Messages" value={status?.storage.messages ?? 0} />
        <StatCard icon={<Sparkles size={18} />} label="Image Cache" value={status?.storage.images ?? 0} />
        <StatCard icon={<Terminal size={18} />} label="Log Level" value={status?.logging.level ?? 'info'} status="warning" />
      </div>

      <section className="dashboard-hero-v3">
        <div className="hero-body">
          <div className="hero-header">
            <div>
              <div className="eyebrow">Runtime overview</div>
              <h2>{status?.bot.name ?? 'Daiyosei'}</h2>
            </div>
            <div className="hero-actions">
              <button className="btn-v3-outline" onClick={() => onNavigate('settings')} type="button">
                Settings
              </button>
              <button className="btn-v3-primary" onClick={() => onNavigate('providers')} type="button">
                Manage Models
              </button>
            </div>
          </div>

          <p className="hero-description">{status?.bot.persona ?? 'Waiting for runtime status...'}</p>

          <div className="summary-grid-v3">
            <SummaryItem label="HTTP" value={status ? `${status.http.host}:${status.http.port}` : 'Loading'} />
            <SummaryItem label="OneBot" value={status?.oneBot.enabled ? `${status.oneBot.host}:${status.oneBot.port}` : 'Disabled'} />
            <SummaryItem label="OpenMemory" value={status?.openMemory.mode === 'remote' ? status.openMemory.baseUrl ?? 'Connected' : 'Local'} />
            <SummaryItem label="Web UI" value={status?.webUi.serving ? 'Serving' : 'Build required'} />
          </div>
        </div>
      </section>

      <SectionHeader
        title="Control Surface"
        description="Quick access to the current runtime building blocks."
      />

      <div className="dashboard-grid-v3">
        <div className="card-v3">
          <div className="card-header-v3">
            <Zap size={20} />
            <h3>Registered Tools</h3>
          </div>
          <div className="tool-list-v3">
            {(plugins?.tools ?? []).map((tool) => (
              <span key={tool} className="tool-badge-v3">
                {tool}
              </span>
            ))}
            {(plugins?.tools ?? []).length === 0 ? (
              <EmptyState
                title="No tools registered"
                description="Plugin tools will appear here after plugin loading completes."
              />
            ) : null}
          </div>
        </div>

        <div className="card-v3">
          <div className="card-header-v3">
            <Wrench size={20} />
            <h3>Installed Skills</h3>
          </div>
          <div className="tool-list-v3">
            {(skills?.skills ?? []).slice(0, 6).map((skill) => (
              <Tag key={skill.id} tone="accent">
                {skill.name}
              </Tag>
            ))}
            {(skills?.skills ?? []).length === 0 ? (
              <EmptyState title="No skills loaded" description="Drop skill manifests into the skills directory and restart." />
            ) : null}
          </div>
        </div>

        <div className="card-v3">
          <div className="card-header-v3">
            <Cpu size={20} />
            <h3>Active Roles</h3>
          </div>
          <div className="role-grid-v3">
            {(status?.models ?? []).map((model) => (
              <div key={model.role} className="role-card-v3">
                <span className="role-label-v3">{model.role}</span>
                <span className="role-value-v3">{model.model}</span>
              </div>
            ))}
            {(status?.models ?? []).length === 0 ? (
              <EmptyState
                title="No roles bound"
                description="Create provider and model entries, then assign them to roles."
              />
            ) : null}
          </div>
        </div>

        <div className="card-v3">
          <div className="card-header-v3">
            <Database size={20} />
            <h3>Memory</h3>
          </div>
          <div className="stack-list-v3">
            <SummaryItem label="OpenMemory" value={status?.openMemory.mode === 'remote' ? 'Remote' : 'Local'} />
            <SummaryItem label="Image cache" value={`${status?.storage.images ?? 0} records`} />
            <SummaryItem label="Message archive" value={`${status?.storage.messages ?? 0} records`} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="summary-item-v3">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
