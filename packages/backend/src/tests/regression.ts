import { parseInput } from '../core/parser';
import { getAllFormats, getGenerator } from '../core/generator';
import { processNodes } from '../core/processor';
import { resolveNodeDomains } from '../core/resolve-domain';
import { generateRegionGroups } from '../core/region-groups';
import { validateUrl } from '../core/url-safety';
import { createRateLimiter } from '../core/rate-limit';
import { ApiError } from '../core/api-error';
import { parseConversionRequest, parseDirectSubscriptionQuery } from '../core/request-schema';
import { analyzeConversion } from '../core/capabilities';
import { CAPABILITY_MATRIX, getSupportedProtocolsForTarget } from '../core/capability-matrix';
import { renderOutputWithTemplate } from '../core/template-output';
import { applyNodeOperators } from '../core/node-operators';
import { formatSubscriptionUserinfo, mergeSubscriptionUserinfo, parseSubscriptionUserinfo } from '../core/subscription-userinfo';
import { saveSubscription, getSubscription } from '../db';
import { getSubscriptionExpiresAt, SUBSCRIPTION_TTL_DAYS } from '../db';
import { buildOpenApiDocument, renderApiDocsHtml } from '../openapi';
import * as yaml from 'js-yaml';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';

type TestFn = () => Promise<void> | void;

const tests: Array<{ name: string; run: TestFn }> = [];

