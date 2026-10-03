'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useOptimistic, useTransition } from 'react';
import { Icon } from '@/components/ui/icon';
import { buttonClass, cx } from '@/components/ui/primitives';

export function PrintButton({ sheets, labels }: { sheets: number; labels: number }) {
  return (
    <button type="button" onClick={() => window.print()} disabled={labels === 0} className={cx(buttonClass('primary'), 'font-semibold')}>
      <Icon name="printer" size={16} />
      Print labels · {sheets} {sheets === 1 ? 'sheet' : 'sheets'}
    </button>
  );
}

const OPTIONS = [
  { key: 'farmer', label: 'Farmer name and village' },
  { key: 'hybrid', label: 'Hybrid and parent lines' },
  { key: 'area', label: 'Contracted area' },
] as const;

/** "Print on label" toggles. State lives in `?show=` so the server renders the matching preview. */
export function LabelFieldOptions({ show }: { show: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [current, setCurrent] = useOptimistic(show);

  function toggle(key: string, on: boolean) {
    const next = new Set(current);
    if (on) next.add(key);
    else next.delete(key);
    const keys = OPTIONS.map((o) => o.key).filter((k) => next.has(k));
    const q = new URLSearchParams(params.toString());
    q.set('show', keys.join(',') || 'none');
    start(() => {
      setCurrent(keys);
      router.replace(`${pathname}?${q}`, { scroll: false });
    });
  }

  return (
    <fieldset className="flex flex-col gap-1" aria-busy={pending}>
      <legend className="mb-2 text-[13px] font-medium">Print on label</legend>
      {OPTIONS.map((o) => (
        <label key={o.key} className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[13.5px]">
          <input type="checkbox" checked={current.includes(o.key)} onChange={(e) => toggle(o.key, e.target.checked)} className="size-[18px] accent-brand" />
          {o.label}
        </label>
      ))}
    </fieldset>
  );
}
