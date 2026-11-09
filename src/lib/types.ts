export type ChainId =
  | 'ethereum'
  | 'base'
  | 'solana'
  | 'bsc'
  | 'arbitrum'
  | 'optimism'
  | 'polygon'
  | 'avalanche';

export type SocialPlatform = 'website' | 'twitter' | 'github' | 'telegram' | 'discord' | 'docs' | 'other';
export type CommunityPlatform = 'telegram' | 'discord';
export type CommunityType = 'group' | 'channel' | 'private_invite' | 'server' | 'unknown';
export type ValidationStatus = 'unknown' | 'unverified' | 'accessible' | 'verified' | 'invalid' | 'restricted' | 'error';
export type ReviewStatus =
  | 'new'
  | 'reviewed'
  | 'ready_to_contact'
  | 'contacted'
  | 'replied'
  | 'interested'
  | 'negotiating'
  | 'client'
  | 'not_interested';
export type ProspectStatus =
  | 'new_lead'
  | 'reviewed'
  | 'ready_to_contact'
  | 'contacted'
  | 'replied'
  | 'interested'
  | 'negotiating'
  | 'client'
  | 'not_interested';
export type CommunityRequirement = 'telegram_group' | 'discord_server' | 'both' | 'either' | 'any';

export interface ChainConfig {
  id: ChainId;
  label: string;
  short: string;
  dexChainId: string;
  geckoNetwork: string;
  evm: boolean;
  explorer: string;
  color: string;
}

export interface UserSettings {
  id: string;
  discovery_interval_minutes: number;
  enabled_chains: ChainId[];
  min_liquidity_usd: number;
  max_liquidity_usd: number | null;
  min_volume_24h_usd: number;
  max_volume_24h_usd: number | null;
  min_transactions_24h: number;
  max_token_age_hours: number;
  include_unknown_age: boolean;
  min_qualification_score: number;
  community_requirement: CommunityRequirement;
  require_accessible_community: boolean;
  include_unverified_telegram_invites: boolean;
  auto_refresh_dashboard: boolean;
  dashboard_refresh_seconds: number;
  notifications_enabled: boolean;
  notify_qualified: boolean;
  notify_both_communities: boolean;
  gecko_max_pages: number;
  gecko_per_chain: boolean;
  dex_enrichment_batch_size: number;
  community_check_ttl_hours: number;
  duplicate_contact_window_hours: number;
  owner_name: string;
  owner_services: string[];
  contact_email: string;
  updated_at: string;
}

export interface QualificationReason {
  code: string;
  label: string;
  points: number;
  detail: string;
}

export interface Project {
  id: string;
  token_id: string;
  chain: ChainId;
  contract_address: string;
  contract_address_key: string;
  name: string;
  symbol: string;
  description: string | null;
  website: string | null;
  twitter_url: string | null;
  telegram_url: string | null;
  discord_url: string | null;
  github_url: string | null;
  discovered_at: string;
  token_created_at: string | null;
  liquidity_usd: number | null;
  volume_24h_usd: number | null;
  transaction_count_24h: number | null;
  buys_24h: number | null;
  sells_24h: number | null;
  market_cap_usd: number | null;
  fdv_usd: number | null;
  price_usd: number | null;
  pair_count: number;
  primary_pair_address: string | null;
  primary_dex: string | null;
  qualification_score: number;
  qualification_reasons: QualificationReason[];
  is_qualified: boolean;
  review_status: ReviewStatus;
  has_telegram_group: boolean;
  has_discord_server: boolean;
  has_accessible_community: boolean;
  market_data_source: string | null;
  metadata_source: string | null;
  data_flags: Record<string, unknown>;
  last_market_update_at: string | null;
  last_enriched_at: string | null;
  created_at: string;
  updated_at: string;
  image_url?: string | null;
  prospect?: Prospect | null;
  community_links?: CommunityLink[];
  social_links?: SocialLink[];
  trading_pairs?: TradingPair[];
  outreach_history?: OutreachHistory[];
}

export interface TradingPair {
  id: string;
  project_id: string;
  chain: ChainId;
  pair_address: string;
  dex_id: string | null;
  quote_symbol: string | null;
  price_usd: number | null;
  liquidity_usd: number | null;
  volume_24h_usd: number | null;
  transaction_count_24h: number | null;
  buys_24h: number | null;
  sells_24h: number | null;
  pair_created_at: string | null;
  fdv_usd: number | null;
  market_cap_usd: number | null;
  source: string;
  source_url: string | null;
  last_updated_at: string;
}

export interface SocialLink {
  id: string;
  project_id: string;
  platform: SocialPlatform;
  url: string;
  label: string | null;
  source: string | null;
  source_kind: 'api' | 'metadata_extracted';
  discovered_at: string;
  last_seen_at: string;
}

export interface CommunityLink {
  id: string;
  project_id: string;
  social_link_id: string | null;
  platform: CommunityPlatform;
  url: string;
  normalized_url: string;
  community_type: CommunityType;
  validation_status: ValidationStatus;
  verification_method: string | null;
  is_verified: boolean;
  member_count: number | null;
  title: string | null;
  invite_code: string | null;
  last_checked_at: string | null;
  next_check_at: string | null;
  error: string | null;
  raw_evidence: Record<string, unknown>;
}

