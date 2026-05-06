import dns from 'node:dns/promises';
import net from 'node:net';
import { URL } from 'node:url';

// Private/internal IP ranges
const PRIVATE_RANGES = [
  // IPv4
  { start: ip4ToNum('10.0.0.0'), end: ip4ToNum('10.255.255.255') },
  { start: ip4ToNum('172.16.0.0'), end: ip4ToNum('172.31.255.255') },
  { start: ip4ToNum('192.168.0.0'), end: ip4ToNum('192.168.255.255') },
  { start: ip4ToNum('127.0.0.0'), end: ip4ToNum('127.255.255.255') },
  { start: ip4ToNum('169.254.0.0'), end: ip4ToNum('169.254.255.255') }, // link-local / cloud metadata
  { start: ip4ToNum('0.0.0.0'), end: ip4ToNum('0.255.255.255') },
];

function ip4ToNum(ip: string): number {
  const parts = ip.split('.').map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function ipv4MappedToIp4(ip: string): string | null {
  const normalized = ip.toLowerCase();
  if (!normalized.startsWith('::ffff:')) return null;

  const rest = normalized.slice('::ffff:'.length);
  if (/^\d+\.\d+\.\d+\.\d+$/.test(rest)) return rest;

  const parts = rest.split(':');
  if (parts.length !== 2) return null;

  const high = Number.parseInt(parts[0], 16);
  const low = Number.parseInt(parts[1], 16);
  if (!Number.isFinite(high) || !Number.isFinite(low) || high < 0 || high > 0xffff || low < 0 || low > 0xffff) {
    return null;
  }

  const num = ((high << 16) | low) >>> 0;
  return [
    (num >>> 24) & 0xff,
    (num >>> 16) & 0xff,
    (num >>> 8) & 0xff,
    num & 0xff,
  ].join('.');
}

function isPrivateIp(ip: string): boolean {
  const normalized = ip.replace(/^\[|\]$/g, '').toLowerCase();
  const ipv4Mapped = ipv4MappedToIp4(normalized);
  if (ipv4Mapped) return isPrivateIp(ipv4Mapped);

  const version = net.isIP(normalized);
  if (version === 4) {
    const num = ip4ToNum(normalized);
    return PRIVATE_RANGES.some(r => num >= r.start && num <= r.end);
  }

  if (version === 6) {
    return (
      normalized === '::' ||
      normalized === '::1' ||
      normalized.startsWith('fe80:') ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('ff')
    );
  }

  return true;
}

async function resolvePublicAddresses(hostname: string): Promise<void> {
  const cleanHostname = hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(cleanHostname)) {
    if (isPrivateIp(cleanHostname)) {
      throw new Error('Access to internal addresses is not allowed');
    }
    return;
  }

  let records: Array<{ address: string; family: number }>;
  try {
    records = await dns.lookup(cleanHostname, { all: true, verbatim: true });
  } catch {
    throw new Error('DNS lookup failed');
  }

  if (records.length === 0) {
    throw new Error('DNS lookup failed');
  }

  if (records.some((record) => isPrivateIp(record.address))) {
    throw new Error('Access to internal addresses is not allowed');
  }
}

/**
 * Validate a URL is safe to fetch (not targeting internal services)
 * Returns the URL string if safe, throws if not
 */
export async function validateUrl(rawUrl: string): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL');
  }

  // Only allow http/https
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only HTTP/HTTPS URLs are allowed');
  }

  // Block credentials in URL
  if (parsed.username || parsed.password) {
    throw new Error('URLs with credentials are not allowed');
  }

  await resolvePublicAddresses(parsed.hostname);

  return parsed.toString();
}
