import { describe, expect, it } from 'vitest';
import { settingsSchema, outreachSchema } from '@/lib/server/validation';

describe('settings and outreach validation', () => {
  it('accepts valid partial settings', () => {
    const parsed = settingsSchema.safeParse({ discovery_interval_minutes: 5, enabled_chains: ['ethereum', 'base'], community_requirement: 'either', min_qualification_score: 50 });
    expect(parsed.success).toBe(true);
  });

  it('rejects unsupported chains and out-of-range intervals', () => {
    expect(settingsSchema.safeParse({ enabled_chains: ['dogecoin'] }).success).toBe(false);
    expect(settingsSchema.safeParse({ discovery_interval_minutes: 0 }).success).toBe(false);
    expect(settingsSchema.safeParse({ min_qualification_score: 101 }).success).toBe(false);
  });

  it('requires a non-empty outreach message', () => {
    expect(outreachSchema.safeParse({ message: '' }).success).toBe(false);
    expect(outreachSchema.safeParse({ message: 'Hello', platform: 'telegram' }).success).toBe(true);
  });
});
