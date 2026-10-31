import { z } from "zod";
import { BUDGET_CATEGORIES, type EventBrief } from "./planner.ts";
import { dateOnlySchema, idSchema } from "./plan-record-primitives.ts";
import { MAX_BUDGET_MINOR } from "./planning-limits.ts";

export const costPaymentSchema = z
  .object({
    id: idSchema,
    amountMinor: z.number().int().positive().max(MAX_BUDGET_MINOR),
    paidAt: dateOnlySchema.nullable(),
    note: z.string().trim().max(160),
  })
  .strict();

export const costAdjustmentSchema = z
  .object({
    id: idSchema,
    kind: z.enum(["discount", "fee", "tax"]),
    label: z.string().trim().min(2).max(80),
    pricingModel: z.enum(["fixed", "per_guest"]).default("fixed"),
    amountMinor: z.number().int().min(0).max(MAX_BUDGET_MINOR),
    amountMaxMinor: z
      .number()
      .int()
      .min(0)
      .max(MAX_BUDGET_MINOR)
      .nullable()
      .default(null),
    sourceNote: z.string().trim().min(3).max(300),
  })
  .strict()
  .superRefine((adjustment, context) => {
    if (
      adjustment.amountMaxMinor !== null &&
      adjustment.amountMaxMinor < adjustment.amountMinor
    ) {
      context.addIssue({
        code: "custom",
        path: ["amountMaxMinor"],
        message: "The upper adjustment must be at least the lower amount.",
      });
    }
  });

export const costItemSchema = z
  .object({
    id: idSchema,
    label: z.string().trim().min(2).max(100),
    category: z.enum(BUDGET_CATEGORIES),
    vendorId: idSchema.nullable(),
    sessionId: idSchema.nullable().default(null),
    amountMinor: z.number().int().min(0).max(MAX_BUDGET_MINOR).nullable(),
    amountMaxMinor: z
      .number()
      .int()
      .positive()
      .max(MAX_BUDGET_MINOR)
      .nullable()
      .default(null),
    pricingModel: z.enum(["fixed", "per_guest"]).default("fixed"),
    evidence: z.enum(["unpriced", "estimate", "quote", "committed"]),
    paidMinor: z.number().int().min(0).max(MAX_BUDGET_MINOR),
    payments: z.array(costPaymentSchema).max(100),
    mandatory: z.boolean(),
    validUntil: dateOnlySchema.nullable(),
    minimumGuestCount: z.number().int().min(1).max(10000).nullable(),
    feesIncluded: z.boolean().nullable(),
    taxesIncluded: z.boolean().nullable().default(null),
    chargesReviewed: z.boolean().default(false),
    adjustments: z.array(costAdjustmentSchema).max(20).default([]),
    exclusions: z.array(z.string().trim().min(1).max(160)).max(12),
    sourceNote: z.string().max(300),
  })
  .strict()
  .superRefine((item, context) => {
    if (item.evidence === "unpriced" && item.amountMinor !== null) {
      context.addIssue({
        code: "custom",
        path: ["amountMinor"],
        message: "Unpriced items must not include an amount.",
      });
    }
    if (item.evidence === "unpriced" && item.amountMaxMinor !== null) {
      context.addIssue({
        code: "custom",
        path: ["amountMaxMinor"],
        message: "Unpriced items must not include an amount range.",
      });
    }
    if (
      item.evidence !== "unpriced" &&
      (item.amountMinor === null || item.amountMinor <= 0)
    ) {
      context.addIssue({
        code: "custom",
        path: ["amountMinor"],
        message: "Priced items need a positive amount.",
      });
    }
    if (
      item.amountMinor !== null &&
      item.amountMaxMinor !== null &&
      item.amountMaxMinor < item.amountMinor
    ) {
      context.addIssue({
        code: "custom",
        path: ["amountMaxMinor"],
        message: "The upper amount must be at least the lower amount.",
      });
    }
    if (
      item.evidence === "committed" &&
      item.amountMaxMinor !== null &&
      item.amountMaxMinor !== item.amountMinor
    ) {
      context.addIssue({
        code: "custom",
        path: ["amountMaxMinor"],
        message: "A commitment must have one exact amount.",
      });
    }
    if (item.paidMinor > 0 && item.evidence !== "committed") {
      context.addIssue({
        code: "custom",
        path: ["paidMinor"],
        message: "Payments can only be recorded against a commitment.",
      });
    }
    const paymentIds = item.payments.map((payment) => payment.id);
    if (new Set(paymentIds).size !== paymentIds.length) {
      context.addIssue({
        code: "custom",
        path: ["payments"],
        message: "Payment IDs must be unique within a cost.",
      });
    }
    const paymentTotal = item.payments.reduce(
      (sum, payment) => sum + BigInt(payment.amountMinor),
      0n,
    );
    if (paymentTotal !== BigInt(item.paidMinor)) {
      context.addIssue({
        code: "custom",
        path: ["payments"],
        message: "Recorded payments must add up to the paid total.",
      });
    }
    if (item.payments.length > 0 && item.evidence !== "committed") {
      context.addIssue({
        code: "custom",
        path: ["payments"],
        message: "Payments can only be recorded against a commitment.",
      });
    }
    const adjustmentIds = item.adjustments.map((adjustment) => adjustment.id);
    if (new Set(adjustmentIds).size !== adjustmentIds.length) {
      context.addIssue({
        code: "custom",
        path: ["adjustments"],
        message: "Adjustment IDs must be unique within a cost.",
      });
    }
    if (
      item.feesIncluded === true &&
      item.adjustments.some((adjustment) => adjustment.kind === "fee")
    ) {
      context.addIssue({
        code: "custom",
        path: ["adjustments"],
        message:
          "A cost cannot mark fees included and also add a separate fee. Set the fee status to excluded or extra.",
      });
    }
    if (
      item.taxesIncluded === true &&
      item.adjustments.some((adjustment) => adjustment.kind === "tax")
    ) {
      context.addIssue({
        code: "custom",
        path: ["adjustments"],
        message:
          "A cost cannot mark taxes included and also add a separate tax. Set the tax status to excluded or extra.",
      });
    }
    if (
      item.evidence === "committed" &&
      item.adjustments.some(
        (adjustment) =>
          adjustment.amountMaxMinor !== null &&
          adjustment.amountMaxMinor !== adjustment.amountMinor,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["adjustments"],
        message:
          "A committed cost must use exact fee, tax, and discount amounts.",
      });
    }
    if (
      item.chargesReviewed &&
      (item.sourceNote.trim().length < 3 ||
        /^no quote or local price has been supplied\.?$/i.test(
          item.sourceNote.trim(),
        ))
    ) {
      context.addIssue({
        code: "custom",
        path: ["sourceNote"],
        message:
          "Record the actual quote or source used to confirm fees and taxes before completing this review.",
      });
    }
    if (item.chargesReviewed && item.amountMinor === null) {
      context.addIssue({
        code: "custom",
        path: ["chargesReviewed"],
        message: "Price the cost before completing its fee and tax review.",
      });
    }
    if (
      item.chargesReviewed &&
      (item.feesIncluded === null || item.taxesIncluded === null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["chargesReviewed"],
        message:
          "Record whether fees and taxes are included or recorded separately before completing this review.",
      });
    }
    if (
      item.chargesReviewed &&
      item.feesIncluded === false &&
      !item.adjustments.some((adjustment) => adjustment.kind === "fee")
    ) {
      context.addIssue({
        code: "custom",
        path: ["chargesReviewed"],
        message:
          "Record a sourced fee amount, including zero when no separate fee applies.",
      });
    }
    if (
      item.chargesReviewed &&
      item.taxesIncluded === false &&
      !item.adjustments.some((adjustment) => adjustment.kind === "tax")
    ) {
      context.addIssue({
        code: "custom",
        path: ["chargesReviewed"],
        message:
          "Record a sourced tax amount, including zero when no separate tax applies.",
      });
    }
  });

