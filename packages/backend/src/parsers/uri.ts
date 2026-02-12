import { Parser, ProxyNode, ProxyProtocol, TlsType, Transport } from '../core/types';

const SUPPORTED_SCHEMES = ['ss://', 'ssr://', 'vmess://', 'vless://', 'trojan://', 'hysteria://', 'hysteria2://', 'hy2://', 'tuic://', 'wireguard://', 'socks://', 'socks5://', 'http://', 'https://'];

function safeB64Decode(str: string): string {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4;
  const final = pad ? padded + '='.repeat(4 - pad) : padded;
  return Buffer.from(final, 'base64').toString('utf-8');
}

function parsePort(val: string): number {
  const n = parseInt(val, 10);
  return isNaN(n) ? 0 : n;
}

function parseTransport(type?: string): Transport {
  const map: Record<string, Transport> = {
    tcp: 'tcp',
    ws: 'ws',
    grpc: 'grpc',
    h2: 'h2',
    quic: 'quic',
    httpupgrade: 'httpupgrade',
    xhttp: 'xhttp',
    splithttp: 'splithttp',
  };
  return map[type ?? ''] ?? 'tcp';
}

function parseSS(line: string): ProxyNode | null {
  const body = line.slice(5); // remove ss://

  // Try SIP002 format: ss://base64(method:password)@host:port#name
  // or legacy: ss://base64(method:password@host:port)#name
  const hashIdx = body.indexOf('#');
  const name = hashIdx >= 0 ? decodeURIComponent(body.slice(hashIdx + 1)) : '';
  const main = hashIdx >= 0 ? body.slice(0, hashIdx) : body;

  const atIdx = main.lastIndexOf('@');
  if (atIdx >= 0) {
    // SIP002 format
    const userinfo = safeB64Decode(main.slice(0, atIdx));
    const hostPort = main.slice(atIdx + 1);
    const colonIdx = userinfo.indexOf(':');
    if (colonIdx < 0) return null;
    const method = userinfo.slice(0, colonIdx);
    const password = userinfo.slice(colonIdx + 1);

    const lastColon = hostPort.lastIndexOf(':');
    if (lastColon < 0) return null;
    const server = hostPort.slice(0, lastColon);
    const port = parsePort(hostPort.slice(lastColon + 1));

    return {
      name: name || `${server}:${port}`,
      type: 'ss',
      server,
      port,
      method,
      password,
      transport: 'tcp',
      tls: 'none',
      udp: true,
    };
  }

  // Legacy format: ss://base64(method:password@host:port)#name
  const decoded = safeB64Decode(main);
  const dColonIdx = decoded.indexOf(':');
  if (dColonIdx < 0) return null;
  const method = decoded.slice(0, dColonIdx);
  const rest = decoded.slice(dColonIdx + 1);
  const dAtIdx = rest.lastIndexOf('@');
  if (dAtIdx < 0) return null;
  const password = rest.slice(0, dAtIdx);
  const hostPort = rest.slice(dAtIdx + 1);
  const lastColon = hostPort.lastIndexOf(':');
  if (lastColon < 0) return null;
  const server = hostPort.slice(0, lastColon);
  const port = parsePort(hostPort.slice(lastColon + 1));

  return {
    name: name || `${server}:${port}`,
    type: 'ss',
    server,
    port,
    method,
    password,
    transport: 'tcp',
    tls: 'none',
    udp: true,
  };
}

