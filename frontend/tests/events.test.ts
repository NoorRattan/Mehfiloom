import { describe, expect, it } from "vitest";
import { money } from "../lib/events";

describe("displayed budgets", () => {
  it.each([
    [12_345_678, "INR", "₹1,23,456.78"],
    [1234, "USD", "$12.34"],
    [1234, "JPY", "¥1,234"],
    [1234, "KWD", "KWD 1.234"],
    [0, "EUR", "€0"],
  ])("formats %s minor units in %s using that currency's precision", (amount, currency, expected) => {
    expect(money(amount as number, currency as string)).toBe(expected);
  });

  it("normalizes currency spelling and retains cent precision after repeated renders", () => {
    expect(money(1234, " usd ")).toBe("$12.34");
    expect(money(1235, "USD")).toBe("$12.35");
  });
});
