import { describe, expect, it, vi } from "vitest";
import { resolveAudience, sendReminder } from "../src/reminders/send";
import type { Reminder } from "../src/reminders/evaluate";

const REMINDER: Reminder = {
  id: "wallet-check",
  rule: "quarterly:first-monday",
  months: [1, 4, 7, 10],
  subject: "Quarterly multisig wallet health check due",
  body_template: "wallet-check",
  audience: "key-holders",
};

const RECIPIENTS = JSON.stringify({
  committee: ["c1@test.invalid", "c2@test.invalid"],
  "key-holders": ["k1@test.invalid"],
});

describe("resolveAudience", () => {
  it("resolves the audience from the COMMITTEE_RECIPIENTS secret", () => {
    expect(
      resolveAudience({ COMMITTEE_RECIPIENTS: RECIPIENTS }, "key-holders")
    ).toEqual(["k1@test.invalid"]);
  });

  it("reroutes everything to TEST_RECIPIENT when set", () => {
    expect(
      resolveAudience(
        { COMMITTEE_RECIPIENTS: RECIPIENTS, TEST_RECIPIENT: "me@test.invalid" },
        "committee"
      )
    ).toEqual(["me@test.invalid"]);
  });

  it("throws when the secret or audience is missing", () => {
    expect(() => resolveAudience({}, "committee")).toThrow();
    expect(() =>
      resolveAudience({ COMMITTEE_RECIPIENTS: "{}" }, "committee")
    ).toThrow();
  });
});

describe("sendReminder", () => {
  it("does not call Resend in DRY_RUN mode", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await sendReminder(REMINDER, {
      COMMITTEE_RECIPIENTS: RECIPIENTS,
      DRY_RUN: "1",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("posts to Resend with BCC'd recipients when live", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));
    await sendReminder(REMINDER, {
      COMMITTEE_RECIPIENTS: RECIPIENTS,
      RESEND_API_KEY: "re_test",
      MAIL_FROM: "BPNZ <reminders@test.invalid>",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.bcc).toEqual(["k1@test.invalid"]);
    expect(body.subject).toBe("[BPNZ] Quarterly multisig wallet health check due");
    fetchMock.mockRestore();
  });

  it("throws on a Resend error response", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("quota exceeded", { status: 429 }));
    await expect(
      sendReminder(REMINDER, {
        COMMITTEE_RECIPIENTS: RECIPIENTS,
        RESEND_API_KEY: "re_test",
        MAIL_FROM: "BPNZ <reminders@test.invalid>",
      })
    ).rejects.toThrow(/429/);
    fetchMock.mockRestore();
  });
});
