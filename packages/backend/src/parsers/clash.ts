import { Parser, ProxyNode, TlsType, Transport } from '../core/types';
import * as yaml from 'js-yaml';

function parseClashProxy(proxy: Record<string, any>): ProxyNode | null {
  const type = proxy.type as string;
  if (!['ss', 'ssr', 'vmess', 'vless', 'trojan', 'hysteria', 'hysteria2', 'tuic', 'wireguard'].includes(type)) {
    return null;
  }

  const node: ProxyNode = {
    name: proxy.name,
    type: type as ProxyNode['type'],
    server: proxy.server,
    port: Number(proxy.port),
    transport: 'tcp' as Transport,
    tls: 'none' as TlsType,
    udp: proxy.udp ?? undefined,
  };

  switch (type) {
    case 'ss': {
      node.method = proxy.cipher;
      node.password = proxy.password;
      break;
    }

    case 'ssr': {
      node.method = proxy.cipher;
      node.password = proxy.password;
      node.ssrProtocol = proxy.protocol;
      node.ssrObfs = proxy.obfs;
      node.ssrProtocolParam = proxy['protocol-param'];
      node.ssrObfsParam = proxy['obfs-param'];
      break;
    }

    case 'vmess': {
      node.uuid = proxy.uuid;
      node.alterId = proxy.alterId ?? proxy['alter-id'] ?? 0;
      node.method = proxy.cipher;
      node.tls = proxy.tls === true ? 'tls' : 'none';
      node.sni = proxy.servername;
      node.fingerprint = proxy['client-fingerprint'];
      node.skipCertVerify = proxy['skip-cert-verify'];
      node.alpn = proxy.alpn;

      const network = proxy.network as string | undefined;
      if (network) {
        node.transport = network as Transport;
      }

      if (proxy['ws-opts']) {
        node.wsPath = proxy['ws-opts'].path;
        node.wsHeaders = proxy['ws-opts'].headers;
      }
      if (proxy['grpc-opts']) {
        node.grpcServiceName = proxy['grpc-opts']['grpc-service-name'];
      }
      if (proxy['h2-opts']) {
        node.h2Path = proxy['h2-opts'].path;
        node.h2Host = proxy['h2-opts'].host;
        node.transport = 'h2';
      }
      break;
    }

    case 'vless': {
      node.uuid = proxy.uuid;
      node.flow = proxy.flow;
      node.tls = proxy.tls === true ? 'tls' : 'none';
      node.sni = proxy.servername;
      node.fingerprint = proxy['client-fingerprint'];
      node.skipCertVerify = proxy['skip-cert-verify'];
      node.alpn = proxy.alpn;

      const network = proxy.network as string | undefined;
      if (network) {
        node.transport = network as Transport;
      }

      if (proxy['ws-opts']) {
        node.wsPath = proxy['ws-opts'].path;
        node.wsHeaders = proxy['ws-opts'].headers;
      }
      if (proxy['grpc-opts']) {
        node.grpcServiceName = proxy['grpc-opts']['grpc-service-name'];
      }
      if (proxy['h2-opts']) {
        node.h2Path = proxy['h2-opts'].path;
        node.h2Host = proxy['h2-opts'].host;
        node.transport = 'h2';
      }

      if (proxy['reality-opts']) {
        node.tls = 'reality';
        node.realityPublicKey = proxy['reality-opts']['public-key'];
        node.realityShortId = proxy['reality-opts']['short-id'];
      }
      break;
    }

    case 'trojan': {
      node.password = proxy.password;
      node.tls = 'tls';
      node.sni = proxy.sni;
      node.skipCertVerify = proxy['skip-cert-verify'];
      node.alpn = proxy.alpn;

      const network = proxy.network as string | undefined;
      if (network) {
        node.transport = network as Transport;
      }

      if (proxy['ws-opts']) {
        node.wsPath = proxy['ws-opts'].path;
        node.wsHeaders = proxy['ws-opts'].headers;
      }
      if (proxy['grpc-opts']) {
        node.grpcServiceName = proxy['grpc-opts']['grpc-service-name'];
      }
      break;
    }

    case 'hysteria': {
      node.password = proxy['auth-str'];
      node.upMbps = proxy.up;
      node.downMbps = proxy.down;
      node.obfs = proxy.obfs;
      node.tls = 'tls';
      node.sni = proxy.sni;
      node.skipCertVerify = proxy['skip-cert-verify'];
      node.alpn = proxy.alpn;
      break;
    }

    case 'hysteria2': {
      node.password = proxy.password;
      node.upMbps = proxy.up;
      node.downMbps = proxy.down;
      node.obfs = proxy.obfs;
      node.obfsPassword = proxy['obfs-password'];
      node.tls = 'tls';
      node.sni = proxy.sni;
      node.skipCertVerify = proxy['skip-cert-verify'];
      node.alpn = proxy.alpn;
      break;
    }

    case 'tuic': {
      node.uuid = proxy.uuid;
      node.password = proxy.password;
      node.congestionControl = proxy['congestion-controller'];
      node.udpRelayMode = proxy['udp-relay-mode'];
      node.tls = 'tls';
      node.sni = proxy.sni;
      node.alpn = proxy.alpn;
      break;
    }

    case 'wireguard': {
      node.privateKey = proxy['private-key'];
      node.publicKey = proxy['public-key'];
      node.preSharedKey = proxy['pre-shared-key'];
      node.mtu = proxy.mtu;
      node.reservedBytes = proxy.reserved;
      node.peers = proxy.peers;
      break;
    }
  }

  return node;
}

export const clashParser: Parser = {
  canParse(input: string): boolean {
    return /^proxies:/m.test(input);
  },

  parse(input: string): ProxyNode[] {
    const doc = yaml.load(input) as Record<string, any>;
    if (!doc || !Array.isArray(doc.proxies)) {
      return [];
    }

    const nodes: ProxyNode[] = [];
    for (const proxy of doc.proxies) {
      const node = parseClashProxy(proxy);
      if (node) {
        nodes.push(node);
      }
    }
    return nodes;
  },
};
