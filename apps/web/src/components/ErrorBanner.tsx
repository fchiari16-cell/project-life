import { Component, type ErrorInfo, type ReactNode } from 'react';
import { t } from '../i18n/it';
import { useGame } from '../game/store';
import { Button } from './ui/button';

export function ErrorBanner() {
  const error = useGame((s) => s.error);
  const clear = useGame((s) => s.clearError);
  if (!error) return null;
  return (
    <div role="alert" className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-danger bg-card p-4 text-danger">
      <div>
        <p className="font-semibold">{t.errors.title}</p>
        <p className="mt-1 break-words text-sm">{error}</p>
      </div>
      <Button variant="outline" onClick={clear}>
        {t.errors.dismiss}
      </Button>
    </div>
  );
}

/** Last-resort boundary: render errors never lose saved data (it lives in IndexedDB). */
export class RenderErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Render error', error, info.componentStack);
  }
  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="mx-auto max-w-xl p-6">
        <h1 className="text-xl font-bold">{t.errors.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{this.state.error.message}</p>
        <Button className="mt-4" onClick={() => location.reload()}>
          {t.errors.reload}
        </Button>
      </div>
    );
  }
}
