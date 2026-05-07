import type { ProxyNode, ProxyProtocol, TlsType, Transport } from './types';
import { detectRegion } from './emoji';
import { nodeFingerprint } from './node-fingerprint';

export type NodeOperator =
  | FilterOperator
  | RenameOperator
  | SetOperator
  | SortOperator
  | DedupeOperator;

export interface FilterOperator {
  type: 'filter';
  include?: string;
  exclude?: string;
  protocols?: ProxyProtocol[];
  transports?: Transport[];
  tls?: TlsType[];
  regions?: string[];
  minPort?: number;
  maxPort?: number;
}

export interface RenameOperator {
  type: 'rename';
  pattern: string;
  replacement: string;
}

export type SettableNodeField = 'udp' | 'skipCertVerify' | 'sni' | 'fingerprint' | 'alpn' | 'flow';

export interface SetOperator {
  type: 'set';
  field: SettableNodeField;
  value: boolean | string | string[];
}

export interface SortOperator {
  type: 'sort';
  by: 'name' | 'region' | 'protocol' | 'server' | 'port';
  order?: 'asc' | 'desc';
}

export interface DedupeOperator {
  type: 'dedupe';
  mode?: 'fingerprint' | 'endpoint' | 'credential';
}

const MAX_REGEX_LENGTH = 500;

function safeRegex(pattern: string, flags = ''): RegExp | null {
  if (pattern.length > MAX_REGEX_LENGTH) return null;
  if (/(\([^)]*[+*][^)]*\))[+*{]/.test(pattern)) return null;
  if (/\\[1-9][+*{]/.test(pattern)) return null;
  try {
    return new RegExp(pattern, flags);
  } catch {
    return null;
  }
}

function filterNodes(nodes: ProxyNode[], op: FilterOperator): ProxyNode[] {
  const include = op.include ? safeRegex(op.include, 'i') : null;
  const exclude = op.exclude ? safeRegex(op.exclude, 'i') : null;
  const protocols = op.protocols?.length ? new Set(op.protocols) : null;
  const transports = op.transports?.length ? new Set(op.transports) : null;
  const tls = op.tls?.length ? new Set(op.tls) : null;
  const regions = op.regions?.length ? new Set(op.regions.map((code) => code.toUpperCase())) : null;

  return nodes.filter((node) => {
    if (include && !include.test(node.name)) return false;
    if (exclude && exclude.test(node.name)) return false;
    if (protocols && !protocols.has(node.type)) return false;
    if (transports && !transports.has(node.transport)) return false;
    if (tls && !tls.has(node.tls)) return false;
    if (op.minPort !== undefined && node.port < op.minPort) return false;
    if (op.maxPort !== undefined && node.port > op.maxPort) return false;

    if (regions) {
      const region = detectRegion(node.name);
      if (!region || !regions.has(region.code.toUpperCase())) return false;
    }

    return true;
  });
}

function renameNodes(nodes: ProxyNode[], op: RenameOperator): ProxyNode[] {
  const re = safeRegex(op.pattern, 'g');
  if (!re) return nodes;
  return nodes.map((node) => {
    const name = node.name.replace(re, op.replacement).trim();
    return { ...node, name: name || node.name };
  });
}

function setNodeField(nodes: ProxyNode[], op: SetOperator): ProxyNode[] {
  return nodes.map((node) => {
    switch (op.field) {
      case 'udp':
      case 'skipCertVerify':
        return typeof op.value === 'boolean' ? { ...node, [op.field]: op.value } : node;
      case 'alpn':
        return Array.isArray(op.value) ? { ...node, alpn: op.value } : node;
      case 'sni':
      case 'fingerprint':
      case 'flow':
        return typeof op.value === 'string' ? { ...node, [op.field]: op.value || undefined } : node;
      default:
        return node;
    }
  });
}

function sortNodes(nodes: ProxyNode[], op: SortOperator): ProxyNode[] {
  const sorted = [...nodes];
  const factor = op.order === 'desc' ? -1 : 1;
  sorted.sort((a, b) => factor * compareNodes(a, b, op.by));
  return sorted;
}

function compareNodes(a: ProxyNode, b: ProxyNode, by: SortOperator['by']): number {
  switch (by) {
    case 'region': {
      const ar = detectRegion(a.name)?.code || '';
      const br = detectRegion(b.name)?.code || '';
      return ar.localeCompare(br) || a.name.localeCompare(b.name, 'zh-CN');
    }
    case 'protocol':
      return a.type.localeCompare(b.type) || a.name.localeCompare(b.name, 'zh-CN');
    case 'server':
      return a.server.localeCompare(b.server) || a.port - b.port || a.name.localeCompare(b.name, 'zh-CN');
    case 'port':
      return a.port - b.port || a.name.localeCompare(b.name, 'zh-CN');
    case 'name':
    default:
      return a.name.localeCompare(b.name, 'zh-CN');
  }
}

function dedupeNodes(nodes: ProxyNode[], mode: DedupeOperator['mode'] = 'fingerprint'): ProxyNode[] {
  const seen = new Set<string>();
  const result: ProxyNode[] = [];

  for (const node of nodes) {
    const key = dedupeKey(node, mode);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(node);
  }

  return result;
}

function dedupeKey(node: ProxyNode, mode: DedupeOperator['mode']): string {
  if (mode === 'endpoint') {
    return [node.type, node.server.trim().toLowerCase(), node.port].join('|');
  }
  if (mode === 'credential') {
    return [
      node.type,
      node.server.trim().toLowerCase(),
      node.port,
      node.uuid || '',
      node.password || '',
      node.method || '',
      node.privateKey || '',
    ].join('|');
  }
  return nodeFingerprint(node);
}

export function applyNodeOperators(nodes: ProxyNode[], operators?: NodeOperator[]): ProxyNode[] {
  if (!operators?.length) return nodes;

  return operators.reduce((current, op) => {
    switch (op.type) {
      case 'filter':
        return filterNodes(current, op);
      case 'rename':
        return renameNodes(current, op);
      case 'set':
        return setNodeField(current, op);
      case 'sort':
        return sortNodes(current, op);
      case 'dedupe':
        return dedupeNodes(current, op.mode);
      default:
        return current;
    }
  }, nodes);
}

