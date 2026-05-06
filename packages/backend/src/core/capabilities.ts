import type { ProxyNode, ProxyProtocol, TargetFormat } from './types';

export type WarningSeverity = 'info' | 'warning';

export interface ConversionWarning {
  code: string;
  severity: WarningSeverity;
  message: string;
  target: TargetFormat;
  protocol?: ProxyProtocol;
  nodes?: string[];
  count?: number;
}

export interface ConversionAnalysis {
  supported: ProxyNode[];
  skipped: string[];
  warnings: ConversionWarning[];
}

type WarningDraft = Omit<ConversionWarning, 'nodes' | 'count'>;

const CLASH_META_ALIASES = new Set<TargetFormat>(['clash', 'clashr', 'egern', 'stash']);
const SURGE_ALIASES = new Set<TargetFormat>(['surgemac', 'surfboard']);
const WS_LIKE_TRANSPORT_TARGETS = new Set<TargetFormat>(['surge', 'surgemac', 'surfboard', 'quantumultx', 'loon']);
const REALITY_LIMITED_TARGETS = new Set<TargetFormat>(['surge', 'surgemac', 'surfboard', 'quantumultx', 'loon']);
const WIREGUARD_MANUAL_TARGETS = new Set<TargetFormat>(['quantumultx', 'loon']);

function addWarning(
  warnings: Map<string, ConversionWarning>,
  key: string,
  draft: WarningDraft,
  nodeName?: string
) {
  const existing = warnings.get(key);
  if (existing) {
    existing.count = (existing.count || 0) + (nodeName ? 1 : 0);
    if (nodeName && existing.nodes && existing.nodes.length < 8) {
      existing.nodes.push(nodeName);
    }
    return;
  }

  warnings.set(key, {
    ...draft,
    ...(nodeName ? { nodes: [nodeName], count: 1 } : {}),
  });
}

export function analyzeConversion(
  target: TargetFormat,
  nodes: ProxyNode[],
  supportedProtocols: ProxyProtocol[]
): ConversionAnalysis {
  const supportedSet = new Set(supportedProtocols);
  const warnings = new Map<string, ConversionWarning>();

  if (CLASH_META_ALIASES.has(target)) {
    addWarning(warnings, `alias:${target}`, {
      code: 'FORMAT_ALIAS',
      severity: 'info',
      target,
      message: `${target} 当前复用 Clash Meta 兼容输出，建议在目标客户端中验证高级字段兼容性。`,
    });
  }

  if (SURGE_ALIASES.has(target)) {
    addWarning(warnings, `alias:${target}`, {
      code: 'FORMAT_ALIAS',
      severity: 'info',
      target,
      message: `${target} 当前复用 Surge 兼容输出，部分客户端专有字段可能需要手动调整。`,
    });
  }

  for (const node of nodes) {
    if (!supportedSet.has(node.type)) {
      addWarning(warnings, `unsupported:${target}:${node.type}`, {
        code: 'UNSUPPORTED_PROTOCOL',
        severity: 'warning',
        target,
        protocol: node.type,
        message: `目标格式 ${target} 不支持 ${node.type}，相关节点已跳过。`,
      }, node.name);
      continue;
    }

    if (target === 'singbox' && (node.transport === 'xhttp' || node.transport === 'splithttp')) {
      addWarning(warnings, `transport:${target}:${node.transport}`, {
        code: 'TRANSPORT_DOWNGRADED',
        severity: 'warning',
        target,
        protocol: node.type,
        message: 'sing-box 输出暂将 xHTTP/SplitHTTP 映射为 HTTPUpgrade，mode、xmux 等细节不会完整保留。',
      }, node.name);
    }

    if (WS_LIKE_TRANSPORT_TARGETS.has(target) && (node.transport === 'xhttp' || node.transport === 'splithttp')) {
      addWarning(warnings, `transport:${target}:${node.transport}`, {
        code: 'TRANSPORT_DOWNGRADED',
        severity: 'warning',
        target,
        protocol: node.type,
        message: `${target} 输出会将 xHTTP/SplitHTTP 按 WebSocket 类配置生成，请在客户端中验证可用性。`,
      }, node.name);
    }

    if (REALITY_LIMITED_TARGETS.has(target) && node.tls === 'reality') {
      addWarning(warnings, `reality:${target}:${node.type}`, {
        code: 'FEATURE_PARTIAL',
        severity: 'warning',
        target,
        protocol: node.type,
        message: `${target} 输出无法完整表达 Reality 参数，public-key、short-id 等字段可能需要手动补充。`,
      }, node.name);
    }

    if (target === 'singbox' && node.type === 'wireguard') {
      addWarning(warnings, `wireguard:${target}`, {
        code: 'FEATURE_PARTIAL',
        severity: 'warning',
        target,
        protocol: node.type,
        message: 'sing-box WireGuard 输出使用默认 local_address 10.0.0.2/32，请按实际隧道地址手动调整。',
      }, node.name);
    }

    if ((target === 'surge' || target === 'surgemac' || target === 'surfboard') && node.type === 'wireguard') {
      addWarning(warnings, `wireguard:${target}`, {
        code: 'FEATURE_PARTIAL',
        severity: 'warning',
        target,
        protocol: node.type,
        message: `${target} WireGuard 输出使用默认 self-ip，且 peer/pre-shared-key 等高级字段可能无法完整保留。`,
      }, node.name);
    }

    if (WIREGUARD_MANUAL_TARGETS.has(target) && node.type === 'wireguard') {
      addWarning(warnings, `wireguard:${target}`, {
        code: 'FEATURE_PARTIAL',
        severity: 'warning',
        target,
        protocol: node.type,
        message: `${target} WireGuard 输出为尽力兼容，客户端可能仍需要补充本地地址和 peer 参数。`,
      }, node.name);
    }
  }

  const supported = nodes.filter((node) => supportedSet.has(node.type));
  const skipped = nodes
    .filter((node) => !supportedSet.has(node.type))
    .map((node) => `${node.name} (${node.type})`);

  return {
    supported,
    skipped,
    warnings: Array.from(warnings.values()),
  };
}
