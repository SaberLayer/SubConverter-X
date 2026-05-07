import { getAllFormats } from './core/generator';
import { getAllRules } from './rules';
import { SUBSCRIPTION_TTL_DAYS } from './db';

const conversionRequestSchema = {
  type: 'object',
  required: ['input', 'target'],
  properties: {
    input: {
      type: 'string',
      description: 'Subscription URL, Base64 content, proxy URI list, or client config text.',
    },
    target: {
      type: 'string',
      enum: getAllFormats(),
      description: 'Target output format.',
    },
    ruleTemplate: {
      type: 'string',
      enum: getAllRules().map((rule) => rule.id),
      description: 'Optional built-in rule template ID.',
    },
    include: { type: 'string', description: 'Regex include filter for node names.' },
    exclude: { type: 'string', description: 'Regex exclude filter for node names.' },
    regexDelete: { type: 'string', description: 'Regex list separated by | for deleting text from node names.' },
    regexSort: { type: 'string', description: 'Regex priority list separated by | for node sorting.' },
    filterUseless: { type: 'boolean' },
    resolveDomain: { type: 'boolean' },
    includeTypes: { type: 'array', items: { type: 'string' } },
    excludeTypes: { type: 'array', items: { type: 'string' } },
    includeRegions: { type: 'array', items: { type: 'string' } },
    excludeRegions: { type: 'array', items: { type: 'string' } },
    rename: { type: 'string', description: 'Regex replacement rule.' },
    addEmoji: { type: 'boolean' },
    deduplicate: { type: 'boolean' },
    sort: { type: 'string', enum: ['none', 'name', 'region'] },
    enableUdp: { type: 'boolean' },
    skipCertVerify: { type: 'boolean' },
    autoRegionGroup: { type: 'boolean' },
    configTemplate: {
      type: 'string',
      description: 'Optional inline full-config template. Supported placeholders: {{content}}, {{proxies}}, {{proxyGroups}}, {{rules}}, {{dns}}, {{nodeNames}}.',
    },
    configTemplateUrl: {
      type: 'string',
      description: 'Optional remote full-config template URL. SSRF checks apply before fetching.',
    },
    proxyGroups: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'type'],
        properties: {
          name: { type: 'string' },
          type: { type: 'string', enum: ['select', 'url-test', 'fallback', 'load-balance'] },
          filter: { type: 'string' },
          proxies: { type: 'array', items: { type: 'string' } },
          url: { type: 'string' },
          interval: { type: 'number' },
        },
      },
    },
  },
};

