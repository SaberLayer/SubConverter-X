import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { saveSubscription, getSubscription } from '../db';
import { parseInput } from '../core/parser';
import { processNodes } from '../core/processor';
import { getGenerator } from '../core/generator';
import { getRule } from '../rules';
import { TargetFormat } from '../core/types';
import { resolveNodeDomains } from '../core/resolve-domain';
import { generateRegionGroups } from '../core/region-groups';
import { ApiError, sendError } from '../core/api-error';
import { parseConversionRequest, parseDirectSubscriptionQuery } from '../core/request-schema';
import { analyzeConversion } from '../core/capabilities';

const router = Router();

const CONTENT_TYPES: Record<string, string> = {
  'auto': 'text/yaml; charset=utf-8',
  'clash': 'text/yaml; charset=utf-8',
  'clashr': 'text/yaml; charset=utf-8',
  'clash-meta': 'text/yaml; charset=utf-8',
  'egern': 'text/yaml; charset=utf-8',
  'stash': 'text/yaml; charset=utf-8',
  'singbox': 'application/json; charset=utf-8',
  'surge': 'text/plain; charset=utf-8',
  'surgemac': 'text/plain; charset=utf-8',
  'surfboard': 'text/plain; charset=utf-8',
  'quantumultx': 'text/plain; charset=utf-8',
  'shadowrocket': 'text/plain; charset=utf-8',
  'loon': 'text/plain; charset=utf-8',
  'v2ray': 'application/json; charset=utf-8',
  'v2ray-uri': 'text/plain; charset=utf-8',
  'mixed': 'text/plain; charset=utf-8',
  'plain-json': 'application/json; charset=utf-8',
  'base64': 'text/plain; charset=utf-8',
};

function fileExt(target: string): string {
  if (target === 'singbox' || target === 'v2ray' || target === 'plain-json') return 'json';
  if (target === 'auto' || target === 'clash' || target === 'clashr' || target === 'clash-meta' || target === 'egern' || target === 'stash') return 'yaml';
  return 'txt';
}

function detectTargetFromUA(ua: string): TargetFormat | null {
  const lower = ua.toLowerCase();
  if (lower.includes('clash')) return 'clash-meta';
  if (lower.includes('egern')) return 'egern';
  if (lower.includes('stash')) return 'stash';
  if (lower.includes('surfboard')) return 'surfboard';
  if (lower.includes('sing-box') || lower.includes('singbox')) return 'singbox';
  if (lower.includes('surge')) return 'surge';
  if (lower.includes('quantumult')) return 'quantumultx';
  if (lower.includes('shadowrocket')) return 'shadowrocket';
  if (lower.includes('loon')) return 'loon';
  return null;
}

