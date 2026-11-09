'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { Radar } from 'lucide-react';
import { Filters, DEFAULT_FILTERS } from '@/components/dashboard/filters';
import { ProjectTable } from '@/components/dashboard/project-table';
import { StatCards } from '@/components/dashboard/stat-cards';
import { Button } from '@/components/ui/button';
import { apiFetch, queryString } from '@/lib/api-client';
import type { DashboardStats, Project, UserSettings } from '@/lib/types';

export default function DashboardPage() {
  const { data: settings } = useSWR<UserSettings>('/api/settings');
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(filters.search ?? ''), 300); return () => clearTimeout(t); }, [filters.search]);
  const refreshInterval = settings?.auto_refresh_dashboard ? (settings.dashboard_refresh_seconds || 30) * 1000 : 0;
  const { data: stats, isLoading: statsLoading } = useSWR<DashboardStats>('/api/stats', { refreshInterval });
  const query = useMemo(() => queryString({ ...filters, search: debouncedSearch, community: filters.community ?? settings?.community_requirement ?? 'either' }), [filters, debouncedSearch, settings?.community_requirement]);
  const { data, error, isLoading, mutate } = useSWR<{ rows: Project[]; total: number; page: number; pageSize: number }>(`/api/projects${query}`, { refreshInterval, keepPreviousData: true });
  const runDiscovery = async () => { await apiFetch('/api/discovery/run', { method: 'POST', body: JSON.stringify({}) }); setTimeout(() => mutate(), 5000); };
  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Discovery Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Automated Web3 project discovery, community extraction, and transparent lead qualification. Default view prioritizes accessible Telegram groups or Discord servers.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Radar className="h-4 w-4 text-primary" /> {settings ? `Auto-discovery every ${settings.discovery_interval_minutes} min · dashboard refresh ${settings.dashboard_refresh_seconds}s` : 'Loading settings…'}</div>
      </div>
      <StatCards stats={stats} loading={statsLoading} />
      <Filters value={filters} onChange={setFilters} />
      {data?.total === 0 && !isLoading ? (
        <div className="glass-card rounded-xl border p-10 text-center">
          <p className="text-lg font-medium">No projects discovered yet</p>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">The worker discovers new pools and token profiles from DEX Screener and GeckoTerminal, extracts community links, validates them where permitted, and scores qualified leads. This may take a few seconds on first run.</p>
          <Button className="mt-5" onClick={runDiscovery}>Run discovery now</Button>
        </div>
      ) : (
        <ProjectTable rows={data?.rows ?? []} loading={isLoading} error={error} total={data?.total ?? 0} page={filters.page ?? 1} pageSize={filters.pageSize ?? 25} onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))} onRetry={() => mutate()} />
      )}
    </div>
  );
}
