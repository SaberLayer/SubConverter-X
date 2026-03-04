import { Generator, ProxyNode, ProxyProtocol, TargetFormat } from '../core/types';
import { v2rayUriGenerator } from './v2ray-uri';

export const mixedGenerator: Generator = {
  id: 'mixed' as TargetFormat,
  supportedProtocols: v2rayUriGenerator.supportedProtocols as ProxyProtocol[],
  generate(nodes: ProxyNode[], _ruleTemplate?: string): string {
    return v2rayUriGenerator.generate(nodes);
  },
};

export default mixedGenerator;
