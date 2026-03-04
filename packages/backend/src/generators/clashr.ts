import { Generator, ProxyGroup, ProxyNode, ProxyProtocol, TargetFormat } from '../core/types';
import { clashMetaGenerator } from './clash-meta';

export const clashrGenerator: Generator = {
  id: 'clashr' as TargetFormat,
  supportedProtocols: clashMetaGenerator.supportedProtocols as ProxyProtocol[],
  generate(nodes: ProxyNode[], ruleTemplate?: string, proxyGroups?: ProxyGroup[]): string {
    return clashMetaGenerator.generate(nodes, ruleTemplate, proxyGroups);
  },
};

export default clashrGenerator;
