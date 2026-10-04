import { ROLE_LABELS, ROLES, type Role } from '@nk/shared';
import Link from 'next/link';
import { Icon } from '@/components/ui/icon';
import { Avatar, Badge, Button, cx, PageHeader, ProgressBar, type Tone } from '@/components/ui/primitives';
import { usersSummary } from '@/lib/data/queries';
import { fmtDateTime, fmtInt, fmtPct, initials, maskMobile } from '@/lib/format';

export const metadata = { title: 'Users & roles' };

type Search = { role?: string; user?: string };

const ROLE_TONE: Record<Role, Tone> = {
  FIELD_ASSISTANT: 'brand',
  SUPERVISOR: 'sky',
  PRODUCTION_MANAGER: 'dark',
  ORGANISER: 'rose',
  ADMIN: 'signal',
  VIEWER: 'neutral',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthYear = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

const th = 'border-b border-line-soft px-2 py-3 font-medium';
const td = 'border-b border-row px-2 py-2.5';

export default async function UsersPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const all = usersSummary();
  const role = (ROLES as readonly string[]).includes(sp.role ?? '') ? (sp.role as Role) : 'all';
  const rows = all.filter((u) => role === 'all' || u.user.role === role);
  const sel = all.find((u) => u.user.id === sp.user) ?? rows[0] ?? all[0]!;
  const chips = [{ key: 'all', label: 'All', n: all.length }, ...ROLES.map((r) => ({ key: r, label: ROLE_LABELS[r], n: all.filter((u) => u.user.role === r).length })).filter((c) => c.n > 0)];
  const href = (p: Search) => {
    const q = new URLSearchParams();
    const m = { role: role === 'all' ? undefined : role, user: sel.user.id, ...p };
    if (m.role && m.role !== 'all') q.set('role', m.role);
    if (m.user) q.set('user', m.user);
    const s = q.toString();
    return s ? `/admin/users?${s}` : '/admin/users';
  };
  const u = sel.user;
  const fieldRole = u.role === 'FIELD_ASSISTANT' || u.role === 'ORGANISER';

  return (
    <>
      <PageHeader
        eyebrow={`Configure · ${all.length} users · ${new Set(all.map((x) => x.user.role)).size} roles`}
        title="Users & roles"
        actions={<Button variant="primary" icon="plus" disabled title="Inviting users needs the database">Invite user</Button>}
      />

      <nav aria-label="Filter by role" className="flex flex-wrap gap-2">
        {chips.map((c) => {
          const on = c.key === role;
          return (
            <Link
              key={c.key}
              href={href({ role: c.key, user: undefined })}
              scroll={false}
              aria-current={on ? 'page' : undefined}
              className={cx('flex h-11 items-center gap-[7px] rounded-full border px-[13px] text-[13px]', on ? 'border-ink bg-ink font-medium text-white' : 'border-line-strong bg-surface hover:bg-ground-3')}
            >
              {c.label}
              <span className="tabular opacity-70">{c.n}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-wrap items-start gap-5">
        <section aria-label="Users" className="min-w-0 flex-[2_1_440px] overflow-hidden rounded-[20px] border border-line bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse text-[13px]">
              <thead>
                <tr className="bg-ground-3 text-left text-muted">
                  <th scope="col" className={cx(th, 'pl-5')}>Name</th>
                  <th scope="col" className={th}>Role</th>
                  <th scope="col" className={th}>Scope</th>
                  <th scope="col" className={cx(th, 'text-right')}>Lots</th>
                  <th scope="col" className={cx(th, 'pr-5')}>Last sync</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const on = r.user.id === sel.user.id;
                  return (
                    <tr key={r.user.id} className={cx(on && 'bg-brand-soft')}>
                      <td className={cx(td, 'pl-5')}>
                        <Link href={href({ user: r.user.id })} scroll={false} aria-current={on ? 'true' : undefined} className="flex min-h-11 items-center gap-2.5 hover:underline">
                          <Avatar initials={initials(r.user.name)} size={34} tone={ROLE_TONE[r.user.role]} />
                          <span className="flex flex-col leading-[1.3]">
                            <span className="text-[13.5px] font-medium">{r.user.name}</span>
                            <span className="tabular text-xs text-muted">{maskMobile(r.user.mobile)}</span>
                          </span>
                        </Link>
                      </td>
                      <td className={td}><Badge tone={ROLE_TONE[r.user.role]}>{ROLE_LABELS[r.user.role]}</Badge></td>
                      <td className={cx(td, 'text-subtle')}>{r.user.scopeLabel}</td>
                      <td className={cx(td, 'tabular text-right')}>{fmtInt(r.lots)}</td>
                      <td className={cx(td, 'pr-5')}><SyncCell lastSyncAt={r.user.lastSyncAt} device={r.user.deviceId} stale={r.stale} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="user-title" className="flex min-w-0 flex-[1_1_360px] flex-col gap-[18px] rounded-[20px] border border-line bg-surface px-6 py-[22px]">
          <div className="flex items-center gap-3">
            <Avatar initials={initials(u.name)} size={52} tone={ROLE_TONE[u.role]} />
            <div className="min-w-0">
              <h2 id="user-title" className="text-[19px] font-semibold tracking-[-0.01em]">{u.name}</h2>
              <p className="mt-[3px] text-[13px] text-muted"><span className="tabular">{maskMobile(u.mobile)}</span> · joined {monthYear(u.joined)}</p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="user-role" className="text-[13px] font-medium">Role</label>
            <select key={u.id} id="user-role" defaultValue={u.role} className="h-11 rounded-xl border border-line-strong bg-surface px-3 text-sm">
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between">
              <span className="text-[13px] font-medium">{u.villageIds.length ? 'Assigned villages' : 'Scope'}</span>
              {u.villageIds.length > 0 && <span className="tabular text-xs text-muted">{sel.villages.length} {sel.villages.length === 1 ? 'village' : 'villages'}</span>}
            </div>
            <ul className="flex flex-wrap gap-1.5">
              {(sel.villages.length ? sel.villages : [u.scopeLabel]).map((v) => (
                <li key={v} className="rounded-full bg-brand-soft px-[11px] py-[5px] text-[12.5px] text-brand-text">{v}</li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-2.5 border-t border-line-soft pt-4">
            <span className="text-[13px] font-medium">Workload this season</span>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Tile value={fmtInt(sel.lots)} label="Lots" />
              <Tile value={fmtInt(sel.records)} label="Records" />
              <Tile value={fieldRole ? fmtInt(sel.overdue) : '—'} label="Overdue" warn={sel.overdue > 0} />
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-subtle">Records inside geo-fence</span>
              <b className="tabular font-semibold">{sel.insidePct === null ? 'No field records' : fmtPct(sel.insidePct)}</b>
            </div>
            <ProgressBar value={sel.insidePct ?? 0} color="#1f6fb2" marker={0.9} />
            <p className="text-xs text-muted">Marker shows the 90% target.</p>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2.5">
              <Button variant="primary" className="flex-1" disabled>Save changes</Button>
              <Button disabled>Deactivate</Button>
            </div>
            <p className="flex items-center gap-1.5 text-xs text-muted"><Icon name="info" size={14} />Changes are not saved in the demo build.</p>
          </div>
        </section>
      </div>
    </>
  );
}

function Tile({ value, label, warn }: { value: string; label: string; warn?: boolean }) {
  return (
    <div className={cx('rounded-xl p-2.5', warn ? 'bg-signal-tint text-signal-text' : 'bg-ground')}>
      <div className="tabular text-xl font-semibold">{value}</div>
      <div className={cx('text-[11.5px]', warn ? 'text-signal-text' : 'text-subtle')}>{label}</div>
    </div>
  );
}

function SyncCell({ lastSyncAt, device, stale }: { lastSyncAt: string | null; device: string | null; stale: boolean }) {
  if (!device) return <span className="text-[12.5px] text-subtle">Web</span>;
  if (!lastSyncAt) return <span className="text-[12.5px] text-muted">Never synced</span>;
  return (
    <span className={cx('flex flex-col text-[12.5px] leading-[1.35]', stale ? 'font-semibold text-signal-text' : 'text-subtle')}>
      <span className="flex items-center gap-1">{stale && <Icon name="alert" size={13} strokeWidth={2} />}{fmtDateTime(lastSyncAt)}</span>
      <span className="font-mono text-[11px] font-normal text-muted">{device}</span>
    </span>
  );
}
