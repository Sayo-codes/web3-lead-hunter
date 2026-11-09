'use client';

import useSWR from 'swr';
import { Activity, AlertTriangle, CheckCircle2, Play, Radio, Server } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api-client';
import type { ApiSource, DiscoveryJob, WorkerHealth } from '@/lib/types';
import { timeAgo } from '@/lib/utils';

export default function SystemPage() {
  const { data: jobs, mutate: mutateJobs } = useSWR<DiscoveryJob[]>('/api/jobs', { refreshInterval: 10000 });
  const { data: sources } = useSWR<ApiSource[]>('/api/sources', { refreshInterval: 15000 });
  const { data: health } = useSWR<{ status: string; mode: string; config: any }>('/api/health', { refreshInterval: 30000 });
  const { data: workerHealth } = useSWR<WorkerHealth>('/api/system/worker-health', { refreshInterval: 5000 });

  const run = async () => {
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
      setTimeout(() => mutateJobs(), 2000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const statusVariant = (s: string) => s === 'completed' ? 'success' : s === 'completed_with_errors' ? 'warning' : s === 'failed' ? 'destructive' : s === 'running' ? 'info' : 'muted';
  const workerStatusVariant = (s?: string) => s === 'idle' ? 'success' : s === 'processing' ? 'warning' : s === 'error' ? 'destructive' : 'muted';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">System & ingestion</h1>
          <p className="mt-1 text-sm text-muted-foreground">Worker health, discovery jobs, distributed locks, provider status, and automatic recovery.</p>
        </div>
        <Button onClick={run}><Play className="h-4 w-4" /> Run discovery now</Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card className="glass-card">
          <CardContent className="flex items-center gap-3 p-4">
            <Server className="h-5 w-5 text-primary" />
            <div>
              <div className="text-sm font-medium">Database</div>
              <div className="text-xs text-muted-foreground">{health?.mode ?? '…'} · {health?.status ?? 'checking'}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="flex items-center gap-3 p-4">
            <Activity className="h-5 w-5 text-emerald-300" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Worker Status</span>
                <Badge variant={workerStatusVariant(workerHealth?.status)}>
                  {workerHealth?.status ?? 'checking…'}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                {workerHealth?.active_workers ?? 0} active worker(s) · {health?.config?.dbMode === 'pglite' ? 'In-process' : 'Dedicated'}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="flex items-center gap-3 p-4">
            <Radio className="h-5 w-5 text-sky-400" />
            <div>
              <div className="text-sm font-medium">Last Heartbeat</div>
              <div className="text-xs text-muted-foreground">
                {workerHealth?.last_heartbeat ? timeAgo(workerHealth.last_heartbeat) : 'No heartbeat yet'}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle2 className="h-5 w-5 text-sky-300" />
            <div>
              <div className="text-sm font-medium">Discovery interval</div>
              <div className="text-xs text-muted-foreground">Every {health?.config?.discoveryIntervalMinutes ?? 3} min</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {workerHealth?.last_error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-xs text-destructive">
          <div className="font-semibold">Worker Error Warning:</div>
          <div>{workerHealth.last_error}</div>
        </div>
      )}

      <Card className="glass-card">
        <CardHeader><CardTitle>API sources</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {(sources ?? []).map((s) => (
            <div key={s.id} className="rounded-lg border border-border/60 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{s.name}</span>
                <Badge variant={s.health_status === 'healthy' ? 'success' : s.health_status === 'degraded' ? 'warning' : s.health_status === 'down' ? 'destructive' : 'muted'}>{s.health_status}</Badge>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">{s.enabled ? 'Enabled' : 'Disabled'} · {s.rate_limit_per_min}/min</div>
              <div className="mt-1 text-xs text-muted-foreground">Last success: {timeAgo(s.last_success_at)}</div>
              {s.last_error && <div className="mt-2 flex items-start gap-1 text-xs text-amber-300"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> <span className="line-clamp-3">{s.last_error}</span></div>}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader><CardTitle>Discovery jobs</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Retries</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead className="text-right">Created</TableHead>
                <TableHead className="text-right">Updated</TableHead>
                <TableHead className="text-right">Pairs</TableHead>
                <TableHead className="text-right">Links</TableHead>
                <TableHead className="text-right">Validated</TableHead>
                <TableHead>Error / logs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(jobs ?? []).map((j) => (
                <TableRow key={j.id}>
                  <TableCell><Badge variant={statusVariant(j.status)}>{j.status.replace(/_/g, ' ')}</Badge></TableCell>
                  <TableCell className="text-xs">{j.trigger_source}</TableCell>
                  <TableCell className="text-xs">{j.retry_count ?? 0} / {j.max_retries ?? 3}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{timeAgo(j.created_at)}</TableCell>
                  <TableCell className="text-xs">{j.duration_ms ? `${(j.duration_ms / 1000).toFixed(1)}s` : '—'}</TableCell>
                  <TableCell className="text-right">{j.projects_created}</TableCell>
                  <TableCell className="text-right">{j.projects_updated}</TableCell>
                  <TableCell className="text-right">{j.pairs_upserted}</TableCell>
                  <TableCell className="text-right">{j.links_found}</TableCell>
                  <TableCell className="text-right">{j.links_validated}</TableCell>
                  <TableCell className="max-w-[320px] text-xs text-muted-foreground">
                    {j.error ? <span className="text-amber-300">{j.error}</span> : '—'}
                    <details className="mt-1">
                      <summary className="cursor-pointer text-muted-foreground">Logs</summary>
                      <pre className="mt-1 max-h-40 overflow-auto rounded bg-secondary/50 p-2 text-[10px]">{JSON.stringify(j.logs, null, 2)}</pre>
                    </details>
                  </TableCell>
                </TableRow>
              ))}
              {(jobs ?? []).length === 0 && (
                <TableRow><TableCell colSpan={11} className="py-10 text-center text-sm text-muted-foreground">No jobs yet. The worker will create the first scheduled job automatically.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
