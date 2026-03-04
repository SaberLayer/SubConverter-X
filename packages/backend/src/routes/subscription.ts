import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { saveSubscription, getSubscription } from '../db';
import { parseInput } from '../core/parser';
import { processNodes } from '../core/processor';
import { getGenerator } from '../core/generator';
import { getRule } from '../rules';
import { TargetFormat } from '../core/types';
import { resolveNodeDomains } from '../core/resolve-domain';

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

function normalizeList(v: unknown): string[] | undefined {
  if (!v) return undefined;
  if (Array.isArray(v)) {
    const list = v.map((x) => String(x).trim()).filter(Boolean);
    return list.length ? list : undefined;
  }
  if (typeof v === 'string') {
    const list = v.split(',').map((x) => x.trim()).filter(Boolean);
    return list.length ? list : undefined;
  }
  return undefined;
}

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
    const url = req.query.url as string | undefined;
    let target = (req.query.target as string | undefined) as TargetFormat | undefined;
    const ruleTemplate = req.query.rule as string | undefined;
    const include = req.query.include as string | undefined;
    const exclude = req.query.exclude as string | undefined;
    const includeTypes = normalizeList(req.query.types || req.query.includeTypes);
    const excludeTypes = normalizeList(req.query.excludeTypes);
    const includeRegions = normalizeList(req.query.regions || req.query.includeRegions);
    const excludeRegions = normalizeList(req.query.excludeRegions);
    const rename = req.query.rename as string | undefined;
    const regexDelete = (req.query.regexDelete || req.query.delete) as string | undefined;
    const regexSort = req.query.regexSort as string | undefined;
    const filterUseless = req.query.useless === 'true' || req.query.useless === '1';
    const resolveDomain = req.query.resolveDomain === 'true' || req.query.resolveDomain === '1';
    const addEmoji = req.query.emoji === 'true' || req.query.emoji === '1';
    const deduplicate = req.query.dedupe === 'true' || req.query.dedupe === '1';
    const sort = (req.query.sort as string | undefined) || 'none';
    const enableUdp = req.query.udp === 'true' ? true : req.query.udp === 'false' ? false : undefined;
    const skipCertVerify = req.query.skipCert === 'true' ? true : req.query.skipCert === 'false' ? false : undefined;

    if (!url) {
      res.status(400).json({ error: 'Missing url parameter' });
      return;
    }

    // Auto-detect target from User-Agent if not specified
    if (!target || target === 'auto') {
      const detected = detectTargetFromUA(req.get('user-agent') || '');
      target = detected || 'clash-meta';
    }

    const generator = getGenerator(target);
    if (!generator) {
      res.status(400).json({ error: `Unsupported target format: ${target}` });
      return;
    }

    // Support multiple URLs separated by |
    const input = url.split('|').join('\n');
    const { nodes, subscriptionUserinfo } = await parseInput(input);

    if (nodes.length === 0) {
      res.status(400).json({ error: 'No valid proxy nodes found' });
      return;
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

    const supported = processed.filter((n) => generator.supportedProtocols.includes(n.type));

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
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Create short link
router.post('/shorten', (req: Request, res: Response) => {
  try {
    const {
      input, target, ruleTemplate, include, exclude, rename,
      includeTypes, excludeTypes, includeRegions, excludeRegions,
      regexDelete, regexSort, filterUseless, resolveDomain,
      addEmoji, deduplicate, sort, enableUdp, skipCertVerify, proxyGroups
    } = req.body as {
      input: string;
      target: TargetFormat;
      ruleTemplate?: string;
      include?: string;
      exclude?: string;
      rename?: string;
      includeTypes?: string[] | string;
      excludeTypes?: string[] | string;
      includeRegions?: string[] | string;
      excludeRegions?: string[] | string;
      regexDelete?: string;
      regexSort?: string;
      filterUseless?: boolean;
      resolveDomain?: boolean;
      addEmoji?: boolean;
      deduplicate?: boolean;
      sort?: string;
      enableUdp?: boolean;
      skipCertVerify?: boolean;
      proxyGroups?: any[];
    };

    if (!input || !target) {
      res.status(400).json({ error: 'Missing input or target format' });
      return;
    }

    const token = crypto.randomBytes(9).toString('base64url');
    saveSubscription(token, {
      input, target, ruleTemplate, include, exclude, rename,
      includeTypes: normalizeList(includeTypes),
      excludeTypes: normalizeList(excludeTypes),
      includeRegions: normalizeList(includeRegions),
      excludeRegions: normalizeList(excludeRegions),
      regexDelete,
      regexSort,
      filterUseless,
      resolveDomain,
      addEmoji, deduplicate, sort, enableUdp, skipCertVerify, proxyGroups
    });

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    res.json({ token, url: `${baseUrl}/api/sub/${token}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Serve subscription by token
router.get('/sub/:token', async (req: Request, res: Response) => {
  try {
    const token = req.params.token as string;
    const sub = getSubscription(token);

    if (!sub) {
      res.status(404).json({ error: 'Subscription not found' });
      return;
    }

    // Auto-detect target from User-Agent if needed
    let target = sub.target as TargetFormat;
    const detected = detectTargetFromUA(req.get('user-agent') || '');
    if (detected) target = detected;

    const generator = getGenerator(target);
    if (!generator) {
      res.status(400).json({ error: `Unsupported format: ${target}` });
      return;
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

    const supported = processed.filter((n) => generator.supportedProtocols.includes(n.type));

    // Resolve rule template ID to actual rules
    let resolvedRules: string | undefined;
    if (sub.ruleTemplate) {
      const rule = getRule(sub.ruleTemplate);
      if (rule) {
        const ruleLines = await rule.generate('Proxy');
        resolvedRules = ruleLines.join('\n');
      }
    }

    const output = generator.generate(supported, resolvedRules, sub.proxyGroups);

    // Pass through upstream subscription-userinfo header
    if (subscriptionUserinfo) {
      res.set('subscription-userinfo', subscriptionUserinfo);
    }

    res.set('Content-Type', CONTENT_TYPES[target] || 'text/plain; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="sub_${token}.${fileExt(target)}"`);
    res.set('profile-update-interval', '12');
    res.send(output);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;