// GET /api/sub?target=clash-meta&url=https://...&rule=bypass-cn&include=...&exclude=...&rename=...&emoji=true&dedupe=true&sort=region
// Can be used directly as a subscription URL in proxy clients
router.get('/sub', async (req: Request, res: Response) => {
  try {
    const options = parseDirectSubscriptionQuery(req.query as Record<string, unknown>);
    const {
      url, ruleTemplate, include, exclude, includeTypes, excludeTypes,
      includeRegions, excludeRegions, rename, regexDelete, regexSort,
      filterUseless, resolveDomain, addEmoji, deduplicate, sort,
      enableUdp, skipCertVerify
    } = options;
    let target = options.target;

    // Auto-detect target from User-Agent if not specified
    if (!target || target === 'auto') {
      const detected = detectTargetFromUA(req.get('user-agent') || '');
      target = detected || 'clash-meta';
    }

    const generator = getGenerator(target);
    if (!generator) {
      throw new ApiError(400, 'UNSUPPORTED_TARGET', `Unsupported target format: ${target}`);
    }

    // Support multiple URLs separated by |
    const input = url.split('|').join('\n');
    const { nodes, subscriptionUserinfo } = await parseInput(input);

    if (nodes.length === 0) {
      throw new ApiError(400, 'NO_VALID_NODES', 'No valid proxy nodes found');
    }

    const maybeResolved = await resolveNodeDomains(nodes, resolveDomain);
    const processed = processNodes(maybeResolved, {
      include: include || undefined,
      exclude: exclude || undefined,
      includeTypes,
      excludeTypes,
      includeRegions,
      excludeRegions,
      rename: rename || undefined,
      regexDelete: regexDelete || undefined,
      regexSort: regexSort || undefined,
      filterUseless,
      addEmoji,
      deduplicate,
      sort: sort as any,
      enableUdp,
      skipCertVerify,
    });

    const { supported } = analyzeConversion(target, processed, generator.supportedProtocols);

    let resolvedRules: string | undefined;
    if (ruleTemplate) {
      const rule = getRule(ruleTemplate);
      if (rule) {
        const ruleLines = await rule.generate('Proxy');
        resolvedRules = ruleLines.join('\n');
      }
    }

    const output = generator.generate(supported, resolvedRules);

    if (subscriptionUserinfo) {
      res.set('subscription-userinfo', subscriptionUserinfo);
    }
    res.set('Content-Type', CONTENT_TYPES[target] || 'text/plain; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="sub.${fileExt(target)}"`);
    res.set('profile-update-interval', '12');
    res.send(output);
  } catch (err) {
    sendError(res, err);
  }
});

// Create short link
router.post('/shorten', (req: Request, res: Response) => {
  try {
    const options = parseConversionRequest(req.body);
    const {
      input, target, ruleTemplate, include, exclude, rename,
      includeTypes, excludeTypes, includeRegions, excludeRegions,
      regexDelete, regexSort, filterUseless, resolveDomain,
      addEmoji, deduplicate, sort, enableUdp, skipCertVerify, proxyGroups, autoRegionGroup
    } = options;

    const token = crypto.randomBytes(9).toString('base64url');
    saveSubscription(token, {
      input, target, ruleTemplate, include, exclude, rename,
      includeTypes,
      excludeTypes,
      includeRegions,
      excludeRegions,
      regexDelete,
      regexSort,
      filterUseless,
      resolveDomain,
      addEmoji, deduplicate, sort, enableUdp, skipCertVerify,
      autoRegionGroup,
      proxyGroups: autoRegionGroup ? undefined : proxyGroups
    });

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    res.json({ token, url: `${baseUrl}/api/sub/${token}` });
  } catch (err) {
    sendError(res, err);
  }
});

// Serve subscription by token
router.get('/sub/:token', async (req: Request, res: Response) => {
  try {
    const token = req.params.token as string;
    const sub = getSubscription(token);

    if (!sub) {
      throw new ApiError(404, 'SUBSCRIPTION_NOT_FOUND', 'Subscription not found');
    }

    // Auto-detect target from User-Agent if needed
    let target = sub.target as TargetFormat;
    const detected = detectTargetFromUA(req.get('user-agent') || '');
    if (detected) target = detected;

    const generator = getGenerator(target);
    if (!generator) {
      throw new ApiError(400, 'UNSUPPORTED_TARGET', `Unsupported format: ${target}`);
    }

    const { nodes, subscriptionUserinfo } = await parseInput(sub.input);
    const maybeResolved = await resolveNodeDomains(nodes, sub.resolveDomain);

    // Apply node processing (filter/rename/emoji/dedupe/sort/global settings)
    const processed = processNodes(maybeResolved, {
      include: sub.include,
      exclude: sub.exclude,
      includeTypes: sub.includeTypes,
      excludeTypes: sub.excludeTypes,
      includeRegions: sub.includeRegions,
      excludeRegions: sub.excludeRegions,
      rename: sub.rename,
      regexDelete: sub.regexDelete,
      regexSort: sub.regexSort,
      filterUseless: sub.filterUseless,
      addEmoji: sub.addEmoji,
      deduplicate: sub.deduplicate,
      sort: sub.sort as any,
      enableUdp: sub.enableUdp,
      skipCertVerify: sub.skipCertVerify,
    });

    const { supported } = analyzeConversion(target, processed, generator.supportedProtocols);

    // Resolve rule template ID to actual rules
    let resolvedRules: string | undefined;
    if (sub.ruleTemplate) {
      const rule = getRule(sub.ruleTemplate);
      if (rule) {
        const ruleLines = await rule.generate('Proxy');
        resolvedRules = ruleLines.join('\n');
      }
    }

    const finalProxyGroups = sub.autoRegionGroup ? generateRegionGroups(supported) : sub.proxyGroups;
    const output = generator.generate(supported, resolvedRules, finalProxyGroups);

    // Pass through upstream subscription-userinfo header
    if (subscriptionUserinfo) {
      res.set('subscription-userinfo', subscriptionUserinfo);
    }

    res.set('Content-Type', CONTENT_TYPES[target] || 'text/plain; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="sub_${token}.${fileExt(target)}"`);
    res.set('profile-update-interval', '12');
    res.send(output);
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
