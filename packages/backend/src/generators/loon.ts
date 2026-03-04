import { Generator, ProxyNode, ProxyProtocol, TargetFormat } from '../core/types';

function appendLoonTransport(parts: string[], node: ProxyNode) {
  if (node.transport === 'ws' || node.transport === 'httpupgrade' || node.transport === 'xhttp' || node.transport === 'splithttp') {
    parts.push(`,transport=ws`);
    const path = node.wsPath || node.xhttpPath;
    const host = node.wsHeaders?.Host || node.xhttpHost;
    if (path) parts.push(`,path=${path}`);
    if (host) parts.push(`,host=${host}`);
    return;
  }
  if (node.transport === 'h2') {
    parts.push(`,transport=h2`);
    if (node.h2Path) parts.push(`,path=${node.h2Path}`);
    if (node.h2Host?.length) parts.push(`,host=${node.h2Host[0]}`);
    return;
  }
  if (node.transport === 'grpc') {
    parts.push(`,transport=grpc`);
    if (node.grpcServiceName) parts.push(`,path=${node.grpcServiceName}`);
  }
}

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
      appendLoonTransport(parts, node);
      if (node.tls !== 'none') {
        parts.push(`,over-tls=true`);
        if (node.sni) parts.push(`,tls-name=${node.sni}`);
      }
      if (node.skipCertVerify) parts.push(`,skip-cert-verify=true`);
      if (node.alpn?.length) parts.push(`,alpn=${node.alpn[0]}`);
      return parts.join('');
    }
    case 'vless': {
      const parts: string[] = [
        `${node.name} = Vless,${node.server},${node.port},auto,"${node.uuid}"`,
      ];
      appendLoonTransport(parts, node);
      if (node.tls !== 'none') {
        parts.push(`,over-tls=true`);
        if (node.sni) parts.push(`,tls-name=${node.sni}`);
      }
      if (node.skipCertVerify) parts.push(`,skip-cert-verify=true`);
      if (node.alpn?.length) parts.push(`,alpn=${node.alpn[0]}`);
      return parts.join('');
    }
    case 'trojan': {
      const parts: string[] = [
        `${node.name} = trojan,${node.server},${node.port},"${node.password}"`,
      ];
      appendLoonTransport(parts, node);
      if (node.sni) parts.push(`,tls-name=${node.sni}`);
      if (node.skipCertVerify) parts.push(`,skip-cert-verify=true`);
      if (node.alpn?.length) parts.push(`,alpn=${node.alpn[0]}`);
      return parts.join('');
    }
    case 'hysteria2': {
      const parts: string[] = [
        `${node.name} = Hysteria2,${node.server},${node.port},"${node.password}"`,
      ];
      if (node.sni) parts.push(`,sni=${node.sni}`);
      if (node.skipCertVerify) parts.push(`,skip-cert-verify=true`);
      if (node.obfsPassword) {
        parts.push(`,obfs=salamander`);
        parts.push(`,obfs-password=${node.obfsPassword}`);
      }
      if (node.alpn?.length) parts.push(`,alpn=${node.alpn[0]}`);
      return parts.join('');
    }
    case 'tuic': {
      const parts: string[] = [
        `${node.name} = TUIC,${node.server},${node.port},"${node.uuid || ''}","${node.password || ''}"`,
      ];
      if (node.sni) parts.push(`,sni=${node.sni}`);
      if (node.alpn?.length) parts.push(`,alpn=${node.alpn[0]}`);
      if (node.congestionControl) parts.push(`,congestion-control=${node.congestionControl}`);
      if (node.udpRelayMode) parts.push(`,udp-relay-mode=${node.udpRelayMode}`);
      return parts.join('');
    }
    case 'wireguard': {
      const parts: string[] = [
        `${node.name} = WireGuard,${node.server},${node.port},private-key=${node.privateKey || ''}`,
      ];
      if (node.publicKey) parts.push(`,public-key=${node.publicKey}`);
      if (node.preSharedKey) parts.push(`,pre-shared-key=${node.preSharedKey}`);
      if (node.mtu) parts.push(`,mtu=${node.mtu}`);
      return parts.join('');
    }
    case 'socks': {
      const kind = node.tls !== 'none' ? 'Socks5-TLS' : 'Socks5';
      const parts: string[] = [
        `${node.name} = ${kind},${node.server},${node.port},"${node.uuid || ''}","${node.password || ''}"`,
      ];
      return parts.join('');
    }
    case 'http': {
      const kind = node.tls !== 'none' ? 'HTTPS' : 'HTTP';
      const parts: string[] = [
        `${node.name} = ${kind},${node.server},${node.port},"${node.uuid || ''}","${node.password || ''}"`,
      ];
      if (node.sni) parts.push(`,sni=${node.sni}`);
      return parts.join('');
    }
    default:
      return '';
  }
}

export const loonGenerator: Generator = {
  id: 'loon' as TargetFormat,
  supportedProtocols: ['ss', 'ssr', 'vmess', 'vless', 'trojan', 'hysteria2', 'tuic', 'wireguard', 'socks', 'http'] as ProxyProtocol[],

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
