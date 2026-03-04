import { Generator, ProxyGroup, ProxyProtocol, ProxyNode, TargetFormat } from '../core/types';
import { surgeGenerator } from './surge';

export const surfboardGenerator: Generator = {
  id: 'surfboard' as TargetFormat,
  supportedProtocols: surgeGenerator.supportedProtocols as ProxyProtocol[],
  generate(nodes: ProxyNode[], ruleTemplate?: string, proxyGroups?: ProxyGroup[]): string {
    return surgeGenerator.generate(nodes, ruleTemplate, proxyGroups);
  },
};

export default surfboardGenerator;
