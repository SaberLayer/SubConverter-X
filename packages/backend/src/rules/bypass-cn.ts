import { registerRule } from './index';

registerRule({
  id: 'bypass-cn',
  name: '绕过中国大陆',
  description: '中国大陆 IP 和域名直连，其余走代理',
  generate(proxyGroupName: string): string[] {
    return [
      `DOMAIN-SUFFIX,cn,DIRECT`,
      `DOMAIN-KEYWORD,baidu,DIRECT`,
      `DOMAIN-KEYWORD,alibaba,DIRECT`,
      `DOMAIN-KEYWORD,tencent,DIRECT`,
      `DOMAIN-KEYWORD,taobao,DIRECT`,
      `DOMAIN-KEYWORD,jd,DIRECT`,
      `DOMAIN-KEYWORD,qq,DIRECT`,
      `DOMAIN-KEYWORD,weixin,DIRECT`,
      `DOMAIN-KEYWORD,bilibili,DIRECT`,
      `DOMAIN-KEYWORD,163,DIRECT`,
      `DOMAIN-SUFFIX,googleapis.cn,DIRECT`,
      `GEOIP,LAN,DIRECT`,
      `GEOIP,CN,DIRECT`,
      `MATCH,${proxyGroupName}`,
    ];
  },
});
