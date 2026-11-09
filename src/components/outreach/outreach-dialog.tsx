'use client';
import { useEffect, useState } from 'react';
import useSWR, { mutate } from 'swr';
import { Copy, ExternalLink, Send, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { apiFetch, ApiError } from '@/lib/api-client';
import type { MessageTemplate, Project } from '@/lib/types';
import { bestCommunity } from '@/components/dashboard/badges';

export function OutreachDialog({ project, open, onOpenChange, onRecorded }: { project: Project; open: boolean; onOpenChange: (v: boolean) => void; onRecorded?: () => void }) {
  const { data: templates } = useSWR<MessageTemplate[]>(open ? '/api/templates' : null);
  const [templateId, setTemplateId] = useState('');
  const [platform, setPlatform] = useState(project.telegram_url ? 'telegram' : project.discord_url ? 'discord' : 'website');
  const [message, setMessage] = useState('');
  const [contactedAt, setContactedAt] = useState(new Date().toISOString().slice(0, 16));
  const [responseNotes, setResponseNotes] = useState('');
  const [force, setForce] = useState(false);
  const [duplicate, setDuplicate] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (templates && !templateId) setTemplateId(templates.find((t) => t.is_default)?.id ?? templates[0]?.id ?? ''); }, [templates, templateId]);
  const generate = async () => {
    try {
      const res = await apiFetch<{ message: string }>('/api/messages/generate', { method: 'POST', body: JSON.stringify({ projectId: project.id, templateId }) });
      setMessage(res.message);
      toast.success('Draft generated — review before contacting');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to generate message'); }
  };
  const submit = async () => {
    if (!message.trim()) { toast.error('Write or generate a message first'); return; }
    setBusy(true);
    try {
      await apiFetch(`/api/projects/${project.id}/outreach`, { method: 'POST', body: JSON.stringify({ platform, message, contacted_at: new Date(contactedAt).toISOString(), response_notes: responseNotes || null, force }) });
      toast.success('Outreach recorded');
      mutate((key) => typeof key === 'string' && key.startsWith('/api/'));
      onRecorded?.();
      onOpenChange(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) { setDuplicate(true); toast.warning('Duplicate contact protection triggered', { description: 'This project was contacted recently. Enable override only if intentional.' }); }
      else toast.error(e instanceof Error ? e.message : 'Failed to record outreach');
    } finally { setBusy(false); }
  };
  const tg = bestCommunity(project, 'telegram');
  const dc = bestCommunity(project, 'discord');
  const contactUrl = platform === 'telegram' ? tg?.normalized_url : platform === 'discord' ? dc?.normalized_url : platform === 'twitter' ? project.twitter_url : project.website;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Human-reviewed outreach — {project.name}</DialogTitle>
          <DialogDescription>No message is sent automatically. Copy the draft, contact the project through a permitted channel, then record the interaction here.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Template</Label><Select value={templateId} onValueChange={setTemplateId}><SelectTrigger><SelectValue placeholder="Select template" /></SelectTrigger><SelectContent>{(templates ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Contact platform</Label><Select value={platform} onValueChange={setPlatform}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="telegram">Telegram</SelectItem><SelectItem value="discord">Discord</SelectItem><SelectItem value="twitter">X / Twitter</SelectItem><SelectItem value="website">Website / email</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={generate}><Sparkles className="h-4 w-4" /> Generate draft</Button>
            <Button variant="outline" size="sm" onClick={async () => { await navigator.clipboard.writeText(message); toast.success('Message copied'); }} disabled={!message}><Copy className="h-4 w-4" /> Copy</Button>
            {contactUrl && <Button variant="outline" size="sm" asChild><a href={contactUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /> Open {platform}</a></Button>}
          </div>
          <div className="space-y-1.5"><Label>Message (editable)</Label><Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={9} placeholder="Generate a draft or write a personalized, permission-respecting introduction…" /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Contacted at</Label><Input type="datetime-local" value={contactedAt} onChange={(e) => setContactedAt(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Response notes (optional)</Label><Input value={responseNotes} onChange={(e) => setResponseNotes(e.target.value)} placeholder="e.g. replied, asked for portfolio" /></div>
          </div>
          {duplicate && <label className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200"><Checkbox checked={force} onCheckedChange={(v) => setForce(Boolean(v))} /> Override duplicate-contact protection (use sparingly)</label>}
          <p className="text-xs text-muted-foreground">Do not send unsolicited bulk DMs, auto-join groups/servers, or bypass platform anti-spam protections.</p>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={submit} disabled={busy}><Send className="h-4 w-4" /> {busy ? 'Recording…' : 'Record outreach'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
