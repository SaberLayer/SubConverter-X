export type ProxyProtocol = 'ss' | 'ssr' | 'vmess' | 'vless' | 'trojan' | 'hysteria' | 'hysteria2' | 'tuic' | 'wireguard' | 'socks' | 'http';
export type TlsType = 'none' | 'tls' | 'reality';
export type Transport = 'tcp' | 'ws' | 'grpc' | 'h2' | 'quic' | 'httpupgrade' | 'xhttp' | 'splithttp';
export type TargetFormat = 'clash-meta' | 'singbox' | 'surge' | 'quantumultx' | 'shadowrocket' | 'loon' | 'v2ray' | 'base64';
export type ProxyGroupType = 'select' | 'url-test' | 'fallback' | 'load-balance';

export interface ProxyGroup {
  name: string;
  type: ProxyGroupType;
  filter?: string;           // regex to match node names — empty means all nodes
  proxies?: string[];        // extra entries: other group names, "DIRECT", etc.
  url?: string;              // health check URL (for url-test/fallback)
  interval?: number;         // health check interval in seconds
}

export interface ProxyNode {
  name: string;
  type: ProxyProtocol;
  server: string;
  port: number;

  // Auth
  uuid?: string;
  password?: string;
  method?: string;
  alterId?: number;

  // SSR
  ssrProtocol?: string;
  ssrObfs?: string;
  ssrProtocolParam?: string;
  ssrObfsParam?: string;

  // Transport
  transport: Transport;
  wsPath?: string;
  wsHeaders?: Record<string, string>;
  grpcServiceName?: string;
  h2Path?: string;
  h2Host?: string[];

  // xhttp/splithttp
  xhttpPath?: string;
  xhttpHost?: string;
  xhttpMode?: string;
  xhttpExtra?: Record<string, any>;

  // TLS
  tls: TlsType;
  sni?: string;
  fingerprint?: string;
  alpn?: string[];
  skipCertVerify?: boolean;

  // Reality
  realityPublicKey?: string;
  realityShortId?: string;

  // XTLS
  flow?: string;

  // Hysteria
  upMbps?: number;
  downMbps?: number;
  obfs?: string;
  obfsPassword?: string;

  // TUIC
  congestionControl?: string;
  udpRelayMode?: string;

  // WireGuard
  privateKey?: string;
  publicKey?: string;
  preSharedKey?: string;
  mtu?: number;
  reservedBytes?: number[];
  peers?: { endpoint: string; publicKey: string; allowedIPs: string[] }[];

  // General
  udp?: boolean;
}

export interface Parser {
  canParse(input: string): boolean;
  parse(input: string): ProxyNode[];
}

export interface Generator {
  id: TargetFormat;
  generate(nodes: ProxyNode[], ruleTemplate?: string, proxyGroups?: ProxyGroup[]): string;
  supportedProtocols: ProxyProtocol[];
}
