import Link from 'next/link';
import type { StageGroupKey } from '@/lib/data/queries';
import { fmtInt } from '@/lib/format';
import { STAGE_COLORS, stageTextColor } from '@/lib/stage-colors';

export interface StageSegment { key: StageGroupKey; label: string; value: number; display: string }

/** Segmented bar of lots by current stage. Each segment links to the filtered lot list. */
export function StageBar({ segments }: { segments: StageSegment[] }) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const shown = segments.filter((s) => s.value > 0);
  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex h-[52px] gap-[3px]">
        {shown.map((s, i) => (
          <Link
            key={s.key}
            href={`/lots?stage=${s.key}`}
            title={`${s.label}: ${s.display}`}
            className="flex min-w-2 items-center overflow-hidden text-[13px] font-semibold tabular transition-opacity hover:opacity-85"
            style={{
              flex: `${s.value} 1 0`,
              background: STAGE_COLORS[s.key],
              color: stageTextColor(s.key),
              borderRadius: shown.length === 1 ? 12 : i === 0 ? '12px 4px 4px 12px' : i === shown.length - 1 ? '4px 12px 12px 4px' : 4,
            }}
          >
            {s.value / total > 0.06 && <span className="whitespace-nowrap px-3">{s.display}</span>}
          </Link>
        ))}
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-x-5 gap-y-3.5">
        {segments.map((s) => (
          <Link key={s.key} href={`/lots?stage=${s.key}`} className="flex flex-col gap-1 rounded-lg hover:bg-ground-3">
            <span className="flex items-center gap-2 text-[13px] text-subtle">
              <span className="size-2.5 flex-none rounded-[3px] ring-1 ring-black/5" style={{ background: STAGE_COLORS[s.key] }} />
              {s.label}
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="tabular text-lg font-semibold">{s.display}</span>
              <span className="text-xs text-muted">{fmtInt((s.value / total) * 100)}%</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
