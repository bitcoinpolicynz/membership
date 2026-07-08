#!/usr/bin/env node
// Compile reminders.yml → src/reminders/schedule.json (committed).
// Mirrors the validation rules of the governance repo's validate-reminders.py.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parse } from "yaml";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const doc = parse(readFileSync(join(root, "reminders.yml"), "utf8"));

const ORDINALS = new Set(["first", "second", "third", "fourth", "last"]);
const WEEKDAYS = new Set([
  "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
]);
const AUDIENCES = new Set(["committee", "key-holders"]);

const errors = [];
const seen = new Set();
const reminders = doc?.reminders ?? [];
if (!Array.isArray(reminders) || reminders.length === 0) {
  errors.push("top-level 'reminders' must be a non-empty list");
}

for (const r of reminders) {
  const where = `reminder ${r?.id ?? "(no id)"}`;
  for (const field of ["id", "rule", "subject", "body_template", "audience"]) {
    if (!r?.[field]) errors.push(`${where}: missing ${field}`);
  }
  if (r?.id) {
    if (seen.has(r.id)) errors.push(`${where}: duplicate id`);
    seen.add(r.id);
  }
  if (r?.audience && !AUDIENCES.has(r.audience)) {
    errors.push(`${where}: bad audience ${r.audience}`);
  }
  if (r?.offset_days !== undefined && !Number.isInteger(r.offset_days)) {
    errors.push(`${where}: offset_days must be an integer`);
  }
  if (typeof r?.rule === "string") {
    const sep = r.rule.indexOf(":");
    const kind = r.rule.slice(0, sep);
    const spec = r.rule.slice(sep + 1);
    if (kind === "monthly" || kind === "quarterly") {
      const [ordinal, weekday] = spec.split("-");
      if (!ORDINALS.has(ordinal) || !WEEKDAYS.has(weekday)) {
        errors.push(`${where}: bad ${kind} spec ${spec}`);
      }
      if (kind === "quarterly") {
        const ok =
          Array.isArray(r.months) &&
          r.months.length > 0 &&
          r.months.every((m) => Number.isInteger(m) && m >= 1 && m <= 12);
        if (!ok) errors.push(`${where}: quarterly needs months (ints 1-12)`);
      } else if (r.months) {
        errors.push(`${where}: months only applies to quarterly rules`);
      }
    } else if (kind === "annual") {
      if (!/^\d{2}-\d{2}$/.test(spec)) errors.push(`${where}: bad annual spec ${spec}`);
    } else if (kind === "date") {
      if (Number.isNaN(Date.parse(spec))) errors.push(`${where}: bad date spec ${spec}`);
    } else {
      errors.push(`${where}: unknown rule kind ${kind}`);
    }
  }
}

if (errors.length) {
  for (const e of errors) console.error(`INVALID: ${e}`);
  process.exit(1);
}

const out = join(root, "src", "reminders", "schedule.json");
writeFileSync(out, JSON.stringify({ reminders }, null, 2) + "\n");
console.log(`OK: wrote ${out} (${reminders.length} reminders)`);
