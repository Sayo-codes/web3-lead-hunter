'use client';

import { useState } from 'react';
import { mutate } from 'swr';
import { Play, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';

export function TopbarActions() {
  const [running, setRunning] = useState(false);
  const refresh = () => {
    mutate((key) => typeof key === 'string' && key.startsWith('/api/'));
    toast.success('Dashboard data refreshed');
  };
  const run = async () => {
    setRunning(true);
    try {
      const res = await apiFetch<{ job: { id: string } }>('/api/discovery/run', { method: 'POST', body: JSON.stringify({}) });
      toast.success('Discovery job queued', { description: `Job ${res.job.id.slice(0, 8)} will run shortly.` });
      setTimeout(() => mutate((key) => typeof key === 'string' && key.startsWith('/api/')), 4000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to queue discovery');
    } finally {
      setRunning(false);
    }
  };
  return (
    <>
      <Button variant="outline" size="sm" onClick={refresh}><RefreshCw className="h-4 w-4" /> <span className="hidden sm:inline">Refresh</span></Button>
      <Button size="sm" onClick={run} disabled={running}><Play className="h-4 w-4" /> <span className="hidden sm:inline">{running ? 'Queueing…' : 'Run discovery'}</span></Button>
    </>
  );
}
