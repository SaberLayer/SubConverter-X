import { getAllFormats } from './generator';
import { ApiError } from './api-error';
import type { ProxyGroup, TargetFormat } from './types';

export interface ConversionRequest {
  input: string;
  target: TargetFormat;
  ruleTemplate?: string;
  include?: string;
  exclude?: string;
  rename?: string;
  includeTypes?: string[];
  excludeTypes?: string[];
  includeRegions?: string[];
  excludeRegions?: string[];
  regexDelete?: string;
  regexSort?: string;
  filterUseless?: boolean;
  resolveDomain?: boolean;
  addEmoji?: boolean;
  deduplicate?: boolean;
  sort?: 'none' | 'name' | 'region';
  enableUdp?: boolean;
  skipCertVerify?: boolean;
  proxyGroups?: ProxyGroup[];
  autoRegionGroup?: boolean;
}

export interface DirectSubscriptionQuery extends Omit<ConversionRequest, 'input' | 'target' | 'proxyGroups' | 'autoRegionGroup'> {
  url: string;
  target?: TargetFormat;
}

const SORT_VALUES = new Set(['none', 'name', 'region']);
const GROUP_TYPES = new Set(['select', 'url-test', 'fallback', 'load-balance']);

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown, field: string, required = false): string | undefined {
  if (value === undefined || value === null) {
    if (required) throw new ApiError(400, 'VALIDATION_ERROR', `Missing required field: ${field}`);
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new ApiError(400, 'VALIDATION_ERROR', `Invalid field type: ${field}`, { field, expected: 'string' });
  }
  const trimmed = value.trim();
  if (!trimmed && required) throw new ApiError(400, 'VALIDATION_ERROR', `Missing required field: ${field}`);
  return trimmed || undefined;
}

function asBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;
  }
  throw new ApiError(400, 'VALIDATION_ERROR', `Invalid field type: ${field}`, { field, expected: 'boolean' });
}

function asPositiveNumber(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', `Invalid numeric field: ${field}`, { field, expected: 'positive number' });
  }
  return num;
}

function asList(value: unknown, field: string): string[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const list = Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : String(value).split(',').map((item) => item.trim()).filter(Boolean);
  for (const item of list) {
    if (item.length > 80) {
      throw new ApiError(400, 'VALIDATION_ERROR', `List item is too long: ${field}`, { field, maxLength: 80 });
    }
  }
  return list.length ? list : undefined;
}

function asRegexString(value: unknown, field: string): string | undefined {
  const raw = asString(value, field);
  if (!raw) return undefined;
  if (raw.length > 500) {
    throw new ApiError(400, 'VALIDATION_ERROR', `Field is too long: ${field}`, { field, maxLength: 500 });
  }
  return raw;
}

function asTarget(value: unknown, required = false): TargetFormat | undefined {
  const raw = asString(value, 'target', required);
  if (!raw) return undefined;
  if (!getAllFormats().includes(raw as TargetFormat)) {
    throw new ApiError(400, 'UNSUPPORTED_TARGET', `Unsupported target format: ${raw}`, { supported: getAllFormats() });
  }
  return raw as TargetFormat;
}

function asSort(value: unknown): 'none' | 'name' | 'region' | undefined {
  const raw = asString(value, 'sort');
  if (!raw) return undefined;
  if (!SORT_VALUES.has(raw)) {
    throw new ApiError(400, 'VALIDATION_ERROR', `Invalid sort mode: ${raw}`, { supported: Array.from(SORT_VALUES) });
  }
  return raw as 'none' | 'name' | 'region';
}

