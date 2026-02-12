import { Generator, ProxyNode, ProxyProtocol, TargetFormat } from '../core/types';

function buildLine(node: ProxyNode): string {
  switch (node.type) {
    case 'ss': {
      const parts: string[] = [`shadowsocks=${node.server}:${node.port}, method=${node.method}, password=${node.password}`];
      if (node.transport === 'ws') {
        parts.push(', obfs=ws');
        if (node.wsHeaders?.Host) parts.push(`, obfs-host=${node.wsHeaders.Host}`);
        if (node.wsPath) parts.push(`, obfs-uri=${node.wsPath}`);
      }
      parts.push(', fast-open=false, udp-relay=true');
      parts.push(`, tag=${node.name}`);
      return parts.join('');
    }
    case 'ssr': {
      const parts: string[] = [`shadowsocks=${node.server}:${node.port}, method=${node.method}, password=${node.password}`];
      if (node.ssrProtocol) parts.push(`, ssr-protocol=${node.ssrProtocol}`);
      if (node.ssrProtocolParam) parts.push(`, ssr-protocol-param=${node.ssrProtocolParam}`);
      if (node.ssrObfs) parts.push(`, obfs=${node.ssrObfs}`);
      if (node.ssrObfsParam) parts.push(`, obfs-param=${node.ssrObfsParam}`);
      parts.push(`, tag=${node.name}`);
      return parts.join('');
    }
    case 'vmess': {
      const parts: string[] = [`vmess=${node.server}:${node.port}, method=chacha20-poly1305, password=${node.uuid}`];
      if (node.transport === 'ws') {
        parts.push(', obfs=ws');
        if (node.wsHeaders?.Host) parts.push(`, obfs-host=${node.wsHeaders.Host}`);
        if (node.wsPath) parts.push(`, obfs-uri=${node.wsPath}`);
      }
      if (node.tls !== 'none') {
        parts.push(', over-tls=true');
        if (node.sni) parts.push(`, tls-host=${node.sni}`);
      }
      if (node.skipCertVerify) parts.push(', tls-verification=false');
      parts.push(`, tag=${node.name}`);
      return parts.join('');
    }
    case 'trojan': {
      const parts: string[] = [`trojan=${node.server}:${node.port}, password=${node.password}`];
      parts.push(', over-tls=true');
      if (node.sni) parts.push(`, tls-host=${node.sni}`);
      if (node.skipCertVerify) parts.push(', tls-verification=false');
      parts.push(`, tag=${node.name}`);
      return parts.join('');
    }
    default:
      return '';
  }
}

export const quantumultxGenerator: Generator = {
  id: 'quantumultx' as TargetFormat,
  supportedProtocols: ['ss', 'ssr', 'vmess', 'trojan'] as ProxyProtocol[],

  generate(nodes: ProxyNode[], _ruleTemplate?: string): string {
    const filtered = nodes.filter(n => this.supportedProtocols.includes(n.type));
    const lines = ['[server_local]'];
    for (const node of filtered) {
      const line = buildLine(node);
      if (line) lines.push(line);
    }
    return lines.join('\n');
  },
};
