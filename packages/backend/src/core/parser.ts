import { Parser, ProxyNode } from './types';
import { uriParser } from '../parsers/uri';
import { clashParser } from '../parsers/clash';
import { singboxParser } from '../parsers/singbox';
import { base64Parser } from '../parsers/base64';

const parsers: Parser[] = [uriParser, clashParser, singboxParser, base64Parser];

export interface ParseResult {
  nodes: ProxyNode[];
  subscriptionUserinfo?: string;  // upstream subscription-userinfo header
}

const URL_RE = /^https?:\/\/.+/i;

async function fetchSubscription(url: string, timeout = 15000): Promise<{ body: string; userinfo?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'SubConverter/1.0' },
    });
    clearTimeout(timer);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const body = await resp.text();
    const userinfo = resp.headers.get('subscription-userinfo') || undefined;
    return { body, userinfo };
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

function parseContent(content: string): ProxyNode[] {
  const trimmed = content.trim();
  if (!trimmed) return [];

  for (const parser of parsers) {
    if (parser.canParse(trimmed)) {
      try {
        const nodes = parser.parse(trimmed);
        if (nodes.length > 0) return nodes;
      } catch {
        continue;
      }
    }
  }
  return [];
}

export async function parseInput(raw: string): Promise<ParseResult> {
  const trimmed = raw.trim();
  if (!trimmed) return { nodes: [] };

  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // Check if any line is a subscription URL
  const hasUrls = lines.some((l) => URL_RE.test(l));

  if (hasUrls) {
    // Mixed mode: lines can be URLs or node URIs
    const allNodes: ProxyNode[] = [];
    let userinfo: string | undefined;

    for (const line of lines) {
      if (URL_RE.test(line)) {
        try {
          const result = await fetchSubscription(line);
          // Keep the first subscription-userinfo we find
          if (!userinfo && result.userinfo) userinfo = result.userinfo;
          const nodes = parseContent(result.body);
          allNodes.push(...nodes);
        } catch {
          // Skip failed URLs silently
        }
      } else {
        // Try parsing as node URI directly
        const nodes = parseContent(line);
        allNodes.push(...nodes);
      }
    }

    return { nodes: dedup(allNodes), subscriptionUserinfo: userinfo };
  }

  // No URLs — parse entire input as a single block (could be YAML/JSON/base64)
  return { nodes: dedup(parseContent(trimmed)) };
}

function dedup(nodes: ProxyNode[]): ProxyNode[] {
  const seen = new Set<string>();
  return nodes.filter((n) => {
    const key = `${n.type}:${n.server}:${n.port}:${n.uuid || n.password || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
