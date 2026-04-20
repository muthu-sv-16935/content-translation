/**
 * URL validation for fetch to prevent SSRF.
 * Only allow http/https. Optionally block private/internal hosts.
 */

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/** Hostnames / patterns that should not be reachable (SSRF) */
const BLOCKED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '0.0.0.0',
]);

/** Prefixes for private/internal IP ranges (IPv4) */
const PRIVATE_IPV4_PREFIXES = [
  /^10\./,           // 10.0.0.0/8
  /^172\.(1[6-9]|2\d|3[01])\./, // 172.16.0.0/12
  /^192\.168\./,     // 192.168.0.0/16
  /^169\.254\./,     // link-local
  /^127\./,          // loopback
];

const MAX_URL_LENGTH = 2048;

/**
 * Returns true if the URL is allowed for server-side fetch (no file:, no private hosts).
 * @param {string} input - Raw URL from client
 * @returns {{ allowed: boolean, error?: string }}
 */
export function isAllowedUrl(input) {
  if (typeof input !== 'string') {
    return { allowed: false, error: 'URL must be a string' };
  }
  const trimmed = input.trim();
  if (!trimmed) {
    return { allowed: false, error: 'URL is required' };
  }
  if (trimmed.length > MAX_URL_LENGTH) {
    return { allowed: false, error: 'URL too long' };
  }
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { allowed: false, error: 'Invalid URL' };
  }
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    return { allowed: false, error: 'Only HTTP and HTTPS URLs are allowed' };
  }
  const host = (parsed.hostname || '').toLowerCase();
  if (BLOCKED_HOSTS.has(host)) {
    return { allowed: false, error: 'URL host not allowed' };
  }
  if (PRIVATE_IPV4_PREFIXES.some((re) => re.test(host))) {
    return { allowed: false, error: 'URL host not allowed' };
  }
  return { allowed: true };
}
