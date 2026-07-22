import { describe, expect, it } from "vitest";

import { isFetchSiteAllowed } from "./fetch-site-policy";

describe("isFetchSiteAllowed", () => {
  it("allows an absent or empty header (non-browser callers)", () => {
    expect(isFetchSiteAllowed(null)).toBe(true);
    expect(isFetchSiteAllowed(undefined)).toBe(true);
    expect(isFetchSiteAllowed("")).toBe(true);
    expect(isFetchSiteAllowed("   ")).toBe(true);
  });

  it("allows same-origin, same-site, and none", () => {
    expect(isFetchSiteAllowed("same-origin")).toBe(true);
    expect(isFetchSiteAllowed("same-site")).toBe(true);
    expect(isFetchSiteAllowed("none")).toBe(true);
    expect(isFetchSiteAllowed("SAME-ORIGIN")).toBe(true);
  });

  it("denies cross-site and arbitrary junk", () => {
    expect(isFetchSiteAllowed("cross-site")).toBe(false);
    expect(isFetchSiteAllowed("cross-origin")).toBe(false);
    expect(isFetchSiteAllowed("nonsense")).toBe(false);
  });
});
