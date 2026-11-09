-- Web3 Lead Hunter core schema.
-- Compatible with Supabase PostgreSQL and local PGlite development mode.
-- No fake project data is seeded. Only configuration, provider registry, and default message templates.

CREATE TABLE IF NOT EXISTS api_sources (
  id text PRIMARY KEY,
  name text NOT NULL,
  base_url text,
  enabled boolean NOT NULL DEFAULT true,
  rate_limit_per_min integer NOT NULL DEFAULT 30,
  health_status text NOT NULL DEFAULT 'unknown' CHECK (health_status IN ('unknown','healthy','degraded','down')),
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error text,
  last_status_code integer,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_settings (
  id text PRIMARY KEY DEFAULT 'default',
  discovery_interval_minutes integer NOT NULL DEFAULT 3 CHECK (discovery_interval_minutes BETWEEN 1 AND 1440),
  enabled_chains text[] NOT NULL DEFAULT ARRAY['ethereum','base','solana','bsc','arbitrum','optimism','polygon','avalanche'],
  min_liquidity_usd numeric NOT NULL DEFAULT 0,
  max_liquidity_usd numeric,
  min_volume_24h_usd numeric NOT NULL DEFAULT 0,
  max_volume_24h_usd numeric,
  min_transactions_24h integer NOT NULL DEFAULT 0,
  max_token_age_hours integer NOT NULL DEFAULT 720,
  include_unknown_age boolean NOT NULL DEFAULT true,
  min_qualification_score integer NOT NULL DEFAULT 40 CHECK (min_qualification_score BETWEEN 0 AND 100),
  community_requirement text NOT NULL DEFAULT 'either' CHECK (community_requirement IN ('telegram_group','discord_server','both','either','any')),
  require_accessible_community boolean NOT NULL DEFAULT true,
  include_unverified_telegram_invites boolean NOT NULL DEFAULT false,
  auto_refresh_dashboard boolean NOT NULL DEFAULT true,
  dashboard_refresh_seconds integer NOT NULL DEFAULT 30 CHECK (dashboard_refresh_seconds BETWEEN 5 AND 3600),
  notifications_enabled boolean NOT NULL DEFAULT true,
  notify_qualified boolean NOT NULL DEFAULT true,
  notify_both_communities boolean NOT NULL DEFAULT true,
  gecko_max_pages integer NOT NULL DEFAULT 1 CHECK (gecko_max_pages BETWEEN 1 AND 10),
  gecko_per_chain boolean NOT NULL DEFAULT false,
  dex_enrichment_batch_size integer NOT NULL DEFAULT 30 CHECK (dex_enrichment_batch_size BETWEEN 1 AND 30),
  community_check_ttl_hours integer NOT NULL DEFAULT 6 CHECK (community_check_ttl_hours BETWEEN 1 AND 168),
  duplicate_contact_window_hours integer NOT NULL DEFAULT 168,
  owner_name text NOT NULL DEFAULT '',
  owner_services text[] NOT NULL DEFAULT ARRAY['Smart contract development','Solidity development','Frontend development','Full-stack Web3 development','DApp development','Smart contract integrations','Telegram bot development','Discord bot development','Smart contract security reviews','Web3 project development and maintenance'],
  contact_email text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain text NOT NULL,
  contract_address text NOT NULL,
  contract_address_key text NOT NULL,
  name text,
  symbol text,
  decimals integer,
  image_url text,
  description text,
  coingecko_coin_id text,
  gt_score numeric,
  metadata_source text,
  metadata_updated_at timestamptz,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_metadata_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chain, contract_address_key)
);

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL UNIQUE REFERENCES tokens(id) ON DELETE CASCADE,
  chain text NOT NULL,
  contract_address text NOT NULL,
  contract_address_key text NOT NULL,
  name text NOT NULL DEFAULT 'Unknown token',
  symbol text NOT NULL DEFAULT '?',
  description text,
  website text,
  twitter_url text,
  telegram_url text,
  discord_url text,
  github_url text,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  token_created_at timestamptz,
  liquidity_usd numeric,
  volume_24h_usd numeric,
  transaction_count_24h integer,
  buys_24h integer,
  sells_24h integer,
  market_cap_usd numeric,
  fdv_usd numeric,
  price_usd numeric,
  pair_count integer NOT NULL DEFAULT 0,
  primary_pair_address text,
  primary_dex text,
  qualification_score integer NOT NULL DEFAULT 0 CHECK (qualification_score BETWEEN 0 AND 100),
  qualification_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_qualified boolean NOT NULL DEFAULT false,
  review_status text NOT NULL DEFAULT 'new' CHECK (review_status IN ('new','reviewed','ready_to_contact','contacted','replied','interested','negotiating','client','not_interested')),
  has_telegram_group boolean NOT NULL DEFAULT false,
  has_discord_server boolean NOT NULL DEFAULT false,
  has_accessible_community boolean NOT NULL DEFAULT false,
  market_data_source text,
  metadata_source text,
  data_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_market_update_at timestamptz,
  last_enriched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chain, contract_address_key)
);

