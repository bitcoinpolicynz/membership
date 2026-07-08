/**
 * bpnz-membership Worker.
 *
 * Currently: daily governance reminders (scheduled handler). The membership
 * platform (encrypted D1 contacts, signup, BTCPay/Windcave payments, admin)
 * lands here in later phases — see README.md.
 */

import schedule from "./reminders/schedule.json";
import { dueReminders, isoDate, localDateInZone, type Reminder } from "./reminders/evaluate";
import { sendReminder, type ReminderEnv } from "./reminders/send";

export interface Env extends ReminderEnv {
  ORG_TIMEZONE?: string;
}

export async function runDailyReminders(env: Env, now: Date): Promise<string[]> {
  const timeZone = env.ORG_TIMEZONE ?? "Pacific/Auckland";
  const today = localDateInZone(now, timeZone);
  const due = dueReminders(schedule.reminders as Reminder[], today);
  console.log(`reminder tick ${isoDate(today)} (${timeZone}): ${due.length} due`);

  const failures: string[] = [];
  for (const reminder of due) {
    try {
      await sendReminder(reminder, env);
    } catch (err) {
      // One failed reminder must not swallow the rest of the day's sends
      console.error(`reminder ${reminder.id} failed:`, err);
      failures.push(reminder.id);
    }
  }
  if (failures.length) {
    throw new Error(`Failed reminders: ${failures.join(", ")}`);
  }
  return due.map((r) => r.id);
}

export default {
  async fetch(): Promise<Response> {
    return new Response("bpnz-membership: governance reminders worker\n", {
      headers: { "content-type": "text/plain" },
    });
  },

  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    await runDailyReminders(env, new Date(controller.scheduledTime));
  },
} satisfies ExportedHandler<Env>;
