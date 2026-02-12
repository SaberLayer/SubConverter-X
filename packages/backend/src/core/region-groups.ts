// Auto-generate proxy groups by region

import { ProxyNode, ProxyGroup } from './types';
import { detectRegion, getAllRegions } from './emoji';

/**
 * Generate region-based proxy groups automatically
 */
export function generateRegionGroups(nodes: ProxyNode[]): ProxyGroup[] {
  // Group nodes by region
  const regionMap = new Map<string, string[]>();
  const noRegionNodes: string[] = [];

  for (const node of nodes) {
    const region = detectRegion(node.name);
    if (region) {
      const existing = regionMap.get(region.code) || [];
      existing.push(node.name);
      regionMap.set(region.code, existing);
    } else {
      noRegionNodes.push(node.name);
    }
  }

  const groups: ProxyGroup[] = [];

  // Create main selection group
  groups.push({
    name: '🚀 Proxy',
    type: 'select',
    proxies: ['♻️ Auto', '🇭🇰 Hong Kong', '🇺🇸 United States', '🇸🇬 Singapore', '🇯🇵 Japan', '🇹🇼 Taiwan', 'DIRECT'],
  });

  // Create auto-select group
  groups.push({
    name: '♻️ Auto',
    type: 'url-test',
    url: 'http://www.gstatic.com/generate_204',
    interval: 300,
  });

  // Create region-specific groups
  const allRegions = getAllRegions();
  const regionOrder = ['HK', 'US', 'SG', 'JP', 'TW', 'KR', 'GB', 'DE', 'CA', 'AU'];

  for (const code of regionOrder) {
    const nodeNames = regionMap.get(code);
    if (nodeNames && nodeNames.length > 0) {
      const region = allRegions.find(r => r.code === code);
      if (region) {
        groups.push({
          name: `${region.emoji} ${region.name}`,
          type: 'url-test',
          filter: nodeNames.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
          url: 'http://www.gstatic.com/generate_204',
          interval: 300,
        });
      }
    }
  }

  // Add remaining regions not in priority order
  for (const [code, nodeNames] of regionMap.entries()) {
    if (!regionOrder.includes(code) && nodeNames.length > 0) {
      const region = allRegions.find(r => r.code === code);
      if (region) {
        groups.push({
          name: `${region.emoji} ${region.name}`,
          type: 'url-test',
          filter: nodeNames.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
          url: 'http://www.gstatic.com/generate_204',
          interval: 300,
        });
      }
    }
  }

  // Add "Others" group if there are nodes without detected region
  if (noRegionNodes.length > 0) {
    groups.push({
      name: '🌍 Others',
      type: 'url-test',
      filter: noRegionNodes.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
      url: 'http://www.gstatic.com/generate_204',
      interval: 300,
    });
  }

  return groups;
}
