import type { ReactNode } from 'react';

type TagTone = 'neutral' | 'success' | 'warning' | 'danger' | 'accent';

type TagProps = {
  children: ReactNode;
  tone?: TagTone;
};

export function Tag({ children, tone = 'neutral' }: TagProps) {
  return <span className={`tag-v3 tag-${tone}`}>{children}</span>;
}

