export type TimeOccurrence = "earlier" | "later";

export type ZonedDateTimeResolution = {
  status: "missing" | "invalid" | "nonexistent" | "ambiguous" | "unique";
  candidates: string[];
  instant: string | null;
};

type CivilParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();
const MAX_CACHED_FORMATTERS = 64;

function dateParts(
  value: string,
): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    year < 1900 ||
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  )
    return null;
  return { year, month, day };
}

function timeParts(value: string): { hour: number; minute: number } | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return match ? { hour: Number(match[1]), minute: Number(match[2]) } : null;
}

export function isValidIanaTimeZone(value: string): boolean {
  // Intl also accepts numeric UTC offsets; the planning contract requires a
  // named zone so seasonal clock changes are handled for the event date.
  if (!value.trim() || /^[+-]/.test(value)) return false;
  try {
    formatterFor(value);
    return true;
  } catch {
    return false;
  }
}

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  // IANA identifiers are case-insensitive. Normalize before retaining a key so
  // case variants from public request data share the same native formatter.
  const key = timeZone.toLowerCase();
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      calendar: "iso8601",
      numberingSystem: "latn",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    if (formatterCache.size >= MAX_CACHED_FORMATTERS) {
      const oldest = formatterCache.keys().next().value;
      if (oldest !== undefined) formatterCache.delete(oldest);
    }
  }
  // Refresh insertion order on use; retain at most 64 native formatters.
  formatterCache.delete(key);
  formatterCache.set(key, formatter);
  return formatter;
}

function partsAt(instant: Date, timeZone: string): CivilParts {
  const values = Object.fromEntries(
    formatterFor(timeZone)
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour) % 24,
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function sameWallTime(parts: CivilParts, target: CivilParts): boolean {
  return (
    parts.year === target.year &&
    parts.month === target.month &&
    parts.day === target.day &&
    parts.hour === target.hour &&
    parts.minute === target.minute &&
    parts.second === target.second
  );
}

/**
 * Resolves a wall-clock time without consulting the host machine's timezone.
 * Spring-forward gaps have no candidates; fall-back overlaps require an explicit
 * earlier/later occurrence choice before an instant is returned.
 */
export function resolveZonedDateTime(
  date: string,
  time: string,
  timeZone: string | null,
  occurrence: TimeOccurrence | null = null,
): ZonedDateTimeResolution {
  if (!date && !time)
    return { status: "missing", candidates: [], instant: null };
  const civilDate = dateParts(date);
  const civilTime = timeParts(time);
  if (!civilDate || !civilTime || !timeZone || !isValidIanaTimeZone(timeZone)) {
    return { status: "invalid", candidates: [], instant: null };
  }
  const target: CivilParts = { ...civilDate, ...civilTime, second: 0 };
  const targetEpoch = Date.UTC(
    target.year,
    target.month - 1,
    target.day,
    target.hour,
    target.minute,
  );
  const offsets = new Set<number>();

  // Sampling both sides of the requested wall time captures each offset in force
  // around a DST transition, including half-hour and quarter-hour zones.
  for (
    let deltaMinutes = -48 * 60;
    deltaMinutes <= 48 * 60;
    deltaMinutes += 6 * 60
  ) {
    const sample = new Date(targetEpoch + deltaMinutes * 60_000);
    const local = partsAt(sample, timeZone);
    const localAsUtc = Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hour,
      local.minute,
      local.second,
    );
    // Historical named-zone offsets can include seconds. Rounding them to
    // minutes incorrectly turns an ordinary supported date into a DST gap.
    offsets.add(localAsUtc - sample.getTime());
  }

  const candidates = [...offsets]
    .map((offsetMilliseconds) => new Date(targetEpoch - offsetMilliseconds))
    .filter((candidate) => sameWallTime(partsAt(candidate, timeZone), target))
    .sort((left, right) => left.getTime() - right.getTime())
    .map((candidate) => candidate.toISOString());

  if (candidates.length === 0)
    return { status: "nonexistent", candidates, instant: null };
  if (candidates.length === 1)
    return { status: "unique", candidates, instant: candidates[0] };
  const selected =
    occurrence === "earlier"
      ? candidates[0]
      : occurrence === "later"
        ? (candidates.at(-1) ?? null)
        : null;
  return { status: "ambiguous", candidates, instant: selected };
}

/** Returns the calendar date observed in an explicit IANA zone, or null if absent/invalid. */
export function dateInTimeZone(
  instant: Date,
  timeZone: string | null,
): string | null {
  if (
    !timeZone ||
    !isValidIanaTimeZone(timeZone) ||
    Number.isNaN(instant.getTime())
  )
    return null;
  const parts = partsAt(instant, timeZone);
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

/** Adds whole civil-calendar days without applying the computer's timezone or DST offset. */
export function addCalendarDays(
  date: string,
  offsetDays: number,
): string | null {
  const parts = dateParts(date);
  if (!parts || !Number.isInteger(offsetDays) || Math.abs(offsetDays) > 3650)
    return null;
  const result = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  result.setUTCDate(result.getUTCDate() + offsetDays);
  if (
    Number.isNaN(result.getTime()) ||
    result.getUTCFullYear() < 1900 ||
    result.getUTCFullYear() > 9999
  )
    return null;
  return `${String(result.getUTCFullYear()).padStart(4, "0")}-${String(result.getUTCMonth() + 1).padStart(2, "0")}-${String(result.getUTCDate()).padStart(2, "0")}`;
}
