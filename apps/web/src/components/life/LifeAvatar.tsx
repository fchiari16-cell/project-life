import { cn } from '../../lib/utils';

/** Stable hue from an id, so the same person always gets the same colour. */
function hue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => [...w][0] ?? '')
    .join('')
    .toUpperCase();

/**
 * Original, generated avatar: initials on a pale disc. The name is always shown next to it, so the avatar is
 * decorative (hidden from assistive technology). Dark text on a light disc keeps contrast in both themes.
 */
export function LifeAvatar({ name, id, size = 'md', className }: { name: string; id: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const dims = size === 'sm' ? 'size-8 text-xs' : size === 'lg' ? 'size-14 text-xl' : 'size-11 text-base';
  return (
    <span
      aria-hidden="true"
      className={cn('inline-flex shrink-0 select-none items-center justify-center rounded-full font-bold text-[#14172b]', dims, className)}
      style={{ background: `hsl(${hue(id)} 70% 84%)` }}
    >
      {initials(name)}
    </span>
  );
}