export interface Prospect {
  id: string;
  project_id: string;
  status: ProspectStatus;
  notes: string;
  contact_platform: string | null;
  contacted_at: string | null;
  responded_at: string | null;
  response_notes: string;
  opportunity_status: 'open' | 'successful' | 'unsuccessful';
  next_follow_up_at: string | null;
  saved_at: string;
  updated_at: string;
  project?: Project;
}

export interface OutreachHistory {
  id: string;
  project_id: string;
  prospect_id: string | null;
  platform: string | null;
  message: string;
  status: string;
  contacted_at: string;
  response_notes: string | null;
  created_at: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  subject: string | null;
  body: string;
  services: string[];
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface DiscoveryJob {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'completed_with_errors' | 'failed' | 'cancelled';
  trigger_source: 'scheduled' | 'manual' | 'startup';
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  projects_created: number;
  projects_updated: number;
  pairs_upserted: number;
  links_found: number;
  links_validated: number;
  provider_stats: Record<string, unknown>;
  error: string | null;
  logs: Array<{ at: string; level: string; message: string }>;
  locked_by?: string | null;
  heartbeat_at?: string | null;
  retry_count?: number;
  max_retries?: number;
}

export interface WorkerHeartbeat {
  worker_id: string;
  worker_mode: 'in_process' | 'standalone';
  status: 'idle' | 'processing' | 'stopping' | 'stopped';
  current_job_id: string | null;
  last_heartbeat_at: string;
  started_at: string;
  consecutive_failures: number;
  last_error: string | null;
  metadata: Record<string, unknown>;
  updated_at: string;
}

export type OverallWorkerStatus = 'running' | 'idle' | 'processing' | 'unavailable' | 'error';

export interface WorkerHealth {
  status: OverallWorkerStatus;
  active_workers: number;
  workers: Array<{
    worker_id: string;
    worker_mode: 'in_process' | 'standalone';
    status: 'idle' | 'processing' | 'stopping' | 'stopped';
    last_heartbeat_at: string;
    current_job_id: string | null;
  }>;
  last_heartbeat: string | null;
  last_successful_discovery: string | null;
  last_failed_discovery: string | null;
  currently_running_job: DiscoveryJob | null;
  queued_jobs_count: number;
  failed_jobs_count_24h: number;
  consecutive_failures: number;
  last_error: string | null;
  last_discovery_duration_ms: number | null;
}

export interface Notification {
  id: string;
  project_id: string | null;
  type: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
}

export interface ApiSource {
  id: string;
  name: string;
  base_url: string | null;
  enabled: boolean;
  rate_limit_per_min: number;
  health_status: 'unknown' | 'healthy' | 'degraded' | 'down';
  last_success_at: string | null;
  last_error_at: string | null;
  last_error: string | null;
  last_status_code: number | null;
  config: Record<string, unknown>;
  updated_at: string;
}

export interface RawLink {
  platform: SocialPlatform;
  url: string;
  label?: string;
  source: string;
  sourceKind: 'api' | 'metadata_extracted';
}

export interface PairSnapshot {
  chain: ChainId;
  pairAddress: string;
  dexId?: string | null;
  baseTokenAddress?: string | null;
  quoteTokenAddress?: string | null;
  quoteSymbol?: string | null;
  priceUsd?: number | null;
  liquidityUsd?: number | null;
  volume24h?: number | null;
  transactionCount24h?: number | null;
  buys24h?: number | null;
  sells24h?: number | null;
  pairCreatedAt?: string | null;
  fdvUsd?: number | null;
  marketCapUsd?: number | null;
  source: string;
  sourceUrl?: string | null;
  raw?: Record<string, unknown>;
}

export interface DiscoveredToken {
  chain: ChainId;
  address: string;
  name?: string | null;
  symbol?: string | null;
  decimals?: number | null;
  imageUrl?: string | null;
  description?: string | null;
  coingeckoCoinId?: string | null;
  gtScore?: number | null;
  metadataUpdatedAt?: string | null;
  tokenCreatedAt?: string | null;
  pairs: PairSnapshot[];
  links: RawLink[];
  source: string;
  marketDataSource?: string | null;
  metadataSource?: string | null;
}

export interface ProviderError {
  provider: string;
  endpoint?: string;
  message: string;
  status?: number;
}

export interface ProviderResult {
  provider: string;
  tokens: DiscoveredToken[];
  errors: ProviderError[];
  stats: Record<string, number>;
}

export interface ProjectFilters {
  search?: string;
  chain?: ChainId | 'all';
  age?: string;
  minLiquidity?: number;
  maxLiquidity?: number;
  minVolume?: number;
  maxVolume?: number;
  minTransactions?: number;
  minScore?: number;
  community?: CommunityRequirement;
  requireAccessible?: boolean;
  includeUnverifiedInvites?: boolean;
  hasWebsite?: boolean;
  hasTelegram?: boolean;
  hasDiscord?: boolean;
  reviewStatus?: ReviewStatus | 'all';
  qualifiedOnly?: boolean;
  discoveredAfter?: string;
  discoveredBefore?: string;
  sort?: 'newest' | 'liquidity' | 'volume' | 'score' | 'oldest';
  page?: number;
  pageSize?: number;
}

export interface DashboardStats {
  total_projects: number;
  new_today: number;
  telegram_groups: number;
  discord_servers: number;
  both_communities: number;
  qualified_prospects: number;
  awaiting_review: number;
  contacted: number;
  saved_prospects: number;
  clients: number;
}
