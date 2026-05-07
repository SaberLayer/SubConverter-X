import * as yaml from 'js-yaml';
import type { ProxyNode, TargetFormat } from './types';
import {
  hasTemplateToken,
  renderConfigTemplate,
  resolveConfigTemplate,
  type ConfigTemplateOptions,
  type TemplateContext,
} from './config-template';
import { ApiError } from './api-error';

interface RenderOutputOptions extends ConfigTemplateOptions {
  target: TargetFormat;
  nodes: ProxyNode[];
}

function asYaml(value: unknown): string {
  if (value === undefined || value === null) return '';
  return yaml.dump(value, { noRefs: true, lineWidth: -1 }).trimEnd();
}

function parseOutputDocument(target: TargetFormat, output: string): any | undefined {
  try {
    if (target === 'singbox' || target === 'v2ray' || target === 'plain-json') {
      return JSON.parse(output);
    }
    if (target === 'auto' || target === 'clash' || target === 'clashr' || target === 'clash-meta' || target === 'egern' || target === 'stash') {
      return yaml.load(output);
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function buildTemplateContext(target: TargetFormat, output: string, nodes: ProxyNode[]): TemplateContext {
  const doc = parseOutputDocument(target, output);
  const proxies = doc?.proxies ?? doc?.outbounds ?? [];
  const proxyGroups = doc?.['proxy-groups'] ?? doc?.outbounds?.filter?.((item: any) => (
    item?.type === 'selector' || item?.type === 'urltest'
  )) ?? [];
  const rules = doc?.rules ?? doc?.route?.rules ?? [];
  const dns = doc?.dns ?? {};

  return {
    content: output,
    proxies: asYaml(proxies),
    proxyGroups: asYaml(proxyGroups),
    rules: asYaml(rules),
    dns: asYaml(dns),
    nodeNames: nodes.map((node) => node.name).join('\n'),
  };
}

export async function renderOutputWithTemplate(output: string, options: RenderOutputOptions): Promise<string> {
  const template = await resolveConfigTemplate(options);
  if (!template) return output;

  if (!hasTemplateToken(template)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Config template must include at least one supported placeholder');
  }

  return renderConfigTemplate(template, buildTemplateContext(options.target, output, options.nodes));
}

