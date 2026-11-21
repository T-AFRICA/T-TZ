# TRONIC security checklist

Three lists: what to check in every change, what the owner has to set
outside the repository, and what must be true before a production release.
Finding numbers (F-01 …) refer to `SECURITY_AUDIT_REPORT.md`.

## A. Every change

Work through the lines that apply; say in the pull request which did and
what was tested. A line that does not apply needs no comment.

**Before writing code**

- [ ] What data does this handle, and is any of it personal, financial or a
      location?
- [ ] Who may reach it: visitor, customer, rider, which staff roles, which
      country?
- [ ] What can the caller change in the request, and what happens if every
      field is hostile?
- [ ] Which outside service is involved, and what if it is slow, wrong or
      impersonated?

**Input and output**

- [ ] Input is validated on the server at the boundary (length, type,
      range), not only in the form.
- [ ] No HTML built from data; no `dangerouslySetInnerHTML`; links built
      from data cannot be `javascript:`.
- [ ] Redirects go only to same-site paths.
- [ ] Errors and logs carry codes, never passwords, tokens, delivery codes,
      full payment details or personal data.

**Identity and permission**

- [ ] Identity comes from the verified session (`currentUser`,
      `requireCustomer`, `requireAdmin`), never from the request.
- [ ] Every server action and route handler checks permission itself; a
      page having checked is not enough.
- [ ] Admin actions check the country and the specific permission
      (`requireCountry`), and the country side checks again.
- [ ] A test proves another customer, another country and a lower role are
      refused.

**Database**

- [ ] Changes are a new numbered migration; applied ones are never edited.
- [ ] A new table has Row Level Security on and explicit grants.
- [ ] A new function has `revoke execute ... from public` and grants only
      the roles that need it; if `anon` or `authenticated` may run it, it is
      added to `database/client/tests/function-grants.test.ts` on purpose.
- [ ] A function that runs with its owner's rights pins `search_path` and
      checks the caller inside.
- [ ] Queries are parameterised.

**Money, stock, orders, delivery**

- [ ] Prices, totals, fees, currency and stock are computed on the server.
- [ ] The operation is idempotent: a retry, double-click or replay changes
      nothing twice.
- [ ] State changes follow the allowed steps and are recorded with who did
      them.
- [ ] Nothing is marked paid from what the browser says.

**Abuse**

- [ ] Anything that can be guessed, or that sends email or SMS, has an
      attempt limit.
- [ ] Anything a visitor can trigger is bounded (size, count, queries).

**Files**

- [ ] Uploads have a size limit, a type checked by content, a storage key
      the user cannot choose, and are served with a fixed type and
      `nosniff`.

**Secrets and dependencies**

- [ ] No secret in code, tests, logs or `NEXT_PUBLIC_*`.
- [ ] Test fixtures use made-up values and never the literal pattern
      `password: "…"` (the secret scan reads every commit).
- [ ] A new dependency has a reason, a maintainer and a pinned version;
      `pnpm audit --prod` is clean.

**Before the pull request**

- [ ] `pnpm run lint`, `pnpm run typecheck`, `pnpm run test`.
- [ ] The browser suite of the app that changed (they are not in CI).
- [ ] The diff has no credentials, data or unrelated files.
- [ ] `SECURITY_ARCHITECTURE.md` and `THREAT_MODEL.md` still describe the
      system.

## B. Owner actions outside the repository

None of these can be done or verified from the code. Each is recorded here
when the owner confirms it.

| # | Action | Why | Confirmed |
|---|---|---|---|
| O1 | Run `database/migrations/0020_delivery_code_owner_only.sql` on the Tanzania Supabase project | Until then the delivery code can still be fetched with the public key, an order number and the customer's phone (F-01) | No |
| O2 | Supabase Auth, country project: "Confirm email" on; anonymous sign-ins off; leaked-password protection on; CAPTCHA on sign-up and reset | Guest-order claiming and sign-up privacy rely on verified emails (F-16, F-24); CAPTCHA closes what per-instance limits cannot (F-04) | No |
| O3 | Supabase Auth, admin project: sign-ups off | Invitations are matched by email; an open sign-up could claim one (F-16) | No |
| O4 | Add "Lint, typecheck, test, build" and "Dependency audit" to the required checks of the `protect-main` ruleset | A failing build or a vulnerable dependency can be merged and deployed today (F-14) | No |
| O5 | Decide the open rules: order cap per account (F-10), who may mark an order delivered (F-11), second factor for staff roles (F-13), what guest tracking shows (F-12) | Each changes how staff or customers work | No |
| O6 | Edge protection: a rate-limit or WAF rule for `/login`, `/register`, `/forgot-password`, `/track-order`, `/api/*`; bot protection. One edge only: Vercel's firewall, or Cloudflare in front of Vercel, not both proxying | The limits in the code count per server instance (F-04, F-18) | No |
| O7 | Record which migrations are applied to each Supabase project in `database/migrations/README.md` | The file still calls applied migrations drafts (F-27) | No |
| O8 | A private address for security reports, then a `SECURITY.md`; enable GitHub private vulnerability reporting | Nobody outside can report a problem privately (F-26) | No |
| O9 | Enable CodeQL (free for public repositories) or agree another code scanner | No static security analysis runs (F-26) | No |
| O10 | A staging project and deployment separate from production | Changes are first seen in production | No |
| O11 | Test restoring a Supabase backup; note the date and result | Backups are assumed, not proven | No |
| O12 | Check the domain: HTTPS only, HSTS preload once every subdomain is ready, DNSSEC and CAA records at the registrar | Edge and DNS are outside the repository | No |

## C. Before a production release

From `rulesd.md` section 7, with today's state.

| Gate | State on 2026-11-21 |
|---|---|
| `main` protected, independent review | In force (as recorded in `CLAUDE.md`; not re-read from GitHub in this audit) |
| Required checks that run | Hygiene and secret scan required; build/test and dependency audit not yet (O4) |
| Secret detection | In place |
| Dependency checks | Dependabot weekly; `pnpm audit` in CI from this change |
| Code security scanning | Missing (O9) |
| Staging separate from production | Missing (O10) |
| Authentication, authorisation, country isolation tested with refusals | Unit and database tests in CI; browser suites by hand |
| Payment, POS and meter flows in a sandbox | Not built |
| Backup restore and migration recovery tested | Not recorded (O11) |
| Safe logs and monitoring, alert thresholds | Logs carry codes only; no alerting exists |
| Private security contact | Missing (O8) |
| Owner's authorisation for production and live money | Not recorded in the repository |

Until the open lines are closed the honest description of the platform is
**Ready With Limitations** for Cash on Delivery ordering and **Not Ready**
for online payments, SAP/POS and meter tokens.
