import { Router, Request, Response } from 'express';
import { parseInput } from '../core/parser';
import { processNodes, ProcessOptions } from '../core/processor';
import { getGenerator, getAllFormats } from '../core/generator';
import { getAllRules, getRule } from '../rules';
import { TargetFormat } from '../core/types';
import { generateRegionGroups } from '../core/region-groups';
import { resolveNodeDomains } from '../core/resolve-domain';
import { ApiError, sendError } from '../core/api-error';
import { parseConversionRequest } from '../core/request-schema';
import { analyzeConversion } from '../core/capabilities';
import { renderOutputWithTemplate } from '../core/template-output';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const options = parseConversionRequest(req.body);
    const {
      input, target, ruleTemplate, include, exclude, rename,
      includeTypes, excludeTypes, includeRegions, excludeRegions,
      regexDelete, regexSort, filterUseless, resolveDomain,
      addEmoji, deduplicate, sort, enableUdp, skipCertVerify, proxyGroups, autoRegionGroup,
      configTemplate, configTemplateUrl
    } = options;

    const finalTarget: TargetFormat = target === 'auto' ? 'clash-meta' : target;
    const generator = getGenerator(finalTarget);
    if (!generator) {
      throw new ApiError(400, 'UNSUPPORTED_TARGET', `Unsupported target format: ${finalTarget}`, { supported: getAllFormats() });
    }

    const { nodes, subscriptionUserinfo } = await parseInput(input);
    if (nodes.length === 0) {
      throw new ApiError(400, 'NO_VALID_NODES', 'No valid proxy nodes found in input');
    }

    // Apply node processing (filter/rename/emoji/dedupe/sort/global settings)
    const processOpts: ProcessOptions = {};
    if (include) processOpts.include = include;
    if (exclude) processOpts.exclude = exclude;
    processOpts.includeTypes = includeTypes;
    processOpts.excludeTypes = excludeTypes;
    processOpts.includeRegions = includeRegions;
    processOpts.excludeRegions = excludeRegions;
    if (rename) processOpts.rename = rename;
    if (regexDelete) processOpts.regexDelete = regexDelete;
    if (regexSort) processOpts.regexSort = regexSort;
    if (filterUseless !== undefined) processOpts.filterUseless = filterUseless;
    if (addEmoji !== undefined) processOpts.addEmoji = addEmoji;
    if (deduplicate !== undefined) processOpts.deduplicate = deduplicate;
    if (sort) processOpts.sort = sort;
    if (enableUdp !== undefined) processOpts.enableUdp = enableUdp;
    if (skipCertVerify !== undefined) processOpts.skipCertVerify = skipCertVerify;
    const maybeResolved = await resolveNodeDomains(nodes, resolveDomain);
    const processed = processNodes(maybeResolved, processOpts);

    const { supported, skipped, warnings } = analyzeConversion(finalTarget, processed, generator.supportedProtocols);

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

    const baseOutput = generator.generate(supported, resolvedRules, finalProxyGroups);
    const output = await renderOutputWithTemplate(baseOutput, {
      configTemplate,
      configTemplateUrl,
      target: finalTarget,
      nodes: supported,
    });

    res.json({
      output,
      nodeCount: supported.length,
      skipped,
      warnings,
      subscriptionUserinfo,
      filteredOut: nodes.length - processed.length,
    });
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/formats', (_req: Request, res: Response) => {
  res.json({ formats: getAllFormats() });
});

router.get('/rules', (_req: Request, res: Response) => {
  res.json({ rules: getAllRules() });
});

export default router;
