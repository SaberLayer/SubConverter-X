import { Parser, ProxyNode } from '../core/types';
import { uriParser } from './uri';

export const base64Parser: Parser = {
  canParse(input: string): boolean {
    const trimmed = input.trim();

    if (trimmed.length <= 50) {
      return false;
    }

    // Must match base64 character set only (allowing line breaks)
    if (!/^[A-Za-z0-9+/=\r\n]+$/.test(trimmed)) {
      return false;
    }

    // Reject if it contains spaces
    if (trimmed.includes(' ')) {
      return false;
    }

    // Reject valid JSON
    try {
      JSON.parse(trimmed);
      return false;
    } catch {
      // not JSON, continue
    }

    // Reject YAML-like content (lines with colons suggest YAML/config)
    if (/^[a-zA-Z_-]+:/m.test(trimmed)) {
      return false;
    }

    return true;
  },

  parse(input: string): ProxyNode[] {
    const decoded = Buffer.from(input.trim(), 'base64').toString('utf-8');
    return uriParser.parse(decoded);
  },
};
