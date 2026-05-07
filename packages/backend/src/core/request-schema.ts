import { getAllFormats } from './generator';
import { ApiError } from './api-error';
import type { ProxyGroup, ProxyProtocol, TargetFormat, TlsType, Transport } from './types';
import type { NodeOperator, SettableNodeField } from './node-operators';

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
  configTemplate?: string;
  configTemplateUrl?: string;
  operators?: NodeOperator[];
}

export interface DirectSubscriptionQuery extends Omit<ConversionRequest, 'input' | 'target' | 'proxyGroups' | 'autoRegionGroup'> {
  url: string;
  target?: TargetFormat;
}

const SORT_VALUES = new Set(['none', 'name', 'region']);
const GROUP_TYPES = new Set(['select', 'url-test', 'fallback', 'load-balance']);
const OPERATOR_TYPES = new Set(['filter', 'rename', 'set', 'sort', 'dedupe']);
const PROTOCOL_VALUES = new Set<ProxyProtocol>(['ss', 'ssr', 'vmess', 'vless', 'trojan', 'hysteria', 'hysteria2', 'tuic', 'wireguard', 'socks', 'http']);
const TRANSPORT_VALUES = new Set<Transport>(['tcp', 'ws', 'grpc', 'h2', 'quic', 'httpupgrade', 'xhttp', 'splithttp']);
const TLS_VALUES = new Set<TlsType>(['none', 'tls', 'reality']);
const SET_FIELDS = new Set<SettableNodeField>(['udp', 'skipCertVerify', 'sni', 'fingerprint', 'alpn', 'flow']);
const OPERATOR_SORT_VALUES = new Set(['name', 'region', 'protocol', 'server', 'port']);
const SORT_ORDERS = new Set(['asc', 'desc']);
const DEDUPE_MODES = new Set(['fingerprint', 'endpoint', 'credential']);

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

