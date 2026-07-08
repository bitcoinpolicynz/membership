/**
 * Plain-text bodies for reminder emails, keyed by the schedule's
 * body_template slug. Bodies are generic process nudges — anything
 * meeting-specific (agendas, links) is distributed separately, so these
 * contain no PII and no join links.
 */

import type { Reminder } from "./evaluate";

const BODIES: Record<string, string> = {
  "meeting-prep": `The monthly BPNZ committee meeting is in 2 days.

Prep checklist:
- Agenda drafted from the actions register and circulated
- Reports lined up (Chair, Treasurer, subcommittees)
- Any discussion papers shared with the committee

Process: runbooks/meeting-cycle.md in the governance repo.`,

  "wallet-check": `The quarterly 2-of-3 multisig wallet health check is due.

Each key holder: confirm device access, seed backup intact, and produce a
test signature. Treasurer: reconcile the watch-only balance against finance
records. Record pass/fail only — never key material.

Process: runbooks/wallet-cycle.md and docs/wallet-key-hygiene.md.`,

  "newsletter-deadline": `Quarterly newsletter drafting deadline.

Two editions this cycle: members and external stakeholders. Draft from the
templates, circulate for committee comment, then send after review.

Process: runbooks/newsletter-cycle.md.`,

  "agm-milestone": `An AGM preparation milestone is due — see the subject line.

Track progress in the AGM timeline document. If the milestone is already
done, mark it off; if it is slipping, raise it with the committee now.

Process: runbooks/agm-cycle.md.`,
};

const FALLBACK = `A scheduled governance reminder is due — see the subject line.
Process runbooks live in the governance repository.`;

export function renderBody(reminder: Reminder): string {
  return BODIES[reminder.body_template] ?? FALLBACK;
}
