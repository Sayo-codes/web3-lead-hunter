'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { Crosshair } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/browser';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { data: health } = useSWR<{ config: { supabaseAuth: boolean } }>('/api/health');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [busy, setBusy] = useState(false);
  const authEnabled = health?.config?.supabaseAuth ?? false;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEnabled) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = mode === 'signin' ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password });
      if (error) throw error;
      toast.success(mode === 'signin' ? 'Signed in' : 'Account created. Check email confirmation if enabled.');
      router.push(params.get('next') || '/');
      router.refresh();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Authentication failed'); } finally { setBusy(false); }
  };
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="pointer-events-none fixed inset-0 grid-bg opacity-20" />
      <Card className="relative w-full max-w-md glass-card">
        <CardHeader className="text-center"><div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 text-black"><Crosshair className="h-6 w-6" /></div><CardTitle>Web3 Lead Hunter</CardTitle><CardDescription>Single-owner prospecting workspace</CardDescription></CardHeader>
        <CardContent>
          {!authEnabled ? <div className="space-y-4 text-sm text-muted-foreground"><p>This instance is running in local development mode without Supabase Auth. The dashboard is available directly.</p><Button asChild className="w-full"><Link href="/">Open dashboard</Link></Button></div> : <form onSubmit={submit} className="space-y-4"><div className="space-y-1.5"><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div><div className="space-y-1.5"><Label>Password</Label><Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div><Button type="submit" className="w-full" disabled={busy}>{busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}</Button><button type="button" className="w-full text-center text-xs text-muted-foreground hover:text-foreground" onClick={() => setMode((m) => m === 'signin' ? 'signup' : 'signin')}>{mode === 'signin' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}</button><p className="text-center text-[11px] text-muted-foreground">If OWNER_EMAIL is set, only that account can access the API.</p></form>}
        </CardContent>
      </Card>
    </div>
  );
}
