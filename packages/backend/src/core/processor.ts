import { ProxyNode } from './types';
import { addEmojiFlag, detectRegion } from './emoji';

export type SortMode = 'none' | 'name' | 'region';

const MAX_REGEX_LENGTH = 500;

/**
 * Safely create a RegExp — rejects overly complex patterns to prevent ReDoS
 */
function safeRegex(pattern: string, flags = ''): RegExp | null {
  if (pattern.length > MAX_REGEX_LENGTH) return null;
  // Reject patterns with nested quantifiers like (a+)+ or (a*)*
  if (/(\([^)]*[+*][^)]*\))[+*{]/.test(pattern)) return null;
  // Reject backreferences with quantifiers
  if (/\\[1-9][+*{]/.test(pattern)) return null;
  try {
    return new RegExp(pattern, flags);
  } catch {
    return null;
  }
}

export interface ProcessOptions {
  include?: string;        // regex — only keep nodes whose name matches
  exclude?: string;        // regex — remove nodes whose name matches
  regexDelete?: string;    // delete rules: "regex1|regex2|..."
  regexSort?: string;      // sort by regex priority: "HK|JP|SG"
  filterUseless?: boolean; // remove nodes with missing required fields
  includeTypes?: string[]; // only keep listed protocol types
  excludeTypes?: string[]; // drop listed protocol types
  includeRegions?: string[]; // only keep nodes in listed regions (e.g. HK,US)
  excludeRegions?: string[]; // drop nodes in listed regions
  rename?: string;         // rename rules, format: "pattern@replacement|pattern2@replacement2"
  addEmoji?: boolean;      // add emoji flags to node names
  deduplicate?: boolean;   // remove duplicate nodes (same server+port+type)
  sort?: SortMode;         // sort mode
  enableUdp?: boolean;     // force enable/disable UDP for all nodes
  skipCertVerify?: boolean; // force enable/disable skip-cert-verify for all nodes
}

export function processNodes(nodes: ProxyNode[], opts: ProcessOptions): ProxyNode[] {
  let result = nodes;

  // Remove nodes with obviously invalid/missing key fields
  if (opts.filterUseless) {
    result = result.filter(isUsableNode);
  }

  // Type include filter
  if (opts.includeTypes && opts.includeTypes.length > 0) {
    const allow = new Set(opts.includeTypes.map((t) => t.toLowerCase()));
    result = result.filter((n) => allow.has(n.type.toLowerCase()));
  }

  // Type exclude filter
  if (opts.excludeTypes && opts.excludeTypes.length > 0) {
    const deny = new Set(opts.excludeTypes.map((t) => t.toLowerCase()));
    result = result.filter((n) => !deny.has(n.type.toLowerCase()));
  }

  // Region include filter
  if (opts.includeRegions && opts.includeRegions.length > 0) {
    const allow = new Set(opts.includeRegions.map((r) => r.toUpperCase()));
    result = result.filter((n) => {
      const region = detectRegion(n.name);
      return !!region && allow.has(region.code.toUpperCase());
    });
  }

  // Region exclude filter
  if (opts.excludeRegions && opts.excludeRegions.length > 0) {
    const deny = new Set(opts.excludeRegions.map((r) => r.toUpperCase()));
    result = result.filter((n) => {
      const region = detectRegion(n.name);
      if (!region) return true;
      return !deny.has(region.code.toUpperCase());
    });
  }

  // Include filter
  if (opts.include) {
    const re = safeRegex(opts.include, 'i');
    if (re) result = result.filter((n) => re.test(n.name));
  }

  // Exclude filter
  if (opts.exclude) {
    const re = safeRegex(opts.exclude, 'i');
    if (re) result = result.filter((n) => !re.test(n.name));
  }

  // Regex delete rules
  if (opts.regexDelete) {
    const rules = parseRegexList(opts.regexDelete).map((p) => safeRegex(p, 'i')).filter((x): x is RegExp => !!x);
    if (rules.length > 0) {
      result = result.filter((n) => !rules.some((re) => re.test(n.name)));
    }
  }

  // Rename
  if (opts.rename) {
    const rules = parseRenameRules(opts.rename);
    result = result.map((n) => {
      let name = n.name;
      for (const { pattern, replacement } of rules) {
        const re = safeRegex(pattern, 'g');
        if (re) name = name.replace(re, replacement);
      }
      return { ...n, name: name.trim() || n.name };
    });
  }

  // Add emoji flags
  if (opts.addEmoji) {
    result = result.map((n) => ({
      ...n,
      name: addEmojiFlag(n.name),
    }));
  }

  // Deduplicate
  if (opts.deduplicate) {
    result = deduplicateNodes(result);
  }

  // Regex sort (higher priority than basic sort)
  const regexSortRules = opts.regexSort ? parseRegexSortRules(opts.regexSort) : [];
  if (regexSortRules.length > 0) {
    result = sortNodesByRegex(result, regexSortRules);
  } else if (opts.sort && opts.sort !== 'none') {
    // Sort
    result = sortNodes(result, opts.sort);
  }

  // Global UDP setting
  if (opts.enableUdp !== undefined) {
    result = result.map((n) => ({ ...n, udp: opts.enableUdp }));
  }

  // Global skip-cert-verify setting
  if (opts.skipCertVerify !== undefined) {
    result = result.map((n) => ({ ...n, skipCertVerify: opts.skipCertVerify }));
  }

  return result;
}

