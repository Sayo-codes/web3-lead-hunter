-- Configuration seed only. No project/token records are seeded.

INSERT INTO api_sources (id, name, base_url, enabled, rate_limit_per_min, health_status, config)
VALUES
  ('dexscreener', 'DEX Screener', 'https://api.dexscreener.com', true, 50, 'unknown', '{"profiles_per_minute":60,"pairs_per_minute":300}'::jsonb),
  ('geckoterminal', 'GeckoTerminal', 'https://api.geckoterminal.com/api/v2', true, 5, 'unknown', '{"keyless":true,"max_pages":10,"cache_seconds":60}'::jsonb),
  ('discord', 'Discord Invite API', 'https://discord.com/api/v10', true, 20, 'unknown', '{"purpose":"invite_validation_only"}'::jsonb),
  ('telegram', 'Telegram Verification', 'https://api.telegram.org', true, 10, 'unknown', '{"purpose":"bot_getChat_or_public_page_hint","auto_join":false}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;

INSERT INTO message_templates (id, name, subject, body, services, is_default)
VALUES
  (
    '00000000-0000-4000-8000-000000000001',
    'Friendly Web3 development intro',
    'Helping {{project_name}} ship faster',
    E'Hi {{project_name}} team,\n\nI came across {{project_name}} ({{symbol}}) on {{chain}} and liked what you are building. I''m a full-stack blockchain developer helping early-stage Web3 teams ship securely and quickly.\n\nI can help with: {{services}}.\n\nIf useful, I can take a look at your current contracts, DApp, or bot integrations and suggest a few concrete improvements. No pressure — happy to share a quick audit checklist or examples of past work.\n\nBest,\n{{owner_name}}',
    ARRAY['Smart contract development','Solidity development','DApp development','Smart contract security reviews'],
    true
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    'Community bot / integration angle',
    'Telegram/Discord tooling for {{project_name}}',
    E'Hello {{project_name}},\n\nI noticed your community on {{community_platform}}. I build Telegram and Discord bots, smart contract integrations, and full-stack Web3 apps for token projects.\n\nIf you''re planning holder verification, alerts, governance tooling, or a project dashboard, I can help scope and build it. I focus on maintainable code and safe integrations.\n\nWould a short call or async spec review be helpful?\n\n{{owner_name}}',
    ARRAY['Telegram bot development','Discord bot development','Smart contract integrations','Full-stack Web3 development'],
    false
  ),
  (
    '00000000-0000-4000-8000-000000000003',
    'Security review angle',
    'Quick security review offer for {{project_name}}',
    E'Hi {{project_name}} team,\n\nCongrats on the launch. Early liquidity and community growth often come with integration and contract risk. I offer smart contract security reviews and Solidity development for Web3 projects.\n\nI can review {{symbol}} for common issues (access control, upgradeability, fee logic, oracle/integration assumptions) and provide a prioritized report. If you already have an audit, I can help with remediation and monitoring.\n\nLet me know if you''d like a sample checklist.\n\n{{owner_name}}',
    ARRAY['Smart contract security reviews','Solidity development','Web3 project development and maintenance'],
    false
  )
ON CONFLICT (id) DO NOTHING;
