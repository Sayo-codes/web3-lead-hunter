import { NextResponse } from 'next/server';
import { isSupabaseAuthEnabled } from '@/lib/config';
import { createClient } from '@/lib/supabase/server';
import { ensureInProcessWorker } from './worker-init';

export interface AuthUser {
  id: string;
  email: string | null;
  mode: 'local' | 'supabase';
}

export async function getUser(): Promise<AuthUser | null> {
  ensureInProcessWorker();
  if (!isSupabaseAuthEnabled()) {
    return { id: 'local-dev-owner', email: 'local@dev.invalid', mode: 'local' };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const ownerEmail = process.env.OWNER_EMAIL;
  if (ownerEmail && data.user.email && data.user.email.toLowerCase() !== ownerEmail.toLowerCase()) return null;
  return { id: data.user.id, email: data.user.email ?? null, mode: 'supabase' };
}

export async function requireUser(): Promise<{ ok: true; user: AuthUser } | { ok: false; response: NextResponse }> {
  const user = await getUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { ok: true, user };
}