function add(name: string, run: TestFn) {
  tests.push({ name, run });
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function mustGetGenerator(format: Parameters<typeof getGenerator>[0]) {
  const generator = getGenerator(format);
  assert(generator, `missing generator ${format}`);
  return generator;
}

function fixtureInput(name: string): string {
  return fs.readFileSync(path.join(__dirname, 'fixtures', 'input', name), 'utf-8');
}

const goldenFixtureInput = fixtureInput('modern-mixed.txt');

add('parse mixed URI input', async () => {
  const input = [
    'vmess://eyJ2IjoiMiIsInBzIjoiVk1FU1MtV1MiLCJhZGQiOiIxLjEuMS4xIiwicG9ydCI6IjQ0MyIsImlkIjoiMTExMTExMTEtMTExMS0xMTExLTExMTEtMTExMTExMTExMTExIiwiYWlkIjoiMCIsIm5ldCI6IndzIiwiaG9zdCI6ImNkbi5leGFtcGxlLmNvbSIsInBhdGgiOiIvdnMifQ==',
    'vless://11111111-1111-1111-1111-111111111111@2.2.2.2:443?security=tls&type=xhttp&path=%2Fedge&host=cdn.example.com&mode=auto&sni=sn.example.com#VLESS-XHTTP',
    'trojan://pass@3.3.3.3:443?type=httpupgrade&path=%2Fup&host=up.example.com&sni=tr.example.com#TROJAN-UPGRADE',
    'hysteria2://hy2pass@4.4.4.4:443?sni=hy.example.com&obfs=salamander&obfs-password=obfsp#HY2-NODE',
    'socks5://user:pass@5.5.5.5:1080#SOCKS-NODE',
    'https://huser:hpass@6.6.6.6:443#HTTP-NODE',
  ].join('\n');

  const { nodes } = await parseInput(input);
  assert(nodes.length >= 6, `expected >=6 nodes, got ${nodes.length}`);
});

add('parse qx/loon/surge style lines', async () => {
  const input = [
    '[server_local]',
    'shadowsocks=7.7.7.7:8388, method=aes-128-gcm, password=pwd, tag=QX-SS',
    '',
    '[Proxy]',
    'LoonVless = Vless,8.8.8.8,443,auto,"11111111-1111-1111-1111-111111111111",transport=ws,path=/ws,host=ws.example.com,over-tls=true,tls-name=tls.example.com',
    'SurgeTrojan = trojan, 9.9.9.9, 443, password=tpwd, ws=true, ws-path=/sws, ws-headers=Host:sws.example.com, sni=sn.example.com',
  ].join('\n');

  const { nodes } = await parseInput(input);
  assert(nodes.length >= 3, `expected >=3 nodes, got ${nodes.length}`);
  assert(nodes.some((n) => n.type === 'ss' && n.name === 'QX-SS'), 'missing QX SS parse');
  assert(nodes.some((n) => n.type === 'vless' && n.name === 'LoonVless'), 'missing Loon VLESS parse');
  assert(nodes.some((n) => n.type === 'trojan' && n.name === 'SurgeTrojan'), 'missing Surge Trojan parse');
});

add('clash json5 parse', async () => {
  const input = `{
    // json5 style
    proxies: [
      { name: 'JSON5-SS', type: 'ss', server: '1.2.3.4', port: 8388, cipher: 'aes-128-gcm', password: 'pwd', },
    ],
  }`;
  const { nodes } = await parseInput(input);
  assert(nodes.length === 1, `expected 1 node, got ${nodes.length}`);
  assert(nodes[0].name === 'JSON5-SS', 'json5 node name mismatch');
});

add('generate all formats non-empty', async () => {
  const input = [
    'ss://YWVzLTEyOC1nY206cHdk@1.1.1.1:8388#SS1',
    'vmess://eyJ2IjoiMiIsInBzIjoiVk1FU1MiLCJhZGQiOiIxLjEuMS4yIiwicG9ydCI6IjQ0MyIsImlkIjoiMTExMTExMTEtMTExMS0xMTExLTExMTEtMTExMTExMTExMTExIiwiYWlkIjoiMCIsIm5ldCI6IndzIiwiaG9zdCI6ImNkbi5leGFtcGxlLmNvbSIsInBhdGgiOiIvdnMifQ==',
    'vless://11111111-1111-1111-1111-111111111111@1.1.1.3:443?security=tls&type=httpupgrade&path=%2Fup&host=up.example.com&sni=up.example.com#VLESS-UP',
    'trojan://tp@1.1.1.4:443?type=xhttp&path=%2Fxh&host=xh.example.com&mode=auto&sni=xh.example.com#TR-XH',
    'hysteria2://hy@1.1.1.5:443?sni=hy.example.com&obfs=salamander&obfs-password=pass#HY2',
    'tuic://11111111-1111-1111-1111-111111111111:tp@1.1.1.6:443?congestion_control=bbr&sni=tu.example.com#TUIC',
    'wireguard://pvt@1.1.1.7:51820?publickey=pub#WG',
    'socks5://u:p@1.1.1.8:1080#SOCKS',
    'http://u:p@1.1.1.9:8080#HTTP',
  ].join('\n');

  const { nodes } = await parseInput(input);
  const formats = getAllFormats();
  assert(formats.length > 0, 'formats list is empty');

  for (const fmt of formats) {
    const generator = getGenerator(fmt);
    assert(generator, `missing generator ${fmt}`);
    const output = generator.generate(nodes);
    assert(typeof output === 'string' && output.length > 0, `empty output for ${fmt}`);
  }
});

add('transport params keep for base64/shadowrocket', async () => {
  const input = 'trojan://pass@8.8.8.8:443?type=xhttp&path=%2Fedge&host=cdn.example.com&mode=auto&sni=sn.example.com#TR-XHTTP';
  const { nodes } = await parseInput(input);
  assert(nodes.length === 1, 'parse trojan xhttp failed');

  const base64Gen = getGenerator('base64');
  const shadowGen = getGenerator('shadowrocket');
  assert(base64Gen && shadowGen, 'required generators missing');

  const b64Text = Buffer.from(base64Gen.generate(nodes), 'base64').toString('utf-8');
  const srText = Buffer.from(shadowGen.generate(nodes), 'base64').toString('utf-8');
  assert(b64Text.includes('type=xhttp'), 'base64 trojan lost xhttp type');
  assert(srText.includes('type=xhttp'), 'shadowrocket trojan lost xhttp type');
});

add('processor type/region filters', async () => {
  const rawNodes = [
    { name: '🇭🇰 HK-vmess', type: 'vmess', server: '1.1.1.1', port: 443, transport: 'tcp', tls: 'tls' },
    { name: '🇯🇵 JP-trojan', type: 'trojan', server: '1.1.1.2', port: 443, transport: 'tcp', tls: 'tls' },
    { name: 'US-ss', type: 'ss', server: '1.1.1.3', port: 8388, transport: 'tcp', tls: 'none' },
  ] as any;

  const out = processNodes(rawNodes, {
    includeTypes: ['vmess', 'trojan'],
    excludeRegions: ['JP'],
  });

  assert(out.length === 1, `expected 1 node after filters, got ${out.length}`);
  assert(out[0].name.includes('HK'), 'filter result mismatch');
});

add('processor regex delete/sort and useless filter', async () => {
  const rawNodes = [
    { name: 'JP-VM', type: 'vmess', server: '1.1.1.2', port: 443, uuid: '11111111-1111-1111-1111-111111111111', transport: 'tcp', tls: 'tls' },
    { name: 'HK-SS', type: 'ss', server: '1.1.1.3', port: 8388, method: 'aes-128-gcm', password: 'pwd', transport: 'tcp', tls: 'none' },
    { name: '过期-SS', type: 'ss', server: '1.1.1.4', port: 8388, method: 'aes-128-gcm', password: 'pwd', transport: 'tcp', tls: 'none' },
    { name: 'BROKEN-VM', type: 'vmess', server: '1.1.1.5', port: 443, transport: 'tcp', tls: 'tls' },
  ] as any;

  const out = processNodes(rawNodes, {
    filterUseless: true,
    regexDelete: '过期',
    regexSort: 'HK|JP',
  });

  assert(out.length === 2, `expected 2 nodes after filter, got ${out.length}`);
  assert(out[0].name === 'HK-SS', `expected regex-sort HK first, got ${out[0].name}`);
  assert(out[1].name === 'JP-VM', `expected regex-sort JP second, got ${out[1].name}`);
});

add('processor dedupe keeps distinct credentials on same endpoint', async () => {
  const rawNodes = [
    { name: 'VL-A', type: 'vless', server: '1.1.1.1', port: 443, uuid: '11111111-1111-1111-1111-111111111111', transport: 'tcp', tls: 'tls' },
    { name: 'VL-B', type: 'vless', server: '1.1.1.1', port: 443, uuid: '22222222-2222-2222-2222-222222222222', transport: 'tcp', tls: 'tls' },
    { name: 'VL-A-DUP', type: 'vless', server: '1.1.1.1', port: 443, uuid: '11111111-1111-1111-1111-111111111111', transport: 'tcp', tls: 'tls' },
  ] as any;

  const out = processNodes(rawNodes, { deduplicate: true });
  assert(out.length === 2, `expected 2 distinct nodes after dedupe, got ${out.length}`);
  assert(out.some((n) => n.name === 'VL-A'), 'expected original VL-A to be kept');
  assert(out.some((n) => n.name === 'VL-B'), 'expected distinct UUID VL-B to be kept');
});

add('node operators apply ordered filter rename set sort and dedupe', () => {
  const rawNodes = [
    { name: 'HK VLESS A', type: 'vless', server: '2.2.2.2', port: 443, uuid: '11111111-1111-1111-1111-111111111111', transport: 'xhttp', tls: 'reality' },
    { name: 'US TROJAN', type: 'trojan', server: '1.1.1.1', port: 443, password: 'tp', transport: 'ws', tls: 'tls' },
    { name: 'JP SS', type: 'ss', server: '3.3.3.3', port: 8388, method: 'aes-128-gcm', password: 'pwd', transport: 'tcp', tls: 'none' },
    { name: 'HK VLESS DUP', type: 'vless', server: '2.2.2.2', port: 443, uuid: '22222222-2222-2222-2222-222222222222', transport: 'xhttp', tls: 'reality' },
  ] as any;

  const out = applyNodeOperators(rawNodes, [
    { type: 'filter', protocols: ['vless', 'trojan'], minPort: 400, tls: ['tls', 'reality'] },
    { type: 'rename', pattern: '^', replacement: 'OP-' },
    { type: 'set', field: 'udp', value: true },
    { type: 'dedupe', mode: 'endpoint' },
    { type: 'sort', by: 'server' },
  ]);

  assert(out.length === 2, `expected 2 nodes after operators, got ${out.length}`);
  assert(out[0].name === 'OP-US TROJAN', `expected server sort to put US trojan first, got ${out[0].name}`);
  assert(out[1].name === 'OP-HK VLESS A', `expected endpoint dedupe to keep first HK VLESS, got ${out[1].name}`);
  assert(out.every((node) => node.udp === true), 'set operator should force udp=true');
});

add('auto region groups only reference generated groups', () => {
  const groups = generateRegionGroups([
    { name: 'US-1', type: 'ss', server: '1.1.1.1', port: 8388, method: 'aes-128-gcm', password: 'pwd', transport: 'tcp', tls: 'none' },
  ] as any);

  const groupNames = new Set(groups.map((g) => g.name));
  const main = groups.find((g) => g.name === '🚀 Proxy');
  assert(main, 'missing main proxy group');
  assert(main.proxies?.includes('🇺🇸 United States'), 'main group should include generated US group');
  assert(!main.proxies?.includes('🇭🇰 Hong Kong'), 'main group should not include missing HK group');
  for (const member of main.proxies || []) {
    assert(member === 'DIRECT' || groupNames.has(member), `main group references missing member: ${member}`);
  }
});

add('subscription storage preserves auto region group option', () => {
  const token = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  saveSubscription(token, {
    input: 'ss://YWVzLTEyOC1nY206cHdk@1.1.1.1:8388#US-1',
    target: 'clash-meta',
    autoRegionGroup: true,
    proxyGroups: [{ name: 'Manual', type: 'select' }],
    configTemplate: 'proxies:\n{{proxies}}\n',
    operators: [{ type: 'rename', pattern: '^', replacement: 'Saved-' }],
  });

  const stored = getSubscription(token);
  assert(stored, 'expected subscription to be stored');
  assert(stored.autoRegionGroup === true, 'expected autoRegionGroup to be preserved');
  assert(stored.configTemplate?.includes('{{proxies}}'), 'expected configTemplate to be preserved');
  assert(stored.operators?.[0]?.type === 'rename', 'expected operators to be preserved');
});

add('subscription ttl metadata is generated', () => {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = getSubscriptionExpiresAt(now);
  assert(expiresAt === now + SUBSCRIPTION_TTL_DAYS * 86400, 'subscription expiresAt should respect configured TTL');
});

add('subscription-userinfo parses, merges, and formats traffic metadata', () => {
  const first = parseSubscriptionUserinfo('upload=100; download=200; total=1000; expire=2000000000');
  const second = parseSubscriptionUserinfo('download=50; upload=25; total=500; expire=1990000000');
  assert(first?.upload === 100 && first.download === 200, 'first userinfo parse mismatch');
  assert(second?.upload === 25 && second.download === 50, 'second userinfo parse mismatch');

  const merged = mergeSubscriptionUserinfo([first, second]);
  assert(merged?.upload === 125, `expected merged upload=125, got ${merged?.upload}`);
  assert(merged?.download === 250, `expected merged download=250, got ${merged?.download}`);
  assert(merged?.total === 1500, `expected merged total=1500, got ${merged?.total}`);
  assert(merged?.expire === 1990000000, `expected earliest expire, got ${merged?.expire}`);
  assert(formatSubscriptionUserinfo(merged) === 'upload=125; download=250; total=1500; expire=1990000000', 'userinfo format mismatch');
});

add('openapi document exposes core endpoints', () => {
  const doc = buildOpenApiDocument() as any;
  assert(doc.openapi === '3.0.3', 'unexpected OpenAPI version');
  assert(doc.paths['/api/convert']?.post, 'missing /api/convert operation');
  assert(doc.paths['/api/shorten']?.post, 'missing /api/shorten operation');
  assert(doc.paths['/api/sub/{token}']?.get, 'missing token subscription operation');
  assert(doc.paths['/api/sub/{token}/info']?.get, 'missing token info operation');
  assert(renderApiDocsHtml().includes('/api/openapi.json'), 'API docs HTML should link OpenAPI JSON');
});

add('url safety blocks private and ipv4-mapped addresses', async () => {
  for (const url of ['http://127.0.0.1/sub', 'http://[::1]/sub', 'http://[::ffff:127.0.0.1]/sub']) {
    let blocked = false;
    try {
      await validateUrl(url);
    } catch {
      blocked = true;
    }
    assert(blocked, `expected private URL to be blocked: ${url}`);
  }
});

add('rate limiter normalizes ipv4-mapped client ip', () => {
  const limiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 1,
    message: { error: 'limited' },
  });

  function run(ip: string): number {
    let statusCode = 200;
    let ended = false;
    const req = { ip } as any;
    const res = {
      setHeader: () => undefined,
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      json: () => {
        ended = true;
        return res;
      },
    } as any;
    limiter(req, res, () => {
      ended = true;
    });
    assert(ended, `limiter did not finish request for ${ip}`);
    return statusCode;
  }

  assert(run('127.0.0.1') === 200, 'first request should pass');
  assert(run('::ffff:127.0.0.1') === 429, 'mapped IPv4 should share the same rate limit bucket');
});