export function buildOpenApiDocument() {
  return {
    openapi: '3.0.3',
    info: {
      title: 'SubConverter-X API',
      version: '1.0.0',
      description: 'Privacy-first self-hosted proxy subscription converter API.',
    },
    servers: [{ url: '/' }],
    tags: [
      { name: 'Convert', description: 'Convert subscriptions and node configs.' },
      { name: 'Subscription', description: 'Short-link subscription endpoints.' },
      { name: 'Metadata', description: 'Formats, rules, and health checks.' },
    ],
    paths: {
      '/health': {
        get: {
          tags: ['Metadata'],
          summary: 'Health check',
          responses: { '200': { description: 'Service is healthy' } },
        },
      },
      '/api/convert': {
        post: {
          tags: ['Convert'],
          summary: 'Convert subscription content',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: conversionRequestSchema,
              },
            },
          },
          responses: {
            '200': {
              description: 'Conversion result',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      output: { type: 'string' },
                      nodeCount: { type: 'number' },
                      skipped: { type: 'array', items: { type: 'string' } },
                      warnings: { type: 'array', items: { type: 'object' } },
                      filteredOut: { type: 'number' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/shorten': {
        post: {
          tags: ['Subscription'],
          summary: 'Create a short subscription link',
          description: `Short links are retained for ${SUBSCRIPTION_TTL_DAYS} days by default.`,
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: conversionRequestSchema,
              },
            },
          },
          responses: {
            '200': {
              description: 'Short link metadata',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      token: { type: 'string' },
                      url: { type: 'string' },
                      expiresAt: { type: 'number' },
                      ttlDays: { type: 'number' },
                      hasConfigTemplate: { type: 'boolean' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/sub': {
        get: {
          tags: ['Subscription'],
          summary: 'Convert a remote subscription directly by URL',
          parameters: [
            { name: 'url', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'target', in: 'query', schema: { type: 'string', enum: getAllFormats() } },
            { name: 'rule', in: 'query', schema: { type: 'string' } },
            { name: 'emoji', in: 'query', schema: { type: 'boolean' } },
            { name: 'dedupe', in: 'query', schema: { type: 'boolean' } },
            { name: 'sort', in: 'query', schema: { type: 'string', enum: ['none', 'name', 'region'] } },
            { name: 'template', in: 'query', schema: { type: 'string' }, description: 'Remote config template URL alias for configTemplateUrl.' },
            { name: 'configTemplateUrl', in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            '200': { description: 'Converted subscription config' },
          },
        },
      },
      '/api/sub/{token}': {
        get: {
          tags: ['Subscription'],
          summary: 'Get converted subscription by short token',
          parameters: [{ name: 'token', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': { description: 'Converted subscription config' },
            '404': { description: 'Subscription not found or expired' },
          },
        },
      },
      '/api/sub/{token}/info': {
        get: {
          tags: ['Subscription'],
          summary: 'Get short-link metadata without exposing original input',
          parameters: [{ name: 'token', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': { description: 'Short-link metadata' },
            '404': { description: 'Subscription not found or expired' },
          },
        },
      },
      '/api/convert/formats': {
        get: {
          tags: ['Metadata'],
          summary: 'List supported output formats',
          responses: { '200': { description: 'Supported formats' } },
        },
      },
      '/api/convert/rules': {
        get: {
          tags: ['Metadata'],
          summary: 'List available rule templates',
          responses: { '200': { description: 'Rule templates' } },
        },
      },
    },
  };
}

export function renderApiDocsHtml(): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>SubConverter-X API Docs</title>
  <style>
    body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f8fafc; color: #0f172a; }
    main { max-width: 960px; margin: 0 auto; padding: 40px 20px; }
    h1 { font-size: 32px; margin: 0 0 8px; }
    h2 { margin-top: 32px; border-bottom: 1px solid #dbe3ef; padding-bottom: 8px; }
    p { color: #475569; line-height: 1.7; }
    a { color: #0369a1; }
    code, pre { background: #0f172a; color: #e2e8f0; border-radius: 10px; }
    code { padding: 2px 6px; }
    pre { padding: 16px; overflow: auto; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
    .card { background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px; box-shadow: 0 10px 24px rgba(15, 23, 42, 0.05); }
    .method { display: inline-block; font-size: 12px; font-weight: 700; border-radius: 999px; padding: 3px 8px; background: #dcfce7; color: #166534; margin-right: 8px; }
  </style>
</head>
<body>
  <main>
    <h1>SubConverter-X API Docs</h1>
    <p>这是内置 API 快速文档。机器可读 OpenAPI JSON 位于 <a href="/api/openapi.json">/api/openapi.json</a>。</p>

    <h2>核心接口</h2>
    <div class="grid">
      <div class="card"><span class="method">POST</span><code>/api/convert</code><p>转换订阅内容，返回配置文本、节点数量和兼容性提示。</p></div>
      <div class="card"><span class="method">POST</span><code>/api/shorten</code><p>生成短链接订阅，默认保留 ${SUBSCRIPTION_TTL_DAYS} 天。</p></div>
      <div class="card"><span class="method">GET</span><code>/api/sub/:token</code><p>通过短链 token 获取转换后的订阅配置。</p></div>
      <div class="card"><span class="method">GET</span><code>/api/sub/:token/info</code><p>查看短链元数据，不返回原始订阅内容。</p></div>
    </div>

    <h2>转换示例</h2>
    <pre><code>curl -X POST http://localhost:8080/api/convert \\
  -H "Content-Type: application/json" \\
  -d '{"input":"ss://...","target":"clash-meta","addEmoji":true,"deduplicate":true}'</code></pre>

    <h2>短链接示例</h2>
    <pre><code>curl -X POST http://localhost:8080/api/shorten \\
  -H "Content-Type: application/json" \\
  -d '{"input":"https://example.com/sub","target":"clash-meta"}'</code></pre>

    <h2>更多信息</h2>
    <p>支持格式查看 <code>/api/convert/formats</code>，规则模板查看 <code>/api/convert/rules</code>。</p>
  </main>
</body>
</html>`;
}
