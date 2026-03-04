import { Parser, ProxyNode, ProxyProtocol, Transport, TlsType } from '../core/types';

type Options = Record<string, string>;

const QX_TYPES = new Set([
  'shadowsocks', 'shadowsocksr', 'vmess', 'trojan', 'http', 'socks5', 'socks5-tls', 'vless', 'hysteria2', 'tuic', 'wireguard',
]);

const SURGE_TYPES = new Set([
  'ss', 'ssr', 'vmess', 'vless', 'trojan', 'hysteria2', 'tuic', 'wireguard', 'http', 'socks5', 'socks5-tls',
]);

const LOON_TYPES = new Set([
  'shadowsocks', 'shadowsocksr', 'vmess', 'vless', 'trojan', 'hysteria2', 'tuic', 'wireguard', 'http', 'https', 'socks5', 'socks5-tls',
]);

function stripQuotes(v: string): string {
  const trimmed = v.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function splitCommaAware(input: string): string[] {
  const out: string[] = [];
  let curr = '';
  let inQuote = false;
  let quoteChar = '';

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if ((ch === '"' || ch === "'") && (!inQuote || ch === quoteChar)) {
      if (!inQuote) {
        inQuote = true;
        quoteChar = ch;
      } else {
        inQuote = false;
        quoteChar = '';
      }
      curr += ch;
      continue;
    }
    if (ch === ',' && !inQuote) {
      out.push(curr.trim());
      curr = '';
      continue;
    }
    curr += ch;
  }
  if (curr.trim()) out.push(curr.trim());
  return out;
}

function parseHostPort(raw: string): { host: string; port: number } | null {
  const s = raw.trim();
  if (!s) return null;

  if (s.startsWith('[')) {
    const end = s.indexOf(']');
    if (end === -1) return null;
    const host = s.slice(1, end);
    const portRaw = s.slice(end + 1).replace(/^:/, '');
    const port = parseInt(portRaw, 10);
    return Number.isFinite(port) ? { host, port } : null;
  }

  const idx = s.lastIndexOf(':');
  if (idx === -1) return null;
  const host = s.slice(0, idx);
  const port = parseInt(s.slice(idx + 1), 10);
  if (!host || !Number.isFinite(port)) return null;
  return { host, port };
}

function parseOptions(parts: string[], start = 0): Options {
  const opts: Options = {};
  for (let i = start; i < parts.length; i++) {
    const p = parts[i];
    const eq = p.indexOf('=');
    if (eq === -1) continue;
    const k = p.slice(0, eq).trim().toLowerCase();
    const v = stripQuotes(p.slice(eq + 1).trim());
    if (!k) continue;
    opts[k] = v;
  }
  return opts;
}

function toBool(v: string | undefined): boolean | undefined {
  if (!v) return undefined;
  const lower = v.toLowerCase();
  if (lower === 'true' || lower === '1' || lower === 'yes') return true;
  if (lower === 'false' || lower === '0' || lower === 'no') return false;
  return undefined;
}

function pick(opts: Options, ...keys: string[]): string | undefined {
  for (const k of keys) {
    if (opts[k] !== undefined && opts[k] !== '') return opts[k];
  }
  return undefined;
}