function asProxyGroups(value: unknown): ProxyGroup[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'proxyGroups must be an array');
  }

  const groups = value.map((item, index) => {
    if (!isObject(item)) {
      throw new ApiError(400, 'VALIDATION_ERROR', `Invalid proxy group at index ${index}`);
    }

    const name = asString(item.name, `proxyGroups[${index}].name`, true)!;
    const type = asString(item.type, `proxyGroups[${index}].type`, true)!;
    if (!GROUP_TYPES.has(type)) {
      throw new ApiError(400, 'VALIDATION_ERROR', `Invalid proxy group type: ${type}`, { supported: Array.from(GROUP_TYPES) });
    }

    return {
      name,
      type: type as ProxyGroup['type'],
      filter: asRegexString(item.filter, `proxyGroups[${index}].filter`),
      proxies: asList(item.proxies, `proxyGroups[${index}].proxies`),
      url: asString(item.url, `proxyGroups[${index}].url`),
      interval: asPositiveNumber(item.interval, `proxyGroups[${index}].interval`),
    };
  });

  return groups.length ? groups : undefined;
}

export function parseConversionRequest(body: unknown): ConversionRequest {
  if (!isObject(body)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Request body must be a JSON object');
  }

  const input = asString(body.input, 'input', true)!;
  if (input.length > 5 * 1024 * 1024) {
    throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Input is too large', { maxBytes: 5 * 1024 * 1024 });
  }

  return {
    input,
    target: asTarget(body.target, true)!,
    ruleTemplate: asString(body.ruleTemplate, 'ruleTemplate'),
    include: asRegexString(body.include, 'include'),
    exclude: asRegexString(body.exclude, 'exclude'),
    rename: asRegexString(body.rename, 'rename'),
    includeTypes: asList(body.includeTypes, 'includeTypes'),
    excludeTypes: asList(body.excludeTypes, 'excludeTypes'),
    includeRegions: asList(body.includeRegions, 'includeRegions'),
    excludeRegions: asList(body.excludeRegions, 'excludeRegions'),
    regexDelete: asRegexString(body.regexDelete, 'regexDelete'),
    regexSort: asRegexString(body.regexSort, 'regexSort'),
    filterUseless: asBoolean(body.filterUseless, 'filterUseless'),
    resolveDomain: asBoolean(body.resolveDomain, 'resolveDomain'),
    addEmoji: asBoolean(body.addEmoji, 'addEmoji'),
    deduplicate: asBoolean(body.deduplicate, 'deduplicate'),
    sort: asSort(body.sort),
    enableUdp: asBoolean(body.enableUdp, 'enableUdp'),
    skipCertVerify: asBoolean(body.skipCertVerify, 'skipCertVerify'),
    proxyGroups: asProxyGroups(body.proxyGroups),
    autoRegionGroup: asBoolean(body.autoRegionGroup, 'autoRegionGroup'),
  };
}

export function parseDirectSubscriptionQuery(query: Record<string, unknown>): DirectSubscriptionQuery {
  const url = asString(query.url, 'url', true)!;
  return {
    url,
    target: asTarget(query.target),
    ruleTemplate: asString(query.rule, 'rule'),
    include: asRegexString(query.include, 'include'),
    exclude: asRegexString(query.exclude, 'exclude'),
    includeTypes: asList(query.types ?? query.includeTypes, 'types'),
    excludeTypes: asList(query.excludeTypes, 'excludeTypes'),
    includeRegions: asList(query.regions ?? query.includeRegions, 'regions'),
    excludeRegions: asList(query.excludeRegions, 'excludeRegions'),
    rename: asRegexString(query.rename, 'rename'),
    regexDelete: asRegexString(query.regexDelete ?? query.delete, 'regexDelete'),
    regexSort: asRegexString(query.regexSort, 'regexSort'),
    filterUseless: asBoolean(query.useless, 'useless') ?? false,
    resolveDomain: asBoolean(query.resolveDomain, 'resolveDomain') ?? false,
    addEmoji: asBoolean(query.emoji, 'emoji') ?? false,
    deduplicate: asBoolean(query.dedupe, 'dedupe') ?? false,
    sort: asSort(query.sort) ?? 'none',
    enableUdp: asBoolean(query.udp, 'udp'),
    skipCertVerify: asBoolean(query.skipCert, 'skipCert'),
  };
}
