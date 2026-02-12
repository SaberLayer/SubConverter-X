// Region detection and emoji flag mapping

export interface RegionInfo {
  code: string;      // ISO 3166-1 alpha-2 code
  emoji: string;     // Flag emoji
  name: string;      // English name
  nameCN: string;    // Chinese name
}

const REGION_MAP: Record<string, RegionInfo> = {
  HK: { code: 'HK', emoji: '🇭🇰', name: 'Hong Kong', nameCN: '香港' },
  TW: { code: 'TW', emoji: '🇹🇼', name: 'Taiwan', nameCN: '台湾' },
  SG: { code: 'SG', emoji: '🇸🇬', name: 'Singapore', nameCN: '新加坡' },
  JP: { code: 'JP', emoji: '🇯🇵', name: 'Japan', nameCN: '日本' },
  KR: { code: 'KR', emoji: '🇰🇷', name: 'South Korea', nameCN: '韩国' },
  US: { code: 'US', emoji: '🇺🇸', name: 'United States', nameCN: '美国' },
  GB: { code: 'GB', emoji: '🇬🇧', name: 'United Kingdom', nameCN: '英国' },
  DE: { code: 'DE', emoji: '🇩🇪', name: 'Germany', nameCN: '德国' },
  FR: { code: 'FR', emoji: '🇫🇷', name: 'France', nameCN: '法国' },
  RU: { code: 'RU', emoji: '🇷🇺', name: 'Russia', nameCN: '俄罗斯' },
  CA: { code: 'CA', emoji: '🇨🇦', name: 'Canada', nameCN: '加拿大' },
  AU: { code: 'AU', emoji: '🇦🇺', name: 'Australia', nameCN: '澳大利亚' },
  IN: { code: 'IN', emoji: '🇮🇳', name: 'India', nameCN: '印度' },
  NL: { code: 'NL', emoji: '🇳🇱', name: 'Netherlands', nameCN: '荷兰' },
  TR: { code: 'TR', emoji: '🇹🇷', name: 'Turkey', nameCN: '土耳其' },
  AR: { code: 'AR', emoji: '🇦🇷', name: 'Argentina', nameCN: '阿根廷' },
  BR: { code: 'BR', emoji: '🇧🇷', name: 'Brazil', nameCN: '巴西' },
  MY: { code: 'MY', emoji: '🇲🇾', name: 'Malaysia', nameCN: '马来西亚' },
  TH: { code: 'TH', emoji: '🇹🇭', name: 'Thailand', nameCN: '泰国' },
  VN: { code: 'VN', emoji: '🇻🇳', name: 'Vietnam', nameCN: '越南' },
  PH: { code: 'PH', emoji: '🇵🇭', name: 'Philippines', nameCN: '菲律宾' },
  ID: { code: 'ID', emoji: '🇮🇩', name: 'Indonesia', nameCN: '印度尼西亚' },
  IT: { code: 'IT', emoji: '🇮🇹', name: 'Italy', nameCN: '意大利' },
  ES: { code: 'ES', emoji: '🇪🇸', name: 'Spain', nameCN: '西班牙' },
  CH: { code: 'CH', emoji: '🇨🇭', name: 'Switzerland', nameCN: '瑞士' },
  SE: { code: 'SE', emoji: '🇸🇪', name: 'Sweden', nameCN: '瑞典' },
  NO: { code: 'NO', emoji: '🇳🇴', name: 'Norway', nameCN: '挪威' },
  FI: { code: 'FI', emoji: '🇫🇮', name: 'Finland', nameCN: '芬兰' },
  PL: { code: 'PL', emoji: '🇵🇱', name: 'Poland', nameCN: '波兰' },
  UA: { code: 'UA', emoji: '🇺🇦', name: 'Ukraine', nameCN: '乌克兰' },
  AE: { code: 'AE', emoji: '🇦🇪', name: 'UAE', nameCN: '阿联酋' },
  SA: { code: 'SA', emoji: '🇸🇦', name: 'Saudi Arabia', nameCN: '沙特阿拉伯' },
  ZA: { code: 'ZA', emoji: '🇿🇦', name: 'South Africa', nameCN: '南非' },
  MX: { code: 'MX', emoji: '🇲🇽', name: 'Mexico', nameCN: '墨西哥' },
  CN: { code: 'CN', emoji: '🇨🇳', name: 'China', nameCN: '中国' },
};

