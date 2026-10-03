import Link from 'next/link';
import QRCode from 'qrcode';
import { Icon } from '@/components/ui/icon';
import { buttonClass, cx, PageHeader } from '@/components/ui/primitives';
import { REPORTS } from '@/lib/data/exports';
import { lotViews, type LotView } from '@/lib/data/queries';
import { fmtGuntas, fmtInt } from '@/lib/format';
import { LabelFieldOptions, PrintButton } from './label-controls';

export const metadata = { title: 'QR labels & exports' };

type Search = { lots?: string; format?: string; show?: string };
type Format = 'a6' | 'bag';

const FORMATS: { key: Format; title: string; desc: string; perSheet: number; cols: number; rows: number }[] = [
  { key: 'a6', title: 'A6 field tag', desc: 'Weatherproof tag tied at the field entrance', perSheet: 4, cols: 2, rows: 2 },
  { key: 'bag', title: 'Seed bag label', desc: 'Stuck on bags at seed collection', perSheet: 10, cols: 2, rows: 5 },
];
const DEFAULT_SHOW = ['farmer', 'hybrid'];
const MAX_LOTS = 200;
const DEFAULT_ORGANISER = '015';

/**
 * Print rules. Sizes inside a sheet use container query units (cqw), so the on-screen preview and
 * the printed A4 page are the same layout at different scales.
 */
const PRINT_CSS = `
@page { size: A4 portrait; margin: 0; }
@media print {
  html, body { background: #fff !important; }
  div:has(> nav[aria-label="Primary"]) { display: none !important; }
  main { padding: 0 !important; }
  main > div { max-width: none !important; gap: 0 !important; }
  .nk-print-root { display: block !important; padding: 0 !important; background: none !important; border-radius: 0 !important; gap: 0 !important; }
  .nk-sheet-wrap { display: block !important; gap: 0 !important; }
  .nk-sheet { width: 210mm !important; max-width: none !important; height: 297mm !important; box-shadow: none !important; border-radius: 0 !important; break-after: page; break-inside: avoid; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  .nk-sheet:last-of-type { break-after: auto; }
}
`;

function parseLots(raw: string | undefined): string[] {
  if (!raw) return [];
  return [...new Set(raw.split(/[\s,;]+/).map((s) => s.trim().toUpperCase()).filter(Boolean))].slice(0, MAX_LOTS);
}

