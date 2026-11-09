import { publicConfig } from '@/lib/config';
import { getApiSources, getSettings, setSourceEnabled, updateSettings } from '@/lib/db/repository';
import { fail, ok } from '@/lib/server/api';
import { requireUser } from '@/lib/server/auth';
import { deleteProviderSecret, getSecretStatuses, setProviderSecret } from '@/lib/server/secrets';
import { settingsPutSchema } from '@/lib/server/validation';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function payload() {
  return { settings: await getSettings(), publicConfig: publicConfig(), secrets: await getSecretStatuses(), sources: await getApiSources() };
}
export async function GET() {
  const auth = await requireUser(); if (!auth.ok) return auth.response;
  return ok(await payload());
}
export async function PUT(req: Request) {
  const auth = await requireUser(); if (!auth.ok) return auth.response;
  const parsed = settingsPutSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('Invalid settings payload', 422, { issues: parsed.error.flatten() });
  try {
    if (parsed.data.settings) await updateSettings(parsed.data.settings as any);
    if (parsed.data.secrets) for (const [id, value] of Object.entries(parsed.data.secrets)) await setProviderSecret(id, value);
    if (parsed.data.deleteSecrets) for (const id of parsed.data.deleteSecrets) await deleteProviderSecret(id);
    if (parsed.data.sources) for (const s of parsed.data.sources) await setSourceEnabled(s.id, s.enabled);
    return ok(await payload());
  } catch (e) { return fail(e instanceof Error ? e.message : 'Failed to save settings', 500); }
}
