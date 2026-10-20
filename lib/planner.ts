import { z } from "zod";

export const EVENT_TYPES = ["wedding", "birthday", "community"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const BUDGET_CATEGORIES = [
  "venue",
  "food",
  "decor",
  "attire",
  "photography",
  "entertainment",
  "logistics",
  "accessibility",
  "contingency",
  "other",
] as const;

export const CATEGORY_LABELS: Record<(typeof BUDGET_CATEGORIES)[number], string> = {
  venue: "Venue",
  food: "Food & drinks",
  decor: "Decor",
  attire: "Attire",
  photography: "Photography",
  entertainment: "Entertainment",
  logistics: "Logistics",
  accessibility: "Access & safety",
  contingency: "Reserve",
  other: "Other needs",
};

const MAX_BUDGET_MINOR = 1_000_000_000_000;

export const proposalSchema = z
  .object({
    conceptTitle: z.string().min(3).max(80),
    overview: z.string().min(30).max(500),
    theme: z.string().min(3).max(100),
    budgetAllocations: z
      .array(
        z
          .object({
            category: z.enum(BUDGET_CATEGORIES),
            weight: z.number().int().min(1).max(1000),
            rationale: z.string().min(10).max(180),
          })
          .strict(),
      )
      .min(4)
      .max(8),
    timeline: z
      .array(
        z
          .object({
            task: z.string().min(5).max(120),
            timing: z.string().min(3).max(80),
            priority: z.enum(["high", "medium", "low"]),
          })
          .strict(),
      )
      .min(6)
      .max(12),
    vendorChecklist: z
      .array(
        z
          .object({
            category: z.string().min(3).max(60),
            questions: z.array(z.string().min(5).max(150)).min(3).max(6),
          })
          .strict(),
      )
      .min(3)
      .max(6),
    ideas: z
      .array(
        z
          .object({
            title: z.string().min(3).max(80),
            whyItFits: z.string().min(10).max(180),
            costNote: z.string().min(5).max(160),
          })
          .strict(),
      )
      .min(3)
      .max(5),
    openQuestions: z.array(z.string().min(8).max(150)).min(2).max(5),
    assumptions: z.array(z.string().min(8).max(150)).min(2).max(5),
  })
  .strict();

export type PlannerProposal = z.infer<typeof proposalSchema>;

export const proposalJsonSchema = Object.fromEntries(
  Object.entries(z.toJSONSchema(proposalSchema, { target: "draft-7" })).filter(
    ([key]) => key !== "~standard" && key !== "$schema",
  ),
);

export const eventBriefSchema = z
  .object({
    eventType: z.enum(EVENT_TYPES),
    eventName: z.string().trim().min(2).max(80),
    location: z.string().trim().min(2).max(100),
    eventDate: z
      .string()
      .refine(
        (value) =>
          value === "" ||
          (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
            !Number.isNaN(Date.parse(`${value}T12:00:00Z`))),
        "Enter a valid event date.",
      )
      .refine(isValidCalendarDate, "Enter a valid event date."),
    guestCount: z.number().int().min(1).max(10000),
    budgetAmount: z.string().trim().min(1).max(24),
    currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
    style: z.string().trim().max(500),
    mustHaves: z.string().trim().max(700),
  })
  .strict();

export type EventBrief = z.infer<typeof eventBriefSchema>;

export type BudgetLine = PlannerProposal["budgetAllocations"][number] & {
  amountMinor: number;
};

export type PlanResult = {
  proposal: PlannerProposal;
  currency: string;
  totalMinor: number;
  allocatedMinor: number;
  lines: BudgetLine[];
};

function isValidCalendarDate(value: string): boolean {
  if (value === "") return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1900) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function currencyDigits(currency: string): number {
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Use a three-letter currency code.");
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
  }).resolvedOptions().maximumFractionDigits ?? 2;
}

export function parseBudgetMinor(amount: string, currency: string): number {
  const digits = currencyDigits(currency);
  const cleaned = amount.trim();
  const pattern = digits === 0 ? /^\d{1,12}$/ : new RegExp(`^\\d{1,12}(?:\\.\\d{1,${digits}})?$`);
  if (!pattern.test(cleaned)) {
    throw new Error(
      digits === 0
        ? "Enter a whole-number budget for this currency."
        : `Enter an amount with up to ${digits} decimal place${digits === 1 ? "" : "s"}.`,
    );
  }

  const [whole, fraction = ""] = cleaned.split(".");
  const scale = 10n ** BigInt(digits);
  const minor = BigInt(whole) * scale + BigInt((fraction.padEnd(digits, "0") || "0"));
  if (minor <= 0n || minor > BigInt(MAX_BUDGET_MINOR)) {
    throw new Error("Enter a positive budget within the supported planning range.");
  }
  return Number(minor);
}

export function formatMoney(amountMinor: number, currency: string): string {
  const digits = currencyDigits(currency);
  const major = amountMinor / 10 ** digits;
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(major);
}

