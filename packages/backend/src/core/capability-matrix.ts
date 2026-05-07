import type { ProxyNode, ProxyProtocol, TargetFormat } from './types';

export type CapabilityStatus = 'full' | 'partial' | 'unsupported';

export type CapabilityWarningCode =
  | 'FORMAT_ALIAS'
  | 'UNSUPPORTED_PROTOCOL'
  | 'TRANSPORT_DOWNGRADED'
  | 'FEATURE_PARTIAL';

export interface ProtocolCapability {
  status: CapabilityStatus;
  note?: string;
}

export interface CapabilityWarningDraft {
  code: CapabilityWarningCode;
  message: string;
  protocol?: ProxyProtocol;
}

export const PROTOCOLS: ProxyProtocol[] = [
  'ss',
  'ssr',
  'vmess',
  'vless',
  'trojan',
  'hysteria',
  'hysteria2',
  'tuic',
  'wireguard',
  'socks',
  'http',
];

export const TARGETS: TargetFormat[] = [
  'auto',
  'clash',
  'clashr',
  'clash-meta',
  'singbox',
  'surge',
  'surgemac',
  'egern',
  'stash',
  'surfboard',
  'quantumultx',
  'shadowrocket',
  'loon',
  'v2ray',
  'v2ray-uri',
  'mixed',
  'base64',
  'plain-json',
];

const full = (note?: string): ProtocolCapability => ({ status: 'full', note });
const partial = (note: string): ProtocolCapability => ({ status: 'partial', note });
const unsupported = (note: string): ProtocolCapability => ({ status: 'unsupported', note });

function buildCapabilities(
  supportedProtocols: ProxyProtocol[],
  partials: Partial<Record<ProxyProtocol, string>> = {},
  unsupportedNotes: Partial<Record<ProxyProtocol, string>> = {}
): Record<ProxyProtocol, ProtocolCapability> {
  const supported = new Set(supportedProtocols);
  const rows = {} as Record<ProxyProtocol, ProtocolCapability>;

  for (const protocol of PROTOCOLS) {
    if (!supported.has(protocol)) {
      rows[protocol] = unsupported(unsupportedNotes[protocol] || '目标格式没有对应协议语法，节点会被跳过。');
    } else if (partials[protocol]) {
      rows[protocol] = partial(partials[protocol]!);
    } else {
      rows[protocol] = full();
    }
  }

  return rows;
}

const allProtocols = [...PROTOCOLS];
const uriProtocols = [...PROTOCOLS];
const clientTextProtocols: ProxyProtocol[] = ['ss', 'ssr', 'vmess', 'vless', 'trojan', 'hysteria2', 'tuic', 'wireguard', 'socks', 'http'];
const v2rayProtocols: ProxyProtocol[] = ['ss', 'vmess', 'vless', 'trojan', 'socks', 'http'];
const singboxProtocols: ProxyProtocol[] = ['ss', 'vmess', 'vless', 'trojan', 'hysteria', 'hysteria2', 'tuic', 'wireguard', 'socks', 'http'];

const wireGuardManualAddress = 'WireGuard 需要本地地址/peer 等运行时参数，当前输出仅保留基础连接字段。';
const wireGuardSingboxAddress = 'sing-box WireGuard 输出使用默认 local_address 10.0.0.2/32，请按实际隧道地址手动调整。';
const wireGuardSurgeSection = 'WireGuard 输出使用默认 self-ip，peer/pre-shared-key 等高级字段可能无法完整保留。';
const hysteriaUriCompat = 'Hysteria v1 URI 可表达基础认证和带宽字段，部分 obfs 细节可能需要手动确认。';

const clashMetaCapabilities = buildCapabilities(allProtocols);
const uriCapabilities = buildCapabilities(uriProtocols, {
  hysteria: hysteriaUriCompat,
  wireguard: wireGuardManualAddress,
});
const clientTextCapabilities = buildCapabilities(clientTextProtocols, {
  wireguard: 'WireGuard 输出为客户端文本语法的尽力兼容，可能仍需补充本地地址和 peer 参数。',
});
const surgeCapabilities = buildCapabilities(clientTextProtocols, {
  wireguard: wireGuardSurgeSection,
});

export const CAPABILITY_MATRIX: Record<TargetFormat, Record<ProxyProtocol, ProtocolCapability>> = {
  auto: clashMetaCapabilities,
  clash: clashMetaCapabilities,
  clashr: clashMetaCapabilities,
  'clash-meta': clashMetaCapabilities,
  egern: clashMetaCapabilities,
  stash: clashMetaCapabilities,

  singbox: buildCapabilities(singboxProtocols, {
    wireguard: wireGuardSingboxAddress,
  }),

  surge: surgeCapabilities,
  surgemac: surgeCapabilities,
  surfboard: surgeCapabilities,

  quantumultx: clientTextCapabilities,
  loon: clientTextCapabilities,

  shadowrocket: uriCapabilities,
  base64: uriCapabilities,
  'v2ray-uri': uriCapabilities,
  mixed: uriCapabilities,

  v2ray: buildCapabilities(v2rayProtocols),
  'plain-json': buildCapabilities(allProtocols),
};

