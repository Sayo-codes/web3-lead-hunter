'use client';
import { CheckCircle2, HelpCircle, Lock, MessageSquare, Send, ShieldCheck, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getChain } from '@/lib/chains';
import type { CommunityLink, Project } from '@/lib/types';
import { cn, statusLabel } from '@/lib/utils';

export function ChainBadge({ chain }: { chain: string }) {
  const cfg = getChain(chain);
  return <Badge variant="secondary" className="gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: cfg?.color ?? '#888' }} />{cfg?.label ?? chain}</Badge>;
}

export function ScoreBadge({ score, qualified }: { score: number; qualified?: boolean }) {
  const variant = score >= 70 ? 'success' : score >= 40 ? 'warning' : 'muted';
  return <Badge variant={variant} className={cn('font-semibold', qualified && 'ring-1 ring-primary/40')}>{score}/100</Badge>;
}

export function ReviewStatusBadge({ status }: { status: string }) {
  const map: Record<string, 'muted' | 'info' | 'warning' | 'success' | 'destructive' | 'secondary'> = {
    new: 'muted', reviewed: 'info', ready_to_contact: 'warning', contacted: 'info', replied: 'success', interested: 'success', negotiating: 'warning', client: 'success', not_interested: 'destructive',
    new_lead: 'muted',
  };
  return <Badge variant={map[status] ?? 'secondary'}>{statusLabel(status)}</Badge>;
}

export function CommunityIcon({ link, size = 'sm' }: { link?: CommunityLink | null; size?: 'sm' | 'md' }) {
  if (!link) return <span className="text-xs text-muted-foreground">—</span>;
  const Icon = link.platform === 'telegram' ? Send : MessageSquare;
  const ok = link.validation_status === 'verified' || link.validation_status === 'accessible';
  const bad = link.validation_status === 'invalid' || link.validation_status === 'restricted' || link.validation_status === 'error';
  const label = `${link.platform === 'telegram' ? 'Telegram' : 'Discord'} ${link.community_type.replace('_', ' ')} · ${link.validation_status}${link.is_verified ? ' (verified)' : ''}`;
  return (
    <a href={link.normalized_url} target="_blank" rel="noopener noreferrer" title={label} className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-secondary', ok ? 'text-emerald-300' : bad ? 'text-red-300' : 'text-muted-foreground')}>
      <Icon className={size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} />
      {link.is_verified ? <ShieldCheck className="h-3 w-3" /> : ok ? <CheckCircle2 className="h-3 w-3" /> : bad ? <XCircle className="h-3 w-3" /> : link.community_type === 'private_invite' ? <Lock className="h-3 w-3" /> : <HelpCircle className="h-3 w-3" />}
    </a>
  );
}

export function bestCommunity(project: Project, platform: 'telegram' | 'discord'): CommunityLink | null {
  const links = (project.community_links ?? []).filter((l) => l.platform === platform);
  if (links.length === 0) {
    const url = platform === 'telegram' ? project.telegram_url : project.discord_url;
    return url ? ({ id: '', project_id: project.id, social_link_id: null, platform, url, normalized_url: url, community_type: platform === 'discord' ? 'server' : 'unknown', validation_status: 'unverified', verification_method: null, is_verified: false, member_count: null, title: null, invite_code: null, last_checked_at: null, next_check_at: null, error: null, raw_evidence: {} } as CommunityLink) : null;
  }
  const rank = (l: CommunityLink) => (l.community_type === 'group' || l.community_type === 'server' ? 10 : 0) + (l.validation_status === 'verified' ? 5 : l.validation_status === 'accessible' ? 3 : 0) + (l.is_verified ? 2 : 0);
  return links.sort((a, b) => rank(b) - rank(a))[0];
}
