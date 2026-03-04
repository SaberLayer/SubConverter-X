import { Generator, ProxyGroup, ProxyNode, ProxyProtocol, TargetFormat } from '../core/types';
import { surgeGenerator } from './surge';

export const surgemacGenerator: Generator = {
  id: 'surgemac' as TargetFormat,
  supportedProtocols: surgeGenerator.supportedProtocols as ProxyProtocol[],
  generate(nodes: ProxyNode[], ruleTemplate?: string, proxyGroups?: ProxyGroup[]): string {
    return surgeGenerator.generate(nodes, ruleTemplate, proxyGroups);
  },
};

export default surgemacGenerator;
