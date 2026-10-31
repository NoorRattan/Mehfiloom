import { z } from "zod";

export const idSchema = z
  .string()
  .min(3)
  .max(100)
  .regex(/^[A-Za-z0-9:_-]+$/);

export function scopedPlanId(planId: string, suffix: string): string {
  return `${planId.slice(0, Math.max(1, 100 - suffix.length))}${suffix}`;
}

export function normalizedPlanLabel(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
export const dateOnlySchema = z.string().refine((value) => {
  if (value === "") return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}, "Enter a valid date.");