export type CostAdjustment = z.infer<typeof costAdjustmentSchema>;

function adjustmentAmountMinor(
  adjustment: CostAdjustment,
  guestUnits: number,
  range: "lower" | "upper",
): bigint {
  const amountMinor =
    range === "upper"
      ? (adjustment.amountMaxMinor ?? adjustment.amountMinor)
      : adjustment.amountMinor;
  const multiplier = adjustment.pricingModel === "per_guest" ? guestUnits : 1;
  return BigInt(amountMinor) * BigInt(multiplier);
}

export type CostItem = z.infer<typeof costItemSchema>;
export type CostPayment = z.infer<typeof costPaymentSchema>;

export type QuoteValidityStatus =
  "not_quote" | "unknown" | "current" | "expired";

export function quoteValidityStatus(
  cost: Pick<CostItem, "evidence" | "validUntil">,
  today: string,
): QuoteValidityStatus {
  if (cost.evidence !== "quote") return "not_quote";
  if (cost.validUntil === null) return "unknown";
  return cost.validUntil < today ? "expired" : "current";
}

export function parseCostExclusions(input: string): string[] {
  const exclusions = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (exclusions.length > 12) throw new Error("Record up to 12 exclusions.");
  if (exclusions.some((line) => line.length < 1))
    throw new Error("Each exclusion must contain at least 1 character.");
  if (exclusions.some((line) => line.length > 160))
    throw new Error("Each exclusion must be 160 characters or fewer.");
  return exclusions;
}

export function evidenceAfterAmountEntry(
  evidence: CostItem["evidence"],
): CostItem["evidence"] {
  return evidence === "unpriced" ? "estimate" : evidence;
}

export type CostItemForecast = {
  units: number;
  baseLowerMinor: number | null;
  baseUpperMinor: number | null;
  discountLowerMinor: number;
  discountUpperMinor: number;
  feeLowerMinor: number;
  feeUpperMinor: number;
  taxLowerMinor: number;
  taxUpperMinor: number;
  lowerMinor: number | null;
  upperMinor: number | null;
};

export function safeMinor(value: bigint): number {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("This amount exceeds the supported exact forecast range.");
  }
  return Number(value);
}

