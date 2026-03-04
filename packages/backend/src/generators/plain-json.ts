import { Generator, ProxyNode, ProxyProtocol, TargetFormat } from '../core/types';

export const plainJsonGenerator: Generator = {
  id: 'plain-json' as TargetFormat,
  supportedProtocols: ['ss', 'ssr', 'vmess', 'vless', 'trojan', 'hysteria', 'hysteria2', 'tuic', 'wireguard', 'socks', 'http'] as ProxyProtocol[],
  generate(nodes: ProxyNode[], _ruleTemplate?: string): string {
    const filtered = nodes.filter((n) => this.supportedProtocols.includes(n.type));
    return JSON.stringify({
      version: 1,
      generatedAt: new Date().toISOString(),
      count: filtered.length,
      proxies: filtered,
    }, null, 2);
  },
};

export default plainJsonGenerator;
