# TRONIC threat model

Who might attack TRONIC, what they want, and what stands in their way.
Written for the system as built on 2026-11-21. Update it when a module is
added or changes what it handles (`CLAUDE.md`, "Security in every change").

Finding numbers (F-01 …) refer to `SECURITY_AUDIT_REPORT.md`.

## 1. What is worth protecting

| Asset | Where it lives | Why it matters |
|---|---|---|
| Customer accounts and sessions | Supabase Auth (country project), session cookies | Account takeover exposes orders, addresses and delivery codes |
| Customer personal data: name, phone, email, delivery address, shared location | Country database (`orders`, `customer_profiles`, `order_delivery_points`) | Privacy, physical safety, data protection law |
| Orders, prices, stock | Country database | Money and goods |
| Delivery proof: code, photo, signature, cash collected | Country database (`deliveries`, `delivery_proofs`) | The evidence that goods and cash changed hands |
| Rider positions and phone numbers | Country database (`delivery_locations`, `deliveries`) | Rider safety and privacy |
| Staff accounts, roles and grants | Admin database, Supabase Auth (admin project) | Control of every country's orders and catalogue |
| Audit log | Admin database | Accountability; must not be editable |
| Signing key of the country admin API | Admin deployment (private key), each country (public key) | Whoever holds the private key can act as any administrator in a country |
| Database and Supabase credentials | Hosting environment variables | Full access to the data |
| Payment records (when built) | Country database (`payments`, draft) | Money |

## 2. Who might attack

| Actor | Starting position |
|---|---|
| Visitor | No account; the public site and the public Supabase key |
| Registered customer | An account; can call customer functions directly |
| Dishonest rider | A rider account; sees order number, customer name, phone and address for their deliveries |
| Dishonest or compromised staff member | An Order Manager, Customer Support or Finance account, possibly password-only |
| Compromised Country Super Admin | Full control of one country |
| Third party in the supply chain | A dependency, a map tile or font provider, a GitHub Action |
| Automated abuse | Bots guessing passwords, scraping, exhausting stock or the database |

## 3. Threats and what answers them

Status: **Done** (in the code, with a test), **Partly**, **Open** (see the
finding), **Later** (the feature does not exist yet).

### Customers and visitors

| # | Threat | Answer | Status |
|---|---|---|---|
| T1 | Read another customer's orders, address or photo by changing an id | Row Level Security by `auth.uid()`; storage path is the customer's own id | Done |
| T2 | Steal a session through a script injected into a page | HttpOnly session cookies; CSP; no HTML injection points. Inline scripts are still allowed | Partly (F-15) |
| T3 | Guess a password | Attempt limits per email and client; Supabase's own limits | Partly (F-04: per server instance, no CAPTCHA) |
| T4 | Find out who has an account | Same answers for sign-in and reset | Done; sign-up depends on a Supabase setting (F-24) |
| T5 | Sign a victim into the attacker's account with a crafted email link | Only sign-up and reset links are exchanged | Done |
| T6 | Send a victim to another site after sign-in | Only same-site paths are followed | Done |
| T7 | Pay less by changing a price, total or currency in the browser | The database prices every line and refuses a total that changed | Done |
| T8 | Create duplicate orders by retrying or double-clicking | Idempotency key bound to the customer and the request | Done |
| T9 | Buy stock that is not there, or two people buy the last unit | Row locks and a non-negative stock check in one transaction | Done |
| T10 | Reserve all stock with unpaid Cash on Delivery orders | None beyond needing an account. A line may hold 500 units and the stock count is shown on the site (owner decisions 2026-11-21), so the amount to reserve is known | Open (F-10) |
| T10a | A competitor reads stock levels from the public site | Accepted by the owner: the count of products on sale is public. Counts of products not on sale stay private | Accepted |
| T11 | Exhaust the database with cheap requests | Search is limited; a checkout quote is one catalogue read | Partly (no limit on quotes or page views; needs an edge rule) |
| T12 | Track someone else's order with only its number | The number has 32 random bits and needs the checkout phone or email as well; tries per order are limited | Partly (F-12: the database itself does not count tries) |
| T13 | Follow a rider or learn a customer's location | Shown only while the order is on its way, to someone who knows the number and the contact | Partly (F-12) |