export function buildPlanResult(
  proposal: PlannerProposal,
  currency: string,
  totalMinor: number,
): PlanResult {
  currencyDigits(currency);
  if (!Number.isSafeInteger(totalMinor) || totalMinor <= 0 || totalMinor > MAX_BUDGET_MINOR) {
    throw new Error("The plan needs a positive budget within the supported planning range.");
  }

  const categories = proposal.budgetAllocations.map((item) => item.category);
  if (new Set(categories).size !== categories.length) {
    throw new Error("The plan repeated a budget category. Please generate it again.");
  }
  if (!categories.includes("contingency")) {
    throw new Error("The plan omitted a contingency allocation. Please generate it again.");
  }
  if (proposal.budgetAllocations.some((item) => !Number.isSafeInteger(item.weight) || item.weight < 1 || item.weight > 1000)) {
    throw new Error("The plan returned invalid budget allocation weights.");
  }

  const weightTotal = proposal.budgetAllocations.reduce((sum, item) => sum + item.weight, 0);
  if (!Number.isSafeInteger(weightTotal) || weightTotal <= 0) {
    throw new Error("The plan returned invalid budget allocation weights.");
  }

  const total = BigInt(totalMinor);
  const denominator = BigInt(weightTotal);
  const shares = proposal.budgetAllocations.map((item, index) => {
    const product = total * BigInt(item.weight);
    return {
      index,
      amountMinor: Number(product / denominator),
      remainder: product % denominator,
    };
  });

  const floorTotal = shares.reduce((sum, share) => sum + BigInt(share.amountMinor), 0n);
  const minorUnitsToDistribute = Number(total - floorTotal);
  const byRemainder = [...shares].sort((left, right) => {
    if (left.remainder === right.remainder) return left.index - right.index;
    return left.remainder > right.remainder ? -1 : 1;
  });
  for (let i = 0; i < minorUnitsToDistribute; i += 1) {
    byRemainder[i].amountMinor += 1;
  }

  const lines = proposal.budgetAllocations.map((item, index) => ({
    ...item,
    amountMinor: shares[index].amountMinor,
  }));
  const allocatedMinor = lines.reduce((sum, item) => sum + item.amountMinor, 0);
  if (allocatedMinor !== totalMinor) throw new Error("The budget allocation did not reconcile.");

  return { proposal, currency, totalMinor, allocatedMinor, lines };
}

export const EXAMPLE_BRIEF: EventBrief = {
  eventType: "wedding",
  eventName: "A spring wedding",
  location: "Jaipur, India",
  eventDate: "2027-02-14",
  guestCount: 120,
  budgetAmount: "250000",
  currency: "INR",
  style: "Warm, relaxed, and intimate, with room for both families to mingle.",
  mustHaves: "Vegetarian meal options, step-free access, and an indoor weather backup.",
};

export const EXAMPLE_PROPOSAL: PlannerProposal = {
  conceptTitle: "A garden gathering with a family-table heart",
  overview:
    "Build the day around a welcoming shared meal, gentle florals, and unhurried time together. Keep the guest route step-free and confirm an indoor alternative before any outdoor booking.",
  theme: "Soft garden colors, handmade details, and an easy flow between moments.",
  budgetAllocations: [
    { category: "venue", weight: 24, rationale: "Protect a comfortable gathering space and a weather backup." },
    { category: "food", weight: 28, rationale: "Prioritize the shared meal and clear vegetarian choices." },
    { category: "decor", weight: 10, rationale: "Use a few personal details instead of broad room coverage." },
    { category: "photography", weight: 9, rationale: "Keep a focused record of the day and family moments." },
    { category: "entertainment", weight: 7, rationale: "Leave room for music that suits the group's energy." },
    { category: "accessibility", weight: 7, rationale: "Plan step-free movement and guest comfort from the start." },
    { category: "logistics", weight: 7, rationale: "Cover setup, transport, and coordination needs." },
    { category: "contingency", weight: 8, rationale: "Keep a host-controlled reserve for unresolved costs." },
  ],
  timeline: [
    { task: "Confirm the event date, guest range, and non-negotiable needs", timing: "First planning session", priority: "high" },
    { task: "Shortlist venues and verify step-free access plus indoor backup", timing: "As early as possible", priority: "high" },
    { task: "Ask caterers for vegetarian menus, inclusions, and minimums", timing: "After venue shortlist", priority: "high" },
    { task: "Choose a simple decor direction and reuse-friendly materials", timing: "Once venue is known", priority: "medium" },
    { task: "Confirm music, photography, and setup responsibilities", timing: "Before invitations are finalized", priority: "medium" },
    { task: "Recheck guest count, access route, weather plan, and final balances", timing: "One week before", priority: "high" },
  ],
  vendorChecklist: [
    { category: "Venue", questions: ["Is step-free access available for the full guest route?", "What is included in the hire and what costs extra?", "What indoor option is available if the weather changes?"] },
    { category: "Catering", questions: ["Can you share vegetarian menu choices and allergen handling?", "What guest minimum, service, and setup fees apply?", "When does the final headcount need to be confirmed?"] },
    { category: "Photography", questions: ["Which hours and deliverables are included?", "Are travel, overtime, or editing fees separate?", "When should we expect the finished images?"] },
  ],
  ideas: [
    { title: "Family recipe cards", whyItFits: "Invite each side to share one dish or food memory for the table.", costNote: "Low-material idea; printing and translation needs are not priced." },
    { title: "Quiet welcome corner", whyItFits: "A calmer seating area can make arrivals easier for guests who need a pause.", costNote: "Space and seating are required; venue suitability is unknown." },
    { title: "Reusable table details", whyItFits: "A few borrowed or reusable pieces keep the garden feel personal and reduce single-use decor.", costNote: "Availability and any rental costs need local quotes." },
  ],
  openQuestions: [
    "Does the budget include outfits, travel, and any pre-event gatherings?",
    "Are there dietary needs or language preferences beyond vegetarian options?",
  ],
  assumptions: [
    "The attendance figure is an early planning estimate and may change.",
    "No venue, vendor availability, or local price has been verified.",
  ],
};
