import { Generator, ProxyNode, ProxyProtocol, ProxyGroup, TargetFormat } from '../core/types';
import { resolveProxyGroups, buildDefaultGroups, ResolvedGroup } from '../core/proxy-group';

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
    case 'vmess': {
      parts.push(`vmess, ${node.server}, ${node.port}, username=${node.uuid}`);
      if (node.tls !== 'none') parts.push(', tls=true');
      if (node.transport === 'ws') {
        parts.push(', ws=true');
        if (node.wsPath) parts.push(`, ws-path=${node.wsPath}`);
        if (node.wsHeaders?.Host) parts.push(`, ws-headers=Host:${node.wsHeaders.Host}`);
      }
      if ((node.alterId ?? 0) === 0) parts.push(', vmess-aead=true');
      if (node.sni) parts.push(`, sni=${node.sni}`);
      if (node.skipCertVerify) parts.push(', skip-cert-verify=true');
      break;
    }
    case 'trojan': {
      parts.push(`trojan, ${node.server}, ${node.port}, password=${node.password}`);
      if (node.sni) parts.push(`, sni=${node.sni}`);
      if (node.skipCertVerify) parts.push(', skip-cert-verify=true');
      if (node.transport === 'ws') {
        parts.push(', ws=true');
        if (node.wsPath) parts.push(`, ws-path=${node.wsPath}`);
      }
      break;
    }
    case 'hysteria2': {
      parts.push(`hysteria2, ${node.server}, ${node.port}, password=${node.password}`);
      if (node.sni) parts.push(`, sni=${node.sni}`);
      if (node.skipCertVerify) parts.push(', skip-cert-verify=true');
      break;
    }
    case 'tuic': {
      parts.push(`tuic, ${node.server}, ${node.port}, token=${node.uuid}, password=${node.password}`);
      if (node.sni) parts.push(`, sni=${node.sni}`);
      if (node.alpn?.length) parts.push(`, alpn=${node.alpn[0]}`);
      break;
    }
    case 'wireguard': {
      const sectionName = `wg-${node.name.replace(/[^a-zA-Z0-9-]/g, '')}`;
      parts.push(`wireguard, section-name=${sectionName}`);
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
  supportedProtocols: ['ss', 'vmess', 'trojan', 'hysteria2', 'tuic', 'wireguard'] as ProxyProtocol[],

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
      const members = [...g.nodeNames, ...g.extraProxies].join(', ');
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