export function forecastCostItem(
  item: CostItem,
  expectedGuests: number,
): CostItemForecast {
  const guestUnits = Math.max(
    expectedGuests,
    item.minimumGuestCount ?? expectedGuests,
  );
  const units = item.pricingModel === "per_guest" ? guestUnits : 1;
  const multiplier = BigInt(units);
  const adjustmentTotal = (
    kind: CostAdjustment["kind"],
    range: "lower" | "upper",
  ) =>
    item.adjustments
      .filter((adjustment) => adjustment.kind === kind)
      .reduce(
        (sum, adjustment) =>
          sum + adjustmentAmountMinor(adjustment, guestUnits, range),
        0n,
      );
  const discountLowerMinor = adjustmentTotal("discount", "lower");
  const discountUpperMinor = adjustmentTotal("discount", "upper");
  const feeLowerMinor = adjustmentTotal("fee", "lower");
  const feeUpperMinor = adjustmentTotal("fee", "upper");
  const taxLowerMinor = adjustmentTotal("tax", "lower");
  const taxUpperMinor = adjustmentTotal("tax", "upper");
  if (item.amountMinor === null) {
    return {
      units,
      baseLowerMinor: null,
      baseUpperMinor: null,
      discountLowerMinor: safeMinor(discountLowerMinor),
      discountUpperMinor: safeMinor(discountUpperMinor),
      feeLowerMinor: safeMinor(feeLowerMinor),
      feeUpperMinor: safeMinor(feeUpperMinor),
      taxLowerMinor: safeMinor(taxLowerMinor),
      taxUpperMinor: safeMinor(taxUpperMinor),
      lowerMinor: null,
      upperMinor: null,
    };
  }
  const baseLowerMinor = BigInt(item.amountMinor) * multiplier;
  const baseUpperMinor =
    BigInt(item.amountMaxMinor ?? item.amountMinor) * multiplier;
  if (discountUpperMinor > baseLowerMinor)
    throw new Error("Discounts cannot exceed the lowest base cost.");
  const lowerMinor =
    baseLowerMinor - discountUpperMinor + feeLowerMinor + taxLowerMinor;
  const upperMinor =
    baseUpperMinor - discountLowerMinor + feeUpperMinor + taxUpperMinor;
  if (lowerMinor < 0n || upperMinor < lowerMinor)
    throw new Error("The adjusted cost range is invalid.");
  return {
    units,
    baseLowerMinor: safeMinor(baseLowerMinor),
    baseUpperMinor: safeMinor(baseUpperMinor),
    discountLowerMinor: safeMinor(discountLowerMinor),
    discountUpperMinor: safeMinor(discountUpperMinor),
    feeLowerMinor: safeMinor(feeLowerMinor),
    feeUpperMinor: safeMinor(feeUpperMinor),
    taxLowerMinor: safeMinor(taxLowerMinor),
    taxUpperMinor: safeMinor(taxUpperMinor),
    lowerMinor: safeMinor(lowerMinor),
    upperMinor: safeMinor(upperMinor),
  };
}

export function addCostPayment(
  item: CostItem,
  payment: CostPayment,
  commitmentTotalMinor: number | null,
): CostItem {
  const validated = costItemSchema.parse(item);
  const parsedPayment = costPaymentSchema.parse(payment);
  if (validated.evidence !== "committed")
    throw new Error("Payments can only be recorded against a commitment.");
  if (validated.payments.length >= 100)
    throw new Error(
      "This cost already has the maximum of 100 payment records.",
    );
  if (validated.payments.some((existing) => existing.id === parsedPayment.id))
    throw new Error("Payment IDs must be unique within a cost.");
  const paidMinor =
    BigInt(validated.paidMinor) + BigInt(parsedPayment.amountMinor);
  if (paidMinor > BigInt(MAX_BUDGET_MINOR))
    throw new Error("Recorded payments exceed the supported amount.");
  if (
    commitmentTotalMinor !== null &&
    paidMinor > BigInt(commitmentTotalMinor)
  ) {
    throw new Error("Payment cannot exceed the remaining commitment balance.");
  }
  return costItemSchema.parse({
    ...validated,
    paidMinor: Number(paidMinor),
    payments: [...validated.payments, parsedPayment],
  });
}

export function removeCostPayment(item: CostItem, paymentId: string): CostItem {
  const validated = costItemSchema.parse(item);
  const payments = validated.payments.filter(
    (payment) => payment.id !== paymentId,
  );
  if (payments.length === validated.payments.length)
    throw new Error("Payment record was not found.");
  const paidMinor = payments.reduce(
    (sum, payment) => sum + payment.amountMinor,
    0,
  );
  return costItemSchema.parse({ ...validated, payments, paidMinor });
}

export function expectedGuestsForCostItem(
  plan: {
    planBrief: Pick<EventBrief, "sessions">;
    guestSummary: { expected: number };
  },
  item: Pick<CostItem, "sessionId">,
): number {
  if (!item.sessionId) return plan.guestSummary.expected;
  return (
    plan.planBrief.sessions.find((session) => session.id === item.sessionId)
      ?.guestCount ?? plan.guestSummary.expected
  );
}
