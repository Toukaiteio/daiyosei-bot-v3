import type { ReactNode } from 'react';
import { Brain } from 'lucide-react';
import { APP_VERSION, NAV_ITEMS } from '../constants';
import type { TabId } from '../types';

type AppShellProps = {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  children: ReactNode;
};

export function AppShell({ activeTab, onTabChange, children }: AppShellProps) {
  const currentTab = NAV_ITEMS.find((item) => item.id === activeTab) ?? NAV_ITEMS[0];

  return (
    <main className="app-v3">
      <aside className="nav-v3">
        <button className="nav-logo" onClick={() => onTabChange('dashboard')} type="button">
          <Brain size={32} />
          <span>DAIYOSEI</span>
        </button>
        <div className="nav-links">
          {NAV_ITEMS.map((item) => (
            <NavBtn
              key={item.id}
              id={item.id}
              icon={<item.icon size={20} />}
              label={item.label}
              active={activeTab === item.id}
              onClick={onTabChange}
            />
          ))}
        </div>
      </aside>

      <div className="main-v3">
        <header className="main-header-v3">
          <div>
            <div className="breadcrumb">{currentTab.label}</div>
            <p className="header-subtitle">{currentTab.description}</p>
          </div>
          <div className="version-tag">{APP_VERSION}</div>
        </header>
        <div className="main-content-v3">{children}</div>
      </div>
    </main>
  );
}

function NavBtn({
  id,
  icon,
  label,
  active,
  onClick,
}: {
  id: TabId;
  icon: ReactNode;
  label: string;
  active: boolean;
  onClick: (tab: TabId) => void;
}) {
  return (
    <button
      className={`nav-link-v3 ${active ? 'active' : ''}`}
      onClick={() => onClick(id)}
      type="button"
      aria-label={label}
      title={label}
    >
      {icon}
    </button>
  );
}

