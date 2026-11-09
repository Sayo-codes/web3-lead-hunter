'use client';

import { useState } from 'react';
import { Filter, RotateCcw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { CHAINS } from '@/lib/chains';
import type { ProjectFilters } from '@/lib/types';

export const DEFAULT_FILTERS: ProjectFilters = { search: '', chain: 'all', age: 'all', community: 'either', sort: 'newest', page: 1, pageSize: 25, qualifiedOnly: false };

const AGES = [ ['all', 'Any age'], ['<1h', 'Less than 1 hour'], ['1-6h', '1–6 hours'], ['6-24h', '6–24 hours'], ['1-3d', '1–3 days'], ['3-7d', '3–7 days'], ['7-30d', '7–30 days'], ['>30d', 'Older than 30 days'], ['unknown', 'Unknown age'] ];
const COMMUNITIES = [ ['either', 'Telegram group OR Discord server'], ['telegram_group', 'Telegram group only'], ['discord_server', 'Discord server only'], ['both', 'Both Telegram and Discord'], ['any', 'Any / no community requirement'] ];
const SORTS = [ ['newest', 'Newest projects'], ['oldest', 'Oldest projects'], ['liquidity', 'Highest liquidity'], ['volume', 'Highest trading volume'], ['score', 'Highest qualification score'] ];
const REVIEW = [ ['all', 'Any outreach status'], ['new', 'New Lead'], ['reviewed', 'Reviewed'], ['ready_to_contact', 'Ready to Contact'], ['contacted', 'Contacted'], ['replied', 'Replied'], ['interested', 'Interested'], ['negotiating', 'Negotiating'], ['client', 'Client'], ['not_interested', 'Not Interested'] ];

export function Filters({ value, onChange }: { value: ProjectFilters; onChange: (f: ProjectFilters) => void }) {
  const [advanced, setAdvanced] = useState(false);
  const set = (patch: Partial<ProjectFilters>) => onChange({ ...value, ...patch, page: 1 });
  const num = (v: string) => (v === '' ? undefined : Number(v));
  return (
    <div className="glass-card rounded-xl border p-4">
      <div className="grid gap-3 lg:grid-cols-12">
        <div className="relative lg:col-span-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search name, symbol, or contract address…" value={value.search ?? ''} onChange={(e) => set({ search: e.target.value })} />
        </div>
        <div className="lg:col-span-2"><Select value={value.chain ?? 'all'} onValueChange={(v) => set({ chain: v as ProjectFilters['chain'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All chains</SelectItem>{CHAINS.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent></Select></div>
        <div className="lg:col-span-2"><Select value={value.age ?? 'all'} onValueChange={(v) => set({ age: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{AGES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></div>
        <div className="lg:col-span-3"><Select value={value.community ?? 'either'} onValueChange={(v) => set({ community: v as ProjectFilters['community'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{COMMUNITIES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></div>
        <div className="lg:col-span-1"><Button variant="outline" className="w-full" onClick={() => setAdvanced((a) => !a)}><Filter className="h-4 w-4" /></Button></div>
      </div>
      {advanced && (
        <div className="mt-4 grid gap-4 border-t border-border pt-4 md:grid-cols-3 xl:grid-cols-4">
          <div className="space-y-1.5"><Label>Min liquidity (USD)</Label><Input type="number" min={0} value={value.minLiquidity ?? ''} onChange={(e) => set({ minLiquidity: num(e.target.value) })} placeholder="0" /></div>
          <div className="space-y-1.5"><Label>Max liquidity (USD)</Label><Input type="number" min={0} value={value.maxLiquidity ?? ''} onChange={(e) => set({ maxLiquidity: num(e.target.value) })} placeholder="No max" /></div>
          <div className="space-y-1.5"><Label>Min 24h volume (USD)</Label><Input type="number" min={0} value={value.minVolume ?? ''} onChange={(e) => set({ minVolume: num(e.target.value) })} placeholder="0" /></div>
          <div className="space-y-1.5"><Label>Max 24h volume (USD)</Label><Input type="number" min={0} value={value.maxVolume ?? ''} onChange={(e) => set({ maxVolume: num(e.target.value) })} placeholder="No max" /></div>
          <div className="space-y-1.5"><Label>Min 24h transactions</Label><Input type="number" min={0} value={value.minTransactions ?? ''} onChange={(e) => set({ minTransactions: num(e.target.value) })} placeholder="0" /></div>
          <div className="space-y-1.5"><Label>Min qualification score</Label><Input type="number" min={0} max={100} value={value.minScore ?? ''} onChange={(e) => set({ minScore: num(e.target.value) })} placeholder="0" /></div>
          <div className="space-y-1.5"><Label>Sort by</Label><Select value={value.sort ?? 'newest'} onValueChange={(v) => set({ sort: v as ProjectFilters['sort'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SORTS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Outreach status</Label><Select value={value.reviewStatus ?? 'all'} onValueChange={(v) => set({ reviewStatus: v as ProjectFilters['reviewStatus'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{REVIEW.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Discovered after</Label><Input type="date" value={value.discoveredAfter?.slice(0, 10) ?? ''} onChange={(e) => set({ discoveredAfter: e.target.value ? new Date(e.target.value).toISOString() : undefined })} /></div>
          <div className="space-y-1.5"><Label>Discovered before</Label><Input type="date" value={value.discoveredBefore?.slice(0, 10) ?? ''} onChange={(e) => set({ discoveredBefore: e.target.value ? new Date(e.target.value + 'T23:59:59').toISOString() : undefined })} /></div>
          <div className="flex flex-col gap-2 pt-1">
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={Boolean(value.hasWebsite)} onCheckedChange={(v) => set({ hasWebsite: Boolean(v) })} /> Has website</label>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={Boolean(value.hasTelegram)} onCheckedChange={(v) => set({ hasTelegram: Boolean(v) })} /> Has Telegram link</label>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={Boolean(value.hasDiscord)} onCheckedChange={(v) => set({ hasDiscord: Boolean(v) })} /> Has Discord link</label>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={Boolean(value.qualifiedOnly)} onCheckedChange={(v) => set({ qualifiedOnly: Boolean(v) })} /> Qualified only</label>
          </div>
          <div className="flex items-end"><Button variant="ghost" onClick={() => onChange({ ...DEFAULT_FILTERS })}><RotateCcw className="h-4 w-4" /> Reset filters</Button></div>
        </div>
      )}
    </div>
  );
}