function parseSSR(line: string): ProxyNode | null {
  const body = line.slice(6); // remove ssr://
  const decoded = safeB64Decode(body);

  // Format: host:port:protocol:method:obfs:base64pass/?params
  const paramSplit = decoded.indexOf('/?');
  const mainPart = paramSplit >= 0 ? decoded.slice(0, paramSplit) : decoded;
  const paramStr = paramSplit >= 0 ? decoded.slice(paramSplit + 2) : '';

  const parts = mainPart.split(':');
  if (parts.length < 6) return null;

  // host may contain colons (IPv6), so rejoin all but last 5
  const server = parts.slice(0, parts.length - 5).join(':');
  const port = parsePort(parts[parts.length - 5]);
  const ssrProtocol = parts[parts.length - 4];
  const method = parts[parts.length - 3];
  const ssrObfs = parts[parts.length - 2];
  const passwordB64 = parts[parts.length - 1];
  const password = safeB64Decode(passwordB64);

  const params = new URLSearchParams(paramStr);
  const obfsParam = params.get('obfsparam') ? safeB64Decode(params.get('obfsparam')!) : undefined;
  const protoParam = params.get('protoparam') ? safeB64Decode(params.get('protoparam')!) : undefined;
  const remarks = params.get('remarks') ? safeB64Decode(params.get('remarks')!) : undefined;

  return {
    name: remarks || `${server}:${port}`,
    type: 'ssr',
    server,
    port,
    method,
    password,
    ssrProtocol,
    ssrObfs,
    ssrProtocolParam: protoParam,
    ssrObfsParam: obfsParam,
    transport: 'tcp',
    tls: 'none',
    udp: true,
  };
}

function parseVMess(line: string): ProxyNode | null {
  const body = line.slice(8); // remove vmess://
  const decoded = safeB64Decode(body);
  const json = JSON.parse(decoded);

  const server = json.add ?? '';
  const port = parsePort(String(json.port ?? '0'));
  const uuid = json.id ?? '';
  const alterId = parseInt(json.aid ?? '0', 10);
  const name = json.ps ?? `${server}:${port}`;
  const net = json.net ?? 'tcp';
  const tlsVal = json.tls ?? '';
  const sni = json.sni ?? '';
  const fp = json.fp ?? '';
  const alpnStr = json.alpn ?? '';
  const host = json.host ?? '';
  const path = json.path ?? '';

  const transport = parseTransport(net);
  const tls: TlsType = tlsVal === 'tls' ? 'tls' : 'none';

  const node: ProxyNode = {
    name,
    type: 'vmess',
    server,
    port,
    uuid,
    alterId: isNaN(alterId) ? 0 : alterId,
    transport,
    tls,
    udp: true,
  };

  if (sni) node.sni = sni;
  if (fp) node.fingerprint = fp;
  if (alpnStr) node.alpn = alpnStr.split(',').map((s: string) => s.trim());

  if (transport === 'ws') {
    if (path) node.wsPath = path;
    if (host) node.wsHeaders = { Host: host };
  } else if (transport === 'grpc') {
    if (path) node.grpcServiceName = path;
  } else if (transport === 'h2') {
    if (path) node.h2Path = path;
    if (host) node.h2Host = host.split(',').map((s: string) => s.trim());
  } else if (transport === 'xhttp' || transport === 'splithttp') {
    if (path) node.xhttpPath = path;
    if (host) node.xhttpHost = host;
  }

  return node;
}

function parseVLESS(line: string): ProxyNode | null {
  // vless://uuid@host:port?params#name
  const url = new URL(line);
  const uuid = url.username;
  const server = url.hostname;
  const port = parsePort(url.port);
  const name = url.hash ? decodeURIComponent(url.hash.slice(1)) : `${server}:${port}`;
  const params = url.searchParams;

  const security = params.get('security') ?? 'none';
  const type = params.get('type') ?? 'tcp';
  const sni = params.get('sni') ?? '';
  const fp = params.get('fp') ?? '';
  const flow = params.get('flow') ?? '';
  const encryption = params.get('encryption') ?? 'none';
  const alpnStr = params.get('alpn') ?? '';
  const pbk = params.get('pbk') ?? '';
  const sid = params.get('sid') ?? '';

  let tls: TlsType = 'none';
  if (security === 'tls') tls = 'tls';
  else if (security === 'reality') tls = 'reality';

  const transport = parseTransport(type);

  const node: ProxyNode = {
    name,
    type: 'vless',
    server,
    port,
    uuid,
    transport,
    tls,
    udp: true,
  };

  if (sni) node.sni = sni;
  if (fp) node.fingerprint = fp;
  if (flow) node.flow = flow;
  if (alpnStr) node.alpn = alpnStr.split(',').map((s) => s.trim());

  if (tls === 'reality') {
    if (pbk) node.realityPublicKey = pbk;
    if (sid) node.realityShortId = sid;
  }

  // Transport-specific
  if (transport === 'ws') {
    const path = params.get('path') ?? '';
    const host = params.get('host') ?? '';
    if (path) node.wsPath = path;
    if (host) node.wsHeaders = { Host: host };
  } else if (transport === 'grpc') {
    const serviceName = params.get('serviceName') ?? '';
    if (serviceName) node.grpcServiceName = serviceName;
  } else if (transport === 'h2') {
    const path = params.get('path') ?? '';
    const host = params.get('host') ?? '';
    if (path) node.h2Path = path;
    if (host) node.h2Host = host.split(',').map((s) => s.trim());
  } else if (transport === 'xhttp' || transport === 'splithttp') {
    const path = params.get('path') ?? '';
    const host = params.get('host') ?? '';
    const mode = params.get('mode') ?? '';
    if (path) node.xhttpPath = path;
    if (host) node.xhttpHost = host;
    if (mode) node.xhttpMode = mode;
  }

  return node;
}