### Riders and delivery

| # | Threat | Answer | Status |
|---|---|---|---|
| T14 | Mark an order delivered without meeting the customer | The customer's six-digit code, a photo, a signature and the cash amount; five wrong codes lock the order for 15 minutes | Done once migration 0020 is applied (F-01) |
| T15 | Read the customer's code | Only the signed-in owner of the order gets it | Done in the storefront; the database half is migration 0020 (F-01) |
| T16 | Act on another rider's deliveries | Every rider function is scoped to the rider in the signed token | Done |
| T17 | Report a false position, or flood positions | Only the assigned rider, only while on the way, one point per 10 seconds | Done |
| T18 | Positions kept longer than promised | Clean-up when new points arrive | Open (F-21: not scheduled) |

### Staff and administration

| # | Threat | Answer | Status |
|---|---|---|---|
| T19 | Staff of one country reach another country's data | Country taken from the URL and checked against grants; the country checks the token's country | Done |
| T20 | Give oneself a higher role | Grant rules in the admin database; nobody changes their own account | Done |
| T21 | Take over a staff account with a stolen password | Second factor for the two super roles only | Open (F-13) |
| T22 | Close a delivery from the office, skipping the proof | None: an Order Manager can move an order to delivered | Open (F-11) |
| T23 | Change something and leave no trace | Audit entries for country changes; the log is append-only | Partly (F-17: exports and reads are not recorded) |
| T24 | A suspended or signed-out account keeps working | Status and session checked on every request | Done |
| T25 | Forge or replay a request to a country | Signed, short-lived tokens bound to the request; writes applied once | Partly (F-18: replay memory is per instance) |
| T26 | Upload a file that runs as a page | Type checked by content, fixed response type, `nosniff`, sandbox | Done for products and banners; proofs by declared type (F-20) |
| T27 | Put a formula into a CSV report | Cells that begin with a formula character are written as text | Done |
| T27a | Staff of one country read the combined figures of all countries | The page and its CSV are for a Master Super Admin only, checked on the server on every request; anyone else gets "not found" and the attempt is recorded. Each country is still asked with a signed request it checks itself | Done |
| T27b | Someone changes a US dollar rate to distort the combined reports | Only a Master Super Admin can set one (checked in the action and again in the database); the value must be a plain positive number; every change is in the audit log with the rate before and after. The rate is used for reports only: no price, charge or stored order amount depends on it | Done |
| T27c | A made-up figure is shown for a country that did not answer, or currencies are added together | A country without an answer has no figures and shows the reason; money joins a total only through that country's own rate, and a country without a rate is named and left out | Done |
| T27d | An administrator of several countries reads, on the Overview, the figures of a country where their role has no reports | The Overview asks a country only where the administrator holds `reports.read` (checked on the server before the request; the country checks it again on the signed request). A country that is not asked or does not answer is named as not counted; sales are listed per country in its own currency and never added | Done (rule: unit test; page: browser test as a Master Super Admin. No synthetic account holds roles in two countries yet, so the page itself is not browser-tested for that case) |

### Notifications