// Pattern matching for region detection
const REGION_PATTERNS: Array<{ pattern: RegExp; code: string }> = [
  // Hong Kong
  { pattern: /香港|港|\bHK\b|Hong\s*Kong|HongKong/i, code: 'HK' },
  // Taiwan
  { pattern: /台湾|台|\bTW\b|Taiwan/i, code: 'TW' },
  // Singapore
  { pattern: /新加坡|狮城|坡|\bSG\b|Singapore/i, code: 'SG' },
  // Japan
  { pattern: /日本|日|\bJP\b|Japan|Tokyo|Osaka/i, code: 'JP' },
  // South Korea
  { pattern: /韩国|韩|\bKR\b|Korea|Seoul/i, code: 'KR' },
  // United States
  { pattern: /美国|美|\bUS\b|USA|United\s*States|America|Los\s*Angeles|San\s*Francisco|New\s*York|Seattle|Chicago/i, code: 'US' },
  // United Kingdom
  { pattern: /英国|英|\bUK\b|\bGB\b|United\s*Kingdom|Britain|London/i, code: 'GB' },
  // Germany
  { pattern: /德国|德|\bDE\b|Germany|Berlin|Frankfurt/i, code: 'DE' },
  // France
  { pattern: /法国|法|\bFR\b|France|Paris/i, code: 'FR' },
  // Russia
  { pattern: /俄罗斯|俄|\bRU\b|Russia|Moscow/i, code: 'RU' },
  // Canada
  { pattern: /加拿大|加|\bCA\b|Canada|Toronto|Vancouver/i, code: 'CA' },
  // Australia
  { pattern: /澳大利亚|澳洲|澳|\bAU\b|Australia|Sydney/i, code: 'AU' },
  // India
  { pattern: /印度|\bIN\b|India|Mumbai/i, code: 'IN' },
  // Netherlands
  { pattern: /荷兰|\bNL\b|Netherlands|Amsterdam/i, code: 'NL' },
  // Turkey
  { pattern: /土耳其|\bTR\b|Turkey|Istanbul/i, code: 'TR' },
  // Argentina
  { pattern: /阿根廷|\bAR\b|Argentina/i, code: 'AR' },
  // Brazil
  { pattern: /巴西|\bBR\b|Brazil/i, code: 'BR' },
  // Malaysia
  { pattern: /马来西亚|马来|\bMY\b|Malaysia/i, code: 'MY' },
  // Thailand
  { pattern: /泰国|泰|\bTH\b|Thailand|Bangkok/i, code: 'TH' },
  // Vietnam
  { pattern: /越南|越|\bVN\b|Vietnam/i, code: 'VN' },
  // Philippines
  { pattern: /菲律宾|菲|\bPH\b|Philippines/i, code: 'PH' },
  // Indonesia
  { pattern: /印尼|印度尼西亚|\bID\b|Indonesia/i, code: 'ID' },
  // Italy
  { pattern: /意大利|意|\bIT\b|Italy|Milan|Rome/i, code: 'IT' },
  // Spain
  { pattern: /西班牙|\bES\b|Spain|Madrid/i, code: 'ES' },
  // Switzerland
  { pattern: /瑞士|\bCH\b|Switzerland/i, code: 'CH' },
  // Sweden
  { pattern: /瑞典|\bSE\b|Sweden/i, code: 'SE' },
  // Norway
  { pattern: /挪威|\bNO\b|Norway/i, code: 'NO' },
  // Finland
  { pattern: /芬兰|\bFI\b|Finland/i, code: 'FI' },
  // Poland
  { pattern: /波兰|\bPL\b|Poland/i, code: 'PL' },
  // Ukraine
  { pattern: /乌克兰|\bUA\b|Ukraine/i, code: 'UA' },
  // UAE
  { pattern: /阿联酋|迪拜|\bAE\b|UAE|Dubai/i, code: 'AE' },
  // Saudi Arabia
  { pattern: /沙特|\bSA\b|Saudi/i, code: 'SA' },
  // South Africa
  { pattern: /南非|\bZA\b|South\s*Africa/i, code: 'ZA' },
  // Mexico
  { pattern: /墨西哥|\bMX\b|Mexico/i, code: 'MX' },
  // China
  { pattern: /中国|国内|\bCN\b|China/i, code: 'CN' },
];

/**
 * Detect region from node name
 */
export function detectRegion(name: string): RegionInfo | null {
  for (const { pattern, code } of REGION_PATTERNS) {
    if (pattern.test(name)) {
      return REGION_MAP[code] || null;
    }
  }
  return null;
}

/**
 * Add emoji flag to node name if not already present
 */
export function addEmojiFlag(name: string): string {
  // Check if emoji already exists
  const emojiRegex = /[\u{1F1E6}-\u{1F1FF}]{2}/u;
  if (emojiRegex.test(name)) {
    return name; // Already has emoji
  }

  const region = detectRegion(name);
  if (region) {
    return `${region.emoji} ${name}`;
  }

  return name;
}

/**
 * Get all available regions
 */
export function getAllRegions(): RegionInfo[] {
  return Object.values(REGION_MAP);
}

/**
 * Get region by code
 */
export function getRegionByCode(code: string): RegionInfo | null {
  return REGION_MAP[code.toUpperCase()] || null;
}