function parseTrojan(line: string): ProxyNode | null {
  // trojan://password@host:port?params#name
  const url = new URL(line);
  const password = decodeURIComponent(url.username);
  const server = url.hostname;
  const port = parsePort(url.port);
  const name = url.hash ? decodeURIComponent(url.hash.slice(1)) : `${server}:${port}`;
  const params = url.searchParams;

  const security = params.get('security') ?? params.get('tls') ?? '';
  const type = params.get('type') ?? 'tcp';
  const sni = params.get('sni') ?? '';
  const fp = params.get('fp') ?? '';
  const alpnStr = params.get('alpn') ?? '';

  let tls: TlsType = 'tls'; // trojan defaults to tls
  if (security === 'none') tls = 'none';
  else if (security === 'reality') tls = 'reality';

  const transport = parseTransport(type);

  const node: ProxyNode = {
    name,
    type: 'trojan',
    server,
    port,
    password,
    transport,
    tls,
    udp: true,
  };

  if (sni) node.sni = sni;
  if (fp) node.fingerprint = fp;
  if (alpnStr) node.alpn = alpnStr.split(',').map((s) => s.trim());

  if (tls === 'reality') {
    const pbk = params.get('pbk') ?? '';
    const sid = params.get('sid') ?? '';
    if (pbk) node.realityPublicKey = pbk;
    if (sid) node.realityShortId = sid;
  }

  const flow = params.get('flow') ?? '';
  if (flow) node.flow = flow;

  if (transport === 'ws') {
    const path = params.get('path') ?? '';
    const host = params.get('host') ?? '';
    if (path) node.wsPath = path;
    if (host) node.wsHeaders = { Host: host };
  } else if (transport === 'grpc') {
    const serviceName = params.get('serviceName') ?? '';
    if (serviceName) node.grpcServiceName = serviceName;
  } else if (transport === 'h2') {
    const path = params.get('path') ?? '';
    const host = params.get('host') ?? '';
    if (path) node.h2Path = path;
    if (host) node.h2Host = host.split(',').map((s) => s.trim());
  }

  return node;
}

function parseHysteria(line: string): ProxyNode | null {
  // hysteria://host:port?params#name
  const url = new URL(line);
  const server = url.hostname;
  const port = parsePort(url.port);
  const name = url.hash ? decodeURIComponent(url.hash.slice(1)) : `${server}:${port}`;
  const params = url.searchParams;

  const auth = params.get('auth') ?? '';
  const upMbps = parseInt(params.get('upmbps') ?? '0', 10);
  const downMbps = parseInt(params.get('downmbps') ?? '0', 10);
  const obfs = params.get('obfs') ?? '';
  const obfsParam = params.get('obfsParam') ?? '';
  const alpnStr = params.get('alpn') ?? '';
  const insecure = params.get('insecure') === '1';
  const peer = params.get('peer') ?? '';

  const node: ProxyNode = {
    name,
    type: 'hysteria',
    server,
    port,
    transport: 'tcp',
    tls: 'tls',
    udp: true,
  };

  if (auth) node.password = auth;
  if (upMbps) node.upMbps = upMbps;
  if (downMbps) node.downMbps = downMbps;
  if (obfs) node.obfs = obfs;
  if (obfsParam) node.obfsPassword = obfsParam;
  if (alpnStr) node.alpn = alpnStr.split(',').map((s) => s.trim());
  if (insecure) node.skipCertVerify = true;
  if (peer) node.sni = peer;

  return node;
}

