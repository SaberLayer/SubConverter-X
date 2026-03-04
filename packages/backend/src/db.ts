import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.resolve(process.env.DB_PATH || './data/subconverter.db');

let db: Database.Database;

function getDb(): Database.Database {
  if (!db) {
    const fs = require('fs');
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        token TEXT PRIMARY KEY,
        input TEXT NOT NULL,
        target TEXT NOT NULL,
        rule_template TEXT,
        include_filter TEXT,
        exclude_filter TEXT,
        include_types TEXT,
        exclude_types TEXT,
        include_regions TEXT,
        exclude_regions TEXT,
        rename_rules TEXT,
        regex_delete TEXT,
        regex_sort TEXT,
        filter_useless INTEGER DEFAULT 0,
        resolve_domain INTEGER DEFAULT 0,
        add_emoji INTEGER DEFAULT 0,
        deduplicate INTEGER DEFAULT 0,
        sort_mode TEXT DEFAULT 'none',
        enable_udp INTEGER,
        skip_cert_verify INTEGER,
        proxy_groups TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);

    // Migrate: add columns if missing (for existing databases)
    const cols = db.prepare("PRAGMA table_info(subscriptions)").all() as { name: string }[];
    const colNames = new Set(cols.map((c) => c.name));
    if (!colNames.has('include_filter')) db.exec('ALTER TABLE subscriptions ADD COLUMN include_filter TEXT');
    if (!colNames.has('exclude_filter')) db.exec('ALTER TABLE subscriptions ADD COLUMN exclude_filter TEXT');
    if (!colNames.has('include_types')) db.exec('ALTER TABLE subscriptions ADD COLUMN include_types TEXT');
    if (!colNames.has('exclude_types')) db.exec('ALTER TABLE subscriptions ADD COLUMN exclude_types TEXT');
    if (!colNames.has('include_regions')) db.exec('ALTER TABLE subscriptions ADD COLUMN include_regions TEXT');
    if (!colNames.has('exclude_regions')) db.exec('ALTER TABLE subscriptions ADD COLUMN exclude_regions TEXT');
    if (!colNames.has('rename_rules')) db.exec('ALTER TABLE subscriptions ADD COLUMN rename_rules TEXT');
    if (!colNames.has('regex_delete')) db.exec('ALTER TABLE subscriptions ADD COLUMN regex_delete TEXT');
    if (!colNames.has('regex_sort')) db.exec('ALTER TABLE subscriptions ADD COLUMN regex_sort TEXT');
    if (!colNames.has('filter_useless')) db.exec('ALTER TABLE subscriptions ADD COLUMN filter_useless INTEGER DEFAULT 0');
    if (!colNames.has('resolve_domain')) db.exec('ALTER TABLE subscriptions ADD COLUMN resolve_domain INTEGER DEFAULT 0');
    if (!colNames.has('add_emoji')) db.exec('ALTER TABLE subscriptions ADD COLUMN add_emoji INTEGER DEFAULT 0');
    if (!colNames.has('deduplicate')) db.exec('ALTER TABLE subscriptions ADD COLUMN deduplicate INTEGER DEFAULT 0');
    if (!colNames.has('sort_mode')) db.exec('ALTER TABLE subscriptions ADD COLUMN sort_mode TEXT DEFAULT \'none\'');
    if (!colNames.has('enable_udp')) db.exec('ALTER TABLE subscriptions ADD COLUMN enable_udp INTEGER');
    if (!colNames.has('skip_cert_verify')) db.exec('ALTER TABLE subscriptions ADD COLUMN skip_cert_verify INTEGER');
    if (!colNames.has('proxy_groups')) db.exec('ALTER TABLE subscriptions ADD COLUMN proxy_groups TEXT');

    // Index for cleanup queries
    db.exec('CREATE INDEX IF NOT EXISTS idx_subscriptions_created_at ON subscriptions(created_at)');
  }
  return db;
}

export interface SubscriptionOptions {
  input: string;
  target: string;
  ruleTemplate?: string;
  include?: string;
  exclude?: string;
  includeTypes?: string[];
  excludeTypes?: string[];
  includeRegions?: string[];
  excludeRegions?: string[];
  rename?: string;
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
}

