# bpnz-membership

Cloudflare Worker for **Bitcoin Policy New Zealand**: automated governance
reminders today; the membership platform (encrypted contacts, signup,
payments, newsletters) in later phases.

This is a public repository and holds **no personal information**. Recipient
addresses live in Worker secrets; member/contact data will live in a D1
database with field-level encryption (see `vendor/d1-field-crypto/`).

## What runs now: daily governance reminders

One cron tick per day (`0 17 * * *` UTC ≈ early morning NZ). The handler
computes today's date in `Pacific/Auckland` and evaluates `reminders.yml`
(compiled to `src/reminders/schedule.json`) — meeting prep, quarterly wallet
health checks, newsletter deadlines, AGM milestones — then emails the
relevant audience via Resend, BCC'd.

Evaluating rules in local-date code off a single daily cron (rather than one
UTC cron expression per reminder) keeps firing dates correct across NZ
daylight-saving transitions.

### Editing the schedule

1. Edit `reminders.yml` (schema: the governance repo's `docs/reminders.md`).
2. `npm run compile:reminders` (validates + regenerates `schedule.json`).
3. Commit both files; deploy.

AGM milestone entries are regenerated from the governance repo:
`scripts/agm-timeline.py --agm-date YYYY-MM-DD --emit-reminders`.

## Configuration

| Name | Kind | Purpose |
|---|---|---|
| `ORG_TIMEZONE` | var | IANA timezone for rule evaluation (`Pacific/Auckland`) |
| `MAIL_FROM` | var | Sender: `BPNZ Governance <reminders@mail.nzbitcoin.org>` |
| `DRY_RUN` | var | `"1"` = log instead of sending. Keep on until verified. |
| `TEST_RECIPIENT` | var/secret | If set, reroutes every send to this one address |
| `RESEND_API_KEY` | secret | Resend API key |
| `COMMITTEE_RECIPIENTS` | secret | JSON `{"committee": ["..."], "key-holders": ["..."]}` |

Set secrets with `wrangler secret put <NAME>`; for local dev put them in
`.dev.vars` (gitignored).

## Develop / test / deploy

```bash
npm install
npm test                  # rule evaluator (incl. DST boundaries), send logic, crypto lib
npm run typecheck
npm run dev               # wrangler dev --test-scheduled; then:
curl "http://localhost:8787/__scheduled?cron=0+17+*+*+*"
npm run deploy
```

### Go-live sequence (no committee spam)

1. Deploy with `DRY_RUN=1`; watch a real daily tick in `wrangler tail`.
2. Set `TEST_RECIPIENT` to your own address, `DRY_RUN=0`; confirm a real
   email arrives on the next due reminder (or fire `/__scheduled` locally).
3. Remove `TEST_RECIPIENT`; the committee starts receiving reminders.

## Roadmap (see the governance-in-a-box plan)

- **Phase 4:** D1 schema (contacts, memberships, payments, suppression) with
  AES-256-GCM field encryption + email blind index; `/api/signup` with
  Turnstile; BTCPay webhook → membership activation + receipt; renewal
  reminders; admin behind Cloudflare Access.
- **Phase 5:** newsletter batch sending with per-recipient unsubscribe
  tokens; Resend bounce/complaint webhook → suppression; Windcave card
  payments module.