add('request schema validates conversion payload', () => {
  const parsed = parseConversionRequest({
    input: 'ss://YWVzLTEyOC1nY206cHdk@1.1.1.1:8388#US-1',
    target: 'clash-meta',
    includeTypes: 'ss,vmess',
    filterUseless: true,
    sort: 'region',
    configTemplate: 'proxies:\n{{proxies}}\n',
    operators: [
      { type: 'filter', protocols: ['ss'], minPort: 1000 },
      { type: 'set', field: 'udp', value: true },
    ],
    proxyGroups: [
      { name: 'Manual', type: 'select', proxies: ['DIRECT'] },
    ],
  });

  assert(parsed.target === 'clash-meta', 'target parse mismatch');
  assert(parsed.includeTypes?.length === 2, 'includeTypes should parse CSV');
  assert(parsed.proxyGroups?.[0].name === 'Manual', 'proxy group parse mismatch');
  assert(parsed.configTemplate?.includes('{{proxies}}'), 'configTemplate parse mismatch');
  assert(parsed.operators?.length === 2, 'operators parse mismatch');
});

add('request schema rejects unsupported target, invalid group, template conflict, and invalid operator', () => {
  let unsupported = false;
  try {
    parseConversionRequest({ input: 'x', target: 'unknown' });
  } catch (err) {
    unsupported = err instanceof ApiError && err.code === 'UNSUPPORTED_TARGET';
  }
  assert(unsupported, 'unsupported target should be rejected');

  let invalidGroup = false;
  try {
    parseConversionRequest({
      input: 'x',
      target: 'clash-meta',
      proxyGroups: [{ name: 'Bad', type: 'bad-type' }],
    });
  } catch (err) {
    invalidGroup = err instanceof ApiError && err.code === 'VALIDATION_ERROR';
  }
  assert(invalidGroup, 'invalid proxy group should be rejected');

  let templateConflict = false;
  try {
    parseConversionRequest({
      input: 'x',
      target: 'clash-meta',
      configTemplate: '{{content}}',
      configTemplateUrl: 'https://example.com/template.yaml',
    });
  } catch (err) {
    templateConflict = err instanceof ApiError && err.code === 'VALIDATION_ERROR';
  }
  assert(templateConflict, 'config template conflict should be rejected');

  let invalidOperator = false;
  try {
    parseConversionRequest({
      input: 'x',
      target: 'clash-meta',
      operators: [{ type: 'set', field: 'server', value: '1.1.1.1' }],
    });
  } catch (err) {
    invalidOperator = err instanceof ApiError && err.code === 'VALIDATION_ERROR';
  }
  assert(invalidOperator, 'invalid operator should be rejected');
});

