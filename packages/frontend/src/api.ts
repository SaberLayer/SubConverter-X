const API_BASE = '/api';

export interface ProxyGroup {
  name: string;
  type: 'select' | 'url-test' | 'fallback' | 'load-balance';
  filter?: string;
  proxies?: string[];
  url?: string;
  interval?: number;
}

export interface ConvertRequest {
  input: string;
  target: string;
  ruleTemplate?: string;
  include?: string;
  exclude?: string;
  rename?: string;
  addEmoji?: boolean;
  deduplicate?: boolean;
  sort?: 'none' | 'name' | 'region';
  enableUdp?: boolean;
  skipCertVerify?: boolean;
  proxyGroups?: ProxyGroup[];
  autoRegionGroup?: boolean;
}

export interface ConvertResponse {
  output: string;
  nodeCount: number;
  skipped: string[];
  subscriptionUserinfo?: string;
  filteredOut?: number;
}

export interface ShortenResponse {
  token: string;
  url: string;
}

export interface RuleInfo {
  id: string;
  name: string;
  description: string;
}

export async function convert(req: ConvertRequest): Promise<ConvertResponse> {
  const res = await fetch(`${API_BASE}/convert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  const text = await res.text();
  if (!text) throw new Error('服务器返回空响应，请检查后端是否正常运行');
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`服务器返回非 JSON 响应: ${text.substring(0, 200)}`);
  }
  if (!res.ok) throw new Error(data.error || 'Convert failed');
  return data;
}

export async function shorten(req: ConvertRequest): Promise<ShortenResponse> {
  const res = await fetch(`${API_BASE}/shorten`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  const text = await res.text();
  if (!text) throw new Error('服务器返回空响应，请检查后端是否正常运行');
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`服务器返回非 JSON 响应: ${text.substring(0, 200)}`);
  }
  if (!res.ok) throw new Error(data.error || 'Shorten failed');
  return data;
}

export async function getFormats(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/convert/formats`);
  const data = await res.json();
  return data.formats;
}

export async function getRules(): Promise<RuleInfo[]> {
  const res = await fetch(`${API_BASE}/convert/rules`);
  const data = await res.json();
  return data.rules;
}
