'use client';

import { BookmarkCheck, Clock, MessageSquare, Send, Sparkles, TrendingUp, Users, Layers } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { DashboardStats } from '@/lib/types';
import { formatNumber } from '@/lib/utils';

const CARDS = [
  { key: 'total_projects', label: 'Total discovered', icon: Layers, color: 'text-sky-300' },
  { key: 'new_today', label: 'New today', icon: TrendingUp, color: 'text-emerald-300' },
  { key: 'telegram_groups', label: 'Telegram groups', icon: Send, color: 'text-cyan-300' },
  { key: 'discord_servers', label: 'Discord servers', icon: MessageSquare, color: 'text-indigo-300' },
  { key: 'both_communities', label: 'Both communities', icon: Users, color: 'text-teal-300' },
  { key: 'qualified_prospects', label: 'Qualified prospects', icon: Sparkles, color: 'text-amber-300' },
  { key: 'awaiting_review', label: 'Awaiting review', icon: Clock, color: 'text-muted-foreground' },
  { key: 'contacted', label: 'Contacted', icon: BookmarkCheck, color: 'text-emerald-300' },
] as const;

export function StatCards({ stats, loading }: { stats?: DashboardStats; loading?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
      {CARDS.map((c) => (
        <Card key={c.key} className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{c.label}</span>
              <c.icon className={`h-4 w-4 ${c.color}`} />
            </div>
            {loading || !stats ? <Skeleton className="mt-2 h-7 w-16" /> : <div className="mt-1 text-2xl font-semibold tabular-nums">{formatNumber(stats[c.key])}</div>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
