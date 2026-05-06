import { ProxyNode } from './types';

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        const item = (value as Record<string, unknown>)[key];
        if (item !== undefined) acc[key] = stableValue(item);
        return acc;
      }, {});
  }
  return value ?? null;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

export function nodeFingerprint(node: ProxyNode): string {
  return stableStringify({
    type: node.type,
    server: node.server.trim().toLowerCase(),
    port: node.port,
    uuid: node.uuid,
    password: node.password,
    method: node.method,
    alterId: node.alterId,
    ssrProtocol: node.ssrProtocol,
    ssrObfs: node.ssrObfs,
    ssrProtocolParam: node.ssrProtocolParam,
    ssrObfsParam: node.ssrObfsParam,
    transport: node.transport,
    wsPath: node.wsPath,
    wsHeaders: node.wsHeaders,
    grpcServiceName: node.grpcServiceName,
    h2Path: node.h2Path,
    h2Host: node.h2Host,
    xhttpPath: node.xhttpPath,
    xhttpHost: node.xhttpHost,
    xhttpMode: node.xhttpMode,
    xhttpExtra: node.xhttpExtra,
    tls: node.tls,
    sni: node.sni,
    fingerprint: node.fingerprint,
    alpn: node.alpn,
    skipCertVerify: node.skipCertVerify,
    realityPublicKey: node.realityPublicKey,
    realityShortId: node.realityShortId,
    flow: node.flow,
    upMbps: node.upMbps,
    downMbps: node.downMbps,
    obfs: node.obfs,
    obfsPassword: node.obfsPassword,
    congestionControl: node.congestionControl,
    udpRelayMode: node.udpRelayMode,
    privateKey: node.privateKey,
    publicKey: node.publicKey,
    preSharedKey: node.preSharedKey,
    mtu: node.mtu,
    reservedBytes: node.reservedBytes,
    peers: node.peers,
    udp: node.udp,
  });
}
