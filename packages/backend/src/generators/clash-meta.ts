import * as yaml from 'js-yaml';
import { Generator, ProxyNode, ProxyProtocol, ProxyGroup, TargetFormat } from '../core/types';
import { resolveProxyGroups, buildDefaultGroups, ResolvedGroup } from '../core/proxy-group';

function buildProxy(node: ProxyNode): Record<string, unknown> {
  const base: Record<string, unknown> = { name: node.name, server: node.server, port: node.port };

  switch (node.type) {
    case 'ss': {
      const p: Record<string, unknown> = { ...base, type: 'ss', cipher: node.method, password: node.password };
      if (node.udp) p.udp = true;
      return p;
    }
    case 'ssr': {
      const p: Record<string, unknown> = {
        ...base, type: 'ssr', cipher: node.method, password: node.password,
        protocol: node.ssrProtocol, obfs: node.ssrObfs,
      };
      if (node.ssrProtocolParam) p['protocol-param'] = node.ssrProtocolParam;
      if (node.ssrObfsParam) p['obfs-param'] = node.ssrObfsParam;
      if (node.udp) p.udp = true;
      return p;
    }
    case 'vmess': {
      const p: Record<string, unknown> = {
        ...base, type: 'vmess', uuid: node.uuid, alterId: node.alterId ?? 0,
        cipher: node.method || 'auto', network: node.transport,
      };
      if (node.tls !== 'none') p.tls = true;
      if (node.sni) p.servername = node.sni;
      if (node.skipCertVerify) p['skip-cert-verify'] = true;
      if (node.udp) p.udp = true;
      if (node.fingerprint) p['client-fingerprint'] = node.fingerprint;
      if (node.alpn) p.alpn = node.alpn;
      if (node.transport === 'ws') {
        const wsOpts: Record<string, unknown> = {};
        if (node.wsPath) wsOpts.path = node.wsPath;
        if (node.wsHeaders) wsOpts.headers = node.wsHeaders;
        if (Object.keys(wsOpts).length) p['ws-opts'] = wsOpts;
      }
      if (node.transport === 'grpc' && node.grpcServiceName) {
        p['grpc-opts'] = { 'grpc-service-name': node.grpcServiceName };
      }
      if (node.transport === 'h2') {
        const h2Opts: Record<string, unknown> = {};
        if (node.h2Path) h2Opts.path = node.h2Path;
        if (node.h2Host) h2Opts.host = node.h2Host;
        if (Object.keys(h2Opts).length) p['h2-opts'] = h2Opts;
      }
      if (node.transport === 'xhttp' || node.transport === 'splithttp') {
        const xhttpOpts: Record<string, unknown> = {};
        if (node.xhttpPath) xhttpOpts.path = node.xhttpPath;
        if (node.xhttpHost) xhttpOpts.host = node.xhttpHost;
        if (node.xhttpMode) xhttpOpts.mode = node.xhttpMode;
        if (Object.keys(xhttpOpts).length) p['xhttp-opts'] = xhttpOpts;
      }
      return p;
    }
    case 'vless': {
      const p: Record<string, unknown> = {
        ...base, type: 'vless', uuid: node.uuid, network: node.transport,
      };
      if (node.flow) p.flow = node.flow;
      if (node.tls !== 'none') p.tls = true;
      if (node.sni) p.servername = node.sni;
      if (node.udp) p.udp = true;
      if (node.fingerprint) p['client-fingerprint'] = node.fingerprint;
      if (node.skipCertVerify) p['skip-cert-verify'] = true;
      if (node.alpn) p.alpn = node.alpn;
      if (node.tls === 'reality') {
        const realityOpts: Record<string, unknown> = {};
        if (node.realityPublicKey) realityOpts['public-key'] = node.realityPublicKey;
        if (node.realityShortId) realityOpts['short-id'] = node.realityShortId;
        p['reality-opts'] = realityOpts;
      }
      if (node.transport === 'ws') {
        const wsOpts: Record<string, unknown> = {};
        if (node.wsPath) wsOpts.path = node.wsPath;
        if (node.wsHeaders) wsOpts.headers = node.wsHeaders;
        if (Object.keys(wsOpts).length) p['ws-opts'] = wsOpts;
      }
      if (node.transport === 'grpc' && node.grpcServiceName) {
        p['grpc-opts'] = { 'grpc-service-name': node.grpcServiceName };
      }
      if (node.transport === 'h2') {
        const h2Opts: Record<string, unknown> = {};
        if (node.h2Path) h2Opts.path = node.h2Path;
        if (node.h2Host) h2Opts.host = node.h2Host;
        if (Object.keys(h2Opts).length) p['h2-opts'] = h2Opts;
      }
      if (node.transport === 'xhttp' || node.transport === 'splithttp') {
        const xhttpOpts: Record<string, unknown> = {};
        if (node.xhttpPath) xhttpOpts.path = node.xhttpPath;
        if (node.xhttpHost) xhttpOpts.host = node.xhttpHost;
        if (node.xhttpMode) xhttpOpts.mode = node.xhttpMode;
        if (Object.keys(xhttpOpts).length) p['xhttp-opts'] = xhttpOpts;
      }
      return p;
    }
    case 'trojan': {
      const p: Record<string, unknown> = {
        ...base, type: 'trojan', password: node.password, network: node.transport,
      };
      if (node.sni) p.sni = node.sni;
      if (node.skipCertVerify) p['skip-cert-verify'] = true;
      if (node.udp) p.udp = true;
      if (node.alpn) p.alpn = node.alpn;
      if (node.transport === 'ws') {
        const wsOpts: Record<string, unknown> = {};
        if (node.wsPath) wsOpts.path = node.wsPath;
        if (node.wsHeaders) wsOpts.headers = node.wsHeaders;
        if (Object.keys(wsOpts).length) p['ws-opts'] = wsOpts;
      }
      if (node.transport === 'grpc' && node.grpcServiceName) {
        p['grpc-opts'] = { 'grpc-service-name': node.grpcServiceName };
      }
      return p;
    }
    case 'hysteria2': {
      const p: Record<string, unknown> = {
        ...base, type: 'hysteria2', password: node.password,
      };
      if (node.sni) p.sni = node.sni;
      if (node.skipCertVerify) p['skip-cert-verify'] = true;
      if (node.obfsPassword) {
        p.obfs = 'salamander';
        p['obfs-password'] = node.obfsPassword;
      }
      if (node.fingerprint) p.fingerprint = node.fingerprint;
      if (node.alpn) p.alpn = node.alpn;
      if (node.upMbps) p.up = node.upMbps + ' Mbps';
      if (node.downMbps) p.down = node.downMbps + ' Mbps';
      return p;
    }
    case 'tuic': {
      const p: Record<string, unknown> = {
        ...base, type: 'tuic', uuid: node.uuid, password: node.password,
      };
      if (node.congestionControl) p['congestion-controller'] = node.congestionControl;
      if (node.udpRelayMode) p['udp-relay-mode'] = node.udpRelayMode;
      if (node.sni) p.sni = node.sni;
      if (node.skipCertVerify) p['skip-cert-verify'] = true;
      if (node.alpn) p.alpn = node.alpn;
      return p;
    }
    case 'wireguard': {
      const p: Record<string, unknown> = {
        ...base, type: 'wireguard',
      };
      if (node.privateKey) p['private-key'] = node.privateKey;
      if (node.publicKey) p['public-key'] = node.publicKey;
      if (node.preSharedKey) p['pre-shared-key'] = node.preSharedKey;
      if (node.mtu) p.mtu = node.mtu;
      if (node.reservedBytes) p.reserved = node.reservedBytes;
      if (node.udp) p.udp = true;
      if (node.peers) p.peers = node.peers;
      return p;
    }
    case 'hysteria': {
      const p: Record<string, unknown> = {
        ...base, type: 'hysteria',
      };
      if (node.password) p['auth-str'] = node.password;
      if (node.upMbps) p.up = node.upMbps + ' Mbps';
      if (node.downMbps) p.down = node.downMbps + ' Mbps';
      if (node.obfs) p.obfs = node.obfs;
      if (node.sni) p.sni = node.sni;
      if (node.skipCertVerify) p['skip-cert-verify'] = true;
      if (node.alpn) p.alpn = node.alpn;
      return p;
    }
    case 'socks': {
      const p: Record<string, unknown> = {
        ...base, type: 'socks5',
      };
      if (node.uuid) p.username = node.uuid;
      if (node.password) p.password = node.password;
      if (node.tls !== 'none') p.tls = true;
      if (node.sni) p.sni = node.sni;
      if (node.skipCertVerify) p['skip-cert-verify'] = true;
      if (node.udp) p.udp = true;
      return p;
    }
    case 'http': {
      const p: Record<string, unknown> = {
        ...base, type: 'http',
      };
      if (node.uuid) p.username = node.uuid;
      if (node.password) p.password = node.password;
      if (node.tls !== 'none') p.tls = true;
      if (node.sni) p.sni = node.sni;
      if (node.skipCertVerify) p['skip-cert-verify'] = true;
      return p;
    }
    default:
      return base;
  }
}

