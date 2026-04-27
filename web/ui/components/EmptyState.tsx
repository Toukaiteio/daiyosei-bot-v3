import type { ReactNode } from 'react';

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state-v3">
      <strong>{title}</strong>
      <p>{description}</p>
      {action}
    </div>
  );
}

