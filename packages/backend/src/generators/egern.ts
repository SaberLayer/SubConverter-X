import { Generator, ProxyGroup, ProxyNode, ProxyProtocol, TargetFormat } from '../core/types';
import { clashMetaGenerator } from './clash-meta';

export const egernGenerator: Generator = {
  id: 'egern' as TargetFormat,
  supportedProtocols: clashMetaGenerator.supportedProtocols as ProxyProtocol[],
  generate(nodes: ProxyNode[], ruleTemplate?: string, proxyGroups?: ProxyGroup[]): string {
    return clashMetaGenerator.generate(nodes, ruleTemplate, proxyGroups);
  },
};

export default egernGenerator;
