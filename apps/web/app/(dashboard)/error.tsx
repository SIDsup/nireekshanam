'use client';

import { Icon } from '@/components/ui/icon';

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-[20px] border border-line bg-surface p-8">
      <span className="flex size-11 items-center justify-center rounded-full bg-signal-tint text-signal-text"><Icon name="alert" size={20} /></span>
      <h1 className="text-xl font-semibold">Something went wrong loading this page</h1>
      <p className="text-sm text-muted">{error.digest ? `Reference ${error.digest}. ` : ''}Try again. If it keeps happening, share the reference with your administrator.</p>
      <button type="button" onClick={reset} className="h-11 rounded-xl bg-brand px-5 text-sm font-medium text-white">Try again</button>
    </div>
  );
}