function applyCommonOptions(node: ProxyNode, opts: Options) {
  const udp = toBool(pick(opts, 'udp-relay', 'udp'));
  if (udp !== undefined) node.udp = udp;

  const skipCertVerify = toBool(pick(opts, 'skip-cert-verify', 'tls-verification', 'insecure'));
  if (skipCertVerify !== undefined) {
    // tls-verification=false means skip verify=true
    if (opts['tls-verification'] !== undefined) {
      node.skipCertVerify = !skipCertVerify;
    } else {
      node.skipCertVerify = skipCertVerify;
    }
  }

  const sni = pick(opts, 'sni', 'tls-host', 'tls-name', 'servername', 'peer');
  if (sni) node.sni = sni;

  const overTls = toBool(pick(opts, 'over-tls', 'tls'));
  if (overTls === true) node.tls = 'tls';

  const alpn = pick(opts, 'alpn');
  if (alpn) node.alpn = alpn.split(',').map((s) => s.trim()).filter(Boolean);

  const network = pick(opts, 'network', 'transport');
  const wsFlag = toBool(opts.ws);
  const obfs = pick(opts, 'obfs');
  if (network === 'ws' || wsFlag === true || obfs === 'ws') {
    node.transport = 'ws';
    const wsPath = pick(opts, 'path', 'obfs-uri', 'ws-path');
    const wsHost = pick(opts, 'host', 'obfs-host', 'ws-host');
    if (wsPath) node.wsPath = wsPath;
    if (wsHost) node.wsHeaders = { Host: wsHost };
  } else if (network === 'grpc') {
    node.transport = 'grpc';
    const serviceName = pick(opts, 'service-name', 'grpc-service-name');
    if (serviceName) node.grpcServiceName = serviceName;
  } else if (network === 'h2' || network === 'http') {
    node.transport = 'h2';
    const path = pick(opts, 'path');
    const host = pick(opts, 'host');
    if (path) node.h2Path = path;
    if (host) node.h2Host = host.split(',').map((s) => s.trim()).filter(Boolean);
  } else if (network === 'httpupgrade') {
    node.transport = 'httpupgrade';
  } else if (network === 'quic') {
    node.transport = 'quic';
  } else if (network === 'xhttp') {
    node.transport = 'xhttp';
  } else if (network === 'splithttp') {
    node.transport = 'splithttp';
  }
}

function normalizeName(name: string, fallback: string): string {
  const n = stripQuotes(name).trim();
  return n || fallback;
}

function parseQxLine(line: string): ProxyNode | null {
  const eq = line.indexOf('=');
  if (eq === -1) return null;
  const left = line.slice(0, eq).trim().toLowerCase();
  if (!QX_TYPES.has(left)) return null;

  const right = line.slice(eq + 1).trim();
  const parts = splitCommaAware(right);
  if (parts.length === 0) return null;

  const hostPort = parseHostPort(parts[0]);
  if (!hostPort) return null;
  const opts = parseOptions(parts, 1);
  const name = normalizeName(pick(opts, 'tag', 'remarks') || '', `${hostPort.host}:${hostPort.port}`);

  const protoMap: Record<string, ProxyProtocol> = {
    shadowsocks: 'ss',
    shadowsocksr: 'ssr',
    vmess: 'vmess',
    vless: 'vless',
    trojan: 'trojan',
    hysteria2: 'hysteria2',
    tuic: 'tuic',
    wireguard: 'wireguard',
    socks5: 'socks',
    'socks5-tls': 'socks',
    http: 'http',
  };
  const type = protoMap[left];
  if (!type) return null;

  const node: ProxyNode = {
    name,
    type,
    server: hostPort.host,
    port: hostPort.port,
    transport: 'tcp',
    tls: (left === 'socks5-tls' ? 'tls' : 'none') as TlsType,
    udp: true,
  };

  if (type === 'ss') {
    node.method = pick(opts, 'method', 'cipher');
    node.password = pick(opts, 'password');
  } else if (type === 'ssr') {
    node.method = pick(opts, 'method', 'cipher');
    node.password = pick(opts, 'password');
    node.ssrProtocol = pick(opts, 'ssr-protocol', 'protocol');
    node.ssrObfs = pick(opts, 'obfs');
    node.ssrProtocolParam = pick(opts, 'ssr-protocol-param', 'protocol-param');
    node.ssrObfsParam = pick(opts, 'obfs-param');
  } else if (type === 'vmess') {
    node.uuid = pick(opts, 'password', 'uuid', 'id', 'username');
    node.method = pick(opts, 'method', 'cipher') || 'auto';
    const aid = parseInt(pick(opts, 'alterid', 'aid') || '0', 10);
    if (Number.isFinite(aid)) node.alterId = aid;
  } else if (type === 'vless') {
    node.uuid = pick(opts, 'password', 'uuid', 'id');
    node.flow = pick(opts, 'flow');
    const security = pick(opts, 'security');
    if (security === 'reality') node.tls = 'reality';
    if (security === 'tls') node.tls = 'tls';
    node.realityPublicKey = pick(opts, 'pbk', 'reality-public-key', 'public-key');
    node.realityShortId = pick(opts, 'sid', 'short-id');
  } else if (type === 'trojan') {
    node.password = pick(opts, 'password');
    node.tls = 'tls';
  } else if (type === 'hysteria2') {
    node.password = pick(opts, 'password', 'auth');
    node.tls = 'tls';
    node.obfs = pick(opts, 'obfs');
    node.obfsPassword = pick(opts, 'obfs-password', 'obfs-passwords');
  } else if (type === 'tuic') {
    node.uuid = pick(opts, 'token', 'uuid');
    node.password = pick(opts, 'password');
    node.tls = 'tls';
    node.congestionControl = pick(opts, 'congestion-control', 'congestion_control');
    node.udpRelayMode = pick(opts, 'udp-relay-mode', 'udp_relay_mode');
  } else if (type === 'wireguard') {
    node.privateKey = pick(opts, 'private-key', 'private_key');
    node.publicKey = pick(opts, 'public-key', 'public_key', 'peer-public-key', 'peer_public_key');
    node.preSharedKey = pick(opts, 'preshared-key', 'pre-shared-key', 'pre_shared_key');
    node.mtu = parseInt(pick(opts, 'mtu') || '', 10) || undefined;
    node.tls = 'none';
  } else if (type === 'socks') {
    node.uuid = pick(opts, 'username', 'user');
    node.password = pick(opts, 'password', 'pass');
  } else if (type === 'http') {
    node.uuid = pick(opts, 'username', 'user');
    node.password = pick(opts, 'password', 'pass');
  }

  applyCommonOptions(node, opts);
  return node;
}

