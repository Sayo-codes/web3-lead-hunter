import { DexScreenerProvider } from './dexscreener';
import { GeckoTerminalProvider } from './geckoterminal';
import type { DiscoveryProvider } from './types';

export function getProviders(): DiscoveryProvider[] {
  return [new GeckoTerminalProvider(), new DexScreenerProvider()];
}

export * from './types';