add('request schema validates direct subscription query', () => {
  const parsed = parseDirectSubscriptionQuery({
    url: 'https://example.com/sub',
    target: 'auto',
    emoji: '1',
    dedupe: 'true',
    sort: 'name',
  });

  assert(parsed.url === 'https://example.com/sub', 'url parse mismatch');
  assert(parsed.target === 'auto', 'target parse mismatch');
  assert(parsed.addEmoji === true, 'emoji query flag should parse true');
  assert(parsed.deduplicate === true, 'dedupe query flag should parse true');
});

add('config template renders clash-meta fragments', async () => {
  const input = [
    'ss://YWVzLTEyOC1nY206cHdk@1.1.1.1:8388#SS1',
    'trojan://pass@2.2.2.2:443?sni=tr.example.com#TR1',
  ].join('\n');
  const { nodes } = await parseInput(input);
  const generator = mustGetGenerator('clash-meta');
  const base = generator.generate(nodes, 'MATCH,Proxy', [{ name: 'Manual', type: 'select', proxies: ['DIRECT'] }]);
  const rendered = await renderOutputWithTemplate(base, {
    target: 'clash-meta',
    nodes,
    configTemplate: [
      'mixed-port: 7890',
      'proxies:',
      '{{proxies}}',
      'proxy-groups:',
      '{{proxyGroups}}',
      'rules:',
      '{{rules}}',
      '',
    ].join('\n'),
  });

  const doc = yaml.load(rendered) as any;
  assert(Array.isArray(doc.proxies), 'template should render proxies as YAML');
  assert(doc.proxies.some((p: any) => p.name === 'SS1'), 'template output missing SS1 proxy');
  assert(Array.isArray(doc['proxy-groups']), 'template should render proxy groups');
  assert(doc.rules?.includes('MATCH,Proxy'), 'template output missing rules');
});

add('config template renders singbox full content and rejects empty templates', async () => {
  const { nodes } = await parseInput('ss://YWVzLTEyOC1nY206cHdk@1.1.1.1:8388#SS1');
  const base = mustGetGenerator('singbox').generate(nodes);
  const rendered = await renderOutputWithTemplate(base, {
    target: 'singbox',
    nodes,
    configTemplate: '{\n  "log": { "level": "debug" },\n  "source": {{content}}\n}',
  });
  const doc = JSON.parse(rendered);
  assert(doc.log.level === 'debug', 'template should keep custom singbox log section');
  assert(doc.source.outbounds.some((o: any) => o.tag === 'SS1'), 'template content should include generated singbox outbounds');

  let rejected = false;
  try {
    await renderOutputWithTemplate(base, {
      target: 'singbox',
      nodes,
      configTemplate: 'no placeholders here',
    });
  } catch (err) {
    rejected = err instanceof ApiError && err.code === 'VALIDATION_ERROR';
  }
  assert(rejected, 'template without placeholders should be rejected');
});

add('conversion capabilities report unsupported and downgraded features', () => {
  const nodes = [
    {
      name: 'SSR-OLD',
      type: 'ssr',
      server: '1.1.1.1',
      port: 8388,
      method: 'aes-128-gcm',
      password: 'pwd',
      ssrProtocol: 'origin',
      ssrObfs: 'plain',
      transport: 'tcp',
      tls: 'none',
    },
    {
      name: 'VL-XHTTP',
      type: 'vless',
      server: '2.2.2.2',
      port: 443,
      uuid: '11111111-1111-1111-1111-111111111111',
      transport: 'xhttp',
      tls: 'tls',
      xhttpPath: '/edge',
      xhttpHost: 'edge.example.com',
      xhttpMode: 'auto',
    },
    {
      name: 'WG-SB',
      type: 'wireguard',
      server: '3.3.3.3',
      port: 51820,
      privateKey: 'pvt',
      publicKey: 'pub',
      transport: 'tcp',
      tls: 'none',
    },
  ] as any;

  const singbox = getGenerator('singbox');
  assert(singbox, 'missing singbox generator');
  const singboxAnalysis = analyzeConversion('singbox', nodes, singbox.supportedProtocols);
  assert(singboxAnalysis.supported.length === 2, `expected 2 singbox supported nodes, got ${singboxAnalysis.supported.length}`);
  assert(singboxAnalysis.skipped.some((item) => item.includes('SSR-OLD')), 'expected SSR node to be skipped for singbox');
  assert(singboxAnalysis.warnings.some((w) => w.code === 'UNSUPPORTED_PROTOCOL' && w.protocol === 'ssr'), 'missing unsupported SSR warning');
  assert(singboxAnalysis.warnings.some((w) => w.code === 'TRANSPORT_DOWNGRADED' && w.nodes?.includes('VL-XHTTP')), 'missing xhttp downgrade warning');
  assert(singboxAnalysis.warnings.some((w) => w.code === 'FEATURE_PARTIAL' && w.nodes?.includes('WG-SB')), 'missing wireguard partial warning');
});

add('capability matrix matches generator protocol filters', () => {
  for (const fmt of getAllFormats()) {
    const generator = mustGetGenerator(fmt);
    const matrixProtocols = getSupportedProtocolsForTarget(fmt);
    assert(matrixProtocols.join(',') === generator.supportedProtocols.join(','), `${fmt} capability matrix drifted from generator supportedProtocols`);
    for (const protocol of generator.supportedProtocols) {
      assert(CAPABILITY_MATRIX[fmt][protocol].status !== 'unsupported', `${fmt}/${protocol} should not be unsupported in matrix`);
    }
  }
});

