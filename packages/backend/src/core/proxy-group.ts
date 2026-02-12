import { ProxyGroup, ProxyNode } from './types';

const DEFAULT_TEST_URL = 'http://www.gstatic.com/generate_204';
const DEFAULT_INTERVAL = 300;

export interface ResolvedGroup {
  name: string;
  type: ProxyGroup['type'];
  nodeNames: string[];
  extraProxies: string[];
  url: string;
  interval: number;
}

export function resolveProxyGroups(groups: ProxyGroup[], allNodeNames: string[]): ResolvedGroup[] {
  return groups.map((g) => {
    let nodeNames: string[];
    if (g.filter) {
      try {
        const re = new RegExp(g.filter, 'i');
        nodeNames = allNodeNames.filter((n) => re.test(n));
      } catch {
        nodeNames = [...allNodeNames];
      }
    } else {
      nodeNames = [...allNodeNames];
    }

    return {
      name: g.name,
      type: g.type,
      nodeNames,
      extraProxies: g.proxies || [],
      url: g.url || DEFAULT_TEST_URL,
      interval: g.interval || DEFAULT_INTERVAL,
    };
  });
}

export function buildDefaultGroups(allNodeNames: string[]): ResolvedGroup[] {
  return [
    {
      name: 'Proxy',
      type: 'select',
      nodeNames: allNodeNames,
      extraProxies: ['DIRECT'],
      url: DEFAULT_TEST_URL,
      interval: DEFAULT_INTERVAL,
    },
    {
      name: 'Auto',
      type: 'url-test',
      nodeNames: allNodeNames,
      extraProxies: [],
      url: DEFAULT_TEST_URL,
      interval: DEFAULT_INTERVAL,
    },
  ];
}