export default async function LabelsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const views = lotViews();
  const byId = new Map(views.map((v) => [v.lot.lotId, v]));
  const format = FORMATS.find((f) => f.key === sp.format) ?? FORMATS[0]!;
  const show = sp.show === undefined ? DEFAULT_SHOW : sp.show.split(',').filter((s) => ['farmer', 'hybrid', 'area'].includes(s));

  const orgLots = (code: string) => views.filter((v) => v.organiser.code === code).slice(0, 24).map((v) => v.lot.lotId);
  const requested = sp.lots ? parseLots(sp.lots) : orgLots(DEFAULT_ORGANISER);
  const lots = requested.map((id) => byId.get(id)).filter((v): v is LotView => !!v);
  const unknown = requested.filter((id) => !byId.has(id));
  const isDefault = !sp.lots;

  const qrs = await Promise.all(lots.map((v) => QRCode.toString(v.lot.lotId, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } })));
  const sheets: { view: LotView; qr: string }[][] = [];
  lots.forEach((view, i) => {
    if (i % format.perSheet === 0) sheets.push([]);
    sheets.at(-1)!.push({ view, qr: qrs[i]! });
  });

  const organisers = [...new Map(views.map((v) => [v.organiser.code, v.organiser])).values()].sort((a, b) => a.code.localeCompare(b.code));
  const selectionLabel = (() => {
    const orgs = new Set(lots.map((v) => v.organiser.code));
    return orgs.size === 1 ? `Organiser ${[...orgs][0]}` : `${orgs.size} organisers`;
  })();

  const href = (p: Search) => {
    const m: Search = { lots: sp.lots, format: format.key, show: sp.show, ...p };
    const q = new URLSearchParams();
    if (m.lots) q.set('lots', m.lots);
    if (m.format && m.format !== 'a6') q.set('format', m.format);
    if (m.show !== undefined) q.set('show', m.show);
    const s = q.toString();
    return s ? `/admin/labels?${s}` : '/admin/labels';
  };

  return (
    <>
      <style>{PRINT_CSS}</style>
      <div className="print:hidden">
        <PageHeader
          eyebrow="Reports & exports"
          title="QR labels"
          actions={<PrintButton sheets={sheets.length} labels={lots.length} />}
        />
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <section aria-label="Label settings" className="flex min-w-0 flex-[1_1_320px] flex-col gap-[18px] rounded-[20px] border border-line bg-surface px-6 py-[22px] print:hidden">
          <fieldset className="flex flex-col gap-2.5">
            <legend className="mb-2.5 text-[13px] font-medium">Label type</legend>
            {FORMATS.map((f) => {
              const on = f.key === format.key;
              return (
                <Link
                  key={f.key}
                  href={href({ format: f.key })}
                  scroll={false}
                  aria-current={on ? 'true' : undefined}
                  className={cx('flex w-full items-center justify-between gap-3 rounded-[14px] border-[1.5px] px-4 py-3.5', on ? 'border-brand-mid bg-brand-soft' : 'border-line-strong bg-surface hover:bg-ground-3')}
                >
                  <span className="flex flex-col gap-[3px]">
                    <span className="text-sm font-semibold">{f.title}</span>
                    <span className="text-[12.5px] text-muted">{f.desc}</span>
                  </span>
                  <span className="whitespace-nowrap font-mono text-xs text-subtle">{f.perSheet} / A4</span>
                </Link>
              );
            })}
          </fieldset>

          <div className="flex flex-col gap-2.5">
            <span className="text-[13px] font-medium">Lots</span>
            <div className="rounded-xl bg-ground px-3.5 py-3 text-[13.5px]">
              <b className="font-semibold">{fmtInt(lots.length)} {lots.length === 1 ? 'lot' : 'lots'}</b>
              {lots.length > 0 && <> · {selectionLabel}</>}
              {isDefault && <span className="text-muted"> · first 24 lots</span>}
            </div>
            {unknown.length > 0 && (
              <p role="alert" className="rounded-xl bg-signal-tint px-3.5 py-2.5 text-[13px] leading-normal text-signal-text">
                {unknown.length} {unknown.length === 1 ? 'ID was' : 'IDs were'} not found and skipped: <span className="break-all font-mono">{unknown.slice(0, 5).join(', ')}{unknown.length > 5 ? ', …' : ''}</span>
              </p>
            )}
            <details className="group rounded-xl border border-line">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3.5 text-[13px] font-medium text-brand">
                Change lots
                <Icon name="chevronDown" size={16} className="transition-transform group-open:rotate-180" />
              </summary>
              <div className="flex flex-col gap-3 border-t border-line-soft px-3.5 py-3">
                <div className="flex flex-wrap gap-1.5" aria-label="First 24 lots of an organiser">
                  {organisers.map((o) => (
                    <Link key={o.code} href={href({ lots: orgLots(o.code).join(',') })} className="inline-flex h-9 items-center rounded-full border border-line-strong bg-surface px-3 text-[12.5px] hover:bg-ground-3">
                      <span className="mr-1 font-mono font-semibold">{o.code}</span>{o.name}
                    </Link>
                  ))}
                </div>
                <form action="/admin/labels" method="get" className="flex flex-col gap-2">
                  <label htmlFor="lots-input" className="text-xs text-muted">Or paste lot IDs, separated by commas or new lines</label>
                  <textarea id="lots-input" name="lots" rows={3} defaultValue={lots.map((v) => v.lot.lotId).join(', ')} className="resize-y rounded-xl border border-line-strong bg-surface px-3 py-2.5 font-mono text-xs" />
                  {format.key !== 'a6' && <input type="hidden" name="format" value={format.key} />}
                  {sp.show !== undefined && <input type="hidden" name="show" value={sp.show} />}
                  <button type="submit" className={cx(buttonClass('secondary', 'sm'), 'h-11 self-start')}>Use these lots</button>
                </form>
              </div>
            </details>
          </div>

          <LabelFieldOptions show={show} />

          <div className="flex flex-col gap-1.5 border-t border-line-soft pt-4">
            <h2 className="mb-1.5 text-[15px] font-semibold">Report exports</h2>
            <ul>
              {REPORTS.map((r) => (
                <li key={r.key} className="flex min-h-[52px] items-center justify-between gap-2.5 border-b border-row py-1.5 text-[13.5px]">
                  <span className="flex min-w-0 flex-col">
                    <span>{r.title}</span>
                    <span className="text-xs text-muted">{r.description}</span>
                  </span>
                  <a href={`/api/exports/${r.key}`} download aria-label={`Download ${r.title} as CSV`} className="inline-flex h-11 flex-none items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 text-xs font-medium hover:bg-ground-3">
                    <Icon name="download" size={14} />CSV
                  </a>
                </li>
              ))}
            </ul>
            <p className="pt-1 text-xs text-muted">CSV files open directly in Excel.</p>
          </div>
        </section>

        <section aria-label="Print preview" className="nk-print-root flex min-w-0 flex-[2_1_560px] flex-col items-center gap-3.5 rounded-[20px] bg-[#e4e8e1] p-4 sm:p-7">
          <div className="flex w-full max-w-[560px] flex-wrap justify-between gap-2 text-[12.5px] text-subtle print:hidden">
            <span>A4 · {sheets.length} {sheets.length === 1 ? 'sheet' : 'sheets'}</span>
            <span>{format.perSheet} labels per sheet · use Save as PDF in the print dialog for a PDF</span>
          </div>
          {sheets.length === 0 && <p className="py-16 text-[13.5px] text-subtle print:hidden">No lots selected. Pick an organiser or paste lot IDs.</p>}
          <div className="nk-sheet-wrap flex w-full flex-col items-center gap-6">
            {sheets.map((labels, si) => (
              <div key={si} className="nk-sheet w-full max-w-[560px] overflow-hidden rounded-[4px] bg-white text-black shadow-[0_10px_30px_rgba(16,32,26,0.14)] [container-type:inline-size]" aria-label={`Sheet ${si + 1} of ${sheets.length}`} role="group">
                <div
                  className="grid"
                  style={{
                    height: '141.42cqw',
                    padding: '4cqw',
                    gap: format.key === 'a6' ? '4cqw' : '2cqw',
                    gridTemplateColumns: `repeat(${format.cols}, minmax(0, 1fr))`,
                    gridTemplateRows: `repeat(${format.rows}, minmax(0, 1fr))`,
                  }}
                >
                  {labels.map(({ view, qr }) => <Label key={view.lot.lotId} view={view} qr={qr} format={format.key} show={show} />)}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function Label({ view, qr, format, show }: { view: LotView; qr: string; format: Format; show: string[] }) {
  const a6 = format === 'a6';
  const lines: { text: string; strong?: boolean }[] = [];
  if (show.includes('farmer')) lines.push({ text: `${view.farmer.name} · ${view.village.name}`, strong: true });
  if (show.includes('hybrid')) lines.push({ text: `${view.hybrid.cropCode} ${view.hybrid.hybridCode} · ${view.hybrid.femaleCode} × ${view.hybrid.maleCode}${a6 ? ' · Kharif 2026' : ''}` });
  if (show.includes('area')) lines.push({ text: `${fmtGuntas(view.lot.contractedAreaSqm)} contracted` });

  return (
    <div
      className={cx('flex min-w-0 overflow-hidden border border-dashed border-[#c9d1c8]', a6 ? 'flex-col items-center justify-center text-center' : 'items-center')}
      style={{ borderRadius: a6 ? '1.2cqw' : '0.8cqw', padding: a6 ? '2cqw' : '1.2cqw 1.6cqw', gap: a6 ? '2.4cqw' : '2cqw' }}
    >
      <div className="flex-none [&_svg]:block [&_svg]:size-full" style={{ width: a6 ? '26cqw' : '17cqw', height: a6 ? '26cqw' : '17cqw' }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: qr }} />
      <div className={cx('flex min-w-0 flex-col', a6 ? 'items-center' : 'items-start')} style={{ gap: a6 ? '0.8cqw' : '0.5cqw' }}>
        <span className="font-mono font-semibold tracking-[0.02em] whitespace-nowrap" style={{ fontSize: a6 ? '2.1cqw' : '1.5cqw' }}>{view.lot.lotId}</span>
        {lines.map((l) => (
          <span key={l.text} className={cx('max-w-full truncate', l.strong ? 'font-semibold' : 'text-[#3a4a42]')} style={{ fontSize: l.strong ? (a6 ? '2.5cqw' : '1.75cqw') : (a6 ? '2cqw' : '1.45cqw') }}>
            {l.text}
          </span>
        ))}
      </div>
    </div>
  );
}
