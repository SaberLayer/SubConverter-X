import type { ProxyNode, ProxyProtocol, TargetFormat } from './types';
import {
  getFeatureWarningsForNode,
  getTargetFormatWarning,
  getTargetProtocolCapability,
} from './capability-matrix';

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

  const aliasWarning = getTargetFormatWarning(target);
  if (aliasWarning) {
    addWarning(warnings, `alias:${target}`, {
      code: aliasWarning.code,
      severity: 'info',
      target,
      protocol: aliasWarning.protocol,
      message: aliasWarning.message,
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

    const capability = getTargetProtocolCapability(target, node.type);
    if (capability.status === 'partial' && capability.note) {
      addWarning(warnings, `partial:${target}:${node.type}`, {
        code: 'FEATURE_PARTIAL',
        severity: 'warning',
        target,
        protocol: node.type,
        message: capability.note,
      }, node.name);
    }

    for (const featureWarning of getFeatureWarningsForNode(target, node)) {
      addWarning(warnings, `feature:${target}:${node.type}:${node.transport}:${featureWarning.code}:${featureWarning.message}`, {
        code: featureWarning.code,
        severity: 'warning',
        target,
        protocol: featureWarning.protocol,
        message: featureWarning.message,
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