function parseSurgeLine(line: string): ProxyNode | null {
  const eq = line.indexOf('=');
  if (eq === -1) return null;
  const name = normalizeName(line.slice(0, eq), '');
  const right = line.slice(eq + 1).trim();
  const parts = splitCommaAware(right);
  if (parts.length < 3) return null;

  const kind = parts[0].trim().toLowerCase();
  if (!SURGE_TYPES.has(kind)) return null;

  if (kind === 'wireguard' && /^section-name\s*=/.test(parts[1])) {
    // Surge wireguard commonly references an external section; skip for now.
    return null;
  }

  const server = stripQuotes(parts[1]);
  const port = parseInt(stripQuotes(parts[2]), 10);
  if (!server || !Number.isFinite(port)) return null;
  const opts = parseOptions(parts, 3);

  const protoMap: Record<string, ProxyProtocol> = {
    ss: 'ss',
    ssr: 'ssr',
    vmess: 'vmess',
    vless: 'vless',
    trojan: 'trojan',
    hysteria2: 'hysteria2',
    tuic: 'tuic',
    wireguard: 'wireguard',
    socks5: 'socks',
    'socks5-tls': 'socks',
    http: 'http',
  };
  const type = protoMap[kind];
  if (!type) return null;

  const node: ProxyNode = {
    name: name || `${server}:${port}`,
    type,
    server,
    port,
    transport: 'tcp',
    tls: (kind === 'socks5-tls' ? 'tls' : 'none') as TlsType,
    udp: true,
  };

  if (type === 'ss' || type === 'ssr') {
    node.method = pick(opts, 'encrypt-method', 'method', 'cipher');
    node.password = pick(opts, 'password');
    if (type === 'ssr') {
      node.ssrProtocol = pick(opts, 'protocol');
      node.ssrProtocolParam = pick(opts, 'protocol-param');
      node.ssrObfs = pick(opts, 'obfs');
      node.ssrObfsParam = pick(opts, 'obfs-param');
    }
  } else if (type === 'vmess') {
    node.uuid = pick(opts, 'username', 'uuid', 'id');
    node.method = pick(opts, 'method', 'cipher') || 'auto';
    const aid = parseInt(pick(opts, 'alter-id', 'alterid', 'aid') || '0', 10);
    if (Number.isFinite(aid)) node.alterId = aid;
  } else if (type === 'vless') {
    node.uuid = pick(opts, 'username', 'uuid', 'id');
    node.flow = pick(opts, 'flow');
  } else if (type === 'trojan') {
    node.password = pick(opts, 'password');
    node.tls = 'tls';
  } else if (type === 'hysteria2') {
    node.password = pick(opts, 'password');
    node.tls = 'tls';
    node.obfsPassword = pick(opts, 'obfs-password');
  } else if (type === 'tuic') {
    node.uuid = pick(opts, 'token', 'uuid');
    node.password = pick(opts, 'password');
    node.tls = 'tls';
  } else if (type === 'wireguard') {
    node.privateKey = pick(opts, 'private-key', 'private_key');
    node.publicKey = pick(opts, 'public-key', 'public_key');
    node.preSharedKey = pick(opts, 'pre-shared-key', 'pre_shared_key');
    node.mtu = parseInt(pick(opts, 'mtu') || '', 10) || undefined;
  } else if (type === 'socks' || type === 'http') {
    node.uuid = pick(opts, 'username', 'user');
    node.password = pick(opts, 'password', 'pass');
  }

  applyCommonOptions(node, opts);
  return node;
}

