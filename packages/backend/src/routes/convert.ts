import { Router, Request, Response } from 'express';
import { parseInput } from '../core/parser';
import { processNodes, ProcessOptions } from '../core/processor';
import { getGenerator, getAllFormats } from '../core/generator';
import { getAllRules, getRule } from '../rules';
import { TargetFormat } from '../core/types';
import { processInput as fetchInput } from '../core/fetcher';
import { generateRegionGroups } from '../core/region-groups';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      input, target, ruleTemplate, include, exclude, rename,
      addEmoji, deduplicate, sort, enableUdp, skipCertVerify, proxyGroups, autoRegionGroup
    } = req.body as {
      input: string;
      target: TargetFormat;
      ruleTemplate?: string;
      include?: string;
      exclude?: string;
      rename?: string;
      addEmoji?: boolean;
      deduplicate?: boolean;
      sort?: 'none' | 'name' | 'region';
      enableUdp?: boolean;
      skipCertVerify?: boolean;
      proxyGroups?: any[];
      autoRegionGroup?: boolean;
    };

    if (!input || !target) {
      res.status(400).json({ error: 'Missing input or target format' });
      return;
    }

    const generator = getGenerator(target);
    if (!generator) {
      res.status(400).json({ error: `Unsupported target format: ${target}`, supported: getAllFormats() });
      return;
    }

    // Fetch URLs if input contains subscription URLs
    const fetchedInput = await fetchInput(input);
    const { nodes, subscriptionUserinfo } = await parseInput(fetchedInput);
    if (nodes.length === 0) {
      res.status(400).json({ error: 'No valid proxy nodes found in input' });
      return;
    }

    // Apply node processing (filter/rename/emoji/dedupe/sort/global settings)
    const processOpts: ProcessOptions = {};
    if (include) processOpts.include = include;
    if (exclude) processOpts.exclude = exclude;
    if (rename) processOpts.rename = rename;
    if (addEmoji !== undefined) processOpts.addEmoji = addEmoji;
    if (deduplicate !== undefined) processOpts.deduplicate = deduplicate;
    if (sort) processOpts.sort = sort;
    if (enableUdp !== undefined) processOpts.enableUdp = enableUdp;
    if (skipCertVerify !== undefined) processOpts.skipCertVerify = skipCertVerify;
    const processed = processNodes(nodes, processOpts);

    const supported = processed.filter((n) => generator.supportedProtocols.includes(n.type));
    const skipped = processed.filter((n) => !generator.supportedProtocols.includes(n.type)).map((n) => `${n.name} (${n.type})`);

    // Determine proxy groups
    let finalProxyGroups = proxyGroups;
    if (autoRegionGroup) {
      finalProxyGroups = generateRegionGroups(supported);
    }

    // Resolve rule template ID to actual rules
    let resolvedRules: string | undefined;
    if (ruleTemplate) {
      const rule = getRule(ruleTemplate);
      if (rule) {
        const ruleLines = await rule.generate('Proxy');
        resolvedRules = ruleLines.join('\n');
      }
    }

    const output = generator.generate(supported, resolvedRules, finalProxyGroups);

    res.json({
      output,
      nodeCount: supported.length,
      skipped,
      subscriptionUserinfo,
      filteredOut: nodes.length - processed.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

router.get('/formats', (_req: Request, res: Response) => {
  res.json({ formats: getAllFormats() });
});

router.get('/rules', (_req: Request, res: Response) => {
  res.json({ rules: getAllRules() });
});

export default router;
