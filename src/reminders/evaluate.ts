/**
 * Reminder rule evaluator.
 *
 * Consumes the declarative schedule format defined in the governance repo
 * (docs/reminders.md): a single daily cron tick calls dueReminders() with
 * today's date IN THE ORG TIMEZONE, and every rule is evaluated with plain
 * calendar arithmetic. No per-reminder cron expressions, so daylight-saving
 * transitions cannot shift a reminder onto the wrong day.
 */

export type Audience = "committee" | "key-holders";

export interface Reminder {
  id: string;
  rule: string;
  months?: number[];
  offset_days?: number;
  subject: string;
  body_template: string;
  audience: Audience;
}

/** Calendar date with 1-based month, independent of any timezone. */
export interface LocalDate {
  y: number;
  m: number;
  d: number;
}

const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const ORDINALS: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  last: -1,
};

/** The calendar date at `instant` in `timeZone` (e.g. "Pacific/Auckland"). */
export function localDateInZone(instant: Date, timeZone: string): LocalDate {
  // en-CA formats as YYYY-MM-DD
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
  const [y, m, d] = formatted.split("-").map(Number);
  return { y, m, d };
}

/** UTC-noon anchor makes day arithmetic immune to DST edge cases. */
function toUtcNoon(date: LocalDate): Date {
  return new Date(Date.UTC(date.y, date.m - 1, date.d, 12));
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const t = toUtcNoon(date);
  t.setUTCDate(t.getUTCDate() + days);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

export function sameDate(a: LocalDate, b: LocalDate): boolean {
  return a.y === b.y && a.m === b.m && a.d === b.d;
}

export function isoDate(date: LocalDate): string {
  const mm = String(date.m).padStart(2, "0");
  const dd = String(date.d).padStart(2, "0");
  return `${date.y}-${mm}-${dd}`;
}

function weekdayOf(date: LocalDate): number {
  return toUtcNoon(date).getUTCDay();
}

function matchesOrdinalWeekday(date: LocalDate, spec: string): boolean {
  const [ordinalName, weekdayName] = spec.split("-");
  const ordinal = ORDINALS[ordinalName];
  const weekday = WEEKDAYS[weekdayName];
  if (ordinal === undefined || weekday === undefined) {
    throw new Error(`Bad ordinal-weekday spec: ${spec}`);
  }
  if (weekdayOf(date) !== weekday) return false;
  if (ordinal === -1) {
    // "last <weekday>": the same weekday a week later falls in the next month
    return addDays(date, 7).m !== date.m;
  }
  return Math.ceil(date.d / 7) === ordinal;
}

/** Does `rule` (ignoring offset_days) resolve to `date`? */
export function ruleMatches(reminder: Reminder, date: LocalDate): boolean {
  const sep = reminder.rule.indexOf(":");
  const kind = reminder.rule.slice(0, sep);
  const spec = reminder.rule.slice(sep + 1);

  switch (kind) {
    case "monthly":
      return matchesOrdinalWeekday(date, spec);
    case "quarterly":
      if (!reminder.months?.includes(date.m)) return false;
      return matchesOrdinalWeekday(date, spec);
    case "annual": {
      const [mm, dd] = spec.split("-").map(Number);
      return date.m === mm && date.d === dd;
    }
    case "date": {
      const [y, m, d] = spec.split("-").map(Number);
      return sameDate(date, { y, m, d });
    }
    default:
      throw new Error(`Unknown rule kind in ${reminder.rule}`);
  }
}

/**
 * Reminders that fire on `today` (org-local). A reminder with offset_days=-2
 * fires 2 days BEFORE its rule date, i.e. when the rule matches today+2.
 */
export function dueReminders(schedule: Reminder[], today: LocalDate): Reminder[] {
  return schedule.filter((r) =>
    ruleMatches(r, addDays(today, -(r.offset_days ?? 0)))
  );
}