function parseLoonLine(line: string): ProxyNode | null {
  const eq = line.indexOf('=');
  if (eq === -1) return null;
  const name = normalizeName(line.slice(0, eq), '');
  const right = line.slice(eq + 1).trim();
  const parts = splitCommaAware(right);
  if (parts.length < 4) return null;

  const kind = parts[0].trim().toLowerCase();
  if (!LOON_TYPES.has(kind)) return null;

  const server = stripQuotes(parts[1]);
  const port = parseInt(stripQuotes(parts[2]), 10);
  if (!server || !Number.isFinite(port)) return null;

  const fallbackName = `${server}:${port}`;
  const finalName = name || fallbackName;

  let node: ProxyNode | null = null;
  let optsStart = 3;

  switch (kind) {
    case 'shadowsocks': {
      node = {
        name: finalName, type: 'ss', server, port,
        method: stripQuotes(parts[3]), password: stripQuotes(parts[4] || ''),
        transport: 'tcp', tls: 'none', udp: true,
      };
      optsStart = 5;
      break;
    }
    case 'shadowsocksr': {
      node = {
        name: finalName, type: 'ssr', server, port,
        method: stripQuotes(parts[3]), password: stripQuotes(parts[4] || ''),
        transport: 'tcp', tls: 'none', udp: true,
      };
      optsStart = 5;
      break;
    }
    case 'vmess': {
      node = {
        name: finalName, type: 'vmess', server, port,
        method: stripQuotes(parts[3]) || 'auto', uuid: stripQuotes(parts[4] || ''),
        transport: 'tcp', tls: 'none', udp: true,
      };
      optsStart = 5;
      break;
    }
    case 'vless': {
      node = {
        name: finalName, type: 'vless', server, port,
        uuid: stripQuotes(parts[4] || parts[3] || ''),
        transport: 'tcp', tls: 'none', udp: true,
      };
      optsStart = 5;
      break;
    }
    case 'trojan': {
      node = {
        name: finalName, type: 'trojan', server, port,
        password: stripQuotes(parts[3] || ''),
        transport: 'tcp', tls: 'tls', udp: true,
      };
      optsStart = 4;
      break;
    }
    case 'hysteria2': {
      node = {
        name: finalName, type: 'hysteria2', server, port,
        password: stripQuotes(parts[3] || ''),
        transport: 'tcp', tls: 'tls', udp: true,
      };
      optsStart = 4;
      break;
    }
    case 'tuic': {
      node = {
        name: finalName, type: 'tuic', server, port,
        uuid: stripQuotes(parts[3] || ''),
        password: stripQuotes(parts[4] || ''),
        transport: 'tcp', tls: 'tls', udp: true,
      };
      optsStart = 5;
      break;
    }
    case 'wireguard': {
      node = {
        name: finalName, type: 'wireguard', server, port,
        transport: 'tcp', tls: 'none', udp: true,
      };
      optsStart = 3;
      break;
    }
    case 'socks5':
    case 'socks5-tls': {
      node = {
        name: finalName, type: 'socks', server, port,
        uuid: stripQuotes(parts[3] || ''),
        password: stripQuotes(parts[4] || ''),
        transport: 'tcp', tls: (kind === 'socks5-tls' ? 'tls' : 'none') as TlsType, udp: true,
      };
      optsStart = 5;
      break;
    }
    case 'http':
    case 'https': {
      node = {
        name: finalName, type: 'http', server, port,
        uuid: stripQuotes(parts[3] || ''),
        password: stripQuotes(parts[4] || ''),
        transport: 'tcp', tls: (kind === 'https' ? 'tls' : 'none') as TlsType, udp: true,
      };
      optsStart = 5;
      break;
    }
    default:
      return null;
  }

  const opts = parseOptions(parts, optsStart);
  if (node.type === 'ssr') {
    node.ssrProtocol = pick(opts, 'protocol');
    node.ssrProtocolParam = pick(opts, 'protocol-param');
    node.ssrObfs = pick(opts, 'obfs');
    node.ssrObfsParam = pick(opts, 'obfs-param');
  }
  if (node.type === 'wireguard') {
    node.privateKey = pick(opts, 'private-key', 'private_key');
    node.publicKey = pick(opts, 'public-key', 'public_key', 'peer-public-key', 'peer_public_key');
    node.preSharedKey = pick(opts, 'pre-shared-key', 'pre_shared_key');
    node.mtu = parseInt(pick(opts, 'mtu') || '', 10) || undefined;
  }
  if (node.type === 'hysteria2') {
    node.obfs = pick(opts, 'obfs');
    node.obfsPassword = pick(opts, 'obfs-password');
  }

  applyCommonOptions(node, opts);
  return node;
}

