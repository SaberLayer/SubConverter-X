import { Parser, ProxyNode } from './types';
import { uriParser } from '../parsers/uri';
import { clashParser } from '../parsers/clash';
import { singboxParser } from '../parsers/singbox';
import { base64Parser } from '../parsers/base64';
import { clientConfigParser } from '../parsers/client-config';
import { fetchSubscription, isSubscriptionUrl } from './fetcher';
import { nodeFingerprint } from './node-fingerprint';
import { formatSubscriptionUserinfo, mergeSubscriptionUserinfo, parseSubscriptionUserinfo, type SubscriptionUserinfo } from './subscription-userinfo';

const parsers: Parser[] = [uriParser, clashParser, singboxParser, clientConfigParser, base64Parser];

export interface ParseResult {
  nodes: ProxyNode[];
  subscriptionUserinfo?: string;  // upstream subscription-userinfo header
  subscriptionUserinfoData?: SubscriptionUserinfo;
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
  const hasUrls = lines.some((l) => isSubscriptionUrl(l));

  if (hasUrls) {
    // Mixed mode: lines can be URLs or node URIs
    const allNodes: ProxyNode[] = [];
    const userinfoItems: SubscriptionUserinfo[] = [];

    for (const line of lines) {
      if (isSubscriptionUrl(line)) {
        try {
          const result = await fetchSubscription(line);
          const userinfo = parseSubscriptionUserinfo(result.userinfo);
          if (userinfo) userinfoItems.push(userinfo);
          const nodes = parseContent(result.content);
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

    const mergedUserinfo = mergeSubscriptionUserinfo(userinfoItems);
    return {
      nodes: dedup(allNodes),
      subscriptionUserinfo: formatSubscriptionUserinfo(mergedUserinfo),
      subscriptionUserinfoData: mergedUserinfo,
    };
  }

  // No URLs — parse entire input as a single block (could be YAML/JSON/base64)
  return { nodes: dedup(parseContent(trimmed)) };
}

function dedup(nodes: ProxyNode[]): ProxyNode[] {
  const seen = new Set<string>();
  return nodes.filter((n) => {
    const key = nodeFingerprint(n);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
