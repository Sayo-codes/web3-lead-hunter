'use client';

import Link from 'next/link';
import { ExternalLink, Globe, Twitter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Project } from '@/lib/types';
import { ageLabel, formatNumber, formatUsd, timeAgo } from '@/lib/utils';
import { ChainBadge, CommunityIcon, ScoreBadge, bestCommunity } from './badges';
import { CopyAddress } from './copy-button';
import { ProjectActions } from './project-actions';

export function ProjectTable({ rows, loading, error, total, page, pageSize, onPageChange, onRetry }: { rows: Project[]; loading?: boolean; error?: Error; total: number; page: number; pageSize: number; onPageChange: (p: number) => void; onRetry: () => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (error) return <div className="glass-card rounded-xl border p-8 text-center"><p className="text-sm text-destructive">{error.message}</p><Button className="mt-4" variant="outline" onClick={onRetry}>Retry</Button></div>;
  return (
    <div className="glass-card rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="min-w-[200px]">Token</TableHead>
            <TableHead>Chain</TableHead>
            <TableHead>Contract</TableHead>
            <TableHead>Age</TableHead>
            <TableHead className="text-right">Liquidity</TableHead>
            <TableHead className="text-right">24h Volume</TableHead>
            <TableHead className="text-right">Txns</TableHead>
            <TableHead className="text-center">Web</TableHead>
            <TableHead className="text-center">X</TableHead>
            <TableHead className="text-center">Telegram</TableHead>
            <TableHead className="text-center">Discord</TableHead>
            <TableHead>Discovered</TableHead>
            <TableHead>Score</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && rows.length === 0 && Array.from({ length: 6 }).map((_, i) => <TableRow key={i}>{Array.from({ length: 14 }).map((__, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>)}
          {!loading && rows.length === 0 && (
            <TableRow><TableCell colSpan={14} className="py-16 text-center"><div className="mx-auto max-w-md"><p className="text-base font-medium">No projects match the current filters</p><p className="mt-1 text-sm text-muted-foreground">Discovery runs automatically. You can also run it now from the top bar, or relax the community/filter requirements.</p></div></TableCell></TableRow>
          )}
          {rows.map((p) => {
            const tg = bestCommunity(p, 'telegram');
            const dc = bestCommunity(p, 'discord');
            return (
              <TableRow key={p.id} className="animate-fade-in">
                <TableCell>
                  <Link href={`/projects/${p.id}`} className="flex items-center gap-3 hover:underline">
                    {p.image_url ? <img src={p.image_url} alt="" className="h-8 w-8 rounded-full border border-border object-cover" /> : <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-bold">{p.symbol.slice(0, 2)}</div>}
                    <div><div className="font-medium leading-tight">{p.name}</div><div className="text-xs text-muted-foreground">{p.symbol}</div></div>
                  </Link>
                </TableCell>
                <TableCell><ChainBadge chain={p.chain} /></TableCell>
                <TableCell><CopyAddress address={p.contract_address} /></TableCell>
                <TableCell className="whitespace-nowrap text-sm">{ageLabel(p.token_created_at)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatUsd(p.liquidity_usd)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatUsd(p.volume_24h_usd)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(p.transaction_count_24h)}</TableCell>
                <TableCell className="text-center">{p.website ? <a href={p.website} target="_blank" rel="noopener noreferrer" className="inline-flex text-muted-foreground hover:text-foreground"><Globe className="h-4 w-4" /></a> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                <TableCell className="text-center">{p.twitter_url ? <a href={p.twitter_url} target="_blank" rel="noopener noreferrer" className="inline-flex text-muted-foreground hover:text-foreground"><Twitter className="h-4 w-4" /></a> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                <TableCell className="text-center"><CommunityIcon link={tg} /></TableCell>
                <TableCell className="text-center"><CommunityIcon link={dc} /></TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground" title={p.discovered_at}>{timeAgo(p.discovered_at)}</TableCell>
                <TableCell><ScoreBadge score={p.qualification_score} qualified={p.is_qualified} /></TableCell>
                <TableCell className="text-right"><ProjectActions project={p} compact /></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-4 py-3 sm:flex-row">
        <span className="text-xs text-muted-foreground">{formatNumber(total)} projects · page {page} of {pages}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Previous</Button>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>Next</Button>
        </div>
      </div>
    </div>
  );
}