function parseRenameRules(raw: string): { pattern: string; replacement: string }[] {
  return raw
    .split('|')
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => {
      const idx = r.indexOf('@');
      if (idx === -1) return null;
      return { pattern: r.slice(0, idx), replacement: r.slice(idx + 1) };
    })
    .filter((r): r is { pattern: string; replacement: string } => r !== null);
}

function parseRegexList(raw: string): string[] {
  return raw
    .split('|')
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseRegexSortRules(raw: string): RegExp[] {
  return parseRegexList(raw)
    .map((p) => safeRegex(p, 'i'))
    .filter((x): x is RegExp => !!x);
}

/**
 * Remove duplicate nodes based on server+port+type
 */
function deduplicateNodes(nodes: ProxyNode[]): ProxyNode[] {
  const seen = new Set<string>();
  const result: ProxyNode[] = [];

  for (const node of nodes) {
    const key = `${node.type}:${node.server}:${node.port}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(node);
    }
  }

  return result;
}

function regexPriority(name: string, rules: RegExp[]): number {
  for (let i = 0; i < rules.length; i++) {
    if (rules[i].test(name)) return i;
  }
  return Number.MAX_SAFE_INTEGER;
}

function sortNodesByRegex(nodes: ProxyNode[], rules: RegExp[]): ProxyNode[] {
  const sorted = [...nodes];
  sorted.sort((a, b) => {
    const ap = regexPriority(a.name, rules);
    const bp = regexPriority(b.name, rules);
    if (ap !== bp) return ap - bp;
    return a.name.localeCompare(b.name, 'zh-CN');
  });
  return sorted;
}

/**
 * Sort nodes by name or region
 */
function sortNodes(nodes: ProxyNode[], mode: SortMode): ProxyNode[] {
  const sorted = [...nodes];

  if (mode === 'name') {
    sorted.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  } else if (mode === 'region') {
    // Sort by region, then by name within each region
    sorted.sort((a, b) => {
      const regionA = detectRegion(a.name);
      const regionB = detectRegion(b.name);

      // Nodes with detected region come first
      if (regionA && !regionB) return -1;
      if (!regionA && regionB) return 1;

      // Both have regions, sort by region code
      if (regionA && regionB) {
        const regionCompare = regionA.code.localeCompare(regionB.code);
        if (regionCompare !== 0) return regionCompare;
      }

      // Same region or both no region, sort by name
      return a.name.localeCompare(b.name, 'zh-CN');
    });
  }

  return sorted;
}

function isUsableNode(node: ProxyNode): boolean {
  if (!node.server || !node.server.trim()) return false;
  if (!Number.isFinite(node.port) || node.port <= 0 || node.port > 65535) return false;

  switch (node.type) {
    case 'ss':
      return !!(node.method && node.password);
    case 'ssr':
      return !!(node.method && node.password);
    case 'vmess':
      return !!node.uuid;
    case 'vless':
      return !!node.uuid;
    case 'trojan':
      return !!node.password;
    case 'hysteria':
      return !!node.password;
    case 'hysteria2':
      return !!node.password;
    case 'tuic':
      return !!(node.uuid && node.password);
    case 'wireguard':
      return !!(node.privateKey && node.publicKey);
    case 'socks':
    case 'http':
      return true;
    default:
      return true;
  }
}
