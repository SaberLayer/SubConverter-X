import { validateUrl } from './url-safety';
import { ApiError } from './api-error';

const MAX_TEMPLATE_SIZE = 1024 * 1024;
const TEMPLATE_TIMEOUT_MS = 10000;
const MAX_REDIRECTS = 3;

export interface ConfigTemplateOptions {
  configTemplate?: string;
  configTemplateUrl?: string;
}

export interface TemplateContext {
  content: string;
  proxies: string;
  proxyGroups: string;
  rules: string;
  dns: string;
  nodeNames: string;
}

const TOKEN_PATTERN = /\{\{\s*(content|proxies|proxyGroups|rules|dns|nodeNames)\s*\}\}/g;

async function readLimitedText(response: Response): Promise<string> {
  const contentLength = response.headers.get('content-length');
  if (contentLength && Number(contentLength) > MAX_TEMPLATE_SIZE) {
    throw new ApiError(413, 'TEMPLATE_TOO_LARGE', 'Config template is too large', { maxBytes: MAX_TEMPLATE_SIZE });
  }

  const reader = response.body?.getReader();
  if (!reader) return response.text();

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > MAX_TEMPLATE_SIZE) {
      await reader.cancel();
      throw new ApiError(413, 'TEMPLATE_TOO_LARGE', 'Config template is too large', { maxBytes: MAX_TEMPLATE_SIZE });
    }
    chunks.push(value);
  }

  return new TextDecoder().decode(Buffer.concat(chunks, total));
}

async function fetchTemplate(url: string): Promise<string> {
  let currentUrl = await validateUrl(url);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TEMPLATE_TIMEOUT_MS);

  try {
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
      const response = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: 'manual',
        headers: {
          'User-Agent': 'SubConverter-X/1.0',
          'Accept': 'text/plain, application/yaml, application/json, */*',
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          throw new ApiError(502, 'TEMPLATE_FETCH_FAILED', `HTTP ${response.status}: missing redirect location`);
        }
        if (redirects === MAX_REDIRECTS) {
          throw new ApiError(502, 'TEMPLATE_FETCH_FAILED', 'Too many template redirects');
        }
        currentUrl = await validateUrl(new URL(location, currentUrl).toString());
        continue;
      }

      if (!response.ok) {
        throw new ApiError(502, 'TEMPLATE_FETCH_FAILED', `Failed to fetch config template: HTTP ${response.status}`);
      }

      return readLimitedText(response);
    }

    throw new ApiError(502, 'TEMPLATE_FETCH_FAILED', 'Too many template redirects');
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    if (err?.name === 'AbortError') {
      throw new ApiError(504, 'TEMPLATE_FETCH_FAILED', 'Config template fetch timeout');
    }
    throw new ApiError(502, 'TEMPLATE_FETCH_FAILED', `Failed to fetch config template: ${err?.message || err}`);
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function resolveConfigTemplate(options: ConfigTemplateOptions): Promise<string | undefined> {
  if (options.configTemplate && options.configTemplateUrl) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Use either configTemplate or configTemplateUrl, not both');
  }

  if (options.configTemplate) return options.configTemplate;
  if (options.configTemplateUrl) return fetchTemplate(options.configTemplateUrl);
  return undefined;
}

export function renderConfigTemplate(template: string, context: TemplateContext): string {
  return template.replace(TOKEN_PATTERN, (_match, token: keyof TemplateContext) => context[token] || '');
}

export function hasTemplateToken(template: string): boolean {
  TOKEN_PATTERN.lastIndex = 0;
  return TOKEN_PATTERN.test(template);
}

