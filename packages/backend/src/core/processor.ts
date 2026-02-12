import { ProxyNode } from './types';
import { addEmojiFlag, detectRegion } from './emoji';

export type SortMode = 'none' | 'name' | 'region';

export interface ProcessOptions {
  include?: string;        // regex — only keep nodes whose name matches
  exclude?: string;        // regex — remove nodes whose name matches
  rename?: string;         // rename rules, format: "pattern@replacement|pattern2@replacement2"
  addEmoji?: boolean;      // add emoji flags to node names
  deduplicate?: boolean;   // remove duplicate nodes (same server+port+type)
  sort?: SortMode;         // sort mode
  enableUdp?: boolean;     // force enable/disable UDP for all nodes
  skipCertVerify?: boolean; // force enable/disable skip-cert-verify for all nodes
}

export function processNodes(nodes: ProxyNode[], opts: ProcessOptions): ProxyNode[] {
  let result = nodes;

  // Include filter
  if (opts.include) {
    try {
      const re = new RegExp(opts.include, 'i');
      result = result.filter((n) => re.test(n.name));
    } catch { /* invalid regex, skip */ }
  }

  // Exclude filter
  if (opts.exclude) {
    try {
      const re = new RegExp(opts.exclude, 'i');
      result = result.filter((n) => !re.test(n.name));
    } catch { /* invalid regex, skip */ }
  }

  // Rename
  if (opts.rename) {
    const rules = parseRenameRules(opts.rename);
    result = result.map((n) => {
      let name = n.name;
      for (const { pattern, replacement } of rules) {
        try {
          name = name.replace(new RegExp(pattern, 'g'), replacement);
        } catch { /* invalid regex, skip */ }
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

  // Sort
  if (opts.sort && opts.sort !== 'none') {
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
