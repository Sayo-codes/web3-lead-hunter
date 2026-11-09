'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR, { mutate } from 'swr';
import { Copy, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';
import { TEMPLATE_VARIABLES } from '@/lib/outreach/templates';
import type { MessageTemplate, Project } from '@/lib/types';

export default function TemplatesPage() {
  const { data: templates, mutate: mutateTemplates } = useSWR<MessageTemplate[]>('/api/templates');
  const { data: projectsData } = useSWR<{ rows: Project[] }>('/api/projects?pageSize=100&sort=score&community=any');
  const [editing, setEditing] = useState<Partial<MessageTemplate> | null>(null);
  const [projectId, setProjectId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [generated, setGenerated] = useState('');
  const projects = useMemo(() => projectsData?.rows ?? [], [projectsData]);
  useEffect(() => { if (!templateId && templates?.length) setTemplateId(templates.find((t) => t.is_default)?.id ?? templates[0].id); }, [templates, templateId]);
  useEffect(() => { if (!projectId && projects.length) setProjectId(projects[0].id); }, [projects, projectId]);
  const refresh = () => { mutateTemplates(); mutate((key) => typeof key === 'string' && key.startsWith('/api/')); };
  const generate = async () => { try { const res = await apiFetch<{ message: string }>('/api/messages/generate', { method: 'POST', body: JSON.stringify({ projectId, templateId }) }); setGenerated(res.message); toast.success('Personalized draft generated'); } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); } };
  const remove = async (id: string) => { if (!confirm('Delete this template?')) return; try { await apiFetch(`/api/templates/${id}`, { method: 'DELETE' }); toast.success('Template deleted'); refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); } };
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-semibold">Message templates</h1><p className="mt-1 text-sm text-muted-foreground">Create editable, personalized intros based on project facts and your services. Messages are never sent automatically.</p></div><Button onClick={() => setEditing({ name: '', subject: '', body: '', services: [], is_default: false })}><Plus className="h-4 w-4" /> New template</Button></div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="glass-card"><CardHeader><CardTitle>Templates</CardTitle></CardHeader><CardContent className="space-y-3">{(templates ?? []).map((t) => <div key={t.id} className="rounded-lg border border-border/60 p-4"><div className="flex items-start justify-between gap-2"><div><div className="font-medium">{t.name} {t.is_default && <Badge variant="success" className="ml-2">Default</Badge>}</div>{t.subject && <div className="text-xs text-muted-foreground">{t.subject}</div>}</div><div className="flex gap-1"><Button variant="ghost" size="icon" onClick={() => setEditing(t)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => remove(t.id)}><Trash2 className="h-4 w-4" /></Button></div></div><p className="mt-2 line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">{t.body}</p><div className="mt-2 flex flex-wrap gap-1">{t.services.map((s) => <Badge key={s} variant="muted">{s}</Badge>)}</div></div>)}{(templates ?? []).length === 0 && <p className="text-sm text-muted-foreground">No templates yet.</p>}</CardContent></Card>
        <Card className="glass-card"><CardHeader><CardTitle>Personalized draft generator</CardTitle></CardHeader><CardContent className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label>Project</Label><Select value={projectId} onValueChange={setProjectId}><SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger><SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.symbol})</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5"><Label>Template</Label><Select value={templateId} onValueChange={setTemplateId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(templates ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div></div><Button onClick={generate} disabled={!projectId || !templateId}><Sparkles className="h-4 w-4" /> Generate draft</Button><Textarea rows={12} value={generated} onChange={(e) => setGenerated(e.target.value)} placeholder="Generated editable draft appears here…" /><div className="flex gap-2"><Button variant="outline" disabled={!generated} onClick={async () => { await navigator.clipboard.writeText(generated); toast.success('Copied'); }}><Copy className="h-4 w-4" /> Copy draft</Button></div><div className="rounded-lg bg-secondary/40 p-3 text-xs text-muted-foreground"><div className="mb-1 font-medium text-foreground">Available variables</div><div className="flex flex-wrap gap-1">{TEMPLATE_VARIABLES.map((v) => <code key={v} className="rounded bg-background px-1.5 py-0.5">{`{{${v}}}`}</code>)}</div></div></CardContent></Card>
      </div>
      {editing && <TemplateDialog template={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />}
    </div>
  );
}

function TemplateDialog({ template, onClose, onSaved }: { template: Partial<MessageTemplate>; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: template.name ?? '', subject: template.subject ?? '', body: template.body ?? '', services: (template.services ?? []).join('\n'), is_default: template.is_default ?? false });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const payload = { name: form.name, subject: form.subject || null, body: form.body, services: form.services.split('\n').map((s) => s.trim()).filter(Boolean), is_default: form.is_default };
      if (template.id) await apiFetch(`/api/templates/${template.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      else await apiFetch('/api/templates', { method: 'POST', body: JSON.stringify(payload) });
      toast.success('Template saved'); onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); } finally { setBusy(false); }
  };
  return <Dialog open onOpenChange={(v) => !v && onClose()}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{template.id ? 'Edit template' : 'New template'}</DialogTitle></DialogHeader><div className="grid gap-3"><div className="space-y-1.5"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div><div className="space-y-1.5"><Label>Subject (optional)</Label><Input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} /></div><div className="space-y-1.5"><Label>Body</Label><Textarea rows={10} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} /></div><div className="space-y-1.5"><Label>Services (one per line)</Label><Textarea rows={4} value={form.services} onChange={(e) => setForm((f) => ({ ...f, services: e.target.value }))} /></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_default} onChange={(e) => setForm((f) => ({ ...f, is_default: e.target.checked }))} /> Default template</label></div><DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy || !form.name || !form.body}>{busy ? 'Saving…' : 'Save template'}</Button></DialogFooter></DialogContent></Dialog>;
}