add('golden fixture parses modern protocol details', async () => {
  const { nodes } = await parseInput(goldenFixtureInput);
  assert(nodes.length === 6, `expected 6 golden fixture nodes, got ${nodes.length}`);

  const vless = nodes.find((n) => n.name === 'VL-REALITY-XHTTP');
  assert(vless, 'missing VLESS Reality xHTTP node');
  assert(vless.type === 'vless', `expected vless, got ${vless.type}`);
  assert(vless.tls === 'reality', `expected reality tls, got ${vless.tls}`);
  assert(vless.transport === 'xhttp', `expected xhttp transport, got ${vless.transport}`);
  assert(vless.xhttpPath === '/edge', `expected xhttp path /edge, got ${vless.xhttpPath}`);
  assert(vless.xhttpHost === 'cdn.example.com', `expected xhttp host cdn.example.com, got ${vless.xhttpHost}`);
  assert(vless.xhttpMode === 'auto', `expected xhttp mode auto, got ${vless.xhttpMode}`);
  assert(vless.realityPublicKey === 'realityPub', `expected reality public key, got ${vless.realityPublicKey}`);
  assert(vless.realityShortId === 'abcd', `expected reality short id, got ${vless.realityShortId}`);
  assert(vless.flow === 'xtls-rprx-vision', `expected VLESS flow, got ${vless.flow}`);

  const trojan = nodes.find((n) => n.name === 'TR-HTTPUP');
  assert(trojan?.type === 'trojan', 'missing Trojan HTTPUpgrade node');
  assert(trojan.transport === 'httpupgrade', `expected trojan httpupgrade, got ${trojan.transport}`);
  assert(trojan.wsPath === '/upgrade', `expected trojan upgrade path, got ${trojan.wsPath}`);
  assert(trojan.wsHeaders?.Host === 'up.example.com', `expected trojan upgrade host, got ${trojan.wsHeaders?.Host}`);

  const hysteria2 = nodes.find((n) => n.name === 'HY2-OBFS');
  assert(hysteria2?.type === 'hysteria2', 'missing Hysteria2 obfs node');
  assert(hysteria2.obfs === 'salamander', `expected hy2 obfs salamander, got ${hysteria2.obfs}`);
  assert(hysteria2.obfsPassword === 'obfs-pass', `expected hy2 obfs password, got ${hysteria2.obfsPassword}`);

  const tuic = nodes.find((n) => n.name === 'TUIC-BBR');
  assert(tuic?.type === 'tuic', 'missing TUIC node');
  assert(tuic.congestionControl === 'bbr', `expected tuic bbr, got ${tuic.congestionControl}`);
  assert(tuic.udpRelayMode === 'native', `expected tuic native relay, got ${tuic.udpRelayMode}`);

  const wireguard = nodes.find((n) => n.name === 'WG-PEER');
  assert(wireguard?.type === 'wireguard', 'missing WireGuard node');
  assert(wireguard.publicKey === 'wg-public', `expected WireGuard public key, got ${wireguard.publicKey}`);
  assert(wireguard.preSharedKey === 'wg-psk', `expected WireGuard pre-shared key, got ${wireguard.preSharedKey}`);
  assert(wireguard.mtu === 1420, `expected WireGuard MTU 1420, got ${wireguard.mtu}`);
  assert(wireguard.reservedBytes?.join(',') === '1,2,3', `expected WireGuard reserved bytes, got ${wireguard.reservedBytes}`);

  const ssr = nodes.find((n) => n.name === 'SSR-Fix');
  assert(ssr?.type === 'ssr', 'missing SSR node');
  assert(ssr.ssrProtocol === 'auth_aes128_md5', `expected SSR protocol, got ${ssr.ssrProtocol}`);
  assert(ssr.ssrObfs === 'tls1.2_ticket_auth', `expected SSR obfs, got ${ssr.ssrObfs}`);
});

add('golden fixture generates clash-meta advanced fields', async () => {
  const { nodes } = await parseInput(goldenFixtureInput);
  const output = mustGetGenerator('clash-meta').generate(nodes);
  const doc = yaml.load(output) as any;
  const proxies = doc.proxies as any[];
  assert(Array.isArray(proxies), 'clash-meta proxies should be an array');

  const vless = proxies.find((p) => p.name === 'VL-REALITY-XHTTP');
  assert(vless, 'clash-meta missing VLESS Reality xHTTP proxy');
  assert(vless.type === 'vless', `expected vless proxy, got ${vless.type}`);
  assert(vless.network === 'xhttp', `expected xhttp network, got ${vless.network}`);
  assert(vless['reality-opts']?.['public-key'] === 'realityPub', 'clash-meta lost Reality public-key');
  assert(vless['reality-opts']?.['short-id'] === 'abcd', 'clash-meta lost Reality short-id');
  assert(vless['xhttp-opts']?.path === '/edge', 'clash-meta lost xHTTP path');
  assert(vless['xhttp-opts']?.host === 'cdn.example.com', 'clash-meta lost xHTTP host');
  assert(vless['xhttp-opts']?.mode === 'auto', 'clash-meta lost xHTTP mode');

  const trojan = proxies.find((p) => p.name === 'TR-HTTPUP');
  assert(trojan, 'clash-meta missing Trojan HTTPUpgrade proxy');
  assert(trojan.network === 'ws', `expected HTTPUpgrade to use ws network, got ${trojan.network}`);
  assert(trojan['ws-opts']?.['v2ray-http-upgrade'] === true, 'clash-meta lost HTTPUpgrade flag');
  assert(trojan['ws-opts']?.path === '/upgrade', 'clash-meta lost HTTPUpgrade path');
  assert(trojan['ws-opts']?.headers?.Host === 'up.example.com', 'clash-meta lost HTTPUpgrade host');

  const hy2 = proxies.find((p) => p.name === 'HY2-OBFS');
  assert(hy2?.obfs === 'salamander', 'clash-meta lost Hysteria2 salamander obfs');
  assert(hy2?.['obfs-password'] === 'obfs-pass', 'clash-meta lost Hysteria2 obfs password');

  const tuic = proxies.find((p) => p.name === 'TUIC-BBR');
  assert(tuic?.['congestion-controller'] === 'bbr', 'clash-meta lost TUIC congestion controller');
  assert(tuic?.['udp-relay-mode'] === 'native', 'clash-meta lost TUIC UDP relay mode');

  const wg = proxies.find((p) => p.name === 'WG-PEER');
  assert(wg?.['private-key'] === 'wg-private', 'clash-meta lost WireGuard private key');
  assert(wg?.['public-key'] === 'wg-public', 'clash-meta lost WireGuard public key');
  assert(wg?.['pre-shared-key'] === 'wg-psk', 'clash-meta lost WireGuard pre-shared key');
  assert(wg?.reserved?.join(',') === '1,2,3', 'clash-meta lost WireGuard reserved bytes');

  const ssr = proxies.find((p) => p.name === 'SSR-Fix');
  assert(ssr?.protocol === 'auth_aes128_md5', 'clash-meta lost SSR protocol');
  assert(ssr?.obfs === 'tls1.2_ticket_auth', 'clash-meta lost SSR obfs');
});

