import Link from 'next/link';
import { Icon } from '@/components/ui/icon';
import { Badge, Button, buttonClass, cx, PageHeader } from '@/components/ui/primitives';
import { mastersSummary } from '@/lib/data/queries';
import type { Village } from '@/lib/data/types';
import { fmtInt, maskMobile } from '@/lib/format';
import type { ImportContext, ImportEntity } from '@/lib/import-spec';
import { BulkImport } from './bulk-import';

export const metadata = { title: 'Masters' };

type Tab = 'hybrids' | 'organisers' | 'locations';
type Search = { tab?: string; state?: string; district?: string; taluk?: string };

const STATE_NAMES: Record<string, string> = { TS: 'Telangana', AP: 'Andhra Pradesh', KA: 'Karnataka', KL: 'Kerala' };
const ENTITY: Record<Tab, { entity: ImportEntity; label: string; add: string }> = {
  hybrids: { entity: 'hybrids', label: 'hybrids', add: 'Add hybrid' },
  organisers: { entity: 'organisers', label: 'organisers', add: 'Add organiser' },
  locations: { entity: 'villages', label: 'villages', add: 'Add village' },
};

const th = 'border-b border-line-soft px-2 py-3 font-medium';
const td = 'border-b border-row px-2 py-[11px]';

export default async function MastersPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const tab: Tab = sp.tab === 'organisers' || sp.tab === 'locations' ? sp.tab : 'hybrids';
  const m = mastersSummary();
  const villageKey = (v: Village) => `${v.stateCode}${v.districtCode}${v.talukCode}${v.code}`;
  const context: ImportContext = {
    hybridKeys: m.hybrids.map((h) => h.hybrid.cropCode + h.hybrid.hybridCode),
    organiserCodes: m.organisers.map((o) => o.organiser.code),
    villageKeys: Object.fromEntries(m.villages.map((v) => [villageKey(v), v.id])),
  };
  const tabs: { key: Tab; label: string; n: number }[] = [
    { key: 'locations', label: 'Locations', n: m.villages.length },
    { key: 'organisers', label: 'Organisers', n: m.organisers.length },
    { key: 'hybrids', label: 'Hybrids & lines', n: m.hybrids.length },
  ];
  const cfg = ENTITY[tab];

  return (
    <>
      <PageHeader
        eyebrow={`Configure · codes lock once used in a lot ID · ${fmtInt(m.farmers)} farmers · ${fmtInt(m.farms)} farms`}
        title="Masters"
        actions={
          <>
            <a href={`/api/masters/template/${cfg.entity}`} download className={buttonClass('secondary')}><Icon name="download" size={16} />Download template</a>
            <Button variant="primary" icon="plus" disabled title="Adding records needs the database">{cfg.add}</Button>
          </>
        }
      />

      <nav aria-label="Master" className="flex gap-1 overflow-x-auto border-b border-line-strong">
        {tabs.map((t) => {
          const on = t.key === tab;
          return (
            <Link
              key={t.key}
              href={t.key === 'hybrids' ? '/admin/masters' : `/admin/masters?tab=${t.key}`}
              scroll={false}
              aria-current={on ? 'page' : undefined}
              className={cx('-mb-px flex h-[46px] flex-none items-center gap-2 whitespace-nowrap border-b-2 px-3.5 text-sm', on ? 'border-brand font-semibold text-ink' : 'border-transparent text-subtle hover:text-ink')}
            >
              {t.label}
              <span className="tabular text-xs font-normal text-muted">{fmtInt(t.n)}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-wrap items-start gap-5">
        <section aria-label={tabs.find((t) => t.key === tab)!.label} className="min-w-0 flex-[2_1_600px] overflow-hidden rounded-[20px] border border-line bg-surface">
          {tab === 'hybrids' && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-[13px]">
                <thead>
                  <tr className="bg-ground-3 text-left text-muted">
                    <th scope="col" className={cx(th, 'pl-5')}>Crop</th>
                    <th scope="col" className={th}>Hybrid</th>
                    <th scope="col" className={th}>Female line</th>
                    <th scope="col" className={th}>Male line</th>
                    <th scope="col" className={th}>F : M</th>
                    <th scope="col" className={cx(th, 'text-right')}>Expected kg/ac</th>
                    <th scope="col" className={cx(th, 'text-right')}>Lots</th>
                    <th scope="col" className={cx(th, 'pr-5')}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {m.hybrids.map(({ hybrid: h, crop, lots }) => (
                    <tr key={h.id}>
                      <td className={cx(td, 'pl-5')}><span className="mr-1.5 rounded-md bg-ground-2 px-1.5 py-0.5 font-mono text-[11.5px] font-semibold">{h.cropCode}</span>{crop.name}</td>
                      <td className={cx(td, 'font-mono font-semibold')}>{h.hybridCode}</td>
                      <td className={cx(td, 'font-mono')}>{h.femaleCode}</td>
                      <td className={cx(td, 'font-mono')}>{h.maleCode}</td>
                      <td className={td}>{h.ratio.replace(':', ' : ')}</td>
                      <td className={cx(td, 'tabular text-right')}>{fmtInt(h.expectedKgPerAcre)}</td>
                      <td className={cx(td, 'tabular text-right')}>{fmtInt(lots)}</td>
                      <td className={cx(td, 'pr-5')}><Badge tone={h.active ? 'brand' : 'neutral'}>{h.active ? 'Active' : 'Inactive'}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'organisers' && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-[13px]">
                <thead>
                  <tr className="bg-ground-3 text-left text-muted">
                    <th scope="col" className={cx(th, 'pl-5')}>Code</th>
                    <th scope="col" className={th}>Name</th>
                    <th scope="col" className={th}>Village · taluk · district</th>
                    <th scope="col" className={th}>Mobile</th>
                    <th scope="col" className={cx(th, 'text-right')}>Farmers</th>
                    <th scope="col" className={cx(th, 'pr-5')}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {m.organisers.map(({ organiser: o, village: v, farmers }) => (
                    <tr key={o.id}>
                      <td className={cx(td, 'pl-5 font-mono font-semibold')}>{o.code}</td>
                      <td className={cx(td, 'font-medium')}>{o.name}</td>
                      <td className={cx(td, 'text-subtle')}>{v.name} · {v.talukName} · {v.districtName}</td>
                      <td className={cx(td, 'tabular text-subtle')}>{maskMobile(o.mobile)}</td>
                      <td className={cx(td, 'tabular text-right')}>{fmtInt(farmers)}</td>
                      <td className={cx(td, 'pr-5')}><Badge tone="brand">Active</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'locations' && <Cascade villages={m.villages} sp={sp} />}
        </section>

        <BulkImport key={cfg.entity} entity={cfg.entity} entityLabel={cfg.label} context={context} />
      </div>
    </>
  );
}

function Cascade({ villages, sp }: { villages: Village[]; sp: Search }) {
  const uniq = <T,>(xs: T[], key: (x: T) => string) => [...new Map(xs.map((x) => [key(x), x])).values()];
  const states = uniq(villages, (v) => v.stateCode).map((v) => v.stateCode).sort();
  const state = states.includes(sp.state ?? '') ? sp.state! : states[0]!;
  const inState = villages.filter((v) => v.stateCode === state);
  const districts = uniq(inState, (v) => v.districtCode).sort((a, b) => a.districtName.localeCompare(b.districtName));
  const district = districts.find((d) => d.districtCode === sp.district) ?? districts[0]!;
  const inDistrict = inState.filter((v) => v.districtCode === district.districtCode);
  const taluks = uniq(inDistrict, (v) => v.talukCode).sort((a, b) => a.talukName.localeCompare(b.talukName));
  const taluk = taluks.find((t) => t.talukCode === sp.taluk) ?? taluks[0]!;
  const inTaluk = inDistrict.filter((v) => v.talukCode === taluk.talukCode).sort((a, b) => a.code.localeCompare(b.code));

  const href = (p: { state?: string; district?: string; taluk?: string }) => {
    const q = new URLSearchParams({ tab: 'locations' });
    for (const [k, v] of Object.entries(p)) if (v) q.set(k, v);
    return `/admin/masters?${q}`;
  };

  const columns = [
    { title: 'State', items: states.map((s) => ({ key: s, name: STATE_NAMES[s] ?? s, code: s, on: s === state, href: href({ state: s }), count: villages.filter((v) => v.stateCode === s).length })) },
    { title: 'District', items: districts.map((d) => ({ key: d.districtCode, name: d.districtName, code: d.districtCode, on: d.districtCode === district.districtCode, href: href({ state, district: d.districtCode }), count: inState.filter((v) => v.districtCode === d.districtCode).length })) },
    { title: 'Taluk', items: taluks.map((t) => ({ key: t.talukCode, name: t.talukName, code: t.talukCode, on: t.talukCode === taluk.talukCode, href: href({ state, district: district.districtCode, taluk: t.talukCode }), count: inDistrict.filter((v) => v.talukCode === t.talukCode).length })) },
  ];

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))]">
      {columns.map((col) => (
        <div key={col.title} className="min-h-[360px] border-r border-b border-line-soft">
          <h3 className="border-b border-line-soft bg-ground-3 px-4 py-3 text-xs font-medium tracking-[0.08em] text-muted uppercase">{col.title}</h3>
          <ul>
            {col.items.map((it) => (
              <li key={it.key}>
                <Link
                  href={it.href}
                  scroll={false}
                  aria-current={it.on ? 'true' : undefined}
                  className={cx('flex min-h-11 items-center justify-between gap-2 border-b border-row px-4 py-2.5 text-[13.5px]', it.on ? 'bg-brand-soft font-semibold shadow-[inset_3px_0_0_#2f7d4e]' : 'hover:bg-ground-3')}
                >
                  <span className="min-w-0">
                    {it.name}
                    <span className="ml-1.5 text-[11.5px] font-normal text-muted">{it.count} {it.count === 1 ? 'village' : 'villages'}</span>
                  </span>
                  <span className="font-mono text-[11.5px] font-normal text-muted">{it.code}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="min-h-[360px] border-b border-line-soft">
        <h3 className="border-b border-line-soft bg-ground-3 px-4 py-3 text-xs font-medium tracking-[0.08em] text-muted uppercase">Village · pincode</h3>
        <ul>
          {inTaluk.map((v) => (
            <li key={v.id} className="flex min-h-11 items-center justify-between gap-2 border-b border-row px-4 py-2.5 text-[13.5px]">
              <span>{v.name} · <span className="tabular text-subtle">{v.pincode}</span></span>
              <span className="font-mono text-[11.5px] text-muted" title={`Full key ${v.stateCode}${v.districtCode}${v.talukCode}${v.code}`}>{v.code}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
