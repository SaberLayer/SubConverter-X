import { Generator, ProxyProtocol, ProxyNode, TargetFormat } from '../core/types';
import { base64Generator } from './base64';

export const v2rayUriGenerator: Generator = {
  id: 'v2ray-uri' as TargetFormat,
  supportedProtocols: base64Generator.supportedProtocols as ProxyProtocol[],
  generate(nodes: ProxyNode[], _ruleTemplate?: string): string {
    const encoded = base64Generator.generate(nodes);
    if (!encoded) return '';
    return Buffer.from(encoded, 'base64').toString('utf-8');
  },
};

export default v2rayUriGenerator;
