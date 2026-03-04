import { Generator, ProxyNode, ProxyProtocol, ProxyGroup, TargetFormat } from '../core/types';
import { resolveProxyGroups, buildDefaultGroups, ResolvedGroup } from '../core/proxy-group';

function appendWsLike(parts: string[], node: ProxyNode) {
  const wsPath = node.wsPath || node.xhttpPath;
  const wsHost = node.wsHeaders?.Host || node.xhttpHost;
  parts.push(', ws=true');
  if (wsPath) parts.push(`, ws-path=${wsPath}`);
  if (wsHost) parts.push(`, ws-headers=Host:${wsHost}`);
}

function appendTransport(parts: string[], node: ProxyNode) {
  if (node.transport === 'ws' || node.transport === 'httpupgrade' || node.transport === 'xhttp' || node.transport === 'splithttp') {
    appendWsLike(parts, node);
    return;
  }
  if (node.transport === 'grpc') {
    parts.push(', transport=grpc');
    if (node.grpcServiceName) parts.push(`, service-name=${node.grpcServiceName}`);
    return;
  }
  if (node.transport === 'h2') {
    parts.push(', transport=h2');
    if (node.h2Path) parts.push(`, path=${node.h2Path}`);
    if (node.h2Host?.length) parts.push(`, host=${node.h2Host[0]}`);
  }
}

function normalizeGroupMember(member: string): string {
  const upper = member.toUpperCase();
  if (upper === 'DIRECT') return 'DIRECT';
  if (upper === 'REJECT') return 'REJECT';
  return member;
}

function buildProxyLine(node: ProxyNode): string {
  const parts: string[] = [node.name, '='];

  switch (node.type) {
    case 'ss': {
      parts.push(`ss, ${node.server}, ${node.port}, encrypt-method=${node.method}, password=${node.password}`);
      if (node.udp) parts.push(', udp-relay=true');
      if (node.transport === 'ws') {
        parts.push(', obfs=ws');
        if (node.wsHeaders?.Host) parts.push(`, obfs-host=${node.wsHeaders.Host}`);
        if (node.wsPath) parts.push(`, obfs-uri=${node.wsPath}`);
      }
      break;
    }
    case 'ssr': {
      parts.push(`ssr, ${node.server}, ${node.port}, encrypt-method=${node.method}, password=${node.password}`);
      if (node.ssrProtocol) parts.push(`, protocol=${node.ssrProtocol}`);
      if (node.ssrProtocolParam) parts.push(`, protocol-param=${node.ssrProtocolParam}`);
      if (node.ssrObfs) parts.push(`, obfs=${node.ssrObfs}`);
      if (node.ssrObfsParam) parts.push(`, obfs-param=${node.ssrObfsParam}`);
      if (node.udp) parts.push(', udp-relay=true');
      break;
    }
    case 'vmess': {
      parts.push(`vmess, ${node.server}, ${node.port}, username=${node.uuid}`);
      if (node.tls !== 'none') parts.push(', tls=true');
      appendTransport(parts, node);
      if ((node.alterId ?? 0) === 0) parts.push(', vmess-aead=true');
      if (node.sni) parts.push(`, sni=${node.sni}`);
      if (node.skipCertVerify) parts.push(', skip-cert-verify=true');
      if (node.alpn?.length) parts.push(`, alpn=${node.alpn[0]}`);
      break;
    }
    case 'vless': {
      parts.push(`vless, ${node.server}, ${node.port}, username=${node.uuid}`);
      if (node.tls !== 'none') parts.push(', tls=true');
      if (node.flow) parts.push(`, flow=${node.flow}`);
      appendTransport(parts, node);
      if (node.sni) parts.push(`, sni=${node.sni}`);
      if (node.skipCertVerify) parts.push(', skip-cert-verify=true');
      if (node.alpn?.length) parts.push(`, alpn=${node.alpn[0]}`);
      break;
    }
    case 'trojan': {
      parts.push(`trojan, ${node.server}, ${node.port}, password=${node.password}`);
      if (node.sni) parts.push(`, sni=${node.sni}`);
      if (node.skipCertVerify) parts.push(', skip-cert-verify=true');
      appendTransport(parts, node);
      if (node.alpn?.length) parts.push(`, alpn=${node.alpn[0]}`);
      break;
    }
    case 'hysteria2': {
      parts.push(`hysteria2, ${node.server}, ${node.port}, password=${node.password}`);
      if (node.sni) parts.push(`, sni=${node.sni}`);
      if (node.skipCertVerify) parts.push(', skip-cert-verify=true');
      if (node.obfsPassword) {
        parts.push(', obfs=salamander');
        parts.push(`, obfs-password=${node.obfsPassword}`);
      }
      if (node.alpn?.length) parts.push(`, alpn=${node.alpn[0]}`);
      break;
    }
    case 'tuic': {
      parts.push(`tuic, ${node.server}, ${node.port}, token=${node.uuid}, password=${node.password}`);
      if (node.sni) parts.push(`, sni=${node.sni}`);
      if (node.alpn?.length) parts.push(`, alpn=${node.alpn[0]}`);
      if (node.congestionControl) parts.push(`, congestion-controller=${node.congestionControl}`);
      if (node.udpRelayMode) parts.push(`, udp-relay-mode=${node.udpRelayMode}`);
      if (node.skipCertVerify) parts.push(', skip-cert-verify=true');
      break;
    }
    case 'wireguard': {
      const sectionName = `wg-${node.name.replace(/[^a-zA-Z0-9-]/g, '')}`;
      parts.push(`wireguard, section-name=${sectionName}`);
      break;
    }
    case 'socks': {
      parts.push(`${node.tls !== 'none' ? 'socks5-tls' : 'socks5'}, ${node.server}, ${node.port}`);
      if (node.uuid) parts.push(`, username=${node.uuid}`);
      if (node.password) parts.push(`, password=${node.password}`);
      break;
    }
    case 'http': {
      parts.push(`${node.tls !== 'none' ? 'https' : 'http'}, ${node.server}, ${node.port}`);
      if (node.uuid) parts.push(`, username=${node.uuid}`);
      if (node.password) parts.push(`, password=${node.password}`);
      if (node.sni) parts.push(`, sni=${node.sni}`);
      if (node.skipCertVerify) parts.push(', skip-cert-verify=true');
      break;
    }
    default:
      return '';
  }

  return parts.join('');
}

