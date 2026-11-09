'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR, { mutate } from 'swr';
import { ExternalLink, Pencil, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { ReviewStatusBadge, ScoreBadge } from '@/components/dashboard/badges';
import { OutreachDialog } from '@/components/outreach/outreach-dialog';
import { apiFetch, queryString } from '@/lib/api-client';
import type { Prospect } from '@/lib/types';
import { formatUsd, statusLabel, timeAgo } from '@/lib/utils';

const STATUSES = ['new_lead','reviewed','ready_to_contact','contacted','replied','interested','negotiating','client','not_interested'];

export default function ProspectsPage() {
  const [status, setStatus] = useState('all');
  const [opportunity, setOpportunity] = useState('all');
  const [search, setSearch] = useState('');
  const { data, error, isLoading } = useSWR<Prospect[]>(`/api/prospects${queryString({ status, opportunity, search })}`, { refreshInterval: 30000 });
  const [editing, setEditing] = useState<Prospect | null>(null);
  const [outreach, setOutreach] = useState<Prospect | null>(null);
  const refresh = () => mutate((key) => typeof key === 'string' && key.startsWith('/api/'));
  const prospects = data ?? [];
  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-semibold">Outreach CRM</h1><p className="mt-1 text-sm text-muted-foreground">Manage saved prospects, notes, contact history, responses, and outcomes. Outreach is human-reviewed; duplicate-contact protection is enforced.</p></div>
      <div className="grid gap-3 md:grid-cols-4">
        <Input placeholder="Search prospects…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{STATUSES.map((s) => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}</SelectContent></Select>
        <Select value={opportunity} onValueChange={setOpportunity}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All outcomes</SelectItem><SelectItem value="open">Open</SelectItem><SelectItem value="successful">Successful</SelectItem><SelectItem value="unsuccessful">Unsuccessful</SelectItem></SelectContent></Select>
        <div className="text-sm text-muted-foreground md:text-right">{prospects.length} prospects</div>
      </div>
      <Card className="glass-card"><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Project</TableHead><TableHead>Status</TableHead><TableHead>Outcome</TableHead><TableHead>Score</TableHead><TableHead className="text-right">Liquidity</TableHead><TableHead>Contacted</TableHead><TableHead>Notes</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
        {isLoading && <TableRow><TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">Loading prospects…</TableCell></TableRow>}
        {error && <TableRow><TableCell colSpan={8} className="py-10 text-center text-sm text-destructive">{error.message}</TableCell></TableRow>}
        {!isLoading && prospects.length === 0 && <TableRow><TableCell colSpan={8} className="py-16 text-center"><p className="font-medium">No prospects yet</p><p className="mt-1 text-sm text-muted-foreground">Save projects from the dashboard or project details to start tracking outreach.</p><Button asChild className="mt-4" variant="outline"><Link href="/">Browse discoveries</Link></Button></TableCell></TableRow>}
        {prospects.map((pr) => <TableRow key={pr.id}><TableCell><Link className="font-medium hover:underline" href={`/projects/${pr.project_id}`}>{pr.project?.name ?? 'Project'}</Link><div className="text-xs text-muted-foreground">{pr.project?.symbol} · {pr.project?.chain}</div></TableCell><TableCell><ReviewStatusBadge status={pr.status} /></TableCell><TableCell><Badge variant={pr.opportunity_status === 'successful' ? 'success' : pr.opportunity_status === 'unsuccessful' ? 'destructive' : 'secondary'}>{statusLabel(pr.opportunity_status)}</Badge></TableCell><TableCell>{pr.project ? <ScoreBadge score={pr.project.qualification_score} /> : '—'}</TableCell><TableCell className="text-right">{formatUsd(pr.project?.liquidity_usd)}</TableCell><TableCell className="text-xs text-muted-foreground">{pr.contacted_at ? timeAgo(pr.contacted_at) : 'Not contacted'}{pr.contact_platform ? ` · ${pr.contact_platform}` : ''}</TableCell><TableCell className="max-w-[220px] truncate text-xs text-muted-foreground" title={pr.notes}>{pr.notes || '—'}</TableCell><TableCell className="text-right"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={() => setEditing(pr)} title="Edit prospect"><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => setOutreach(pr)} title="Record outreach"><Send className="h-4 w-4" /></Button><Button variant="ghost" size="icon" asChild title="Open project"><Link href={`/projects/${pr.project_id}`}><ExternalLink className="h-4 w-4" /></Link></Button></div></TableCell></TableRow>)}
      </TableBody></Table></CardContent></Card>
      {editing && <EditProspectDialog prospect={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />}
      {outreach?.project && <OutreachDialog project={{ ...outreach.project, id: outreach.project_id } as any} open={Boolean(outreach)} onOpenChange={(v) => !v && setOutreach(null)} onRecorded={refresh} />}
    </div>
  );
}

function EditProspectDialog({ prospect, onClose, onSaved }: { prospect: Prospect; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ status: prospect.status, opportunity_status: prospect.opportunity_status, notes: prospect.notes ?? '', response_notes: prospect.response_notes ?? '', contact_platform: prospect.contact_platform ?? '', next_follow_up_at: prospect.next_follow_up_at?.slice(0, 16) ?? '' });
  const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); try { await apiFetch(`/api/prospects/${prospect.id}`, { method: 'PATCH', body: JSON.stringify({ ...form, contact_platform: form.contact_platform || null, next_follow_up_at: form.next_follow_up_at ? new Date(form.next_follow_up_at).toISOString() : null }) }); toast.success('Prospect saved'); onSaved(); } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); } finally { setBusy(false); } };
  return <Dialog open onOpenChange={(v) => !v && onClose()}><DialogContent><DialogHeader><DialogTitle>Edit prospect — {prospect.project?.name}</DialogTitle></DialogHeader><div className="grid gap-3"><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label>Status</Label><Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as Prospect['status'] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5"><Label>Outcome</Label><Select value={form.opportunity_status} onValueChange={(v) => setForm((f) => ({ ...f, opportunity_status: v as Prospect['opportunity_status'] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="open">Open</SelectItem><SelectItem value="successful">Successful</SelectItem><SelectItem value="unsuccessful">Unsuccessful</SelectItem></SelectContent></Select></div></div><div className="space-y-1.5"><Label>Contact platform</Label><Input value={form.contact_platform} onChange={(e) => setForm((f) => ({ ...f, contact_platform: e.target.value }))} /></div><div className="space-y-1.5"><Label>Next follow-up</Label><Input type="datetime-local" value={form.next_follow_up_at} onChange={(e) => setForm((f) => ({ ...f, next_follow_up_at: e.target.value }))} /></div><div className="space-y-1.5"><Label>Notes</Label><Textarea rows={4} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></div><div className="space-y-1.5"><Label>Response notes</Label><Textarea rows={2} value={form.response_notes} onChange={(e) => setForm((f) => ({ ...f, response_notes: e.target.value }))} /></div></div><DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button></DialogFooter></DialogContent></Dialog>;
}