function getDefaultRules(ruleTemplate?: string): string[] {
  if (ruleTemplate) {
    return ruleTemplate.split('\n').filter(l => l.trim());
  }
  return [
    'MATCH,Proxy',
  ];
}

export const clashMetaGenerator: Generator = {
  id: 'clash-meta' as TargetFormat,
  supportedProtocols: ['ss', 'ssr', 'vmess', 'vless', 'trojan', 'hysteria', 'hysteria2', 'tuic', 'wireguard', 'socks', 'http'] as ProxyProtocol[],

  generate(nodes: ProxyNode[], ruleTemplate?: string, proxyGroups?: ProxyGroup[]): string {
    const filtered = nodes.filter(n => this.supportedProtocols.includes(n.type));
    const proxies = filtered.map(buildProxy);
    const names = filtered.map(n => n.name);

    const resolved: ResolvedGroup[] = proxyGroups?.length
      ? resolveProxyGroups(proxyGroups, names)
      : buildDefaultGroups(names);

    const groupNames = resolved.map(g => g.name);

    const clashGroups = resolved.map((g) => {
      const group: Record<string, unknown> = {
        name: g.name,
        type: g.type === 'load-balance' ? 'load-balance' : g.type,
        proxies: [...g.nodeNames, ...g.extraProxies.filter(p => !groupNames.includes(p) || p === 'DIRECT'), ...g.extraProxies.filter(p => groupNames.includes(p) && p !== 'DIRECT')],
      };
      if (g.type === 'url-test' || g.type === 'fallback' || g.type === 'load-balance') {
        group.url = g.url;
        group.interval = g.interval;
      }
      if (g.type === 'load-balance') {
        group.strategy = 'consistent-hashing';
      }
      return group;
    });

    const config: Record<string, unknown> = {
      port: 7890,
      'socks-port': 7891,
      'allow-lan': true,
      mode: 'rule',
      'log-level': 'info',
      dns: {
        enable: true,
        'enhanced-mode': 'fake-ip',
        nameserver: [
          'https://dns.alidns.com/dns-query',
          'https://doh.pub/dns-query',
        ],
      },
      proxies,
      'proxy-groups': clashGroups,
      rules: getDefaultRules(ruleTemplate),
    };

    return yaml.dump(config, { noRefs: true, lineWidth: -1 });
  },
};
