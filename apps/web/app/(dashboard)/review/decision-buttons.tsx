'use client';

import { useFormStatus } from 'react-dom';
import { Icon } from '@/components/ui/icon';
import { cx } from '@/components/ui/primitives';

type Action = (form: FormData) => Promise<void>;

/** Approve / reject submit buttons. Both post the same form (item id + comment) to different Server Actions. */
export function DecisionButtons({ approve, reject, approveLabel, rejectLabel, disabled }: { approve: Action; reject: Action; approveLabel: string; rejectLabel: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  const off = pending || disabled;
  return (
    <div className="flex flex-wrap gap-2.5">
      <button type="submit" formAction={approve} disabled={off} className="flex h-[46px] items-center gap-2 rounded-xl bg-brand px-[18px] text-sm font-semibold text-white hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-60">
        <Icon name="check" size={16} strokeWidth={2.4} />
        {approveLabel}
      </button>
      <button type="submit" formAction={reject} disabled={off} className="flex h-[46px] items-center gap-2 rounded-xl border-[1.5px] border-signal bg-surface px-[18px] text-sm font-semibold text-signal-text hover:bg-signal-tint disabled:cursor-not-allowed disabled:opacity-60">
        <Icon name="x" size={16} strokeWidth={2.4} />
        {rejectLabel}
      </button>
      <span aria-live="polite" className={cx('self-center text-[13px] text-muted', !pending && 'sr-only')}>{pending ? 'Saving decision…' : ''}</span>
    </div>
  );
}

export function UndoButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="min-h-11 px-2 font-semibold underline disabled:opacity-60">
      {pending ? 'Undoing…' : 'Undo'}
    </button>
  );
}
