import { describe, expect, it } from "vitest";

import { formatCatalogMoney } from "./money";

describe("formatCatalogMoney", () => {
  it.each([
    [{ amount: "325", currency: "USD" }, "$3.25"],
    [{ amount: "123", currency: "JPY" }, "¥123"],
    [{ amount: "-50", currency: "USD" }, "-$0.50"],
    [
      { amount: "9007199254740993", currency: "USD" },
      "$90,071,992,547,409.93",
    ],
  ] as const)("formats minor units without Number precision loss", (money, expected) => {
    expect(formatCatalogMoney(money, "en-US")).toBe(expected);
  });

  it("uses the currency's precision rather than assuming two decimals", () => {
    expect(
      formatCatalogMoney({ amount: "1234", currency: "KWD" }, "en-US"),
    ).toBe("KWD 1.234");
  });

  it.each([
    ["ar-EG", "‏١٢٫٣٤ US$"],
    ["fa-IR", "‎$۱۲٫۳۴"],
    ["bn-BD", "১২.৩৪ US$"],
  ])("localizes integer and fraction digits for %s", (locale, expected) => {
    expect(
      formatCatalogMoney({ amount: "1234", currency: "USD" }, locale),
    ).toBe(expected);
  });

  it("rejects a non-integer minor-unit amount", () => {
    expect(() =>
      formatCatalogMoney({ amount: "3.25", currency: "USD" }, "en-US"),
    ).toThrow(RangeError);
  });
});
