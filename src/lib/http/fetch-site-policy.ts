const ALLOWED_FETCH_SITES = new Set(["same-origin", "same-site", "none"]);

/**
 * Browsers stamp every request with Sec-Fetch-Site, so a value naming another
 * site means a different website is driving the browser at our API. A missing
 * or empty header (curl, Square's webhook servers, older browsers) is allowed:
 * a public API cannot be cryptographically bound to its own frontend.
 */
export function isFetchSiteAllowed(
  headerValue: string | null | undefined,
): boolean {
  const normalized = headerValue?.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return ALLOWED_FETCH_SITES.has(normalized);
}
