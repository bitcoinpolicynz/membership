/**
 * Reminder delivery via Resend.
 *
 * Recipient addresses are PII and never live in this repo: they come from
 * the COMMITTEE_RECIPIENTS Worker secret (JSON: audience → address list)
 * until the encrypted D1 committee_recipients table replaces it.
 *
 * Safety rails:
 *   DRY_RUN=1        log instead of sending
 *   TEST_RECIPIENT   reroute every send to this single address
 */

import type { Audience, Reminder } from "./evaluate";
import { renderBody } from "./bodies";

export interface ReminderEnv {
  RESEND_API_KEY?: string;
  COMMITTEE_RECIPIENTS?: string;
  MAIL_FROM?: string;
  DRY_RUN?: string;
  TEST_RECIPIENT?: string;
}

export function resolveAudience(env: ReminderEnv, audience: Audience): string[] {
  if (env.TEST_RECIPIENT) return [env.TEST_RECIPIENT];
  if (!env.COMMITTEE_RECIPIENTS) {
    throw new Error("COMMITTEE_RECIPIENTS secret not configured");
  }
  const map = JSON.parse(env.COMMITTEE_RECIPIENTS) as Record<string, string[]>;
  const recipients = map[audience];
  if (!recipients?.length) {
    throw new Error(`No recipients configured for audience "${audience}"`);
  }
  return recipients;
}

export async function sendReminder(
  reminder: Reminder,
  env: ReminderEnv
): Promise<void> {
  const to = resolveAudience(env, reminder.audience);
  const subject = `[BPNZ] ${reminder.subject}`;
  const text = renderBody(reminder);

  if (env.DRY_RUN === "1") {
    console.log(
      `DRY_RUN reminder=${reminder.id} audience=${reminder.audience} ` +
        `recipients=${to.length} subject=${JSON.stringify(subject)}`
    );
    return;
  }

  if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY secret not configured");
  if (!env.MAIL_FROM) throw new Error("MAIL_FROM var not configured");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      // BCC the list so committee members' addresses aren't shared around
      to: [env.MAIL_FROM],
      bcc: to,
      subject,
      text,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Resend ${res.status} for reminder ${reminder.id}: ${detail}`);
  }
  console.log(`sent reminder=${reminder.id} recipients=${to.length}`);
}
