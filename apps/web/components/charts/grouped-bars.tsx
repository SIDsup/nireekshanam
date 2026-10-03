export interface BarGroup {
  label: string;
  sublabel?: string;
  values: number[];
}

/** Grouped vertical bars with a 0-based axis. One colour per series. */
export function GroupedBars({ groups, colors, unit = '', ariaLabel }: { groups: BarGroup[]; colors: string[]; unit?: string; ariaLabel: string }) {
  const W = 640;
  const H = 256;
  const left = 40;
  const top = 20;
  const bottom = 220;
  const max = niceMax(Math.max(...groups.flatMap((g) => g.values), 1));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const slot = (W - left - 4) / Math.max(groups.length, 1);
  const barW = Math.min(18, (slot - 24) / colors.length);
  const y = (v: number) => bottom - (v / max) * (bottom - top);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={ariaLabel} className="block">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={left} x2={W - 4} y1={y(t)} y2={y(t)} stroke={t === 0 ? '#c9d1c8' : '#ecefe9'} />
          <text x={left - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#5b6b63">{formatTick(t)}{t === max ? unit : ''}</text>
        </g>
      ))}
      {groups.map((g, gi) => {
        const cx = left + slot * gi + slot / 2;
        const x0 = cx - (barW * colors.length + 3 * (colors.length - 1)) / 2;
        return (
          <g key={g.label}>
            {g.values.map((v, i) => (
              <rect key={i} x={x0 + i * (barW + 3)} y={y(v)} width={barW} height={Math.max(0, bottom - y(v))} rx="3" fill={colors[i]}>
                <title>{`${g.label}: ${formatTick(v)}${unit}`}</title>
              </rect>
            ))}
            <text x={cx} y={240} textAnchor="middle" fontSize="11.5" fontWeight="500" fill="#10201a">{g.label}</text>
            {g.sublabel && <text x={cx} y={254} textAnchor="middle" fontSize="10.5" fill="#5b6b63">{g.sublabel}</text>}
          </g>
        );
      })}
    </svg>
  );
}

function niceMax(v: number): number {
  const exp = 10 ** Math.floor(Math.log10(v));
  const n = v / exp;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 4 ? 4 : n <= 5 ? 5 : 10) * exp;
}

function formatTick(v: number): string {
  return v >= 10 ? Math.round(v).toString() : v.toFixed(1).replace(/\.0$/, '');
}
