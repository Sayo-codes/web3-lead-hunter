'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { Activity, AlertCircle, CheckCircle, Loader2, Play, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import type { WorkerHealth } from '@/lib/types';

export function TopbarActions() {
  const [running, setRunning] = useState(false);
  const { data: health } = useSWR<WorkerHealth>('/api/system/worker-health', {
    refreshInterval: 10000,
  });

  const refresh = () => {
    mutate((key) => typeof key === 'string' && key.startsWith('/api/'));
    toast.success('Dashboard data refreshed');
  };

  const run = async () => {
    setRunning(true);
    try {
      const res = await apiFetch<{
        ok?: boolean;
        status: string;
        message: string;
        job?: { id: string; projects_created?: number };
      }>('/api/discovery/run', {
        method: 'POST',
        body: JSON.stringify({ wait: true, timeoutMs: 7000 }),
      });

      if (res.status === 'completed' || res.status === 'completed_with_errors') {
        toast.success('Discovery completed', { description: res.message });
      } else if (res.status === 'running') {
        toast.info('Discovery in progress', {
          description: 'Job claimed and processing in background.',
        });
      } else if (res.status === 'worker_unavailable') {
        toast.warning('Worker unavailable', { description: res.message });
      } else if (res.status === 'failed') {
        toast.error('Discovery failed', { description: res.message });
      } else {
        toast.info('Job queued', { description: res.message });
      }

      mutate((key) => typeof key === 'string' && key.startsWith('/api/'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to trigger discovery');
    } finally {
      setRunning(false);
    }
  };

  const workerStatus = health?.status ?? 'idle';

  return (
    <div className="flex items-center gap-2">
      {/* Live Worker Status Badge */}
      <div className="hidden lg:flex items-center gap-1.5" title={`Active workers: ${health?.active_workers ?? 0}`}>
        {workerStatus === 'processing' && (
          <Badge variant="warning" className="gap-1 animate-pulse">
            <Loader2 className="h-3 w-3 animate-spin" />
            Worker: Processing
          </Badge>
        )}
        {workerStatus === 'idle' && (
          <Badge variant="secondary" className="gap-1 text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Worker: Idle
          </Badge>
        )}
        {workerStatus === 'error' && (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Worker: Error
          </Badge>
        )}
        {workerStatus === 'unavailable' && (
          <Badge variant="muted" className="gap-1 text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
            Worker: Standby
          </Badge>
        )}
      </div>

      <Button variant="outline" size="sm" onClick={refresh}>
        <RefreshCw className="h-4 w-4" /> <span className="hidden sm:inline">Refresh</span>
      </Button>
      <Button size="sm" onClick={run} disabled={running}>
        {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        <span className="hidden sm:inline">{running ? 'Starting…' : 'Run discovery'}</span>
      </Button>
    </div>
  );
}
