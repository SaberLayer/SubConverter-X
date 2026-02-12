import { Generator, ProxyNode, ProxyProtocol, TargetFormat } from '../core/types';

function buildStreamSettings(node: ProxyNode): Record<string, unknown> {
  const stream: Record<string, unknown> = {
    network: node.transport,
  };

  // Security
  if (node.tls === 'reality') {
    stream.security = 'reality';
    const realitySettings: Record<string, unknown> = {};
    if (node.realityPublicKey) realitySettings.publicKey = node.realityPublicKey;
    if (node.realityShortId) realitySettings.shortId = node.realityShortId;
    if (node.fingerprint) realitySettings.fingerprint = node.fingerprint;
    if (node.sni) realitySettings.serverName = node.sni;
    stream.realitySettings = realitySettings;
  } else if (node.tls !== 'none') {
    stream.security = 'tls';
    const tlsSettings: Record<string, unknown> = {};
    if (node.sni) tlsSettings.serverName = node.sni;
    if (node.fingerprint) tlsSettings.fingerprint = node.fingerprint;
    if (node.alpn) tlsSettings.alpn = node.alpn;
    stream.tlsSettings = tlsSettings;
  } else {
    stream.security = 'none';
  }

  // Transport settings
  if (node.transport === 'ws') {
    const wsSettings: Record<string, unknown> = {};
    if (node.wsPath) wsSettings.path = node.wsPath;
    if (node.wsHeaders) wsSettings.headers = node.wsHeaders;
    stream.wsSettings = wsSettings;
  } else if (node.transport === 'grpc') {
    const grpcSettings: Record<string, unknown> = {};
    if (node.grpcServiceName) grpcSettings.serviceName = node.grpcServiceName;
    stream.grpcSettings = grpcSettings;
  } else if (node.transport === 'h2') {
    const httpSettings: Record<string, unknown> = {};
    if (node.h2Path) httpSettings.path = node.h2Path;
    if (node.h2Host) httpSettings.host = node.h2Host;
    stream.httpSettings = httpSettings;
  }

  return stream;
}

function buildOutbound(node: ProxyNode): Record<string, unknown> {
  switch (node.type) {
    case 'vmess': {
      return {
        protocol: 'vmess',
        tag: node.name,
        settings: {
          vnext: [{
            address: node.server,
            port: node.port,
            users: [{
              id: node.uuid,
              alterId: node.alterId ?? 0,
              security: node.method || 'auto',
            }],
          }],
        },
        streamSettings: buildStreamSettings(node),
      };
    }
    case 'vless': {
      return {
        protocol: 'vless',
        tag: node.name,
        settings: {
          vnext: [{
            address: node.server,
            port: node.port,
            users: [{
              id: node.uuid,
              encryption: 'none',
              ...(node.flow ? { flow: node.flow } : {}),
            }],
          }],
        },
        streamSettings: buildStreamSettings(node),
      };
    }
    case 'trojan': {
      return {
        protocol: 'trojan',
        tag: node.name,
        settings: {
          servers: [{
            address: node.server,
            port: node.port,
            password: node.password,
          }],
        },
        streamSettings: buildStreamSettings(node),
      };
    }
    case 'ss': {
      return {
        protocol: 'shadowsocks',
        tag: node.name,
        settings: {
          servers: [{
            address: node.server,
            port: node.port,
            method: node.method,
            password: node.password,
          }],
        },
      };
    }
    default:
      return { protocol: 'freedom', tag: node.name };
  }
}

export const v2rayGenerator: Generator = {
  id: 'v2ray' as TargetFormat,
  supportedProtocols: ['ss', 'vmess', 'vless', 'trojan'] as ProxyProtocol[],

  generate(nodes: ProxyNode[], _ruleTemplate?: string): string {
    const filtered = nodes.filter(n => this.supportedProtocols.includes(n.type));
    const outbounds = filtered.map(buildOutbound);

    const config = {
      inbounds: [
        { tag: 'socks', port: 10808, listen: '127.0.0.1', protocol: 'socks', settings: { udp: true } },
        { tag: 'http', port: 10809, listen: '127.0.0.1', protocol: 'http' },
      ],
      outbounds: [
        ...outbounds,
        { protocol: 'freedom', tag: 'direct', settings: {} },
        { protocol: 'blackhole', tag: 'block', settings: {} },
      ],
    };

    return JSON.stringify(config, null, 2);
  },
};