add('golden fixture generates singbox expected support and warnings', async () => {
  const { nodes } = await parseInput(goldenFixtureInput);
  const generator = mustGetGenerator('singbox');
  const analysis = analyzeConversion('singbox', nodes, generator.supportedProtocols);
  assert(analysis.supported.length === 5, `expected 5 singbox supported fixture nodes, got ${analysis.supported.length}`);
  assert(analysis.skipped.some((item) => item.includes('SSR-Fix')), 'singbox should skip SSR fixture node');
  assert(analysis.warnings.some((w) => w.code === 'UNSUPPORTED_PROTOCOL' && w.protocol === 'ssr'), 'singbox missing SSR unsupported warning');
  assert(analysis.warnings.some((w) => w.code === 'TRANSPORT_DOWNGRADED' && w.nodes?.includes('VL-REALITY-XHTTP')), 'singbox missing xHTTP downgrade warning');
  assert(analysis.warnings.some((w) => w.code === 'FEATURE_PARTIAL' && w.nodes?.includes('WG-PEER')), 'singbox missing WireGuard partial warning');

  const doc = JSON.parse(generator.generate(analysis.supported));
  const outbounds = doc.outbounds as any[];
  const vless = outbounds.find((o) => o.tag === 'VL-REALITY-XHTTP');
  assert(vless?.type === 'vless', 'singbox missing VLESS outbound');
  assert(vless.transport?.type === 'httpupgrade', `expected singbox xHTTP downgrade to httpupgrade, got ${vless.transport?.type}`);
  assert(vless.transport?.path === '/edge', 'singbox lost downgraded xHTTP path');
  assert(vless.transport?.headers?.Host === 'cdn.example.com', 'singbox lost downgraded xHTTP host');
  assert(vless.tls?.reality?.public_key === 'realityPub', 'singbox lost Reality public key');
  assert(vless.tls?.reality?.short_id === 'abcd', 'singbox lost Reality short id');

  const hy2 = outbounds.find((o) => o.tag === 'HY2-OBFS');
  assert(hy2?.obfs?.type === 'salamander', 'singbox lost Hysteria2 obfs type');
  assert(hy2?.obfs?.password === 'obfs-pass', 'singbox lost Hysteria2 obfs password');

  const tuic = outbounds.find((o) => o.tag === 'TUIC-BBR');
  assert(tuic?.congestion_control === 'bbr', 'singbox lost TUIC congestion control');
  assert(tuic?.udp_relay_mode === 'native', 'singbox lost TUIC UDP relay mode');

  const wg = outbounds.find((o) => o.tag === 'WG-PEER');
  assert(wg?.local_address?.[0] === '10.0.0.2/32', 'singbox WireGuard should use explicit default local_address');
  assert(wg?.peer_public_key === 'wg-public', 'singbox lost WireGuard peer public key');
  assert(wg?.pre_shared_key === 'wg-psk', 'singbox lost WireGuard pre-shared key');
});

add('golden fixture keeps client text outputs useful', async () => {
  const { nodes } = await parseInput(goldenFixtureInput);

  const surgeText = mustGetGenerator('surge').generate(nodes);
  assert(surgeText.includes('VL-REALITY-XHTTP=vless'), 'surge missing VLESS fixture');
  assert(surgeText.includes('ws-path=/edge'), 'surge should map xHTTP path to WS-compatible field');
  assert(surgeText.includes('TR-HTTPUP=trojan'), 'surge missing Trojan HTTPUpgrade fixture');
  assert(surgeText.includes('ws-path=/upgrade'), 'surge lost Trojan HTTPUpgrade path');
  assert(surgeText.includes('HY2-OBFS=hysteria2'), 'surge missing Hysteria2 fixture');
  assert(surgeText.includes('obfs-password=obfs-pass'), 'surge lost Hysteria2 obfs password');
  assert(surgeText.includes('TUIC-BBR=tuic'), 'surge missing TUIC fixture');
  assert(surgeText.includes('congestion-controller=bbr'), 'surge lost TUIC congestion controller');
  assert(surgeText.includes('[WireGuard wg-WG-PEER]'), 'surge missing WireGuard section');
  assert(surgeText.includes('peer = (public-key = wg-public'), 'surge lost WireGuard peer');
  assert(surgeText.includes('SSR-Fix=ssr'), 'surge missing SSR fixture');

  const qxText = mustGetGenerator('quantumultx').generate(nodes);
  assert(qxText.includes('tag=VL-REALITY-XHTTP'), 'quantumultx missing VLESS fixture');
  assert(qxText.includes('obfs-uri=/edge'), 'quantumultx lost xHTTP path mapping');
  assert(qxText.includes('tag=HY2-OBFS'), 'quantumultx missing Hysteria2 fixture');
  assert(qxText.includes('obfs-password=obfs-pass'), 'quantumultx lost Hysteria2 obfs password');
  assert(qxText.includes('tag=TUIC-BBR'), 'quantumultx missing TUIC fixture');
  assert(qxText.includes('congestion-control=bbr'), 'quantumultx lost TUIC congestion control');
  assert(qxText.includes('tag=WG-PEER'), 'quantumultx missing WireGuard fixture');
  assert(qxText.includes('tag=SSR-Fix'), 'quantumultx missing SSR fixture');

  const loonText = mustGetGenerator('loon').generate(nodes);
  assert(loonText.includes('VL-REALITY-XHTTP = Vless'), 'loon missing VLESS fixture');
  assert(loonText.includes('transport=ws,path=/edge'), 'loon should map xHTTP to WS-compatible transport');
  assert(loonText.includes('HY2-OBFS = Hysteria2'), 'loon missing Hysteria2 fixture');
  assert(loonText.includes('TUIC-BBR = TUIC'), 'loon missing TUIC fixture');
  assert(loonText.includes('WG-PEER = WireGuard'), 'loon missing WireGuard fixture');
  assert(loonText.includes('SSR-Fix = ShadowsocksR'), 'loon missing SSR fixture');
});