function parseHysteria2(line: string): ProxyNode | null {
  // hysteria2://auth@host:port?params#name  or  hy2://...
  const normalized = line.startsWith('hy2://') ? 'hysteria2://' + line.slice(6) : line;
  const url = new URL(normalized);
  const server = url.hostname;
  const port = parsePort(url.port || '443');
  const name = url.hash ? decodeURIComponent(url.hash.slice(1)) : `${server}:${port}`;
  const auth = decodeURIComponent(url.username);
  const params = url.searchParams;

  const obfs = params.get('obfs') ?? '';
  const obfsPassword = params.get('obfs-password') ?? '';
  const sni = params.get('sni') ?? '';
  const insecure = params.get('insecure') === '1';

  const node: ProxyNode = {
    name,
    type: 'hysteria2',
    server,
    port,
    transport: 'tcp',
    tls: 'tls',
    udp: true,
  };

  if (auth) node.password = auth;
  if (obfs) node.obfs = obfs;
  if (obfsPassword) node.obfsPassword = obfsPassword;
  if (sni) node.sni = sni;
  if (insecure) node.skipCertVerify = true;

  return node;
}

function parseTUIC(line: string): ProxyNode | null {
  // tuic://uuid:password@host:port?params#name
  const url = new URL(line);
  const uuid = decodeURIComponent(url.username);
  const password = decodeURIComponent(url.password);
  const server = url.hostname;
  const port = parsePort(url.port);
  const name = url.hash ? decodeURIComponent(url.hash.slice(1)) : `${server}:${port}`;
  const params = url.searchParams;

  const congestionControl = params.get('congestion_control') ?? '';
  const udpRelayMode = params.get('udp_relay_mode') ?? '';
  const alpnStr = params.get('alpn') ?? '';
  const sni = params.get('sni') ?? '';

  const node: ProxyNode = {
    name,
    type: 'tuic',
    server,
    port,
    uuid,
    password,
    transport: 'tcp',
    tls: 'tls',
    udp: true,
  };

  if (congestionControl) node.congestionControl = congestionControl;
  if (udpRelayMode) node.udpRelayMode = udpRelayMode;
  if (alpnStr) node.alpn = alpnStr.split(',').map((s) => s.trim());
  if (sni) node.sni = sni;

  return node;
}

function parseWireGuard(line: string): ProxyNode | null {
  // wireguard://privatekey@host:port?params#name
  const url = new URL(line);
  const privateKey = decodeURIComponent(url.username);
  const server = url.hostname;
  const port = parsePort(url.port);
  const name = url.hash ? decodeURIComponent(url.hash.slice(1)) : `${server}:${port}`;
  const params = url.searchParams;

  const publicKey = params.get('publickey') ?? '';
  const preSharedKey = params.get('presharedkey') ?? '';
  const mtu = parseInt(params.get('mtu') ?? '0', 10);
  const reserved = params.get('reserved') ?? '';
  const address = params.get('address') ?? '';

  const node: ProxyNode = {
    name,
    type: 'wireguard',
    server,
    port,
    privateKey,
    transport: 'tcp',
    tls: 'none',
    udp: true,
  };

  if (publicKey) node.publicKey = publicKey;
  if (preSharedKey) node.preSharedKey = preSharedKey;
  if (mtu) node.mtu = mtu;
  if (reserved) {
    node.reservedBytes = reserved.split(',').map((s) => parseInt(s.trim(), 10));
  }

  return node;
}

