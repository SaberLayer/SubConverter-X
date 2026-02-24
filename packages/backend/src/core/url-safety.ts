/**
 * URL safety checks — prevent SSRF attacks
 * Blocks requests to private/internal IPs and cloud metadata endpoints
 */

import { URL } from 'url';
import dns from 'dns';
import { promisify } from 'util';

const dnsLookup = promisify(dns.lookup);

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

function isPrivateIp(ip: string): boolean {
  // IPv6 loopback
  if (ip === '::1' || ip === '::' || ip.startsWith('fe80:') || ip.startsWith('fc00:') || ip.startsWith('fd00:')) {
    return true;
  }
  // IPv4
  const num = ip4ToNum(ip);
  return PRIVATE_RANGES.some(r => num >= r.start && num <= r.end);
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

  const hostname = parsed.hostname;

  // Quick check: if hostname is an IP literal, check it directly
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new Error('Access to internal addresses is not allowed');
    }
    return rawUrl;
  }

  // DNS resolution check — resolve the hostname and verify the IP
  try {
    const { address } = await dnsLookup(hostname);
    if (isPrivateIp(address)) {
      throw new Error('Access to internal addresses is not allowed');
    }
  } catch (err: any) {
    if (err.message === 'Access to internal addresses is not allowed') throw err;
    // DNS resolution failure — allow the request to proceed
    // (the actual fetch will fail with a network error)
  }

  return rawUrl;
}
