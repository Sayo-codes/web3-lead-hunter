'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, Crosshair, LayoutDashboard, MessageSquareText, Settings, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NotificationsMenu } from './notifications-menu';
import { TopbarActions } from './topbar-actions';

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/prospects', label: 'Prospects', icon: Users },
  { href: '/templates', label: 'Templates', icon: MessageSquareText },
  { href: '/system', label: 'System', icon: Activity },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  useEffect(() => { fetch('/api/health', { cache: 'no-store' }).catch(() => undefined); }, []);
  if (pathname?.startsWith('/login')) return <>{children}</>;
  return (
    <div className="min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 grid-bg opacity-[0.18]" />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-72 bg-gradient-to-b from-emerald-500/10 via-transparent to-transparent" />
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border/70 bg-card/70 backdrop-blur md:flex">
        <div className="flex h-16 items-center gap-3 border-b border-border/70 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 text-black shadow-lg shadow-emerald-500/20">
            <Crosshair className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">Web3 Lead Hunter</div>
            <div className="text-[11px] text-muted-foreground">Automated prospecting</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname?.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors', active ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground')}>
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border/70 p-4 text-[11px] leading-relaxed text-muted-foreground">
          Market data: <a className="underline hover:text-foreground" href="https://dexscreener.com" target="_blank" rel="noopener noreferrer">DEX Screener</a> &amp; <a className="underline hover:text-foreground" href="https://www.geckoterminal.com" target="_blank" rel="noopener noreferrer">GeckoTerminal</a> / CoinGecko.
          <div className="mt-2">Human-reviewed outreach only. No auto-DMs or auto-joining.</div>
        </div>
      </aside>
      <div className="relative md:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-border/70 bg-background/80 px-4 backdrop-blur md:px-6">
          <div className="flex items-center gap-2 md:hidden">
            <Crosshair className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold">Lead Hunter</span>
          </div>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => {
              const active = item.href === '/' ? pathname === '/' : pathname?.startsWith(item.href);
              return <Link key={item.href} href={item.href} className={cn('rounded-md px-3 py-1.5 text-sm', active ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground')}>{item.label}</Link>;
            })}
          </nav>
          <div className="flex items-center gap-2">
            <TopbarActions />
            <NotificationsMenu />
          </div>
        </header>
        <div className="flex gap-1 overflow-x-auto border-b border-border/70 px-3 py-2 md:hidden">
          {NAV.map((item) => <Link key={item.href} href={item.href} className="whitespace-nowrap rounded-md bg-secondary/60 px-3 py-1 text-xs">{item.label}</Link>)}
        </div>
        <main className="relative mx-auto max-w-[1600px] p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