| # | Threat | Answer | Status |
|---|---|---|---|
| T40 | Read another customer's notifications, or mark them read | Row Level Security by `auth.uid()`; no insert, update or delete grant; `customer_mark_notifications_read` acts on the caller's rows only; the unread count has no parameter and answers the session | Done |
| T41 | A request creates a false notification ("your order was delivered") | Rows are written only by triggers on the real event; no role but the owner can insert | Done |
| T42 | Staff read notifications their role does not cover, or a rider reads another rider's | One audience per signed endpoint and permission; the rider audience is filtered by the administrator in the token; the console asks only for the audiences the role has | Done |
| T43 | Personal data, amounts or the delivery code leak through a notification, a badge or a log | A row holds a kind and an order or product id; the wording is in the application and names no customer; the count endpoints log no identity | Done |
| T44 | One administrator hides notifications from another, or from another country | The "seen" mark is per administrator, country and audience, taken from the signed token and the deployment's own country | Done |
| T45 | A notification trigger fails and blocks an order, a delivery or a stock change | The triggers do one insert each with values the constraints allow; every path is exercised by the order, delivery, inventory and notification tests. A fault would stop the event rather than record it wrongly | Accepted |
| T46 | The notification tables grow without limit | Lists read the newest 50 (customers) or 30 days (staff). Nothing removes old rows | Open (F-30) |
| T47 | A made-up or hostile value is sent as the checkout's WhatsApp number or its country code | The browser's result is never used: the server works the number out again from what was typed and a country code that must be one from the list (anything else is treated as none), and keeps only `+<country code><number>`, 9 to 15 digits; the database checks the same pattern again. A Tanzanian number must be a mobile one. The number is still personal data and is shown only where the order's phone already was | Done (unit and browser tests). The number is not verified to be the customer's or to be on WhatsApp (F-33) |
| T48 | The "Message on WhatsApp" link is used to send a customer's data, or the console's address, to an outside site | Shown only to people who already see the number (staff with the order, the rider with the delivery). The address is `https://wa.me/` plus the digits of a number in the international form, built on the server; any other value gives no link. No message text or order number is in it, and it opens in a new tab with no referrer and no access to the console's window | Done (unit and browser tests). What is then written in WhatsApp is outside the console (F-33) |

### Platform and supply chain

| # | Threat | Answer | Status |
|---|---|---|---|
| T28 | A known vulnerability in a dependency | Dependabot (minor and patch), `pnpm audit` in CI | Done (the check is not yet a required one, F-14) |
| T29 | A credential committed to the public repository | Ignore rules, hygiene check, Gitleaks on all history | Done |
| T30 | A secret shipped in a browser bundle | Server-only variables; admin bundle scan | Done for the admin; no guard import in the storefront (F-23) |
| T31 | A failing or unreviewed change reaches production | One independent approval is enforced; the build and test job is not required | Open (F-14) |
| T32 | A tampered GitHub Action or scanner image | Pinned SHAs and digest, read-only permissions | Done |
| T33 | A leaked database or service credential | Least privilege where set; `service_role` can still write orders and stock directly | Open (F-22) |
| T34 | Lost data | Supabase backups | Not verified: no restore test is recorded |

### Not built yet

| # | Threat | Needed when built |
|---|---|---|
| T35 | Forged "payment succeeded" | Verify the gateway's signature; check amount, currency, reference and state; apply each event once (draft `0007_payments.sql` has the records) |
| T36 | Card data in TRONIC's systems | Hosted checkout or the gateway's own fields; never store card numbers or CVV |
| T37 | Refund abuse | A separate permission, a reason and an audit entry |
| T38 | SAP or POS credentials reachable from the website | Website → backend → integration service → SAP/POS, each with its own identity; idempotent stock and order messages; reconciliation |
| T39 | Meter tokens issued twice or to the wrong meter | Idempotent issuance, reconciliation after timeouts, no tokens in logs (`rulesd.md` section 4) |

## 4. Assumptions this model depends on

These are settings outside the repository. They are owner actions and are
listed in `SECURITY_CHECKLIST.md`:

- Supabase Auth, country project: "Confirm email" on, anonymous sign-ins
  off, leaked-password protection and CAPTCHA as available.
- Supabase Auth, admin project: sign-ups off.
- Every migration through 0020 applied to the country database.
- Environment variables set only in the hosting project, separately for
  each environment.
- The signing key's private half exists only in the admin deployment.
