import { Parser, ProxyNode, ProxyProtocol, TlsType, Transport } from '../core/types';

const SUPPORTED_TYPES: Record<string, ProxyProtocol> = {
  shadowsocks: 'ss',
  vmess: 'vmess',
  vless: 'vless',
  trojan: 'trojan',
  hysteria: 'hysteria',
  hysteria2: 'hysteria2',
  tuic: 'tuic',
  wireguard: 'wireguard',
};

function parseTransport(transport: Record<string, any> | undefined): {
  transport: Transport;
  wsPath?: string;
  wsHeaders?: Record<string, string>;
  grpcServiceName?: string;
  h2Path?: string;
  h2Host?: string[];
} {
  if (!transport || !transport.type) {
    return { transport: 'tcp' };
  }

  const result: ReturnType<typeof parseTransport> = {
    transport: transport.type as Transport,
  };

  switch (transport.type) {
    case 'ws':
      result.wsPath = transport.path;
      result.wsHeaders = transport.headers;
      break;
    case 'grpc':
      result.grpcServiceName = transport.service_name;
      break;
    case 'http':
      result.transport = 'h2';
      result.h2Path = transport.path;
      result.h2Host = transport.host;
      break;
    case 'httpupgrade':
      result.transport = 'httpupgrade' as Transport;
      break;
    case 'quic':
      result.transport = 'quic';
      break;
  }

  return result;
}

function parseTls(tls: Record<string, any> | undefined): {
  tls: TlsType;
  sni?: string;
  skipCertVerify?: boolean;
  alpn?: string[];
  fingerprint?: string;
  realityPublicKey?: string;
  realityShortId?: string;
} {
  if (!tls || !tls.enabled) {
    return { tls: 'none' };
  }

  const result: ReturnType<typeof parseTls> = {
    tls: 'tls',
    sni: tls.server_name,
    skipCertVerify: tls.insecure,
    alpn: tls.alpn,
    fingerprint: tls.utls?.fingerprint,
  };

  if (tls.reality && tls.reality.enabled) {
    result.tls = 'reality';
    result.realityPublicKey = tls.reality.public_key;
    result.realityShortId = tls.reality.short_id;
  }

  return result;
}

function parseSingboxOutbound(outbound: Record<string, any>): ProxyNode | null {
  const protocol = SUPPORTED_TYPES[outbound.type];
  if (!protocol) {
    return null;
  }

  const transportInfo = parseTransport(outbound.transport);
  const tlsInfo = parseTls(outbound.tls);

  const node: ProxyNode = {
    name: outbound.tag,
    type: protocol,
    server: outbound.server,
    port: Number(outbound.server_port),
    transport: transportInfo.transport,
    tls: tlsInfo.tls,
    sni: tlsInfo.sni,
    skipCertVerify: tlsInfo.skipCertVerify,
    alpn: tlsInfo.alpn,
    fingerprint: tlsInfo.fingerprint,
    realityPublicKey: tlsInfo.realityPublicKey,
    realityShortId: tlsInfo.realityShortId,
    wsPath: transportInfo.wsPath,
    wsHeaders: transportInfo.wsHeaders,
    grpcServiceName: transportInfo.grpcServiceName,
    h2Path: transportInfo.h2Path,
    h2Host: transportInfo.h2Host,
  };

  switch (protocol) {
    case 'ss': {
      node.method = outbound.method;
      node.password = outbound.password;
      break;
    }

    case 'vmess': {
      node.uuid = outbound.uuid;
      node.alterId = outbound.alter_id ?? 0;
      node.method = outbound.security;
      break;
    }

    case 'vless': {
      node.uuid = outbound.uuid;
      node.flow = outbound.flow;
      break;
    }

    case 'trojan': {
      node.password = outbound.password;
      break;
    }

    case 'hysteria': {
      node.password = outbound.auth_str;
      node.upMbps = outbound.up_mbps;
      node.downMbps = outbound.down_mbps;
      node.obfs = outbound.obfs;
      break;
    }

    case 'hysteria2': {
      node.password = outbound.password;
      if (outbound.obfs) {
        node.obfs = outbound.obfs.type;
        node.obfsPassword = outbound.obfs.password;
      }
      break;
    }

    case 'tuic': {
      node.uuid = outbound.uuid;
      node.password = outbound.password;
      node.congestionControl = outbound.congestion_control;
      node.udpRelayMode = outbound.udp_relay_mode;
      break;
    }

    case 'wireguard': {
      node.privateKey = outbound.private_key;
      node.publicKey = outbound.peer_public_key;
      node.preSharedKey = outbound.pre_shared_key;
      node.mtu = outbound.mtu;
      node.reservedBytes = outbound.reserved;
      break;
    }
  }

  return node;
}

export const singboxParser: Parser = {
  canParse(input: string): boolean {
    try {
      const doc = JSON.parse(input);
      return doc && Array.isArray(doc.outbounds);
    } catch {
      return false;
    }
  },

  parse(input: string): ProxyNode[] {
    const doc = JSON.parse(input);
    if (!doc || !Array.isArray(doc.outbounds)) {
      return [];
    }

    const nodes: ProxyNode[] = [];
    for (const outbound of doc.outbounds) {
      const node = parseSingboxOutbound(outbound);
      if (node) {
        nodes.push(node);
      }
    }
    return nodes;
  },
};