function asTemplateString(value: unknown, field: string): string | undefined {
  const raw = asString(value, field);
  if (!raw) return undefined;
  if (raw.length > 1024 * 1024) {
    throw new ApiError(413, 'PAYLOAD_TOO_LARGE', `${field} is too large`, { maxBytes: 1024 * 1024 });
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

function asEnumList<T extends string>(value: unknown, field: string, supported: Set<T>): T[] | undefined {
  const list = asList(value, field);
  if (!list) return undefined;
  for (const item of list) {
    if (!supported.has(item as T)) {
      throw new ApiError(400, 'VALIDATION_ERROR', `Invalid ${field} item: ${item}`, { supported: Array.from(supported) });
    }
  }
  return list as T[];
}

function asPort(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(num) || num < 1 || num > 65535) {
    throw new ApiError(400, 'VALIDATION_ERROR', `Invalid port field: ${field}`, { field, min: 1, max: 65535 });
  }
  return num;
}

function asNodeOperators(value: unknown): NodeOperator[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'operators must be an array');
  }
  if (value.length > 20) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Too many operators', { maxItems: 20 });
  }

  const operators = value.map((item, index): NodeOperator => {
    if (!isObject(item)) {
      throw new ApiError(400, 'VALIDATION_ERROR', `Invalid operator at index ${index}`);
    }
    const type = asString(item.type, `operators[${index}].type`, true)!;
    if (!OPERATOR_TYPES.has(type)) {
      throw new ApiError(400, 'VALIDATION_ERROR', `Invalid operator type: ${type}`, { supported: Array.from(OPERATOR_TYPES) });
    }

    if (type === 'filter') {
      const minPort = asPort(item.minPort, `operators[${index}].minPort`);
      const maxPort = asPort(item.maxPort, `operators[${index}].maxPort`);
      if (minPort !== undefined && maxPort !== undefined && minPort > maxPort) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'operator minPort cannot be greater than maxPort');
      }
      return {
        type,
        include: asRegexString(item.include, `operators[${index}].include`),
        exclude: asRegexString(item.exclude, `operators[${index}].exclude`),
        protocols: asEnumList(item.protocols, `operators[${index}].protocols`, PROTOCOL_VALUES),
        transports: asEnumList(item.transports, `operators[${index}].transports`, TRANSPORT_VALUES),
        tls: asEnumList(item.tls, `operators[${index}].tls`, TLS_VALUES),
        regions: asList(item.regions, `operators[${index}].regions`)?.map((code) => code.toUpperCase()),
        minPort,
        maxPort,
      };
    }

    if (type === 'rename') {
      return {
        type,
        pattern: asRegexString(item.pattern, `operators[${index}].pattern`) || '',
        replacement: asString(item.replacement, `operators[${index}].replacement`) || '',
      };
    }

    if (type === 'set') {
      const field = asString(item.field, `operators[${index}].field`, true)!;
      if (!SET_FIELDS.has(field as SettableNodeField)) {
        throw new ApiError(400, 'VALIDATION_ERROR', `Invalid set field: ${field}`, { supported: Array.from(SET_FIELDS) });
      }
      const value = (item as Record<string, unknown>).value;
      if (value === undefined) {
        throw new ApiError(400, 'VALIDATION_ERROR', `Missing required field: operators[${index}].value`);
      }
      if (field === 'udp' || field === 'skipCertVerify') {
        return { type, field: field as SettableNodeField, value: asBoolean(value, `operators[${index}].value`) ?? false };
      }
      if (field === 'alpn') {
        return { type, field: 'alpn', value: asList(value, `operators[${index}].value`) || [] };
      }
      return { type, field: field as SettableNodeField, value: asString(value, `operators[${index}].value`) || '' };
    }

    if (type === 'sort') {
      const by = asString(item.by, `operators[${index}].by`, true)!;
      if (!OPERATOR_SORT_VALUES.has(by)) {
        throw new ApiError(400, 'VALIDATION_ERROR', `Invalid operator sort field: ${by}`, { supported: Array.from(OPERATOR_SORT_VALUES) });
      }
      const order = asString(item.order, `operators[${index}].order`);
      if (order && !SORT_ORDERS.has(order)) {
        throw new ApiError(400, 'VALIDATION_ERROR', `Invalid operator sort order: ${order}`, { supported: Array.from(SORT_ORDERS) });
      }
      return { type, by: by as any, order: order as any };
    }

    const mode = asString(item.mode, `operators[${index}].mode`);
    if (mode && !DEDUPE_MODES.has(mode)) {
      throw new ApiError(400, 'VALIDATION_ERROR', `Invalid dedupe mode: ${mode}`, { supported: Array.from(DEDUPE_MODES) });
    }
    return { type: 'dedupe', mode: mode as any };
  });

  return operators.length ? operators : undefined;
}

export function parseConversionRequest(body: unknown): ConversionRequest {
  if (!isObject(body)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Request body must be a JSON object');
  }

  const input = asString(body.input, 'input', true)!;
  if (input.length > 5 * 1024 * 1024) {
    throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Input is too large', { maxBytes: 5 * 1024 * 1024 });
  }

  const configTemplate = asTemplateString(body.configTemplate, 'configTemplate');
  const configTemplateUrl = asString(body.configTemplateUrl, 'configTemplateUrl');
  if (configTemplate && configTemplateUrl) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Use either configTemplate or configTemplateUrl, not both');
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
    configTemplate,
    configTemplateUrl,
    operators: asNodeOperators(body.operators),
  };
}

export function parseDirectSubscriptionQuery(query: Record<string, unknown>): DirectSubscriptionQuery {
  const url = asString(query.url, 'url', true)!;
  const configTemplate = asTemplateString(query.configTemplate, 'configTemplate');
  const configTemplateUrl = asString(query.configTemplateUrl ?? query.template, 'configTemplateUrl');
  if (configTemplate && configTemplateUrl) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Use either configTemplate or configTemplateUrl, not both');
  }

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
    configTemplate,
    configTemplateUrl,
  };
}
