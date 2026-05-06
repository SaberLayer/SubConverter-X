import { validateUrl } from './url-safety';

const TIMEOUT_MS = 10000;
const MAX_RESPONSE_SIZE = 10 * 1024 * 1024;
const MAX_REDIRECTS = 5;

export interface FetchSubscriptionResult {
  content: string;
  userinfo?: string;
  finalUrl: string;
}

export function isSubscriptionUrl(raw: string): boolean {
  if (!/^https?:\/\//i.test(raw)) return false;
  try {
    const url = new URL(raw);
    if (url.hash) return false;
    if (url.username || url.password) return false;
    if (url.search) return true;
    if (url.pathname && url.pathname !== '/') return true;
    return !url.port;
  } catch {
    return false;
  }
}

async function readLimitedText(response: Response): Promise<string> {
  const contentLength = response.headers.get('content-length');
  if (contentLength && Number(contentLength) > MAX_RESPONSE_SIZE) {
    throw new Error('Response too large');
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
    if (total > MAX_RESPONSE_SIZE) {
      await reader.cancel();
      throw new Error('Response too large');
    }
    chunks.push(value);
  }

  const body = Buffer.concat(chunks, total);
  return new TextDecoder().decode(body);
}

export async function fetchSubscription(url: string): Promise<FetchSubscriptionResult> {
  let currentUrl = await validateUrl(url);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
      const response = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: 'manual',
        headers: {
          'User-Agent': 'SubConverter/1.0',
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) throw new Error(`HTTP ${response.status}: missing redirect location`);
        if (redirects === MAX_REDIRECTS) throw new Error('Too many redirects');
        currentUrl = await validateUrl(new URL(location, currentUrl).toString());
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const content = await readLimitedText(response);
      const userinfo = response.headers.get('subscription-userinfo') || undefined;
      return { content, userinfo, finalUrl: currentUrl };
    }

    throw new Error('Too many redirects');
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw new Error(`Failed to fetch subscription: ${err?.message || err}`);
  } finally {
    clearTimeout(timeoutId);
  }
}
