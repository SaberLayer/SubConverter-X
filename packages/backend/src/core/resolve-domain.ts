import dns from 'node:dns/promises';
import net from 'node:net';
import { ProxyNode } from './types';

const LOOKUP_TIMEOUT_MS = 2500;
const cache = new Map<string, string | null>();

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('DNS lookup timeout')), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

async function lookupHost(host: string): Promise<string | null> {
  const key = host.trim().toLowerCase();
  if (!key) return null;
  if (cache.has(key)) return cache.get(key) ?? null;
  if (net.isIP(key)) {
    cache.set(key, key);
    return key;
  }

  try {
    const records = await withTimeout(dns.lookup(key, { all: true, verbatim: true }), LOOKUP_TIMEOUT_MS);
    const addr = records.find((r) => net.isIP(r.address))?.address ?? null;
    cache.set(key, addr);
    return addr;
  } catch {
    cache.set(key, null);
    return null;
  }
}

export async function resolveNodeDomains(nodes: ProxyNode[], enabled?: boolean): Promise<ProxyNode[]> {
  if (!enabled) return nodes;

  const resolved = await Promise.all(
    nodes.map(async (node) => {
      if (!node.server || net.isIP(node.server)) return node;
      const ip = await lookupHost(node.server);
      if (!ip) return node;
      return { ...node, server: ip };
    })
  );

  return resolved;
}