function parseSOCKS(line: string): ProxyNode | null {
  // Format: socks://[user:pass@]host:port#name or socks5://[user:pass@]host:port#name
  const body = line.replace(/^socks5?:\/\//, '');

  const hashIdx = body.indexOf('#');
  const name = hashIdx >= 0 ? decodeURIComponent(body.slice(hashIdx + 1)) : '';
  const main = hashIdx >= 0 ? body.slice(0, hashIdx) : body;

  const atIdx = main.lastIndexOf('@');
  let username: string | undefined;
  let password: string | undefined;
  let hostPort: string;

  if (atIdx >= 0) {
    const userinfo = main.slice(0, atIdx);
    hostPort = main.slice(atIdx + 1);
    const colonIdx = userinfo.indexOf(':');
    if (colonIdx >= 0) {
      username = userinfo.slice(0, colonIdx);
      password = userinfo.slice(colonIdx + 1);
    } else {
      username = userinfo;
    }
  } else {
    hostPort = main;
  }

  const lastColon = hostPort.lastIndexOf(':');
  if (lastColon < 0) return null;
  const server = hostPort.slice(0, lastColon);
  const port = parsePort(hostPort.slice(lastColon + 1));

  return {
    name: name || `${server}:${port}`,
    type: 'socks',
    server,
    port,
    uuid: username,
    password,
    transport: 'tcp',
    tls: 'none',
    udp: true,
  };
}

function parseHTTP(line: string): ProxyNode | null {
  // Format: http://[user:pass@]host:port#name or https://[user:pass@]host:port#name
  const isHttps = line.startsWith('https://');
  const body = line.replace(/^https?:\/\//, '');

  const hashIdx = body.indexOf('#');
  const name = hashIdx >= 0 ? decodeURIComponent(body.slice(hashIdx + 1)) : '';
  const main = hashIdx >= 0 ? body.slice(0, hashIdx) : body;

  const atIdx = main.lastIndexOf('@');
  let username: string | undefined;
  let password: string | undefined;
  let hostPort: string;

  if (atIdx >= 0) {
    const userinfo = main.slice(0, atIdx);
    hostPort = main.slice(atIdx + 1);
    const colonIdx = userinfo.indexOf(':');
    if (colonIdx >= 0) {
      username = userinfo.slice(0, colonIdx);
      password = userinfo.slice(colonIdx + 1);
    } else {
      username = userinfo;
    }
  } else {
    hostPort = main;
  }

  const lastColon = hostPort.lastIndexOf(':');
  if (lastColon < 0) return null;
  const server = hostPort.slice(0, lastColon);
  const port = parsePort(hostPort.slice(lastColon + 1));

  return {
    name: name || `${server}:${port}`,
    type: 'http',
    server,
    port,
    uuid: username,
    password,
    transport: 'tcp',
    tls: isHttps ? 'tls' : 'none',
  };
}

function parseLine(line: string): ProxyNode | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('ss://') && !trimmed.startsWith('ssr://')) return parseSS(trimmed);
  if (trimmed.startsWith('ssr://')) return parseSSR(trimmed);
  if (trimmed.startsWith('vmess://')) return parseVMess(trimmed);
  if (trimmed.startsWith('vless://')) return parseVLESS(trimmed);
  if (trimmed.startsWith('trojan://')) return parseTrojan(trimmed);
  if (trimmed.startsWith('hysteria2://') || trimmed.startsWith('hy2://')) return parseHysteria2(trimmed);
  if (trimmed.startsWith('hysteria://')) return parseHysteria(trimmed);
  if (trimmed.startsWith('tuic://')) return parseTUIC(trimmed);
  if (trimmed.startsWith('wireguard://')) return parseWireGuard(trimmed);
  if (trimmed.startsWith('socks://') || trimmed.startsWith('socks5://')) return parseSOCKS(trimmed);
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return parseHTTP(trimmed);

  return null;
}

export const uriParser: Parser = {
  canParse(input: string): boolean {
    const lines = input.split(/\r?\n/);
    return lines.some((line) => {
      const trimmed = line.trim();
      return SUPPORTED_SCHEMES.some((scheme) => trimmed.startsWith(scheme));
    });
  },

  parse(input: string): ProxyNode[] {
    const lines = input.split(/\r?\n/);
    const nodes: ProxyNode[] = [];

    for (const line of lines) {
      try {
        const node = parseLine(line);
        if (node) nodes.push(node);
      } catch {
        // skip unparseable lines
      }
    }

    return nodes;
  },
};

export default uriParser;
