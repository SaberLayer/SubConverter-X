const API_BASE = '/api';

async function parseJsonResponse<T>(res: Response, fallback: string): Promise<T> {
  const text = await res.text();
  if (!text) throw new Error('服务器返回空响应，请检查后端是否正常运行');

  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`服务器返回非 JSON 响应: ${text.substring(0, 200)}`);
  }

  if (!res.ok) {
    const error = data.error;
    if (typeof error === 'string') throw new Error(error);
    if (error?.message) throw new Error(error.message);
    throw new Error(fallback);
  }

  return data;
}

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
  regexDelete?: string;
  regexSort?: string;
  filterUseless?: boolean;
  resolveDomain?: boolean;
  includeTypes?: string[];
  excludeTypes?: string[];
  includeRegions?: string[];
  excludeRegions?: string[];
  rename?: string;
  addEmoji?: boolean;
  deduplicate?: boolean;
  sort?: 'none' | 'name' | 'region';
  enableUdp?: boolean;
  skipCertVerify?: boolean;
  proxyGroups?: ProxyGroup[];
  autoRegionGroup?: boolean;
  configTemplate?: string;
  configTemplateUrl?: string;
}

export interface ConvertResponse {
  output: string;
  nodeCount: number;
  skipped: string[];
  warnings?: ConversionWarning[];
  subscriptionUserinfo?: string;
  filteredOut?: number;
}

export interface ConversionWarning {
  code: string;
  severity: 'info' | 'warning';
  message: string;
  target: string;
  protocol?: string;
  nodes?: string[];
  count?: number;
}

export interface ShortenResponse {
  token: string;
  url: string;
  expiresAt?: number;
  ttlDays?: number;
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
  return parseJsonResponse<ConvertResponse>(res, 'Convert failed');
}

export async function shorten(req: ConvertRequest): Promise<ShortenResponse> {
  const res = await fetch(`${API_BASE}/shorten`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  return parseJsonResponse<ShortenResponse>(res, 'Shorten failed');
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
