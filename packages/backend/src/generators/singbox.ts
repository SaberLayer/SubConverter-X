import { Generator, ProxyNode, ProxyProtocol, ProxyGroup, TargetFormat } from '../core/types';
import { resolveProxyGroups, buildDefaultGroups, ResolvedGroup } from '../core/proxy-group';

function buildTransport(node: ProxyNode): Record<string, unknown> | undefined {
  switch (node.transport) {
    case 'ws': {
      const t: Record<string, unknown> = { type: 'ws' };
      if (node.wsPath) t.path = node.wsPath;
      if (node.wsHeaders) t.headers = node.wsHeaders;
      return t;
    }
    case 'grpc': {
      const t: Record<string, unknown> = { type: 'grpc' };
      if (node.grpcServiceName) t.service_name = node.grpcServiceName;
      return t;
    }
    case 'h2': {
      const t: Record<string, unknown> = { type: 'http' };
      if (node.h2Path) t.path = node.h2Path;
      if (node.h2Host) t.host = node.h2Host;
      return t;
    }
    case 'httpupgrade': {
      const t: Record<string, unknown> = { type: 'httpupgrade' };
      if (node.wsPath) t.path = node.wsPath;
      if (node.wsHeaders) t.headers = node.wsHeaders;
      return t;
    }
    case 'xhttp':
    case 'splithttp': {
      const t: Record<string, unknown> = { type: 'httpupgrade' }; // sing-box uses httpupgrade for xhttp
      if (node.xhttpPath) t.path = node.xhttpPath;
      if (node.xhttpHost) t.headers = { Host: node.xhttpHost };
      return t;
    }
    default:
      return undefined;
  }
}

function buildTls(node: ProxyNode): Record<string, unknown> | undefined {
  if (node.tls === 'none') return undefined;
  const tls: Record<string, unknown> = { enabled: true };
  if (node.sni) tls.server_name = node.sni;
  if (node.skipCertVerify) tls.insecure = true;
  if (node.alpn) tls.alpn = node.alpn;
  if (node.fingerprint) {
    tls.utls = { enabled: true, fingerprint: node.fingerprint };
  }
  if (node.tls === 'reality') {
    const reality: Record<string, unknown> = { enabled: true };
    if (node.realityPublicKey) reality.public_key = node.realityPublicKey;
    if (node.realityShortId) reality.short_id = node.realityShortId;
    tls.reality = reality;
  }
  return tls;
}

function buildOutbound(node: ProxyNode): Record<string, unknown> {
  const base: Record<string, unknown> = { tag: node.name, server: node.server, server_port: node.port };

  switch (node.type) {
    case 'ss': {
      return { ...base, type: 'shadowsocks', method: node.method, password: node.password };
    }
    case 'vmess': {
      const o: Record<string, unknown> = {
        ...base, type: 'vmess', uuid: node.uuid,
        alter_id: node.alterId ?? 0, security: node.method || 'auto',
      };
      const transport = buildTransport(node);
      if (transport) o.transport = transport;
      const tls = buildTls(node);
      if (tls) o.tls = tls;
      return o;
    }
    case 'vless': {
      const o: Record<string, unknown> = {
        ...base, type: 'vless', uuid: node.uuid,
      };
      if (node.flow) o.flow = node.flow;
      const transport = buildTransport(node);
      if (transport) o.transport = transport;
      const tls = buildTls(node);
      if (tls) o.tls = tls;
      return o;
    }
    case 'trojan': {
      const o: Record<string, unknown> = {
        ...base, type: 'trojan', password: node.password,
      };
      const transport = buildTransport(node);
      if (transport) o.transport = transport;
      const tls = buildTls(node);
      if (tls) o.tls = tls;
      return o;
    }
    case 'hysteria2': {
      const o: Record<string, unknown> = {
        ...base, type: 'hysteria2', password: node.password,
      };
      if (node.obfsPassword) {
        o.obfs = { type: 'salamander', password: node.obfsPassword };
      }
      const tls = buildTls(node);
      if (tls) o.tls = tls;
      if (node.upMbps) o.up_mbps = node.upMbps;
      if (node.downMbps) o.down_mbps = node.downMbps;
      return o;
    }
    case 'tuic': {
      const o: Record<string, unknown> = {
        ...base, type: 'tuic', uuid: node.uuid, password: node.password,
      };
      if (node.congestionControl) o.congestion_control = node.congestionControl;
      if (node.udpRelayMode) o.udp_relay_mode = node.udpRelayMode;
      const tls = buildTls(node);
      if (tls) o.tls = tls;
      return o;
    }
    case 'wireguard': {
      const o: Record<string, unknown> = {
        ...base, type: 'wireguard',
        local_address: ['10.0.0.2/32'],
      };
      if (node.privateKey) o.private_key = node.privateKey;
      if (node.publicKey) o.peer_public_key = node.publicKey;
      if (node.preSharedKey) o.pre_shared_key = node.preSharedKey;
      if (node.reservedBytes) o.reserved = node.reservedBytes;
      if (node.mtu) o.mtu = node.mtu;
      return o;
    }
    case 'hysteria': {
      const o: Record<string, unknown> = {
        ...base, type: 'hysteria',
      };
      if (node.password) o.auth_str = node.password;
      if (node.upMbps) o.up_mbps = node.upMbps;
      if (node.downMbps) o.down_mbps = node.downMbps;
      if (node.obfs) o.obfs = node.obfs;
      const tls = buildTls(node);
      if (tls) o.tls = tls;
      return o;
    }
    case 'socks': {
      const o: Record<string, unknown> = {
        ...base, type: 'socks', version: '5',
      };
      if (node.uuid) o.username = node.uuid;
      if (node.password) o.password = node.password;
      return o;
    }
    case 'http': {
      const o: Record<string, unknown> = {
        ...base, type: 'http',
      };
      if (node.uuid) o.username = node.uuid;
      if (node.password) o.password = node.password;
      const tls = buildTls(node);
      if (tls) o.tls = tls;
      return o;
    }
    case 'socks': {
      const o: Record<string, unknown> = {
        ...base, type: 'socks', version: '5',
      };
      if (node.uuid) o.username = node.uuid;
      if (node.password) o.password = node.password;
      return o;
    }
    case 'http': {
      const o: Record<string, unknown> = {
        ...base, type: 'http',
      };
      if (node.uuid) o.username = node.uuid;
      if (node.password) o.password = node.password;
      const tls = buildTls(node);
      if (tls) o.tls = tls;
      return o;
    }
    default:
      return base;
  }
}