add('golden fixture keeps URI-style outputs round-trippable', async () => {
  const { nodes } = await parseInput(goldenFixtureInput);

  for (const fmt of ['base64', 'shadowrocket'] as const) {
    const encoded = mustGetGenerator(fmt).generate(nodes);
    const text = Buffer.from(encoded, 'base64').toString('utf-8');
    assert(text.includes('vless://11111111-1111-1111-1111-111111111111@reality.example.com:443?'), `${fmt} missing VLESS URI`);
    assert(text.includes('security=reality'), `${fmt} lost Reality security`);
    assert(text.includes('type=xhttp'), `${fmt} lost xHTTP type`);
    assert(text.includes('pbk=realityPub'), `${fmt} lost Reality public key`);
    assert(text.includes('sid=abcd'), `${fmt} lost Reality short id`);
    assert(text.includes('trojan://trojan-pass@trojan.example.com:443?'), `${fmt} missing Trojan URI`);
    assert(text.includes('type=httpupgrade'), `${fmt} lost HTTPUpgrade type`);
    assert(text.includes('hysteria2://hy2-pass@hy2.example.com:443?'), `${fmt} missing Hysteria2 URI`);
    assert(text.includes('obfs-password=obfs-pass'), `${fmt} lost Hysteria2 obfs password`);
    assert(text.includes('tuic://22222222-2222-2222-2222-222222222222:tuic-pass@tuic.example.com:443?'), `${fmt} missing TUIC URI`);
    assert(text.includes('congestion_control=bbr'), `${fmt} lost TUIC congestion control`);
    assert(text.includes('wireguard://wg-private@wg.example.com:51820?'), `${fmt} missing WireGuard URI`);
    assert(text.includes('publickey=wg-public'), `${fmt} lost WireGuard public key`);
    assert(text.includes('ssr://'), `${fmt} missing SSR URI`);
  }

  const plain = mustGetGenerator('v2ray-uri').generate(nodes);
  assert(plain.includes('VL-REALITY-XHTTP'), 'v2ray-uri missing VLESS fixture');
  assert(plain.includes('ssr://'), 'v2ray-uri missing SSR fixture');
  const roundTrip = await parseInput(plain);
  assert(roundTrip.nodes.some((n) => n.name === 'SSR-Fix' && n.type === 'ssr'), 'v2ray-uri SSR fixture should round-trip');
});

add('messy realworld fixture handles duplicate, invalid, and localized nodes', async () => {
  const { nodes } = await parseInput(fixtureInput('messy-realworld.txt'));
  assert(nodes.length === 4, `expected 4 parsed nodes from messy fixture after parser dedupe, got ${nodes.length}`);
  assert(nodes.some((n) => n.name === '香港 SS 01'), 'missing localized SS node');
  assert(nodes.some((n) => n.name === '日本 VMEss'), 'missing localized VMess node');
  assert(nodes.some((n) => n.name === '美国 Trojan gRPC'), 'missing localized Trojan node');
  assert(!nodes.some((n) => n.name === 'not-a-valid-node'), 'invalid line should not parse as node');

  const processed = processNodes(nodes, { deduplicate: true, addEmoji: true, sort: 'region' });
  assert(processed.length === 4, `expected 4 nodes after processing, got ${processed.length}`);
  assert(processed.some((n) => n.name.startsWith('🇭🇰')), 'expected HK emoji after processing');
  assert(processed.some((n) => n.name.startsWith('🇯🇵')), 'expected JP emoji after processing');
  assert(processed.some((n) => n.name.startsWith('🇺🇸')), 'expected US emoji after processing');

  const clash = yaml.load(mustGetGenerator('clash-meta').generate(processed)) as any;
  assert(Array.isArray(clash.proxies) && clash.proxies.length === 4, 'clash-meta messy fixture proxy count mismatch');
  assert(clash.proxies.some((p: any) => p.name.includes('香港 SS 01')), 'clash-meta messy fixture missing HK SS');
  assert(clash.proxies.some((p: any) => p.name.includes('美国 Trojan gRPC')), 'clash-meta messy fixture missing Trojan gRPC');

  const singbox = mustGetGenerator('singbox');
  const analysis = analyzeConversion('singbox', processed, singbox.supportedProtocols);
  assert(analysis.supported.length === 4, `expected 4 singbox-supported messy nodes, got ${analysis.supported.length}`);
  const singboxDoc = JSON.parse(singbox.generate(analysis.supported));
  assert(singboxDoc.outbounds.some((o: any) => o.tag.includes('日本 VMEss')), 'singbox messy fixture missing VMess outbound');

  const b64Text = Buffer.from(mustGetGenerator('base64').generate(processed), 'base64').toString('utf-8');
  assert(b64Text.includes('ss://') && b64Text.includes('%E9%A6%99%E6%B8%AF%20SS%2001'), 'base64 messy fixture missing encoded HK SS');
  assert(b64Text.includes('trojan://pass@trojan.example.com:443?'), 'base64 messy fixture missing Trojan URI');
});

add('resolve domain operator', async () => {
  const nodes = [
    { name: 'LOCAL', type: 'ss', server: 'localhost', port: 8388, method: 'aes-128-gcm', password: 'pwd', transport: 'tcp', tls: 'none' },
  ] as any;
  const out = await resolveNodeDomains(nodes, true);
  assert(out.length === 1, 'resolve domain output length mismatch');
  assert(net.isIP(out[0].server) !== 0, `expected resolved IP, got ${out[0].server}`);
});

