import type { CatalogMoneyDto } from "@/types/catalog";

function parseMinorAmount(amount: string): bigint {
  if (!/^-?\d+$/.test(amount)) {
    throw new RangeError("Money amount must be a base-10 integer string.");
  }
  return BigInt(amount);
}

function localizeDigits(value: string, locale?: string | readonly string[]): string {
  const digitFormatter = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
    useGrouping: false,
  });
  const localizedDigits = Array.from({ length: 10 }, (_, digit) =>
    digitFormatter.format(digit),
  );

  return value.replace(/\d/g, (digit) => localizedDigits[Number(digit)]);
}

export function formatCatalogMoney(
  money: CatalogMoneyDto,
  locale?: string | readonly string[],
): string {
  const currencyFormatter = new Intl.NumberFormat(locale, {
    currency: money.currency,
    style: "currency",
  });
  const fractionDigits =
    currencyFormatter.resolvedOptions().maximumFractionDigits ?? 2;
  const scale = BigInt(10) ** BigInt(fractionDigits);
  const amount = parseMinorAmount(money.amount);
  const isNegative = amount < 0;
  const absoluteAmount = isNegative ? -amount : amount;
  const whole = absoluteAmount / scale;
  const fraction = (absoluteAmount % scale)
    .toString()
    .padStart(fractionDigits, "0");
  const localizedFraction = localizeDigits(fraction, locale);
  const integer = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
    useGrouping: true,
  }).format(whole);
  let replacedInteger = false;

  return currencyFormatter
    .formatToParts(isNegative ? -1 : 1)
    .map((part) => {
      if (part.type === "integer" && !replacedInteger) {
        replacedInteger = true;
        return integer;
      }
      if (part.type === "fraction") {
        return localizedFraction;
      }
      return part.value;
    })
    .join("");
}