export const singboxGenerator: Generator = {
  id: 'singbox' as TargetFormat,
  supportedProtocols: ['ss', 'vmess', 'vless', 'trojan', 'hysteria', 'hysteria2', 'tuic', 'wireguard', 'socks', 'http'] as ProxyProtocol[],

  generate(nodes: ProxyNode[], _ruleTemplate?: string, proxyGroups?: ProxyGroup[]): string {
    const filtered = nodes.filter(n => this.supportedProtocols.includes(n.type));
    const outbounds = filtered.map(buildOutbound);
    const tags = filtered.map(n => n.name);

    const resolved: ResolvedGroup[] = proxyGroups?.length
      ? resolveProxyGroups(proxyGroups, tags)
      : buildDefaultGroups(tags);

    const selectorGroups = resolved.map((g) => {
      const base: Record<string, unknown> = { tag: g.name };
      switch (g.type) {
        case 'select':
          base.type = 'selector';
          base.outbounds = [...g.nodeNames, ...g.extraProxies.map(p => p === 'DIRECT' ? 'direct' : p)];
          break;
        case 'url-test':
        case 'fallback':
          base.type = 'urltest';
          base.outbounds = [...g.nodeNames];
          base.url = g.url;
          base.interval = g.interval + 's';
          break;
        case 'load-balance':
          // sing-box doesn't have native load-balance, use urltest as fallback
          base.type = 'urltest';
          base.outbounds = [...g.nodeNames];
          base.url = g.url;
          base.interval = g.interval + 's';
          break;
      }
      return base;
    });

    const config = {
      log: { level: 'info', timestamp: true },
      dns: {
        servers: [
          { tag: 'google', address: 'tls://8.8.8.8' },
          { tag: 'local', address: '223.5.5.5', detour: 'direct' },
        ],
      },
      inbounds: [
        { type: 'tun', tag: 'tun-in', inet4_address: '172.19.0.1/30', auto_route: true, strict_route: true, sniff: true },
        { type: 'mixed', tag: 'mixed-in', listen: '127.0.0.1', listen_port: 2080, sniff: true },
      ],
      outbounds: [
        ...selectorGroups,
        ...outbounds,
        { type: 'direct', tag: 'direct' },
        { type: 'block', tag: 'block' },
        { type: 'dns', tag: 'dns-out' },
      ],
      route: {
        auto_detect_interface: true,
        final: 'proxy',
        rules: [
          { protocol: 'dns', outbound: 'dns-out' },
          { geoip: ['private'], outbound: 'direct' },
        ],
      },
      experimental: {
        cache_file: { enabled: true },
      },
    };

    return JSON.stringify(config, null, 2);
  },
};
