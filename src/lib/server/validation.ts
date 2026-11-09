import { z } from 'zod';
import { CHAIN_IDS } from '@/lib/chains';

export const settingsSchema = z.object({
  discovery_interval_minutes: z.coerce.number().int().min(1).max(1440).optional(),
  enabled_chains: z.array(z.enum(CHAIN_IDS as [string, ...string[]])).min(1).optional(),
  min_liquidity_usd: z.coerce.number().min(0).optional(),
  max_liquidity_usd: z.coerce.number().min(0).nullable().optional(),
  min_volume_24h_usd: z.coerce.number().min(0).optional(),
  max_volume_24h_usd: z.coerce.number().min(0).nullable().optional(),
  min_transactions_24h: z.coerce.number().int().min(0).optional(),
  max_token_age_hours: z.coerce.number().int().min(1).max(8760).optional(),
  include_unknown_age: z.boolean().optional(),
  min_qualification_score: z.coerce.number().int().min(0).max(100).optional(),
  community_requirement: z.enum(['telegram_group', 'discord_server', 'both', 'either', 'any']).optional(),
  require_accessible_community: z.boolean().optional(),
  include_unverified_telegram_invites: z.boolean().optional(),
  auto_refresh_dashboard: z.boolean().optional(),
  dashboard_refresh_seconds: z.coerce.number().int().min(5).max(3600).optional(),
  notifications_enabled: z.boolean().optional(),
  notify_qualified: z.boolean().optional(),
  notify_both_communities: z.boolean().optional(),
  gecko_max_pages: z.coerce.number().int().min(1).max(10).optional(),
  gecko_per_chain: z.boolean().optional(),
  dex_enrichment_batch_size: z.coerce.number().int().min(1).max(30).optional(),
  community_check_ttl_hours: z.coerce.number().int().min(1).max(168).optional(),
  duplicate_contact_window_hours: z.coerce.number().int().min(1).max(8760).optional(),
  owner_name: z.string().max(120).optional(),
  owner_services: z.array(z.string().max(120)).max(30).optional(),
  contact_email: z.string().email().or(z.literal('')).optional(),
}).strict();

export const settingsPutSchema = z.object({
  settings: settingsSchema.optional(),
  secrets: z.record(z.enum(['coingecko', 'telegram_bot']), z.string().min(1).max(500)).optional(),
  deleteSecrets: z.array(z.enum(['coingecko', 'telegram_bot'])).optional(),
  sources: z.array(z.object({ id: z.string(), enabled: z.boolean() })).optional(),
}).strict();

export const prospectPatchSchema = z.object({
  status: z.enum(['new_lead', 'reviewed', 'ready_to_contact', 'contacted', 'replied', 'interested', 'negotiating', 'client', 'not_interested']).optional(),
  notes: z.string().max(10000).optional(),
  contact_platform: z.string().max(80).nullable().optional(),
  contacted_at: z.string().datetime().nullable().optional(),
  responded_at: z.string().datetime().nullable().optional(),
  response_notes: z.string().max(10000).optional(),
  opportunity_status: z.enum(['open', 'successful', 'unsuccessful']).optional(),
  next_follow_up_at: z.string().datetime().nullable().optional(),
}).strict();

export const outreachSchema = z.object({
  platform: z.string().max(80).nullable().optional(),
  message: z.string().min(1).max(20000),
  status: z.string().max(80).optional(),
  contacted_at: z.string().datetime().nullable().optional(),
  response_notes: z.string().max(10000).nullable().optional(),
  force: z.boolean().optional(),
}).strict();

export const templateSchema = z.object({
  name: z.string().min(1).max(120),
  subject: z.string().max(200).nullable().optional(),
  body: z.string().min(1).max(20000),
  services: z.array(z.string().max(120)).max(30).optional(),
  is_default: z.boolean().optional(),
}).strict();

export const reviewSchema = z.object({
  status: z.enum(['new', 'reviewed', 'ready_to_contact', 'contacted', 'replied', 'interested', 'negotiating', 'client', 'not_interested']),
}).strict();
