'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import { ArrowLeft, CheckCircle2, ExternalLink, Globe, RefreshCw, ShieldCheck, Twitter } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ChainBadge, ReviewStatusBadge, ScoreBadge } from '@/components/dashboard/badges';
import { CopyAddress } from '@/components/dashboard/copy-button';
import { ProjectActions } from '@/components/dashboard/project-actions';
import { OutreachDialog } from '@/components/outreach/outreach-dialog';
import { apiFetch } from '@/lib/api-client';
import { dexScreenerUrl, explorerUrl, getChain } from '@/lib/chains';
import type { Project, Prospect, UserSettings } from '@/lib/types';
import { ageLabel, formatNumber, formatUsd, statusLabel, timeAgo } from '@/lib/utils';

const STATUSES = ['new_lead','reviewed','ready_to_contact','contacted','replied','interested','negotiating','client','not_interested'];

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: project, error, isLoading, mutate: mutateProject } = useSWR<Project>(params?.id ? `/api/projects/${params.id}` : null);
  const { data: settings } = useSWR<UserSettings>('/api/settings');
  const [outreachOpen, setOutreachOpen] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const refreshAll = () => { mutateProject(); mutate((key) => typeof key === 'string' && key.startsWith('/api/')); };
  if (isLoading) return <div className="space-y-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-96 w-full" /></div>;
  if (error || !project) return <div className="rounded-xl border p-10 text-center"><p className="text-destructive">{error?.message ?? 'Project not found'}</p><Button asChild className="mt-4" variant="outline"><Link href="/">Back to dashboard</Link></Button></div>;
  const verify = async (communityLinkId?: string) => {
    setVerifying(true);
    try { const res = await apiFetch<{ checked: number }>(`/api/projects/${project.id}/verify-community`, { method: 'POST', body: JSON.stringify({ communityLinkId }) }); toast.success(`Re-checked ${res.checked} community link(s)`); refreshAll(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Verification failed'); }
    finally { setVerifying(false); }
  };
  const saveProspect = async () => { try { await apiFetch(`/api/projects/${project.id}/prospect`, { method: 'POST', body: JSON.stringify({}) }); toast.success('Saved as prospect'); refreshAll(); } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); } };
  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" asChild><Link href="/"><ArrowLeft className="h-4 w-4" /> Back to dashboard</Link></Button>
      <Card className="glass-card">
        <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            {project.image_url ? <img src={project.image_url} alt="" className="h-14 w-14 rounded-xl border object-cover" /> : <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-secondary text-lg font-bold">{project.symbol.slice(0, 2)}</div>}
            <div>
              <div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-semibold">{project.name}</h1><Badge variant="secondary">{project.symbol}</Badge><ChainBadge chain={project.chain} /><ScoreBadge score={project.qualification_score} qualified={project.is_qualified} />{project.is_qualified && <Badge variant="success">Qualified</Badge>}<ReviewStatusBadge status={project.review_status} /></div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><CopyAddress address={project.contract_address} showShort={false} /><span>·</span><span>Age {ageLabel(project.token_created_at)}</span><span>·</span><span>Discovered {timeAgo(project.discovered_at)}</span></div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild><a href={dexScreenerUrl(project.chain, project.primary_pair_address || project.contract_address)} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /> DEX Screener</a></Button>
            <Button variant="outline" size="sm" asChild><a href={explorerUrl(project.chain, project.contract_address)} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /> Explorer</a></Button>
            <ProjectActions project={project} />
          </div>
        </CardContent>
      </Card>
      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="community">Community</TabsTrigger><TabsTrigger value="pairs">Trading pairs</TabsTrigger><TabsTrigger value="outreach">Outreach CRM</TabsTrigger><TabsTrigger value="provenance">Data provenance</TabsTrigger></TabsList>
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[['Liquidity', formatUsd(project.liquidity_usd)], ['24h volume', formatUsd(project.volume_24h_usd)], ['24h transactions', formatNumber(project.transaction_count_24h)], ['Market cap', formatUsd(project.market_cap_usd)], ['FDV', formatUsd(project.fdv_usd)], ['Price', formatUsd(project.price_usd, false)], ['Pairs', formatNumber(project.pair_count)], ['Primary DEX', project.primary_dex ?? 'Unavailable']].map(([label, value]) => <Card key={label} className="glass-card"><CardContent className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-lg font-semibold">{value}</div></CardContent></Card>)}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="glass-card"><CardHeader><CardTitle>Qualification score — {project.qualification_score}/100</CardTitle></CardHeader><CardContent className="space-y-2">{project.qualification_reasons.map((r) => <div key={r.code} className="flex items-start justify-between gap-3 rounded-lg border border-border/60 p-3"><div><div className="text-sm font-medium">{r.label} <span className={r.points > 0 ? 'text-emerald-300' : 'text-muted-foreground'}>(+{r.points})</span></div><p className="mt-0.5 text-xs text-muted-foreground">{r.detail}</p></div></div>)}{Array.isArray((project.data_flags as any)?.filter_failures) && (project.data_flags as any).filter_failures.length > 0 && <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">Settings filters not met: {(project.data_flags as any).filter_failures.join('; ')}</div>}</CardContent></Card>
            <Card className="glass-card"><CardHeader><CardTitle>Project information</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><p className="whitespace-pre-wrap text-muted-foreground">{project.description || 'No description available from providers.'}</p><Separator /><div className="grid gap-2">{[['Website', project.website], ['X/Twitter', project.twitter_url], ['GitHub', project.github_url], ['Telegram', project.telegram_url], ['Discord', project.discord_url]].map(([label, url]) => <div key={label} className="flex items-center justify-between gap-2"><span className="text-muted-foreground">{label}</span>{url ? <a className="inline-flex items-center gap-1 truncate text-primary hover:underline" href={url} target="_blank" rel="noopener noreferrer">{url.replace(/^https?:\/\//, '').slice(0, 40)} <ExternalLink className="h-3 w-3" /></a> : <span className="text-xs text-muted-foreground">Unavailable</span>}</div>)}</div></CardContent></Card>
          </div>
        </TabsContent>
        <TabsContent value="community" className="space-y-4">
          <Card className="glass-card"><CardHeader className="flex-row items-center justify-between"><CardTitle>Community links</CardTitle><Button size="sm" variant="outline" onClick={() => verify()} disabled={verifying}><RefreshCw className={`h-4 w-4 ${verifying ? 'animate-spin' : ''}`} /> Re-validate all</Button></CardHeader><CardContent className="space-y-3">{(project.community_links ?? []).length === 0 && <p className="text-sm text-muted-foreground">No Telegram/Discord links found in provider metadata yet.</p>}{(project.community_links ?? []).map((l) => <div key={l.id} className="rounded-lg border border-border/60 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><Badge variant="secondary">{l.platform}</Badge><Badge variant={l.validation_status === 'verified' ? 'success' : l.validation_status === 'accessible' ? 'info' : l.validation_status === 'invalid' ? 'destructive' : 'muted'}>{l.community_type.replace('_', ' ')} · {l.validation_status}</Badge>{l.is_verified && <Badge variant="success"><ShieldCheck className="mr-1 h-3 w-3" /> Verified</Badge>}</div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => verify(l.id)} disabled={verifying}>Re-check</Button><Button size="sm" variant="secondary" asChild><a href={l.normalized_url} target="_blank" rel="noopener noreferrer">Open <ExternalLink className="h-3 w-3" /></a></Button></div></div><div className="mt-2 grid gap-1 text-xs text-muted-foreground"><span className="font-mono">{l.normalized_url}</span>{l.title && <span>Title: {l.title}</span>}{l.member_count !== null && <span>Approx. members: {formatNumber(l.member_count)}</span>}<span>Method: {l.verification_method ?? 'unknown'} · Last checked: {timeAgo(l.last_checked_at)}</span>{l.error && <span className="text-amber-300">{l.error}</span>}{l.platform === 'telegram' && !l.is_verified && l.validation_status === 'accessible' && <span>Public-page hint only; not bot-verified. The app does not join groups.</span>}</div></div>)}</CardContent></Card>
        </TabsContent>
        <TabsContent value="pairs">
          <Card className="glass-card"><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Pair</TableHead><TableHead>DEX</TableHead><TableHead className="text-right">Liquidity</TableHead><TableHead className="text-right">24h volume</TableHead><TableHead className="text-right">Txns</TableHead><TableHead>Created</TableHead><TableHead>Source</TableHead></TableRow></TableHeader><TableBody>{(project.trading_pairs ?? []).map((p) => <TableRow key={p.id}><TableCell className="font-mono text-xs">{p.pair_address.slice(0, 10)}…{p.quote_symbol ? ` / ${p.quote_symbol}` : ''}</TableCell><TableCell>{p.dex_id ?? '—'}</TableCell><TableCell className="text-right">{formatUsd(p.liquidity_usd)}</TableCell><TableCell className="text-right">{formatUsd(p.volume_24h_usd)}</TableCell><TableCell className="text-right">{formatNumber(p.transaction_count_24h)}</TableCell><TableCell className="text-xs">{p.pair_created_at ? new Date(p.pair_created_at).toLocaleString() : 'Unavailable'}</TableCell><TableCell><Badge variant="muted">{p.source}</Badge></TableCell></TableRow>)}{(project.trading_pairs ?? []).length === 0 && <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">No trading pairs retained yet.</TableCell></TableRow>}</TableBody></Table></CardContent></Card>
        </TabsContent>
        <TabsContent value="outreach" className="space-y-4">
          <Card className="glass-card"><CardHeader className="flex-row items-center justify-between"><CardTitle>Prospect management</CardTitle><div className="flex gap-2">{!project.prospect && <Button size="sm" onClick={saveProspect}>Save as prospect</Button>}<Button size="sm" onClick={() => setOutreachOpen(true)}>Record outreach</Button></div></CardHeader><CardContent>{project.prospect ? <ProspectForm prospect={project.prospect} onSaved={refreshAll} /> : <p className="text-sm text-muted-foreground">Not saved as a prospect yet. Save it to track notes, status, responses, and opportunity outcome.</p>}</CardContent></Card>
          <Card className="glass-card"><CardHeader><CardTitle>Outreach history</CardTitle></CardHeader><CardContent className="space-y-3">{(project.outreach_history ?? []).length === 0 && <p className="text-sm text-muted-foreground">No outreach recorded. Duplicate-contact protection is active.</p>}{(project.outreach_history ?? []).map((h) => <div key={h.id} className="rounded-lg border border-border/60 p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><span className="font-medium">{h.platform ?? 'unknown platform'} · {h.status}</span><span className="text-xs text-muted-foreground">{new Date(h.contacted_at).toLocaleString()}</span></div><p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{h.message}</p>{h.response_notes && <p className="mt-2 text-xs text-emerald-300">Response: {h.response_notes}</p>}</div>)}</CardContent></Card>
        </TabsContent>
        <TabsContent value="provenance">
          <Card className="glass-card"><CardHeader><CardTitle>Data provenance & limitations</CardTitle></CardHeader><CardContent className="space-y-2 text-sm text-muted-foreground"><p>Market data source: <span className="text-foreground">{project.market_data_source ?? 'Unavailable'}</span></p><p>Metadata source: <span className="text-foreground">{project.metadata_source ?? 'Unavailable'}</span></p><p>Earliest known pair creation: <span className="text-foreground">{project.token_created_at ? new Date(project.token_created_at).toLocaleString() : 'Unavailable'}</span> (pair creation, not guaranteed token contract creation)</p><p>Last market update: <span className="text-foreground">{timeAgo(project.last_market_update_at)}</span> · Last enrichment: <span className="text-foreground">{timeAgo(project.last_enriched_at)}</span></p><p>Social links are provider metadata unless marked verified. Telegram public-page hints are not bot verification. Discord verification uses the official invite API without joining.</p><pre className="mt-3 overflow-x-auto rounded-lg bg-secondary/50 p-3 text-xs">{JSON.stringify(project.data_flags, null, 2)}</pre></CardContent></Card>
        </TabsContent>
      </Tabs>
      <OutreachDialog project={project} open={outreachOpen} onOpenChange={setOutreachOpen} onRecorded={refreshAll} />
    </div>
  );
}

function ProspectForm({ prospect, onSaved }: { prospect: Prospect; onSaved: () => void }) {
  const [form, setForm] = useState({ status: prospect.status, notes: prospect.notes ?? '', opportunity_status: prospect.opportunity_status, contact_platform: prospect.contact_platform ?? '', response_notes: prospect.response_notes ?? '', next_follow_up_at: prospect.next_follow_up_at?.slice(0, 16) ?? '' });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await apiFetch(`/api/prospects/${prospect.id}`, { method: 'PATCH', body: JSON.stringify({ ...form, contact_platform: form.contact_platform || null, next_follow_up_at: form.next_follow_up_at ? new Date(form.next_follow_up_at).toISOString() : null }) }); toast.success('Prospect updated'); onSaved(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to save'); }
    finally { setBusy(false); }
  };
  return <div className="grid gap-3 md:grid-cols-2"><div className="space-y-1.5"><Label>Status</Label><Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as Prospect['status'] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5"><Label>Opportunity</Label><Select value={form.opportunity_status} onValueChange={(v) => setForm((f) => ({ ...f, opportunity_status: v as Prospect['opportunity_status'] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="open">Open</SelectItem><SelectItem value="successful">Successful</SelectItem><SelectItem value="unsuccessful">Unsuccessful</SelectItem></SelectContent></Select></div><div className="space-y-1.5"><Label>Contact platform</Label><Input value={form.contact_platform} onChange={(e) => setForm((f) => ({ ...f, contact_platform: e.target.value }))} /></div><div className="space-y-1.5"><Label>Next follow-up</Label><Input type="datetime-local" value={form.next_follow_up_at} onChange={(e) => setForm((f) => ({ ...f, next_follow_up_at: e.target.value }))} /></div><div className="space-y-1.5 md:col-span-2"><Label>Notes</Label><Textarea rows={4} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></div><div className="space-y-1.5 md:col-span-2"><Label>Response notes</Label><Textarea rows={2} value={form.response_notes} onChange={(e) => setForm((f) => ({ ...f, response_notes: e.target.value }))} /></div><div className="md:col-span-2"><Button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save prospect'}</Button></div></div>;
}
