import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatUsd(value: number | null | undefined, compact = true): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'Unavailable';
  const n = Number(value);
  if (compact && Math.abs(n) >= 1000) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 }).format(n);
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: n < 1 ? 6 : 2 }).format(n);
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'Unavailable';
  return new Intl.NumberFormat('en-US').format(Number(value));
}

export function shortAddress(address: string | null | undefined, size = 6): string {
  if (!address) return 'Unavailable';
  if (address.length <= size * 2 + 3) return address;
  return `${address.slice(0, size)}…${address.slice(-4)}`;
}

export function ageLabel(createdAt: string | null | undefined, now = Date.now()): string {
  if (!createdAt) return 'Unknown';
  const ms = now - new Date(createdAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 'Unknown';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ${hours % 24}h`;
  const months = Math.floor(days / 30);
  return `${months}mo`;
}

export function ageBucket(createdAt: string | null | undefined, now = Date.now()): string {
  if (!createdAt) return 'unknown';
  const hours = (now - new Date(createdAt).getTime()) / 3600000;
  if (hours < 1) return '<1h';
  if (hours < 6) return '1-6h';
  if (hours < 24) return '6-24h';
  if (hours < 72) return '1-3d';
  if (hours < 168) return '3-7d';
  if (hours < 720) return '7-30d';
  return '>30d';
}

export function timeAgo(date: string | null | undefined): string {
  if (!date) return 'Never';
  const ms = Date.now() - new Date(date).getTime();
  if (ms < 60000) return 'just now';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function safeExternalUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function statusLabel(status: string): string {
  return status
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
