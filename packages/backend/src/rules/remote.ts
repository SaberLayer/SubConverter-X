import fs from 'fs';
import path from 'path';

const CACHE_DIR = path.resolve(__dirname, '../../.rule-cache');

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

const ACL4SSR_BASE = 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/';

export const RULE_SOURCES: Record<string, string> = {
  'LocalAreaNetwork': `${ACL4SSR_BASE}LocalAreaNetwork.list`,
  'UnBan': `${ACL4SSR_BASE}UnBan.list`,
  'BanAD': `${ACL4SSR_BASE}BanAD.list`,
  'BanProgramAD': `${ACL4SSR_BASE}BanProgramAD.list`,
  'GoogleCN': `${ACL4SSR_BASE}GoogleCN.list`,
  'ChinaDomain': `${ACL4SSR_BASE}ChinaDomain.list`,
  'ChinaCompanyIp': `${ACL4SSR_BASE}ChinaCompanyIp.list`,
  'ChinaMedia': `${ACL4SSR_BASE}ChinaMedia.list`,
  // Proxy / foreign services
  'ProxyMedia': `${ACL4SSR_BASE}ProxyMedia.list`,
  'ProxyGFWlist': `${ACL4SSR_BASE}ProxyGFWlist.list`,
  'ProxyLite': `${ACL4SSR_BASE}ProxyLite.list`,
  // Specific services
  'Telegram': `${ACL4SSR_BASE}Ruleset/Telegram.list`,
  'Google': `${ACL4SSR_BASE}Ruleset/Google.list`,
  'YouTube': `${ACL4SSR_BASE}Ruleset/YouTube.list`,
  'Netflix': `${ACL4SSR_BASE}Ruleset/Netflix.list`,
  'Microsoft': `${ACL4SSR_BASE}Ruleset/Microsoft.list`,
  'Apple': `${ACL4SSR_BASE}Ruleset/Apple.list`,
  'Spotify': `${ACL4SSR_BASE}Ruleset/Spotify.list`,
  'Steam': `${ACL4SSR_BASE}Ruleset/Steam.list`,
  'OpenAi': `${ACL4SSR_BASE}Ruleset/OpenAi.list`,
};

export async function fetchRemoteRule(url: string, timeout = 8000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!resp.ok) return null;
    return await resp.text();
  } catch {
    return null;
  }
}

function cachePathFor(key: string): string {
  return path.join(CACHE_DIR, `${key}.list`);
}

export async function loadRuleFile(key: string): Promise<string[] | null> {
  const url = RULE_SOURCES[key];
  if (!url) return null;

  // Level 1: remote fetch
  const remote = await fetchRemoteRule(url);
  if (remote) {
    // Write cache
    try {
      fs.writeFileSync(cachePathFor(key), remote, 'utf-8');
    } catch { /* ignore cache write errors */ }
    return parseRuleList(remote);
  }

  // Level 2: local cache
  const cachePath = cachePathFor(key);
  if (fs.existsSync(cachePath)) {
    try {
      const cached = fs.readFileSync(cachePath, 'utf-8');
      return parseRuleList(cached);
    } catch { /* ignore */ }
  }

  // Level 3: no data
  return null;
}

function parseRuleList(raw: string): string[] {
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !l.startsWith(';'));
}
