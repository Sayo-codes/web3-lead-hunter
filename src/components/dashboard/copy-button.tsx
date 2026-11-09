'use client';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { shortAddress } from '@/lib/utils';
export function CopyAddress({ address, showShort = true }: { address: string; showShort?: boolean }) {
  const copy = async () => {
    try { await navigator.clipboard.writeText(address); toast.success('Contract address copied'); }
    catch { toast.error('Clipboard unavailable'); }
  };
  return <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 font-mono text-xs text-muted-foreground" onClick={copy} title={address}>{showShort ? shortAddress(address) : 'Copy'}<Copy className="h-3 w-3" /></Button>;
}
