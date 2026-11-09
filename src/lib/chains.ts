import type { ChainConfig, ChainId } from './types';

export const CHAINS: ChainConfig[] = [
  { id: 'ethereum', label: 'Ethereum', short: 'ETH', dexChainId: 'ethereum', geckoNetwork: 'eth', evm: true, explorer: 'https://etherscan.io/token/', color: '#627eea' },
  { id: 'base', label: 'Base', short: 'BASE', dexChainId: 'base', geckoNetwork: 'base', evm: true, explorer: 'https://basescan.org/token/', color: '#0052ff' },
  { id: 'solana', label: 'Solana', short: 'SOL', dexChainId: 'solana', geckoNetwork: 'solana', evm: false, explorer: 'https://solscan.io/token/', color: '#14f195' },
  { id: 'bsc', label: 'BNB Chain', short: 'BNB', dexChainId: 'bsc', geckoNetwork: 'bsc', evm: true, explorer: 'https://bscscan.com/token/', color: '#f0b90b' },
  { id: 'arbitrum', label: 'Arbitrum', short: 'ARB', dexChainId: 'arbitrum', geckoNetwork: 'arbitrum', evm: true, explorer: 'https://arbiscan.io/token/', color: '#28a0f0' },
  { id: 'optimism', label: 'Optimism', short: 'OP', dexChainId: 'optimism', geckoNetwork: 'optimism', evm: true, explorer: 'https://optimistic.etherscan.io/token/', color: '#ff0420' },
  { id: 'polygon', label: 'Polygon', short: 'POL', dexChainId: 'polygon', geckoNetwork: 'polygon_pos', evm: true, explorer: 'https://polygonscan.com/token/', color: '#8247e5' },
  { id: 'avalanche', label: 'Avalanche', short: 'AVAX', dexChainId: 'avax', geckoNetwork: 'avax', evm: true, explorer: 'https://snowtrace.io/token/', color: '#e84142' },
];

export const CHAIN_IDS = CHAINS.map((c) => c.id);

export function getChain(id: string): ChainConfig | undefined {
  return CHAINS.find((c) => c.id === id);
}

export function chainFromDexId(dexChainId: string): ChainId | null {
  const c = CHAINS.find((x) => x.dexChainId === dexChainId);
  return c ? c.id : null;
}

export function chainFromGeckoNetwork(network: string): ChainId | null {
  const c = CHAINS.find((x) => x.geckoNetwork === network);
  return c ? c.id : null;
}

export function normalizeAddress(chain: ChainId, address: string): string {
  const trimmed = address.trim();
  const cfg = getChain(chain);
  return cfg?.evm ? trimmed.toLowerCase() : trimmed;
}

export function addressKey(chain: ChainId, address: string): string {
  return normalizeAddress(chain, address);
}

export function isValidAddress(chain: ChainId, address: string): boolean {
  const a = address.trim();
  const cfg = getChain(chain);
  if (!cfg) return false;
  if (cfg.evm) return /^0x[a-fA-F0-9]{40}$/.test(a);
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a);
}

export function dexScreenerUrl(chain: ChainId, addressOrPair: string): string {
  const cfg = getChain(chain);
  return `https://dexscreener.com/${cfg?.dexChainId ?? chain}/${addressOrPair}`;
}

export function explorerUrl(chain: ChainId, address: string): string {
  const cfg = getChain(chain);
  return `${cfg?.explorer ?? ''}${address}`;
}
