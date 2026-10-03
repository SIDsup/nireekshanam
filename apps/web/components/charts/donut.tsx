export function Donut({ value, size = 132, color = '#1f6fb2', track = '#fbe3c4', label, sub }: { value: number; size?: number; color?: string; track?: string; label: string; sub: string }) {
  const r = size / 2 - 14;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label} ${sub}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth="14" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="14" strokeLinecap="round" strokeDasharray={`${c * Math.max(0, Math.min(1, value))} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x={size / 2} y={size / 2 - 2} textAnchor="middle" fontSize="24" fontWeight="600" fill="#10201a">{label}</text>
      <text x={size / 2} y={size / 2 + 17} textAnchor="middle" fontSize="11" fill="#5b6b63">{sub}</text>
    </svg>
  );
}