function buildWireGuardSection(node: ProxyNode): string {
  if (node.type !== 'wireguard') return '';
  const sectionName = `wg-${node.name.replace(/[^a-zA-Z0-9-]/g, '')}`;
  const lines: string[] = [`[WireGuard ${sectionName}]`];
  if (node.privateKey) lines.push(`private-key = ${node.privateKey}`);
  lines.push(`self-ip = 10.0.0.2`);
  if (node.mtu) lines.push(`mtu = ${node.mtu}`);
  if (node.publicKey) lines.push(`peer = (public-key = ${node.publicKey}, endpoint = ${node.server}:${node.port}, allowed-ips = "0.0.0.0/0, ::/0")`);
  if (node.reservedBytes) lines.push(`reserved = [${node.reservedBytes.join(', ')}]`);
  return lines.join('\n');
}

function getDefaultRules(ruleTemplate?: string): string[] {
  if (ruleTemplate) {
    return ruleTemplate.split('\n').filter(l => l.trim());
  }
  return ['FINAL,Proxy'];
}

export const surgeGenerator: Generator = {
  id: 'surge' as TargetFormat,
  supportedProtocols: ['ss', 'ssr', 'vmess', 'vless', 'trojan', 'hysteria2', 'tuic', 'wireguard', 'socks', 'http'] as ProxyProtocol[],

  generate(nodes: ProxyNode[], ruleTemplate?: string, proxyGroups?: ProxyGroup[]): string {
    const filtered = nodes.filter(n => this.supportedProtocols.includes(n.type));
    const names = filtered.map(n => n.name);

    const resolved: ResolvedGroup[] = proxyGroups?.length
      ? resolveProxyGroups(proxyGroups, names)
      : buildDefaultGroups(names);

    const sections: string[] = [];

    // [General]
    sections.push('[General]');
    sections.push('loglevel = notify');
    sections.push('skip-proxy = 127.0.0.1, 192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12, 100.64.0.0/10, localhost, *.local');
    sections.push('');

    // [Proxy]
    sections.push('[Proxy]');
    sections.push('DIRECT = direct');
    sections.push('REJECT = reject');
    for (const node of filtered) {
      const line = buildProxyLine(node);
      if (line) sections.push(line);
    }
    sections.push('');

    // WireGuard sections
    const wgNodes = filtered.filter(n => n.type === 'wireguard');
    for (const node of wgNodes) {
      const section = buildWireGuardSection(node);
      if (section) {
        sections.push(section);
        sections.push('');
      }
    }

    // [Proxy Group]
    sections.push('[Proxy Group]');
    for (const g of resolved) {
      const members = [...g.nodeNames, ...g.extraProxies.map((m) => normalizeGroupMember(m))].join(', ');
      switch (g.type) {
        case 'select':
          sections.push(`${g.name} = select, ${members}`);
          break;
        case 'url-test':
          sections.push(`${g.name} = url-test, ${members}, url=${g.url}, interval=${g.interval}`);
          break;
        case 'fallback':
          sections.push(`${g.name} = fallback, ${members}, url=${g.url}, interval=${g.interval}`);
          break;
        case 'load-balance':
          sections.push(`${g.name} = load-balance, ${members}, url=${g.url}, interval=${g.interval}`);
          break;
      }
    }
    sections.push('');

    // [Rule]
    sections.push('[Rule]');
    const rules = getDefaultRules(ruleTemplate);
    for (const rule of rules) {
      sections.push(rule);
    }

    return sections.join('\n');
  },
};
