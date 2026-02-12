import { Generator, ProxyNode, ProxyProtocol, TargetFormat } from '../core/types';

function safeBase64(str: string): string {
  return Buffer.from(str).toString('base64').replace(/=+$/, '');
}

function buildUri(node: ProxyNode): string {
  switch (node.type) {
    case 'ss': {
      const userinfo = safeBase64(`${node.method}:${node.password}`);
      return `ss://${userinfo}@${node.server}:${node.port}#${encodeURIComponent(node.name)}`;
    }
    case 'ssr': {
      const passB64 = safeBase64(node.password || '');
      const base = `${node.server}:${node.port}:${node.ssrProtocol}:${node.method}:${node.ssrObfs}:${passB64}`;
      const params: string[] = [];
      if (node.ssrProtocolParam) params.push(`protoparam=${safeBase64(node.ssrProtocolParam)}`);
      if (node.ssrObfsParam) params.push(`obfsparam=${safeBase64(node.ssrObfsParam)}`);
      params.push(`remarks=${safeBase64(node.name)}`);
      return `ssr://${safeBase64(`${base}/?${params.join('&')}`)}`;
    }
    case 'vmess': {
      const obj: Record<string, unknown> = {
        v: '2', ps: node.name, add: node.server, port: node.port,
        id: node.uuid, aid: node.alterId ?? 0,
        net: node.transport, type: 'none',
        host: node.wsHeaders?.Host || node.sni || '',
        path: node.wsPath || '',
        tls: node.tls !== 'none' ? 'tls' : '',
      };
      if (node.sni) obj.sni = node.sni;
      return `vmess://${Buffer.from(JSON.stringify(obj)).toString('base64')}`;
    }
    case 'vless': {
      const params = new URLSearchParams();
      if (node.tls !== 'none') params.set('security', node.tls);
      if (node.flow) params.set('flow', node.flow);
      params.set('type', node.transport);
      if (node.sni) params.set('sni', node.sni);
      if (node.fingerprint) params.set('fp', node.fingerprint);
      if (node.transport === 'ws') {
        if (node.wsPath) params.set('path', node.wsPath);
        if (node.wsHeaders?.Host) params.set('host', node.wsHeaders.Host);
      }
      if (node.transport === 'grpc' && node.grpcServiceName) {
        params.set('serviceName', node.grpcServiceName);
      }
      if (node.transport === 'h2') {
        if (node.h2Path) params.set('path', node.h2Path);
        if (node.h2Host?.length) params.set('host', node.h2Host[0]);
      }
      if (node.tls === 'reality') {
        if (node.realityPublicKey) params.set('pbk', node.realityPublicKey);
        if (node.realityShortId) params.set('sid', node.realityShortId);
      }
      if (node.alpn?.length) params.set('alpn', node.alpn.join(','));
      return `vless://${node.uuid}@${node.server}:${node.port}?${params.toString()}#${encodeURIComponent(node.name)}`;
    }
    case 'trojan': {
      const params = new URLSearchParams();
      params.set('type', node.transport);
      if (node.sni) params.set('sni', node.sni);
      if (node.transport === 'ws') {
        if (node.wsPath) params.set('path', node.wsPath);
        if (node.wsHeaders?.Host) params.set('host', node.wsHeaders.Host);
      }
      if (node.alpn?.length) params.set('alpn', node.alpn.join(','));
      if (node.skipCertVerify) params.set('allowInsecure', '1');
      return `trojan://${node.password}@${node.server}:${node.port}?${params.toString()}#${encodeURIComponent(node.name)}`;
    }
    case 'hysteria2': {
      const params = new URLSearchParams();
      if (node.sni) params.set('sni', node.sni);
      if (node.skipCertVerify) params.set('insecure', '1');
      if (node.obfsPassword) {
        params.set('obfs', 'salamander');
        params.set('obfs-password', node.obfsPassword);
      }
      return `hysteria2://${node.password}@${node.server}:${node.port}?${params.toString()}#${encodeURIComponent(node.name)}`;
    }
    default:
      return '';
  }
}

export const shadowrocketGenerator: Generator = {
  id: 'shadowrocket' as TargetFormat,
  supportedProtocols: ['ss', 'ssr', 'vmess', 'vless', 'trojan', 'hysteria2'] as ProxyProtocol[],

  generate(nodes: ProxyNode[], _ruleTemplate?: string): string {
    const filtered = nodes.filter(n => this.supportedProtocols.includes(n.type));
    const lines = filtered.map(buildUri).filter(Boolean);
    return Buffer.from(lines.join('\n')).toString('base64');
  },
};
