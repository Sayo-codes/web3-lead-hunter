import { describe, expect, it } from 'vitest';
import { generateMessage } from '@/lib/outreach/templates';
import type { Project, UserSettings } from '@/lib/types';

const settings = { owner_name: 'Alex Studio', owner_services: ['Solidity development', 'Telegram bot development'], contact_email: 'alex@example.com' } as UserSettings;
const project = { name: 'Example Protocol', symbol: 'EXP', chain: 'base', has_telegram_group: true, has_discord_server: false, liquidity_usd: 12345, qualification_score: 72, contract_address: '0xabc', website: 'https://example.com', telegram_url: 'https://t.me/example', discord_url: null, twitter_url: null } as Project;

describe('outreach message generation', () => {
  it('interpolates project and owner variables without sending anything', () => {
    const msg = generateMessage({ body: 'Hi {{project_name}} ({{symbol}}) on {{chain}}. Services: {{services}}. Community: {{community_platform}}. Liquidity: {{liquidity}}. Score: {{score}}. — {{owner_name}} {{unknown_var}}', services: [] }, project, settings);
    expect(msg).toContain('Example Protocol');
    expect(msg).toContain('EXP');
    expect(msg).toContain('Base');
    expect(msg).toContain('Solidity development');
    expect(msg).toContain('Telegram');
    expect(msg).toContain('Alex Studio');
    expect(msg).not.toContain('{{unknown_var}}');
  });

  it('allows selected services to override template defaults', () => {
    const msg = generateMessage({ body: '{{services}}', services: ['Smart contract security reviews'] }, project, settings, ['Discord bot development']);
    expect(msg).toBe('Discord bot development');
  });
});
