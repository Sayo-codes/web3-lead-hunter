-- Supabase-only hardening.
-- The application uses server-side Postgres connections and Supabase Auth at the API layer.
-- Direct PostgREST access by anon/authenticated is denied. service_role bypasses RLS for server-side use.

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'api_sources','user_settings','tokens','projects','trading_pairs','social_links','community_links',
    'prospects','outreach_history','message_templates','discovery_jobs','notifications','worker_locks','provider_secrets'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;

-- No permissive policies are created for anon/authenticated: default deny.
-- If you later expose tables through PostgREST, add explicit owner-scoped policies first.
