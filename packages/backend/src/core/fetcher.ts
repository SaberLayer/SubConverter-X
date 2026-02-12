// Fetch subscription content from URL

const TIMEOUT_MS = 10000; // 10 seconds

export async function fetchSubscription(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'SubConverter/1.0',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const content = await response.text();
    return content;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw new Error(`Failed to fetch subscription: ${err.message}`);
  }
}

/**
 * Detect if input is a URL or raw content
 */
export function isUrl(input: string): boolean {
  const trimmed = input.trim();
  return trimmed.startsWith('http://') || trimmed.startsWith('https://');
}

/**
 * Process input: if it's a URL, fetch it; otherwise return as-is
 */
export async function processInput(input: string): Promise<string> {
  const lines = input.split('\n').map(l => l.trim()).filter(Boolean);

  // Process each line
  const results = await Promise.all(
    lines.map(async (line) => {
      if (isUrl(line)) {
        try {
          return await fetchSubscription(line);
        } catch (err: any) {
          console.error(`Failed to fetch ${line}:`, err.message);
          return ''; // Skip failed URLs
        }
      }
      return line;
    })
  );

  return results.filter(Boolean).join('\n');
}