export const clientConfigParser: Parser = {
  canParse(input: string): boolean {
    return (
      /^\s*\[(server_local|proxy)\]\s*$/im.test(input) ||
      /^\s*(shadowsocks|shadowsocksr|vmess|vless|trojan|http|socks5(?:-tls)?|hysteria2|tuic|wireguard)\s*=/im.test(input) ||
      /^\s*[^#;\r\n][^=\r\n]{0,80}\s*=\s*(ss|ssr|vmess|vless|trojan|http|socks5(?:-tls)?|hysteria2|tuic|wireguard)\s*,/im.test(input) ||
      /^\s*[^#;\r\n][^=\r\n]{0,80}\s*=\s*(shadowsocksr?|vmess|vless|trojan|http|https|socks5(?:-tls)?|hysteria2|tuic|wireguard)\s*,/im.test(input)
    );
  },

  parse(input: string): ProxyNode[] {
    const lines = input.split(/\r?\n/);
    const nodes: ProxyNode[] = [];
    let section = '';

    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith('#') || line.startsWith(';') || line.startsWith('//')) continue;
      if (line.startsWith('[') && line.endsWith(']')) {
        section = line.slice(1, -1).trim().toLowerCase();
        continue;
      }

      let node: ProxyNode | null = null;
      if (section === 'server_local') {
        node = parseQxLine(line);
      } else if (section === 'proxy') {
        node = parseLoonLine(line) || parseSurgeLine(line);
      } else {
        node = parseQxLine(line) || parseLoonLine(line) || parseSurgeLine(line);
      }

      if (node) nodes.push(node);
    }

    return nodes;
  },
};

export default clientConfigParser;
