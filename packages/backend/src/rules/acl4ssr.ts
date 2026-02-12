import { registerRule } from './index';
import { loadRuleFile } from './remote';

registerRule({
  id: 'acl4ssr-balanced',
  name: 'ACL4SSR 均衡',
  description: '广告拦截 + 国内直连 + Google/Telegram/YouTube/Netflix 分流（远程规则）',
  async generate(proxyGroupName: string): Promise<string[]> {
    const sections: { key: string; action: string }[] = [
      { key: 'LocalAreaNetwork', action: 'DIRECT' },
      { key: 'UnBan', action: 'DIRECT' },
      { key: 'BanAD', action: 'REJECT' },
      { key: 'BanProgramAD', action: 'REJECT' },
      { key: 'GoogleCN', action: 'DIRECT' },
      { key: 'Telegram', action: proxyGroupName },
      { key: 'YouTube', action: proxyGroupName },
      { key: 'Netflix', action: proxyGroupName },
      { key: 'Google', action: proxyGroupName },
      { key: 'ProxyLite', action: proxyGroupName },
      { key: 'ChinaDomain', action: 'DIRECT' },
      { key: 'ChinaCompanyIp', action: 'DIRECT' },
    ];

    const rules = await assembleRules(sections);
    rules.push(`GEOIP,CN,DIRECT`);
    rules.push(`MATCH,${proxyGroupName}`);
    return rules;
  },
});

registerRule({
  id: 'acl4ssr-full',
  name: 'ACL4SSR 完整',
  description: '在均衡基础上增加 Microsoft/Apple/Spotify/Steam/OpenAI 等分流（远程规则）',
  async generate(proxyGroupName: string): Promise<string[]> {
    const sections: { key: string; action: string }[] = [
      { key: 'LocalAreaNetwork', action: 'DIRECT' },
      { key: 'UnBan', action: 'DIRECT' },
      { key: 'BanAD', action: 'REJECT' },
      { key: 'BanProgramAD', action: 'REJECT' },
      { key: 'GoogleCN', action: 'DIRECT' },
      { key: 'Telegram', action: proxyGroupName },
      { key: 'YouTube', action: proxyGroupName },
      { key: 'Netflix', action: proxyGroupName },
      { key: 'Google', action: proxyGroupName },
      { key: 'Microsoft', action: proxyGroupName },
      { key: 'Apple', action: proxyGroupName },
      { key: 'OpenAi', action: proxyGroupName },
      { key: 'Spotify', action: proxyGroupName },
      { key: 'Steam', action: proxyGroupName },
      { key: 'ProxyMedia', action: proxyGroupName },
      { key: 'ProxyGFWlist', action: proxyGroupName },
      { key: 'ChinaDomain', action: 'DIRECT' },
      { key: 'ChinaMedia', action: 'DIRECT' },
      { key: 'ChinaCompanyIp', action: 'DIRECT' },
    ];

    const rules = await assembleRules(sections);
    rules.push(`GEOIP,CN,DIRECT`);
    rules.push(`MATCH,${proxyGroupName}`);
    return rules;
  },
});

async function assembleRules(sections: { key: string; action: string }[]): Promise<string[]> {
  const rules: string[] = [];
  for (const { key, action } of sections) {
    const lines = await loadRuleFile(key);
    if (lines) {
      for (const line of lines) {
        // ACL4SSR rules come as "RULE-TYPE,value" — append the action
        // Some lines already have 3 parts (with no-resolve etc.), handle both
        const parts = line.split(',');
        if (parts.length === 2) {
          rules.push(`${line},${action}`);
        } else if (parts.length >= 3) {
          // Replace existing action with ours (e.g. lines that have ,no-resolve)
          // Format: TYPE,value,action or TYPE,value,action,no-resolve
          const hasNoResolve = parts[parts.length - 1].toLowerCase() === 'no-resolve';
          if (hasNoResolve) {
            rules.push(`${parts[0]},${parts[1]},${action},no-resolve`);
          } else {
            // Already has an action — replace it
            parts[2] = action;
            rules.push(parts.join(','));
          }
        }
      }
    }
  }
  return rules;
}
