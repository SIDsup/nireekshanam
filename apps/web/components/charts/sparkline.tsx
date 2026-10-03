export function Sparkline({ values, color = '#2f7d4e', width = 96, height = 32, min, max }: { values: number[]; color?: string; width?: number; height?: number; min?: number; max?: number }) {
  if (values.length < 2) return null;
  const lo = min ?? Math.min(...values);
  const hi = max ?? Math.max(...values);
  const span = hi - lo || 1;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * width).toFixed(1)},${(height - 3 - ((v - lo) / span) * (height - 6)).toFixed(1)}`).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" aria-hidden="true">
      <polyline points={pts} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MiniBars({ values, width = 96, height = 32, colors }: { values: number[]; width?: number; height?: number; colors?: string[] }) {
  const max = Math.max(...values, 1);
  const w = width / values.length;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      {values.map((v, i) => {
        const h = Math.max(2, (v / max) * height);
        return <rect key={i} x={i * w + 1} y={height - h} width={w - 3} height={h} rx="2" fill={colors?.[i] ?? '#a2d3b0'} />;
      })}
    </svg>
  );
}
