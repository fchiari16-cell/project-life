import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

/** Section title with an optional hint and action; the area colour comes from the nearest `data-area`. */
export function LifeSectionHeader({ id, title, hint, action, level = 2, className }: { id: string; title: string; hint?: string; action?: ReactNode; level?: 2 | 3; className?: string }) {
  const Tag = level === 2 ? 'h2' : 'h3';
  return (
    <div className={cn('mb-3 flex items-start justify-between gap-3 border-l-4 border-area pl-3', className)}>
      <div>
        <Tag id={id} className="text-lg font-bold">
          {title}
        </Tag>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {action}
    </div>
  );
}
