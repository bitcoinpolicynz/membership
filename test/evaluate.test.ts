import { describe, expect, it } from "vitest";
import {
  addDays,
  dueReminders,
  isoDate,
  localDateInZone,
  ruleMatches,
  type Reminder,
} from "../src/reminders/evaluate";
import schedule from "../src/reminders/schedule.json";

const NZ = "Pacific/Auckland";

function reminder(overrides: Partial<Reminder>): Reminder {
  return {
    id: "t",
    rule: "monthly:first-tuesday",
    subject: "t",
    body_template: "t",
    audience: "committee",
    ...overrides,
  };
}

describe("localDateInZone across NZ DST boundaries", () => {
  it("maps the 17:00 UTC cron tick to the next NZ day under NZST (winter)", () => {
    // 2026-07-15 17:00 UTC = 2026-07-16 05:00 NZST (+12)
    const date = localDateInZone(new Date("2026-07-15T17:00:00Z"), NZ);
    expect(isoDate(date)).toBe("2026-07-16");
  });

  it("maps the 17:00 UTC cron tick to the next NZ day under NZDT (summer)", () => {
    // 2026-01-15 17:00 UTC = 2026-01-16 06:00 NZDT (+13)
    const date = localDateInZone(new Date("2026-01-15T17:00:00Z"), NZ);
    expect(isoDate(date)).toBe("2026-01-16");
  });

  it("is correct on the NZDT start day (last Sunday of September 2026)", () => {
    // NZDT begins 2026-09-27 02:00 NZST → clocks jump to 03:00 NZDT
    const date = localDateInZone(new Date("2026-09-26T17:00:00Z"), NZ);
    expect(isoDate(date)).toBe("2026-09-27");
  });

  it("is correct on the NZDT end day (first Sunday of April 2026)", () => {
    // NZDT ends 2026-04-05 03:00 NZDT → clocks fall back to 02:00 NZST
    const date = localDateInZone(new Date("2026-04-04T17:00:00Z"), NZ);
    expect(isoDate(date)).toBe("2026-04-05");
  });
});

describe("calendar arithmetic", () => {
  it("adds days across month and year boundaries", () => {
    expect(isoDate(addDays({ y: 2026, m: 12, d: 30 }, 4))).toBe("2027-01-03");
    expect(isoDate(addDays({ y: 2026, m: 3, d: 1 }, -1))).toBe("2026-02-28");
  });
});

describe("ruleMatches", () => {
  it("matches monthly first-tuesday", () => {
    const r = reminder({ rule: "monthly:first-tuesday" });
    expect(ruleMatches(r, { y: 2026, m: 11, d: 3 })).toBe(true); // Tue 3 Nov
    expect(ruleMatches(r, { y: 2026, m: 11, d: 10 })).toBe(false); // second Tuesday
    expect(ruleMatches(r, { y: 2026, m: 11, d: 4 })).toBe(false); // Wednesday
  });

  it("matches last-friday only when no same weekday follows in the month", () => {
    const r = reminder({ rule: "monthly:last-friday" });
    expect(ruleMatches(r, { y: 2026, m: 7, d: 31 })).toBe(true); // Fri 31 Jul
    expect(ruleMatches(r, { y: 2026, m: 7, d: 24 })).toBe(false);
  });

  it("restricts quarterly rules to the listed months", () => {
    const r = reminder({
      rule: "quarterly:first-monday",
      months: [1, 4, 7, 10],
    });
    expect(ruleMatches(r, { y: 2026, m: 10, d: 5 })).toBe(true); // Mon 5 Oct
    expect(ruleMatches(r, { y: 2026, m: 11, d: 2 })).toBe(false); // Mon, wrong month
  });

  it("matches annual and one-off date rules", () => {
    expect(ruleMatches(reminder({ rule: "annual:11-03" }), { y: 2027, m: 11, d: 3 })).toBe(true);
    expect(ruleMatches(reminder({ rule: "date:2026-10-20" }), { y: 2026, m: 10, d: 20 })).toBe(true);
    expect(ruleMatches(reminder({ rule: "date:2026-10-20" }), { y: 2027, m: 10, d: 20 })).toBe(false);
  });

  it("throws on unknown rule kinds", () => {
    expect(() => ruleMatches(reminder({ rule: "weekly:monday" }), { y: 2026, m: 1, d: 5 })).toThrow();
  });
});

describe("dueReminders with offsets", () => {
  it("fires offset_days before the rule date", () => {
    const r = reminder({ rule: "monthly:first-tuesday", offset_days: -2 });
    // First Tuesday Nov 2026 is the 3rd → prep reminder fires Sunday the 1st
    expect(dueReminders([r], { y: 2026, m: 11, d: 1 })).toHaveLength(1);
    expect(dueReminders([r], { y: 2026, m: 11, d: 3 })).toHaveLength(0);
  });
});

describe("BPNZ production schedule (schedule.json)", () => {
  const reminders = schedule.reminders as Reminder[];

  it("fires meeting prep on Sunday 2 Aug 2026 (first Tuesday is 4 Aug)", () => {
    const due = dueReminders(reminders, { y: 2026, m: 8, d: 2 });
    expect(due.map((r) => r.id)).toContain("meeting-prep");
  });

  it("fires the wallet check on Monday 5 Oct 2026", () => {
    const due = dueReminders(reminders, { y: 2026, m: 10, d: 5 });
    expect(due.map((r) => r.id)).toContain("wallet-check");
  });

  it("does not fire the wallet check in non-quarter months", () => {
    const due = dueReminders(reminders, { y: 2026, m: 11, d: 2 }); // first Monday Nov
    expect(due.map((r) => r.id)).not.toContain("wallet-check");
  });

  it("fires the AGM formal notice on 20 Oct 2026", () => {
    const due = dueReminders(reminders, { y: 2026, m: 10, d: 20 });
    expect(due.map((r) => r.id)).toContain("agm-2026-formal-notice");
  });

  it("fires nothing on an arbitrary quiet day", () => {
    expect(dueReminders(reminders, { y: 2026, m: 7, d: 16 })).toHaveLength(0);
  });
});
