import { parseInput } from '../core/parser';
import { getAllFormats, getGenerator } from '../core/generator';
import { processNodes } from '../core/processor';
import { resolveNodeDomains } from '../core/resolve-domain';
import net from 'node:net';

type TestFn = () => Promise<void> | void;

const tests: Array<{ name: string; run: TestFn }> = [];

function add(name: string, run: TestFn) {
  tests.push({ name, run });
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

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