add('client generators keep expanded protocol coverage', async () => {
  const rawNodes = [
    { name: 'NODE-VLESS', type: 'vless', server: '1.1.1.1', port: 443, uuid: '11111111-1111-1111-1111-111111111111', transport: 'ws', wsPath: '/ws', wsHeaders: { Host: 'ws.example.com' }, tls: 'tls' },
    { name: 'NODE-TUIC', type: 'tuic', server: '1.1.1.2', port: 443, uuid: '11111111-1111-1111-1111-111111111111', password: 'tp', transport: 'tcp', tls: 'tls', sni: 'tu.example.com' },
    { name: 'NODE-WG', type: 'wireguard', server: '1.1.1.3', port: 51820, privateKey: 'pvt', publicKey: 'pub', transport: 'tcp', tls: 'none' },
    { name: 'NODE-SOCKS', type: 'socks', server: '1.1.1.4', port: 1080, uuid: 'u', password: 'p', transport: 'tcp', tls: 'none' },
    { name: 'NODE-HTTP', type: 'http', server: '1.1.1.5', port: 8080, uuid: 'u', password: 'p', transport: 'tcp', tls: 'none' },
  ] as any;

  for (const fmt of ['surge', 'quantumultx', 'loon', 'shadowrocket']) {
    const generator = getGenerator(fmt as any);
    assert(generator, `missing generator ${fmt}`);
    const output = generator.generate(rawNodes);
    const text = fmt === 'shadowrocket' ? Buffer.from(output, 'base64').toString('utf-8') : output;
    assert(text.includes('NODE-VLESS'), `${fmt} missing NODE-VLESS`);
    assert(text.includes('NODE-TUIC'), `${fmt} missing NODE-TUIC`);
    assert(text.includes('NODE-WG'), `${fmt} missing NODE-WG`);
    assert(text.includes('NODE-SOCKS'), `${fmt} missing NODE-SOCKS`);
    assert(text.includes('NODE-HTTP'), `${fmt} missing NODE-HTTP`);
  }
});

add('singbox group final and special members', async () => {
  const rawNodes = [
    {
      name: 'HK-VMESS',
      type: 'vmess',
      server: '1.1.1.1',
      port: 443,
      uuid: '11111111-1111-1111-1111-111111111111',
      transport: 'tcp',
      tls: 'tls',
    },
    {
      name: 'US-TROJAN',
      type: 'trojan',
      server: '2.2.2.2',
      port: 443,
      password: 'pass',
      transport: 'tcp',
      tls: 'tls',
    },
  ] as any;

  const generator = getGenerator('singbox');
  assert(generator, 'missing singbox generator');

  const output = generator.generate(rawNodes, undefined, [
    { name: 'Manual', type: 'select', filter: 'HK', proxies: ['DIRECT', 'REJECT'] },
    { name: 'AutoCheck', type: 'url-test', proxies: ['DIRECT'], interval: 120 },
  ]);

  const doc = JSON.parse(output);
  assert(doc.route?.final === 'Manual', `expected route.final=Manual, got ${doc.route?.final}`);

  const outbounds = Array.isArray(doc.outbounds) ? doc.outbounds : [];
  const manual = outbounds.find((o: any) => o.tag === 'Manual');
  assert(manual, 'missing Manual group');
  assert(manual.type === 'selector', `expected Manual selector, got ${manual.type}`);
  assert(Array.isArray(manual.outbounds), 'Manual outbounds should be array');
  assert(manual.outbounds.includes('HK-VMESS'), 'Manual group missing filtered node');
  assert(manual.outbounds.includes('direct'), 'Manual group missing DIRECT mapping');
  assert(manual.outbounds.includes('block'), 'Manual group missing REJECT mapping');

  const autoCheck = outbounds.find((o: any) => o.tag === 'AutoCheck');
  assert(autoCheck, 'missing AutoCheck group');
  assert(autoCheck.type === 'urltest', `expected AutoCheck urltest, got ${autoCheck.type}`);
  assert(Array.isArray(autoCheck.outbounds), 'AutoCheck outbounds should be array');
  assert(autoCheck.outbounds.includes('direct'), 'AutoCheck group should keep DIRECT mapping');
  assert(autoCheck.interval === '120s', `expected AutoCheck interval=120s, got ${autoCheck.interval}`);
});

add('parse singbox httpupgrade and xhttp transport', async () => {
  const input = {
    outbounds: [
      {
        type: 'vmess',
        tag: 'VM-HU',
        server: '1.1.1.1',
        server_port: 443,
        uuid: '11111111-1111-1111-1111-111111111111',
        alter_id: 0,
        security: 'auto',
        transport: {
          type: 'httpupgrade',
          path: '/up',
          headers: { Host: 'up.example.com' },
        },
        tls: {
          enabled: true,
          server_name: 'sni.example.com',
        },
      },
      {
        type: 'vless',
        tag: 'VL-XHTTP',
        server: '2.2.2.2',
        server_port: 443,
        uuid: '22222222-2222-2222-2222-222222222222',
        transport: {
          type: 'xhttp',
          path: '/edge',
          host: 'edge.example.com',
          mode: 'auto',
          xmux: { max_conns: 4 },
        },
        tls: {
          enabled: true,
        },
      },
    ],
  };

  const { nodes } = await parseInput(JSON.stringify(input));
  assert(nodes.length >= 2, `expected >=2 nodes, got ${nodes.length}`);

  const hu = nodes.find((n) => n.name === 'VM-HU');
  assert(hu, 'missing VM-HU node');
  assert(hu.transport === 'httpupgrade', `expected VM-HU httpupgrade, got ${hu.transport}`);
  assert(hu.wsPath === '/up', `expected VM-HU wsPath=/up, got ${hu.wsPath}`);
  assert(hu.wsHeaders?.Host === 'up.example.com', `expected VM-HU host=up.example.com, got ${hu.wsHeaders?.Host}`);

  const xh = nodes.find((n) => n.name === 'VL-XHTTP');
  assert(xh, 'missing VL-XHTTP node');
  assert(xh.transport === 'xhttp', `expected VL-XHTTP xhttp, got ${xh.transport}`);
  assert(xh.xhttpPath === '/edge', `expected VL-XHTTP path=/edge, got ${xh.xhttpPath}`);
  assert(xh.xhttpHost === 'edge.example.com', `expected VL-XHTTP host=edge.example.com, got ${xh.xhttpHost}`);
  assert(xh.xhttpMode === 'auto', `expected VL-XHTTP mode=auto, got ${xh.xhttpMode}`);
  assert(!!xh.xhttpExtra?.xmux, 'expected VL-XHTTP xhttpExtra.xmux preserved');
});

async function main() {
  let failed = 0;
  console.log(`Running ${tests.length} regression tests...`);
  for (const t of tests) {
    try {
      await t.run();
      console.log(`PASS ${t.name}`);
    } catch (err: any) {
      failed++;
      console.error(`FAIL ${t.name}: ${err?.message || err}`);
    }
  }
  if (failed > 0) {
    console.error(`Regression tests failed: ${failed}/${tests.length}`);
    process.exit(1);
  }
  console.log(`All regression tests passed: ${tests.length}/${tests.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
