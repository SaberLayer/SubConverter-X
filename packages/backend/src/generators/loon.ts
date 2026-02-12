import { Generator, ProxyNode, ProxyProtocol, TargetFormat } from '../core/types';

function buildLine(node: ProxyNode): string {
  switch (node.type) {
    case 'ss': {
      const parts: string[] = [`${node.name} = Shadowsocks,${node.server},${node.port},${node.method},"${node.password}"`];
      if (node.transport === 'ws') {
        parts.push(`,transport=ws`);
        if (node.wsPath) parts.push(`,path=${node.wsPath}`);
        if (node.wsHeaders?.Host) parts.push(`,host=${node.wsHeaders.Host}`);
      }
      return parts.join('');
    }
    case 'ssr': {
      const parts: string[] = [
        `${node.name} = ShadowsocksR,${node.server},${node.port},${node.method},"${node.password}"`,
      ];
      if (node.ssrProtocol) parts.push(`,protocol=${node.ssrProtocol}`);
      if (node.ssrProtocolParam) parts.push(`,protocol-param=${node.ssrProtocolParam}`);
      if (node.ssrObfs) parts.push(`,obfs=${node.ssrObfs}`);
      if (node.ssrObfsParam) parts.push(`,obfs-param=${node.ssrObfsParam}`);
      return parts.join('');
    }
    case 'vmess': {
      const parts: string[] = [
        `${node.name} = Vmess,${node.server},${node.port},${node.method || 'auto'},"${node.uuid}"`,
      ];
      if (node.transport === 'ws') {
        parts.push(`,transport=ws`);
        if (node.wsPath) parts.push(`,path=${node.wsPath}`);
        if (node.wsHeaders?.Host) parts.push(`,host=${node.wsHeaders.Host}`);
      }
      if (node.tls !== 'none') {
        parts.push(`,over-tls=true`);
        if (node.sni) parts.push(`,tls-name=${node.sni}`);
      }
      if (node.skipCertVerify) parts.push(`,skip-cert-verify=true`);
      return parts.join('');
    }
    case 'trojan': {
      const parts: string[] = [
        `${node.name} = trojan,${node.server},${node.port},"${node.password}"`,
      ];
      if (node.transport === 'ws') {
        parts.push(`,transport=ws`);
        if (node.wsPath) parts.push(`,path=${node.wsPath}`);
        if (node.wsHeaders?.Host) parts.push(`,host=${node.wsHeaders.Host}`);
      }
      if (node.sni) parts.push(`,tls-name=${node.sni}`);
      if (node.skipCertVerify) parts.push(`,skip-cert-verify=true`);
      return parts.join('');
    }
    default:
      return '';
  }
}

export const loonGenerator: Generator = {
  id: 'loon' as TargetFormat,
  supportedProtocols: ['ss', 'ssr', 'vmess', 'trojan'] as ProxyProtocol[],

  generate(nodes: ProxyNode[], _ruleTemplate?: string): string {
    const filtered = nodes.filter(n => this.supportedProtocols.includes(n.type));
    const lines = ['[Proxy]'];
    for (const node of filtered) {
      const line = buildLine(node);
      if (line) lines.push(line);
    }
    return lines.join('\n');
  },
};
