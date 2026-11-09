import { getChain } from '@/lib/chains';
import type { MessageTemplate, Project, UserSettings } from '@/lib/types';
import { formatUsd } from '@/lib/utils';

export function generateMessage(template: Pick<MessageTemplate, 'body' | 'services'>, project: Project, settings: UserSettings, services?: string[]): string {
  const selectedServices = (services && services.length ? services : template.services?.length ? template.services : settings.owner_services).filter(Boolean);
  const communityPlatform = project.has_telegram_group ? 'Telegram' : project.has_discord_server ? 'Discord' : 'your community';
  const vars: Record<string, string> = {
    project_name: project.name || 'your project',
    symbol: project.symbol || '',
    chain: getChain(project.chain)?.label ?? project.chain,
    services: selectedServices.join(', '),
    owner_name: settings.owner_name || 'A full-stack Web3 developer',
    contact_email: settings.contact_email || '',
    website: project.website || '',
    telegram_url: project.telegram_url || '',
    discord_url: project.discord_url || '',
    twitter_url: project.twitter_url || '',
    community_platform: communityPlatform,
    liquidity: formatUsd(project.liquidity_usd),
    volume_24h: formatUsd(project.volume_24h_usd),
    score: String(project.qualification_score),
    contract_address: project.contract_address,
  };
  return template.body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => vars[key] ?? '');
}

export const TEMPLATE_VARIABLES = [
  'project_name', 'symbol', 'chain', 'services', 'owner_name', 'contact_email', 'website', 'telegram_url', 'discord_url', 'twitter_url', 'community_platform', 'liquidity', 'volume_24h', 'score', 'contract_address',
];
