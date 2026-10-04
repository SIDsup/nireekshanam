import { ROLE_LABELS } from '@nk/shared';
import { Sidebar } from '@/components/layout/sidebar';
import { reviewQueue, seasonOverview } from '@/lib/data/queries';
import { db } from '@/lib/data/store';
import { fmtInt, initials } from '@/lib/format';
import { viewer } from '@/lib/session';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await viewer();
  const pending = reviewQueue().filter((i) => !i.decision).length;
  const o = seasonOverview();
  const stale = db().users.filter((u) => u.deviceId && u.lastSyncAt && u.lastSyncAt < `${o.today}T00:00:00Z`).length;
  const syncNote = `${fmtInt(o.recordsToday)} records received today. ${stale} ${stale === 1 ? 'device has' : 'devices have'} not synced today.`;

  return (
    <div className="flex min-h-screen flex-wrap items-stretch">
      <div className="flex-[1_1_248px] bg-forest lg:max-w-[260px]">
        <Sidebar user={{ name: user.name, role: ROLE_LABELS[user.role], initials: initials(user.name) }} reviewCount={pending} syncNote={syncNote} />
      </div>
      <main className="min-w-0 flex-[999_1_560px] px-4 pt-7 pb-14 sm:px-[clamp(16px,3vw,40px)]">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-5">{children}</div>
      </main>
    </div>
  );
}
