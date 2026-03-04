import { Generator, ProxyNode, ProxyProtocol, TargetFormat } from '../core/types';

function appendStream(parts: string[], node: ProxyNode) {
  if (node.transport === 'ws' || node.transport === 'httpupgrade' || node.transport === 'xhttp' || node.transport === 'splithttp') {
    parts.push(', obfs=ws');
    const host = node.wsHeaders?.Host || node.xhttpHost;
    const path = node.wsPath || node.xhttpPath;
    if (host) parts.push(`, obfs-host=${host}`);
    if (path) parts.push(`, obfs-uri=${path}`);
    return;
  }
  if (node.transport === 'h2') {
    parts.push(', obfs=http');
    if (node.h2Host?.length) parts.push(`, obfs-host=${node.h2Host[0]}`);
    if (node.h2Path) parts.push(`, obfs-uri=${node.h2Path}`);
    return;
  }
  if (node.transport === 'grpc') {
    parts.push(', obfs=grpc');
    if (node.grpcServiceName) parts.push(`, obfs-uri=${node.grpcServiceName}`);
  }
}

function buildLine(node: ProxyNode): string {
  switch (node.type) {
    case 'ss': {
      const parts: string[] = [`shadowsocks=${node.server}:${node.port}, method=${node.method}, password=${node.password}`];
      if (node.transport === 'ws') {
        parts.push(', obfs=ws');
        if (node.wsHeaders?.Host) parts.push(`, obfs-host=${node.wsHeaders.Host}`);
        if (node.wsPath) parts.push(`, obfs-uri=${node.wsPath}`);
      }
      parts.push(`, fast-open=false, udp-relay=${node.udp === false ? 'false' : 'true'}`);
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
      const parts: string[] = [`vmess=${node.server}:${node.port}, method=${node.method || 'auto'}, password=${node.uuid}`];
      appendStream(parts, node);
      if (node.tls !== 'none') {
        parts.push(', over-tls=true');
        if (node.sni) parts.push(`, tls-host=${node.sni}`);
      }
      if (node.skipCertVerify) parts.push(', tls-verification=false');
      if (node.alpn?.length) parts.push(`, alpn=${node.alpn[0]}`);
      parts.push(`, tag=${node.name}`);
      return parts.join('');
    }
    case 'vless': {
      const parts: string[] = [`vless=${node.server}:${node.port}, method=none, password=${node.uuid}`];
      appendStream(parts, node);
      if (node.tls !== 'none') {
        parts.push(', over-tls=true');
        if (node.sni) parts.push(`, tls-host=${node.sni}`);
      }
      if (node.skipCertVerify) parts.push(', tls-verification=false');
      if (node.alpn?.length) parts.push(`, alpn=${node.alpn[0]}`);
      parts.push(`, tag=${node.name}`);
      return parts.join('');
    }
    case 'trojan': {
      const parts: string[] = [`trojan=${node.server}:${node.port}, password=${node.password}`];
      appendStream(parts, node);
      parts.push(', over-tls=true');
      if (node.sni) parts.push(`, tls-host=${node.sni}`);
      if (node.skipCertVerify) parts.push(', tls-verification=false');
      if (node.alpn?.length) parts.push(`, alpn=${node.alpn[0]}`);
      parts.push(`, tag=${node.name}`);
      return parts.join('');
    }
    case 'hysteria2': {
      const parts: string[] = [`hysteria2=${node.server}:${node.port}, password=${node.password}`];
      if (node.sni) parts.push(`, tls-host=${node.sni}`);
      if (node.skipCertVerify) parts.push(', tls-verification=false');
      if (node.obfsPassword) {
        parts.push(', obfs=salamander');
        parts.push(`, obfs-password=${node.obfsPassword}`);
      }
      if (node.alpn?.length) parts.push(`, alpn=${node.alpn[0]}`);
      parts.push(`, tag=${node.name}`);
      return parts.join('');
    }
    case 'tuic': {
      const parts: string[] = [`tuic=${node.server}:${node.port}, token=${node.uuid || ''}, password=${node.password || ''}`];
      if (node.sni) parts.push(`, sni=${node.sni}`);
      if (node.alpn?.length) parts.push(`, alpn=${node.alpn[0]}`);
      if (node.congestionControl) parts.push(`, congestion-control=${node.congestionControl}`);
      if (node.udpRelayMode) parts.push(`, udp-relay-mode=${node.udpRelayMode}`);
      parts.push(`, tag=${node.name}`);
      return parts.join('');
    }
    case 'wireguard': {
      const parts: string[] = [`wireguard=${node.server}:${node.port}`];
      if (node.privateKey) parts.push(`, private-key=${node.privateKey}`);
      if (node.publicKey) parts.push(`, public-key=${node.publicKey}`);
      if (node.preSharedKey) parts.push(`, pre-shared-key=${node.preSharedKey}`);
      if (node.mtu) parts.push(`, mtu=${node.mtu}`);
      parts.push(`, tag=${node.name}`);
      return parts.join('');
    }
    case 'socks': {
      const parts: string[] = [`socks5=${node.server}:${node.port}`];
      if (node.uuid) parts.push(`, username=${node.uuid}`);
      if (node.password) parts.push(`, password=${node.password}`);
      if (node.tls !== 'none') parts.push(', over-tls=true');
      parts.push(`, tag=${node.name}`);
      return parts.join('');
    }
    case 'http': {
      const parts: string[] = [`http=${node.server}:${node.port}`];
      if (node.uuid) parts.push(`, username=${node.uuid}`);
      if (node.password) parts.push(`, password=${node.password}`);
      if (node.tls !== 'none') parts.push(', over-tls=true');
      parts.push(`, tag=${node.name}`);
      return parts.join('');
    }
    default:
      return '';
  }
}

export const quantumultxGenerator: Generator = {
  id: 'quantumultx' as TargetFormat,
  supportedProtocols: ['ss', 'ssr', 'vmess', 'vless', 'trojan', 'hysteria2', 'tuic', 'wireguard', 'socks', 'http'] as ProxyProtocol[],

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
