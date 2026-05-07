export interface SubscriptionUserinfo {
  upload?: number;
  download?: number;
  total?: number;
  expire?: number;
}

const USERINFO_FIELDS = ['upload', 'download', 'total', 'expire'] as const;

export function parseSubscriptionUserinfo(raw?: string): SubscriptionUserinfo | undefined {
  if (!raw) return undefined;

  const result: SubscriptionUserinfo = {};
  for (const part of raw.split(';')) {
    const [keyRaw, valueRaw] = part.split('=');
    const key = keyRaw?.trim().toLowerCase();
    const value = Number(valueRaw?.trim());
    if (!USERINFO_FIELDS.includes(key as any)) continue;
    if (!Number.isFinite(value) || value < 0) continue;
    result[key as keyof SubscriptionUserinfo] = Math.floor(value);
  }

  return Object.keys(result).length ? result : undefined;
}

export function formatSubscriptionUserinfo(info?: SubscriptionUserinfo): string | undefined {
  if (!info) return undefined;
  const parts: string[] = [];
  for (const field of USERINFO_FIELDS) {
    const value = info[field];
    if (value !== undefined) parts.push(`${field}=${value}`);
  }
  return parts.length ? parts.join('; ') : undefined;
}

export function mergeSubscriptionUserinfo(items: Array<string | SubscriptionUserinfo | undefined>): SubscriptionUserinfo | undefined {
  const parsed = items
    .map((item) => typeof item === 'string' ? parseSubscriptionUserinfo(item) : item)
    .filter((item): item is SubscriptionUserinfo => !!item);

  if (parsed.length === 0) return undefined;

  const merged: SubscriptionUserinfo = {};
  for (const info of parsed) {
    if (info.upload !== undefined) merged.upload = (merged.upload || 0) + info.upload;
    if (info.download !== undefined) merged.download = (merged.download || 0) + info.download;
    if (info.total !== undefined) merged.total = (merged.total || 0) + info.total;
    if (info.expire !== undefined) {
      merged.expire = merged.expire === undefined ? info.expire : Math.min(merged.expire, info.expire);
    }
  }

  return Object.keys(merged).length ? merged : undefined;
}

