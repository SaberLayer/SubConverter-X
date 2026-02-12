import { registerRule } from './index';

registerRule({
  id: 'global',
  name: '全局代理',
  description: '所有流量走代理',
  generate(proxyGroupName: string): string[] {
    return [
      `GEOIP,LAN,DIRECT`,
      `MATCH,${proxyGroupName}`,
    ];
  },
});
