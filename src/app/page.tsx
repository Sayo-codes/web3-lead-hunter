'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { Radar } from 'lucide-react';
import { Filters, DEFAULT_FILTERS } from '@/components/dashboard/filters';
import { ProjectTable } from '@/components/dashboard/project-table';
import { StatCards } from '@/components/dashboard/stat-cards';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { apiFetch, queryString } from '@/lib/api-client';
import type { DashboardStats, Project, UserSettings, WorkerHealth } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function DashboardPage() {
  const { data: settings } = useSWR<UserSettings>('/api/settings');
  const { data: workerHealth } = useSWR<WorkerHealth>('/api/system/worker-health', { refreshInterval: 10000 });
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(filters.search ?? ''), 300); return () => clearTimeout(t); }, [filters.search]);
  const refreshInterval = settings?.auto_refresh_dashboard ? (settings.dashboard_refresh_seconds || 30) * 1000 : 0;
  const { data: stats, isLoading: statsLoading } = useSWR<DashboardStats>('/api/stats', { refreshInterval });
  const query = useMemo(() => queryString({ ...filters, search: debouncedSearch, community: filters.community ?? settings?.community_requirement ?? 'either' }), [filters, debouncedSearch, settings?.community_requirement]);
  const { data, error, isLoading, mutate } = useSWR<{ rows: Project[]; total: number; page: number; pageSize: number }>(`/api/projects${query}`, { refreshInterval, keepPreviousData: true });
  const [runningDiscovery, setRunningDiscovery] = useState(false);

  const runDiscovery = async () => {
    setRunningDiscovery(true);
    try {
      const res = await apiFetch<{ status: string; message: string }>('/api/discovery/run', {
        method: 'POST',
        body: JSON.stringify({ wait: true, timeoutMs: 7000 }),
      });
      if (res.status === 'completed' || res.status === 'completed_with_errors') {
        toast.success('Discovery completed', { description: res.message });
      } else if (res.status === 'worker_unavailable') {
        toast.warning('Worker unavailable', { description: res.message });
      } else {
        toast.info('Discovery in progress', { description: res.message });
      }
      setTimeout(() => mutate(), 2000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Discovery failed');
    } finally {
      setRunningDiscovery(false);
    }
  };

  const workerStatus = workerHealth?.status ?? 'idle';

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Discovery Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Automated Web3 project discovery, community extraction, and transparent lead qualification. Default view prioritizes accessible Telegram groups or Discord servers.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Radar className="h-4 w-4 text-primary" />
            {settings ? `Auto-discovery every ${settings.discovery_interval_minutes} min · refresh ${settings.dashboard_refresh_seconds}s` : 'Loading settings…'}
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
            <span
              className={cn('h-1.5 w-1.5 rounded-full', {
                'bg-amber-400 animate-pulse': workerStatus === 'processing',
                'bg-emerald-400': workerStatus === 'idle',
                'bg-red-400': workerStatus === 'error',
                'bg-zinc-500': workerStatus === 'unavailable',
              })}
            />
            Worker: {workerStatus.charAt(0).toUpperCase() + workerStatus.slice(1)}
          </span>
        </div>
      </div>
      <StatCards stats={stats} loading={statsLoading} />
      <Filters value={filters} onChange={setFilters} />
      {data?.total === 0 && !isLoading ? (
        <div className="glass-card rounded-xl border p-10 text-center">
          <p className="text-lg font-medium">No projects discovered yet</p>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">The worker discovers new pools and token profiles from DEX Screener and GeckoTerminal, extracts community links, validates them where permitted, and scores qualified leads. This may take a few seconds on first run.</p>
          <Button className="mt-5" onClick={runDiscovery} disabled={runningDiscovery}>
            {runningDiscovery ? 'Discovering…' : 'Run discovery now'}
          </Button>
        </div>
      ) : (
        <ProjectTable rows={data?.rows ?? []} loading={isLoading} error={error} total={data?.total ?? 0} page={filters.page ?? 1} pageSize={filters.pageSize ?? 25} onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))} onRetry={() => mutate()} />
      )}
    </div>
  );
}