const FORMAT_ALIAS_WARNINGS: Partial<Record<TargetFormat, CapabilityWarningDraft>> = {
  auto: {
    code: 'FORMAT_ALIAS',
    message: 'auto 当前按 Clash Meta 输出生成，客户端专有字段请以实际目标客户端为准。',
  },
  clash: {
    code: 'FORMAT_ALIAS',
    message: 'clash 当前复用 Clash Meta 兼容输出，建议在目标客户端中验证高级字段兼容性。',
  },
  clashr: {
    code: 'FORMAT_ALIAS',
    message: 'clashr 当前复用 Clash Meta 兼容输出，建议在目标客户端中验证高级字段兼容性。',
  },
  egern: {
    code: 'FORMAT_ALIAS',
    message: 'egern 当前复用 Clash Meta 兼容输出，建议在目标客户端中验证高级字段兼容性。',
  },
  stash: {
    code: 'FORMAT_ALIAS',
    message: 'stash 当前复用 Clash Meta 兼容输出，建议在目标客户端中验证高级字段兼容性。',
  },
  surgemac: {
    code: 'FORMAT_ALIAS',
    message: 'surgemac 当前复用 Surge 兼容输出，部分客户端专有字段可能需要手动调整。',
  },
  surfboard: {
    code: 'FORMAT_ALIAS',
    message: 'surfboard 当前复用 Surge 兼容输出，部分客户端专有字段可能需要手动调整。',
  },
};

const wsLikeDowngradeTargets = new Set<TargetFormat>(['surge', 'surgemac', 'surfboard', 'quantumultx', 'loon']);
const realityLimitedTargets = new Set<TargetFormat>(['surge', 'surgemac', 'surfboard', 'quantumultx', 'loon']);
const clashMetaTargets = new Set<TargetFormat>(['auto', 'clash', 'clashr', 'clash-meta', 'egern', 'stash']);

export function getTargetProtocolCapability(target: TargetFormat, protocol: ProxyProtocol): ProtocolCapability {
  return CAPABILITY_MATRIX[target]?.[protocol] || unsupported('未知目标格式或协议。');
}

export function getTargetFormatWarning(target: TargetFormat): CapabilityWarningDraft | undefined {
  return FORMAT_ALIAS_WARNINGS[target];
}

export function getSupportedProtocolsForTarget(target: TargetFormat): ProxyProtocol[] {
  const capabilities = CAPABILITY_MATRIX[target];
  if (!capabilities) return [];
  return PROTOCOLS.filter((protocol) => capabilities[protocol].status !== 'unsupported');
}

export function getFeatureWarningsForNode(target: TargetFormat, node: ProxyNode): CapabilityWarningDraft[] {
  const warnings: CapabilityWarningDraft[] = [];

  if (target === 'singbox' && (node.transport === 'xhttp' || node.transport === 'splithttp')) {
    warnings.push({
      code: 'TRANSPORT_DOWNGRADED',
      protocol: node.type,
      message: 'sing-box 输出暂将 xHTTP/SplitHTTP 映射为 HTTPUpgrade，mode、xmux 等细节不会完整保留。',
    });
  }

  if (wsLikeDowngradeTargets.has(target) && (node.transport === 'xhttp' || node.transport === 'splithttp')) {
    warnings.push({
      code: 'TRANSPORT_DOWNGRADED',
      protocol: node.type,
      message: `${target} 输出会将 xHTTP/SplitHTTP 按 WebSocket 类配置生成，请在客户端中验证可用性。`,
    });
  }

  if (clashMetaTargets.has(target) && (node.transport === 'xhttp' || node.transport === 'splithttp') && node.type !== 'vless') {
    warnings.push({
      code: 'FEATURE_PARTIAL',
      protocol: node.type,
      message: 'mihomo 的 xHTTP 传输主要面向 VLESS；非 VLESS 节点会保留 xhttp-opts，但需要在目标内核中验证。',
    });
  }

  if (realityLimitedTargets.has(target) && node.tls === 'reality') {
    warnings.push({
      code: 'FEATURE_PARTIAL',
      protocol: node.type,
      message: `${target} 输出无法完整表达 Reality 参数，public-key、short-id 等字段可能需要手动补充。`,
    });
  }

  return warnings;
}

