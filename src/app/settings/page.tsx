'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { KeyRound, Save, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';
import { CHAINS } from '@/lib/chains';
import type { ApiSource, ChainId, UserSettings } from '@/lib/types';

interface SecretStatus { id: string; envName: string; envConfigured: boolean; storedConfigured: boolean; configured: boolean }
interface SettingsPayload { settings: UserSettings; publicConfig: { dbMode: string; supabaseAuth: boolean; secretsStorageEnabled: boolean; geckoUsePaid: boolean; telegramPublicPageChecks: boolean; discordInviteChecks: boolean }; secrets: SecretStatus[]; sources: ApiSource[] }

export default function SettingsPage() {
  const { data, mutate } = useSWR<SettingsPayload>('/api/settings');
  const [form, setForm] = useState<UserSettings | null>(null);
  const [services, setServices] = useState('');
  const [secretInputs, setSecretInputs] = useState<Record<string, string>>({});
  const [sources, setSources] = useState<ApiSource[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) { setForm(data.settings); setServices(data.settings.owner_services.join('\n')); setSources(data.sources); } }, [data]);
  if (!form || !data) return <div className="text-sm text-muted-foreground">Loading settings…</div>;
  const set = (patch: Partial<UserSettings>) => setForm((f) => f ? { ...f, ...patch } : f);
  const num = (v: string) => v === '' ? 0 : Number(v);
  const nullableNum = (v: string) => v === '' ? null : Number(v);
  const save = async () => {
    setBusy(true);
    try {
      const secrets: Record<string, string> = {};
      for (const [k, v] of Object.entries(secretInputs)) if (v.trim()) secrets[k] = v.trim();
      await apiFetch('/api/settings', { method: 'PUT', body: JSON.stringify({ settings: { ...form, owner_services: services.split('\n').map((s) => s.trim()).filter(Boolean) }, secrets, sources: sources.map((s) => ({ id: s.id, enabled: s.enabled })) }) });
      toast.success('Settings saved'); setSecretInputs({}); mutate();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to save settings'); } finally { setBusy(false); }
  };
  const deleteSecret = async (id: string) => { try { await apiFetch('/api/settings', { method: 'PUT', body: JSON.stringify({ deleteSecrets: [id] }) }); toast.success('Stored secret removed'); mutate(); } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); } };
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-semibold">Settings</h1><p className="mt-1 text-sm text-muted-foreground">Configure discovery, qualification, communities, refresh, notifications, and provider credentials. Secrets are never exposed to the frontend.</p></div><Button onClick={save} disabled={busy}><Save className="h-4 w-4" /> {busy ? 'Saving…' : 'Save settings'}</Button></div>
      <Card className="glass-card"><CardContent className="flex flex-wrap items-center gap-3 p-4 text-sm"><Badge variant={data.publicConfig.dbMode === 'supabase' ? 'success' : 'info'}>{data.publicConfig.dbMode === 'supabase' ? 'Supabase production mode' : 'Local PGlite development mode'}</Badge><Badge variant={data.publicConfig.supabaseAuth ? 'success' : 'muted'}>{data.publicConfig.supabaseAuth ? 'Supabase Auth enabled' : 'Local dev owner (no login)'}</Badge><span className="text-muted-foreground">Local mode uses real provider APIs and persists to .data/pglite. For production, configure Supabase and run the dedicated worker.</span></CardContent></Card>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="glass-card"><CardHeader><CardTitle>Discovery & providers</CardTitle><CardDescription>Scheduled ingestion and rate-limit-friendly defaults.</CardDescription></CardHeader><CardContent className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Discovery frequency (minutes)"><Input type="number" min={1} max={1440} value={form.discovery_interval_minutes} onChange={(e) => set({ discovery_interval_minutes: num(e.target.value) })} /></Field><Field label="GeckoTerminal new-pool pages (1–10)"><Input type="number" min={1} max={10} value={form.gecko_max_pages} onChange={(e) => set({ gecko_max_pages: num(e.target.value) })} /></Field><Field label="DEX enrichment batch size (≤30)"><Input type="number" min={1} max={30} value={form.dex_enrichment_batch_size} onChange={(e) => set({ dex_enrichment_batch_size: num(e.target.value) })} /></Field><Field label="Community check TTL (hours)"><Input type="number" min={1} max={168} value={form.community_check_ttl_hours} onChange={(e) => set({ community_check_ttl_hours: num(e.target.value) })} /></Field></div>
          <Toggle label="GeckoTerminal per-chain new pools (higher rate usage; recommended only with paid key)" checked={form.gecko_per_chain} onChange={(v) => set({ gecko_per_chain: v })} />
          <Separator /><div><Label className="mb-2 block">Supported chains</Label><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{CHAINS.map((c) => <label key={c.id} className="flex items-center gap-2 text-sm"><Checkbox checked={form.enabled_chains.includes(c.id)} onCheckedChange={(v) => set({ enabled_chains: v ? [...form.enabled_chains, c.id] : form.enabled_chains.filter((x) => x !== c.id) })} /> {c.label}</label>)}</div></div>
          <Separator /><div><Label className="mb-2 block">Data sources</Label><div className="space-y-2">{sources.map((s) => <div key={s.id} className="flex items-center justify-between rounded-lg border border-border/60 p-3"><div><div className="text-sm font-medium">{s.name}</div><div className="text-xs text-muted-foreground">{s.health_status} · {s.rate_limit_per_min}/min</div></div><Switch checked={s.enabled} onCheckedChange={(v) => setSources((arr) => arr.map((x) => x.id === s.id ? { ...x, enabled: v } : x))} /></div>)}</div></div>
        </CardContent></Card>
        <Card className="glass-card"><CardHeader><CardTitle>Qualification filters</CardTitle><CardDescription>Transparent lead criteria. High volume alone is not treated as service need.</CardDescription></CardHeader><CardContent className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Min liquidity (USD)"><Input type="number" value={form.min_liquidity_usd} onChange={(e) => set({ min_liquidity_usd: num(e.target.value) })} /></Field><Field label="Max liquidity (USD)"><Input type="number" value={form.max_liquidity_usd ?? ''} onChange={(e) => set({ max_liquidity_usd: nullableNum(e.target.value) })} placeholder="No max" /></Field><Field label="Min 24h volume (USD)"><Input type="number" value={form.min_volume_24h_usd} onChange={(e) => set({ min_volume_24h_usd: num(e.target.value) })} /></Field><Field label="Max 24h volume (USD)"><Input type="number" value={form.max_volume_24h_usd ?? ''} onChange={(e) => set({ max_volume_24h_usd: nullableNum(e.target.value) })} placeholder="No max" /></Field><Field label="Min 24h transactions"><Input type="number" value={form.min_transactions_24h} onChange={(e) => set({ min_transactions_24h: num(e.target.value) })} /></Field><Field label="Max token age (hours)"><Input type="number" value={form.max_token_age_hours} onChange={(e) => set({ max_token_age_hours: num(e.target.value) })} /></Field><Field label="Min qualification score"><Input type="number" min={0} max={100} value={form.min_qualification_score} onChange={(e) => set({ min_qualification_score: num(e.target.value) })} /></Field><Field label="Duplicate-contact window (hours)"><Input type="number" value={form.duplicate_contact_window_hours} onChange={(e) => set({ duplicate_contact_window_hours: num(e.target.value) })} /></Field></div>
          <Toggle label="Include projects with unknown age" checked={form.include_unknown_age} onChange={(v) => set({ include_unknown_age: v })} />
          <Field label="Community requirement"><Select value={form.community_requirement} onValueChange={(v) => set({ community_requirement: v as UserSettings['community_requirement'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="either">Either Telegram group or Discord server (default)</SelectItem><SelectItem value="telegram_group">Telegram group only</SelectItem><SelectItem value="discord_server">Discord server only</SelectItem><SelectItem value="both">Both</SelectItem><SelectItem value="any">Any / no requirement</SelectItem></SelectContent></Select></Field>
          <Toggle label="Require accessible community (verified or public hint)" checked={form.require_accessible_community} onChange={(v) => set({ require_accessible_community: v })} />
          <Toggle label="Include unverified Telegram private invites" checked={form.include_unverified_telegram_invites} onChange={(v) => set({ include_unverified_telegram_invites: v })} />
        </CardContent></Card>
        <Card className="glass-card"><CardHeader><CardTitle>Dashboard & notifications</CardTitle></CardHeader><CardContent className="grid gap-4"><Toggle label="Auto-refresh dashboard" checked={form.auto_refresh_dashboard} onChange={(v) => set({ auto_refresh_dashboard: v })} /><Field label="Dashboard refresh interval (seconds)"><Input type="number" min={5} max={3600} value={form.dashboard_refresh_seconds} onChange={(e) => set({ dashboard_refresh_seconds: num(e.target.value) })} /></Field><Toggle label="Enable in-dashboard notifications" checked={form.notifications_enabled} onChange={(v) => set({ notifications_enabled: v })} /><Toggle label="Notify on new qualified project" checked={form.notify_qualified} onChange={(v) => set({ notify_qualified: v })} /><Toggle label="Notify when both Telegram and Discord are found" checked={form.notify_both_communities} onChange={(v) => set({ notify_both_communities: v })} /></CardContent></Card>
        <Card className="glass-card"><CardHeader><CardTitle>Owner profile & services</CardTitle><CardDescription>Used to personalize editable outreach drafts.</CardDescription></CardHeader><CardContent className="grid gap-4"><Field label="Your name / studio"><Input value={form.owner_name} onChange={(e) => set({ owner_name: e.target.value })} placeholder="e.g. Alex · Web3 Studio" /></Field><Field label="Contact email"><Input type="email" value={form.contact_email} onChange={(e) => set({ contact_email: e.target.value })} /></Field><Field label="Services (one per line)"><Textarea rows={8} value={services} onChange={(e) => setServices(e.target.value)} /></Field></CardContent></Card>
      </div>
      <Card className="glass-card"><CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> API keys & secrets</CardTitle><CardDescription>Secrets are stored server-side. Prefer environment variables in production. UI storage uses AES-256-GCM when SECRETS_ENCRYPTION_KEY is set.</CardDescription></CardHeader><CardContent className="space-y-4">
        {!data.publicConfig.secretsStorageEnabled && <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">UI secret storage is disabled. Set SECRETS_ENCRYPTION_KEY (openssl rand -hex 32) or configure credentials via server environment variables.</div>}
        {data.secrets.map((s) => <div key={s.id} className="grid gap-3 rounded-lg border border-border/60 p-4 md:grid-cols-[1fr_1fr_auto] md:items-end"><div><div className="text-sm font-medium">{s.id === 'coingecko' ? 'CoinGecko / GeckoTerminal paid key' : 'Telegram Bot API token'}</div><div className="mt-1 text-xs text-muted-foreground">Env: <code>{s.envName}</code> · {s.configured ? <Badge variant="success" className="ml-1"><ShieldCheck className="mr-1 h-3 w-3" /> Configured</Badge> : <Badge variant="muted" className="ml-1">Not configured</Badge>}</div><p className="mt-1 text-xs text-muted-foreground">{s.id === 'coingecko' ? 'Optional. Keyless GeckoTerminal works for development; paid onchain access is recommended for production.' : 'Optional. Only verifies chats the bot already has access to. Never auto-joins groups.'}</p></div><Input type="password" placeholder={data.publicConfig.secretsStorageEnabled ? 'Enter new secret to store encrypted' : 'Disabled — use environment variable'} disabled={!data.publicConfig.secretsStorageEnabled} value={secretInputs[s.id] ?? ''} onChange={(e) => setSecretInputs((m) => ({ ...m, [s.id]: e.target.value }))} /><Button variant="outline" disabled={!s.storedConfigured} onClick={() => deleteSecret(s.id)}>Remove stored</Button></div>)}
        <div className="text-xs text-muted-foreground">Discord invite validation uses the public official invite API and needs no bot token. Telegram public-page hints can be toggled via TELEGRAM_PUBLIC_PAGE_CHECKS. DEX Screener requires no key.</div>
      </CardContent></Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) { return <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3"><span className="text-sm">{label}</span><Switch checked={checked} onCheckedChange={onChange} /></div>; }