export function saveSubscription(token: string, options: SubscriptionOptions): void {
  const stmt = getDb().prepare(
    `INSERT OR REPLACE INTO subscriptions
    (token, input, target, rule_template, include_filter, exclude_filter, include_types, exclude_types, include_regions, exclude_regions, rename_rules,
     regex_delete, regex_sort, filter_useless, resolve_domain, add_emoji, deduplicate, sort_mode, enable_udp, skip_cert_verify, proxy_groups)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  stmt.run(
    token,
    options.input,
    options.target,
    options.ruleTemplate || null,
    options.include || null,
    options.exclude || null,
    options.includeTypes?.length ? JSON.stringify(options.includeTypes) : null,
    options.excludeTypes?.length ? JSON.stringify(options.excludeTypes) : null,
    options.includeRegions?.length ? JSON.stringify(options.includeRegions) : null,
    options.excludeRegions?.length ? JSON.stringify(options.excludeRegions) : null,
    options.rename || null,
    options.regexDelete || null,
    options.regexSort || null,
    options.filterUseless ? 1 : 0,
    options.resolveDomain ? 1 : 0,
    options.addEmoji ? 1 : 0,
    options.deduplicate ? 1 : 0,
    options.sort || 'none',
    options.enableUdp === undefined ? null : (options.enableUdp ? 1 : 0),
    options.skipCertVerify === undefined ? null : (options.skipCertVerify ? 1 : 0),
    options.proxyGroups ? JSON.stringify(options.proxyGroups) : null
  );
}

/**
 * Delete subscriptions older than given days (default 90 days)
 */
export function cleanupExpired(days = 90): number {
  const cutoff = Math.floor(Date.now() / 1000) - days * 86400;
  const result = getDb().prepare('DELETE FROM subscriptions WHERE created_at < ?').run(cutoff);
  return result.changes;
}

// Run cleanup on startup and then every 24 hours
let cleanupStarted = false;
function startCleanupSchedule() {
  if (cleanupStarted) return;
  cleanupStarted = true;
  const run = () => {
    try { cleanupExpired(); } catch { /* ignore */ }
  };
  run();
  setInterval(run, 24 * 60 * 60 * 1000);
}
startCleanupSchedule();

export function getSubscription(token: string): SubscriptionOptions | null {
  const row = getDb().prepare(
    `SELECT input, target, rule_template, include_filter, exclude_filter, include_types, exclude_types, include_regions, exclude_regions, rename_rules,
     regex_delete, regex_sort, filter_useless, resolve_domain, add_emoji, deduplicate, sort_mode, enable_udp, skip_cert_verify, proxy_groups
     FROM subscriptions WHERE token = ?`
  ).get(token) as any;

  if (!row) return null;

  return {
    input: row.input,
    target: row.target,
    ruleTemplate: row.rule_template || undefined,
    include: row.include_filter || undefined,
    exclude: row.exclude_filter || undefined,
    includeTypes: parseJsonArray(row.include_types),
    excludeTypes: parseJsonArray(row.exclude_types),
    includeRegions: parseJsonArray(row.include_regions),
    excludeRegions: parseJsonArray(row.exclude_regions),
    rename: row.rename_rules || undefined,
    regexDelete: row.regex_delete || undefined,
    regexSort: row.regex_sort || undefined,
    filterUseless: row.filter_useless === 1,
    resolveDomain: row.resolve_domain === 1,
    addEmoji: row.add_emoji === 1,
    deduplicate: row.deduplicate === 1,
    sort: row.sort_mode || 'none',
    enableUdp: row.enable_udp === null ? undefined : row.enable_udp === 1,
    skipCertVerify: row.skip_cert_verify === null ? undefined : row.skip_cert_verify === 1,
    proxyGroups: row.proxy_groups ? JSON.parse(row.proxy_groups) : undefined,
  };
}

function parseJsonArray(raw: string | null | undefined): string[] | undefined {
  if (!raw) return undefined;
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      const list = arr.map((x) => String(x).trim()).filter(Boolean);
      return list.length ? list : undefined;
    }
  } catch {
    // Backward-compatible fallback for legacy CSV values.
    const list = String(raw).split(',').map((x) => x.trim()).filter(Boolean);
    return list.length ? list : undefined;
  }
  return undefined;
}
