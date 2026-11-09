'use client';
import { useState } from 'react';
import Link from 'next/link';
import { mutate } from 'swr';
import { BookmarkPlus, Check, ExternalLink, Eye, Globe, MessageSquare, MoreHorizontal, Send, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { OutreachDialog } from '@/components/outreach/outreach-dialog';
import { apiFetch } from '@/lib/api-client';
import { dexScreenerUrl } from '@/lib/chains';
import type { Project } from '@/lib/types';
import { bestCommunity } from './badges';

export function ProjectActions({ project, compact = false }: { project: Project; compact?: boolean }) {
  const [outreachOpen, setOutreachOpen] = useState(false);
  const tg = bestCommunity(project, 'telegram');
  const dc = bestCommunity(project, 'discord');
  const refresh = () => { mutate((key) => typeof key === 'string' && key.startsWith('/api/')); };
  const act = async (fn: () => Promise<unknown>, msg: string) => {
    try { await fn(); toast.success(msg); refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : 'Action failed'); }
  };
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant={compact ? 'ghost' : 'outline'} size={compact ? 'icon' : 'sm'} className={compact ? 'h-8 w-8' : ''}>{compact ? <MoreHorizontal className="h-4 w-4" /> : <>Actions <MoreHorizontal className="h-4 w-4" /></>}</Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem asChild><Link href={`/projects/${project.id}`}><Eye /> View Details</Link></DropdownMenuItem>
          {project.website && <DropdownMenuItem asChild><a href={project.website} target="_blank" rel="noopener noreferrer"><Globe /> Open Website</a></DropdownMenuItem>}
          {tg && <DropdownMenuItem asChild><a href={tg.normalized_url} target="_blank" rel="noopener noreferrer"><Send /> Open Telegram</a></DropdownMenuItem>}
          {dc && <DropdownMenuItem asChild><a href={dc.normalized_url} target="_blank" rel="noopener noreferrer"><MessageSquare /> Open Discord</a></DropdownMenuItem>}
          <DropdownMenuItem asChild><a href={dexScreenerUrl(project.chain, project.primary_pair_address || project.contract_address)} target="_blank" rel="noopener noreferrer"><ExternalLink /> View on DEX Screener</a></DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => act(() => apiFetch(`/api/projects/${project.id}/review`, { method: 'POST', body: JSON.stringify({ status: 'reviewed' }) }), 'Marked as reviewed')}><Check /> Mark as Reviewed</DropdownMenuItem>
          <DropdownMenuItem onClick={() => act(() => apiFetch(`/api/projects/${project.id}/prospect`, { method: 'POST', body: JSON.stringify({}) }), 'Added to prospects')}><BookmarkPlus /> Add to Prospects</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOutreachOpen(true)}><ShieldCheck /> Mark as Contacted…</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <OutreachDialog project={project} open={outreachOpen} onOpenChange={setOutreachOpen} onRecorded={refresh} />
    </>
  );
}
