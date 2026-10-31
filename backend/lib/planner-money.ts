import { z } from "zod";
import { MAX_BUDGET_MINOR } from "./planning-limits.ts";

const SUPPORTED_CURRENCIES = new Set(Intl.supportedValuesOf("currency"));
const currencyFormats = new Map<string, Intl.NumberFormat>();

export function isSupportedCurrency(currency: string): boolean {
  return SUPPORTED_CURRENCIES.has(currency);
}

export const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine(
    isSupportedCurrency,
    "Choose a supported ISO 4217 currency code, such as INR, USD, or JPY.",
  );

function currencyFormatter(currency: string): Intl.NumberFormat {
  if (!isSupportedCurrency(currency)) {
    throw new Error(
      "Choose a supported ISO 4217 currency code, such as INR, USD, or JPY.",
    );
  }
  // Only the finite supported currency set can enter this cache.
  let formatter = currencyFormats.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en", { style: "currency", currency });
    currencyFormats.set(currency, formatter);
  }
  return formatter;
}

export function currencyDigits(currency: string): number {
  return (
    currencyFormatter(currency).resolvedOptions().maximumFractionDigits ?? 2
  );
}

export function parseBudgetMinor(
  amount: string,
  currency: string,
  allowZero = false,
): number {
  const digits = currencyDigits(currency);
  const cleaned = amount.trim();
  const pattern =
    digits === 0
      ? /^\d{1,12}$/
      : new RegExp(`^\\d{1,12}(?:\\.\\d{1,${digits}})?$`);
  if (!pattern.test(cleaned)) {
    throw new Error(
      digits === 0
        ? "Enter a whole-number budget for this currency."
        : `Enter an amount with up to ${digits} decimal place${digits === 1 ? "" : "s"}.`,
    );
  }

  const [whole, fraction = ""] = cleaned.split(".");
  const scale = 10n ** BigInt(digits);
  const minor =
    BigInt(whole) * scale + BigInt(fraction.padEnd(digits, "0") || "0");
  if (minor < (allowZero ? 0n : 1n) || minor > BigInt(MAX_BUDGET_MINOR)) {
    throw new Error(
      allowZero
        ? "Enter a non-negative amount within the supported planning range."
        : "Enter a positive budget within the supported planning range.",
    );
  }
  return Number(minor);
}

export function formatMoney(amountMinor: number, currency: string): string {
  const digits = currencyDigits(currency);
  const major = amountMinor / 10 ** digits;
  return currencyFormatter(currency).format(major);
}
