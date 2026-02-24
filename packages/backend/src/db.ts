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
        rename_rules TEXT,
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
    if (!colNames.has('rename_rules')) db.exec('ALTER TABLE subscriptions ADD COLUMN rename_rules TEXT');
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
  rename?: string;
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
    (token, input, target, rule_template, include_filter, exclude_filter, rename_rules,
     add_emoji, deduplicate, sort_mode, enable_udp, skip_cert_verify, proxy_groups)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  stmt.run(
    token,
    options.input,
    options.target,
    options.ruleTemplate || null,
    options.include || null,
    options.exclude || null,
    options.rename || null,
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
    `SELECT input, target, rule_template, include_filter, exclude_filter, rename_rules,
     add_emoji, deduplicate, sort_mode, enable_udp, skip_cert_verify, proxy_groups
     FROM subscriptions WHERE token = ?`
  ).get(token) as any;

  if (!row) return null;

  return {
    input: row.input,
    target: row.target,
    ruleTemplate: row.rule_template || undefined,
    include: row.include_filter || undefined,
    exclude: row.exclude_filter || undefined,
    rename: row.rename_rules || undefined,
    addEmoji: row.add_emoji === 1,
    deduplicate: row.deduplicate === 1,
    sort: row.sort_mode || 'none',
    enableUdp: row.enable_udp === null ? undefined : row.enable_udp === 1,
    skipCertVerify: row.skip_cert_verify === null ? undefined : row.skip_cert_verify === 1,
    proxyGroups: row.proxy_groups ? JSON.parse(row.proxy_groups) : undefined,
  };
}
