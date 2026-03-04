import { Generator, ProxyGroup, ProxyProtocol, ProxyNode, TargetFormat } from '../core/types';
import { clashMetaGenerator } from './clash-meta';

export const stashGenerator: Generator = {
  id: 'stash' as TargetFormat,
  supportedProtocols: clashMetaGenerator.supportedProtocols as ProxyProtocol[],
  generate(nodes: ProxyNode[], ruleTemplate?: string, proxyGroups?: ProxyGroup[]): string {
    return clashMetaGenerator.generate(nodes, ruleTemplate, proxyGroups);
  },
};

export default stashGenerator;