CREATE INDEX IF NOT EXISTS idx_projects_chain ON projects(chain);
CREATE INDEX IF NOT EXISTS idx_projects_discovered_at ON projects(discovered_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_score ON projects(qualification_score DESC);
CREATE INDEX IF NOT EXISTS idx_projects_liquidity ON projects(liquidity_usd DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_projects_volume ON projects(volume_24h_usd DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_projects_review_status ON projects(review_status);
CREATE INDEX IF NOT EXISTS idx_projects_qualified ON projects(is_qualified) WHERE is_qualified = true;
CREATE INDEX IF NOT EXISTS idx_projects_community ON projects(has_telegram_group, has_discord_server);
CREATE INDEX IF NOT EXISTS idx_projects_token_created ON projects(token_created_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_projects_name_search ON projects USING gin (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(symbol,'')));

CREATE TABLE IF NOT EXISTS trading_pairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  chain text NOT NULL,
  pair_address text NOT NULL,
  pair_address_key text NOT NULL,
  dex_id text,
  base_token_address text,
  quote_token_address text,
  quote_symbol text,
  price_usd numeric,
  liquidity_usd numeric,
  volume_24h_usd numeric,
  transaction_count_24h integer,
  buys_24h integer,
  sells_24h integer,
  pair_created_at timestamptz,
  fdv_usd numeric,
  market_cap_usd numeric,
  source text NOT NULL,
  source_url text,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chain, pair_address_key)
);

CREATE INDEX IF NOT EXISTS idx_trading_pairs_project ON trading_pairs(project_id);
CREATE INDEX IF NOT EXISTS idx_trading_pairs_chain ON trading_pairs(chain);
CREATE INDEX IF NOT EXISTS idx_trading_pairs_created ON trading_pairs(pair_created_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS social_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('website','twitter','github','telegram','discord','docs','other')),
  url text NOT NULL,
  label text,
  source text,
  source_kind text NOT NULL DEFAULT 'metadata_extracted' CHECK (source_kind IN ('api','metadata_extracted')),
  discovered_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, platform, url)
);

CREATE INDEX IF NOT EXISTS idx_social_links_project ON social_links(project_id);
CREATE INDEX IF NOT EXISTS idx_social_links_platform ON social_links(platform);

CREATE TABLE IF NOT EXISTS community_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  social_link_id uuid REFERENCES social_links(id) ON DELETE SET NULL,
  platform text NOT NULL CHECK (platform IN ('telegram','discord')),
  url text NOT NULL,
  normalized_url text NOT NULL,
  community_type text NOT NULL DEFAULT 'unknown' CHECK (community_type IN ('group','channel','private_invite','server','unknown')),
  validation_status text NOT NULL DEFAULT 'unknown' CHECK (validation_status IN ('unknown','unverified','accessible','verified','invalid','restricted','error')),
  verification_method text,
  is_verified boolean NOT NULL DEFAULT false,
  member_count integer,
  title text,
  invite_code text,
  last_checked_at timestamptz,
  next_check_at timestamptz,
  error text,
  raw_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, platform, normalized_url)
);

CREATE INDEX IF NOT EXISTS idx_community_links_project ON community_links(project_id);
CREATE INDEX IF NOT EXISTS idx_community_links_status ON community_links(validation_status);
CREATE INDEX IF NOT EXISTS idx_community_links_type ON community_links(platform, community_type);
CREATE INDEX IF NOT EXISTS idx_community_links_next_check ON community_links(next_check_at NULLS FIRST);

CREATE TABLE IF NOT EXISTS prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'new_lead' CHECK (status IN ('new_lead','reviewed','ready_to_contact','contacted','replied','interested','negotiating','client','not_interested')),
  notes text NOT NULL DEFAULT '',
  contact_platform text,
  contacted_at timestamptz,
  responded_at timestamptz,
  response_notes text NOT NULL DEFAULT '',
  opportunity_status text NOT NULL DEFAULT 'open' CHECK (opportunity_status IN ('open','successful','unsuccessful')),
  next_follow_up_at timestamptz,
  saved_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prospects_status ON prospects(status);
CREATE INDEX IF NOT EXISTS idx_prospects_opportunity ON prospects(opportunity_status);

CREATE TABLE IF NOT EXISTS outreach_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  prospect_id uuid REFERENCES prospects(id) ON DELETE SET NULL,
  platform text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'contacted',
  contacted_at timestamptz NOT NULL DEFAULT now(),
  response_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outreach_project ON outreach_history(project_id, contacted_at DESC);
CREATE INDEX IF NOT EXISTS idx_outreach_prospect ON outreach_history(prospect_id);

CREATE TABLE IF NOT EXISTS message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  subject text,
  body text NOT NULL,
  services text[] NOT NULL DEFAULT ARRAY[]::text[],
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS discovery_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','completed_with_errors','failed','cancelled')),
  trigger_source text NOT NULL DEFAULT 'scheduled' CHECK (trigger_source IN ('scheduled','manual','startup')),
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  duration_ms integer,
  projects_created integer NOT NULL DEFAULT 0,
  projects_updated integer NOT NULL DEFAULT 0,
  pairs_upserted integer NOT NULL DEFAULT 0,
  links_found integer NOT NULL DEFAULT 0,
  links_validated integer NOT NULL DEFAULT 0,
  provider_stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  logs jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_discovery_jobs_status ON discovery_jobs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discovery_jobs_created ON discovery_jobs(created_at DESC);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(read_at) WHERE read_at IS NULL;

CREATE TABLE IF NOT EXISTS worker_locks (
  id text PRIMARY KEY,
  locked_until timestamptz NOT NULL,
  locked_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS provider_secrets (
  id text PRIMARY KEY,
  encrypted_value text NOT NULL,
  iv text NOT NULL,
  auth_tag text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
