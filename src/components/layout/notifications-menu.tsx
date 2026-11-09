'use client';

import Link from 'next/link';
import useSWR, { mutate } from 'swr';
import { Bell, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { apiFetch } from '@/lib/api-client';
import type { Notification } from '@/lib/types';
import { timeAgo } from '@/lib/utils';

export function NotificationsMenu() {
  const { data } = useSWR<Notification[]>('/api/notifications?limit=20', { refreshInterval: 30000 });
  const notifications = data ?? [];
  const unread = notifications.filter((n) => !n.read_at).length;
  const markAll = async () => {
    try {
      await apiFetch('/api/notifications', { method: 'POST', body: JSON.stringify({}) });
      mutate('/api/notifications?limit=20');
      toast.success('Notifications marked read');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to mark read'); }
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {unread > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{unread > 9 ? '9+' : unread}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-semibold">Notifications</span>
          <Button variant="ghost" size="sm" onClick={markAll} disabled={unread === 0}><CheckCheck className="h-3 w-3" /> Mark read</Button>
        </div>
        <div className="max-h-80 overflow-y-auto p-1">
          {notifications.length === 0 && <div className="p-4 text-center text-sm text-muted-foreground">No notifications yet. Qualified discoveries will appear here.</div>}
          {notifications.map((n) => (
            <Link key={n.id} href={n.project_id ? `/projects/${n.project_id}` : '/system'} className="block rounded-md px-3 py-2 hover:bg-secondary">
              <div className="flex items-start justify-between gap-2">
                <span className={`text-sm font-medium ${n.read_at ? 'text-muted-foreground' : 'text-foreground'}`}>{n.title}</span>
                {!n.read_at && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />}
              </div>
              {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>}
              <span className="mt-1 block text-[10px] text-muted-foreground">{timeAgo(n.created_at)}</span>
            </Link>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
