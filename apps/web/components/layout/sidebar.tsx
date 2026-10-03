'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BrandMark, Icon, type IconName } from '@/components/ui/icon';
import { cx } from '@/components/ui/primitives';

interface NavItem { href: string; label: string; icon: IconName; badge?: number; match?: (p: string) => boolean }

export function Sidebar({ user, reviewCount, syncNote }: { user: { name: string; role: string; initials: string }; reviewCount: number; syncNote: string }) {
  const pathname = usePathname();
  const groups: { title: string; items: NavItem[] }[] = [
    {
      title: 'Monitor',
      items: [
        { href: '/', label: 'Overview', icon: 'overview', match: (p) => p === '/' },
        { href: '/map', label: 'Map', icon: 'map' },
        { href: '/lots', label: 'Production lots', icon: 'layers' },
        { href: '/review', label: 'Review queue', icon: 'shield', badge: reviewCount },
      ],
    },
    {
      title: 'Configure',
      items: [
        { href: '/admin/stages', label: 'Stage configuration', icon: 'sliders' },
        { href: '/admin/masters', label: 'Masters', icon: 'database' },
        { href: '/admin/users', label: 'Users & roles', icon: 'users' },
        { href: '/admin/labels', label: 'Labels & exports', icon: 'chart' },
        { href: '/field', label: 'Field app', icon: 'phone' },
      ],
    },
  ];
  const isActive = (item: NavItem) => (item.match ? item.match(pathname) : pathname === item.href || pathname.startsWith(`${item.href}/`));

  return (
    <nav aria-label="Primary" className="flex w-full flex-col gap-[26px] px-3.5 pt-[22px] pb-6 text-forest-text">
      <Link href="/" className="flex items-center gap-[11px] px-2 text-white">
        <BrandMark />
        <span className="flex flex-col leading-[1.15]">
          <span className="text-[17px] font-semibold tracking-[-0.01em]">Nireekshanam</span>
          <span className="text-[11.5px] tracking-[0.02em] text-forest-muted">Seed production monitoring</span>
        </span>
      </Link>

      <button type="button" className="flex min-h-[52px] w-full items-center justify-between gap-2.5 rounded-xl border border-forest-line bg-forest-2 px-3 py-2 text-left text-white">
        <span className="flex flex-col leading-[1.25]">
          <span className="text-[11px] uppercase tracking-[0.08em] text-forest-muted">Season</span>
          <span className="text-sm font-medium">Kharif 2026 <span className="font-mono text-xs text-forest-muted">01·26</span></span>
        </span>
        <Icon name="chevronsUpDown" size={16} className="text-forest-muted" />
      </button>

      {groups.map((g) => (
        <div key={g.title} className="flex flex-col gap-1">
          <p className="mb-1.5 px-3 text-[11px] font-medium uppercase tracking-[0.09em] text-[#7e9187]">{g.title}</p>
          {g.items.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'flex min-h-[42px] items-center gap-[11px] rounded-[10px] px-3 text-sm transition-colors',
                  active ? 'bg-forest-3 font-medium text-white' : 'text-forest-text hover:bg-forest-2 hover:text-white',
                )}
              >
                <Icon name={item.icon} className={active ? 'text-leaf' : undefined} strokeWidth={1.7} />
                <span className="flex-1">{item.label}</span>
                {!!item.badge && <span className="tabular rounded-full bg-signal-soft px-2 py-0.5 text-xs font-semibold text-forest">{item.badge}</span>}
              </Link>
            );
          })}
        </div>
      ))}

      <div className="mt-2 flex flex-col gap-3">
        <div className="rounded-[14px] border border-forest-line bg-forest-2 p-3.5">
          <div className="flex items-center gap-2 text-[13px] font-medium text-white">
            <span className="size-2 rounded-full bg-leaf shadow-[0_0_0_4px_#1d4a31]" />
            Field sync healthy
          </div>
          <p className="mt-2 text-xs leading-normal text-[#9fb3a8]">{syncNote}</p>
        </div>
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <span aria-hidden="true" className="flex size-9 flex-none items-center justify-center rounded-full bg-[#2b5b40] text-[13px] font-semibold text-white">{user.initials}</span>
          <span className="flex min-w-0 flex-1 flex-col leading-[1.3]">
            <span className="text-[13.5px] font-medium text-white">{user.name}</span>
            <span className="text-xs text-forest-muted">{user.role}</span>
          </span>
          <form action="/api/auth/logout" method="post">
            <button type="submit" aria-label="Sign out" className="flex size-9 items-center justify-center rounded-lg text-forest-muted hover:bg-forest-2 hover:text-white">
              <Icon name="logout" size={16} />
            </button>
          </form>
        </div>
      </div>
    </nav>
  );
}
