import type { ReactNode } from 'react';

type StatCardProps = {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  status?: 'success' | 'warning' | 'danger';
};

export function StatCard({ icon, label, value, status }: StatCardProps) {
  return (
    <div className={`stat-box-v3 ${status ?? ''}`}>
      <div className="s-icon">{icon}</div>
      <div className="s-data">
        <span className="s-label">{label}</span>
        <span className="s-value">{value}</span>
      </div>
    </div>
  );
}

