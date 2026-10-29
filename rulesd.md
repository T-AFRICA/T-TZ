# T-TZ — shared development and security rules

Applies to contributors and coding assistants working on `T-AFRICA/T-TZ`. `CLAUDE.md` imports this file. This policy does not turn on GitHub protections, security scanners, or deployment controls; verify those separately.

## 1. Branches and pull requests

- Start work on a descriptive branch such as `feat/<topic>`, `fix/<topic>`, or `docs/<topic>`.
- Keep commits and PRs focused. Do not force-push shared history, delete shared branches, or overwrite unrelated work.
- Submit changes through a PR targeting `main`; obtain at least one independent human approval before merging.
- New reviewable commits need fresh review. Resolve review discussions and run required checks before merge.
- Do not self-approve, bypass checks, disable hooks, or reduce security controls to make a change pass.
- Until GitHub enforces these protections, follow this workflow manually and explicitly disclose that enforcement is missing.

## 2. Secrets and personal information

- Never commit credentials, real `.env` files, private keys, access/recovery tokens, session cookies, database dumps, or customer/payment exports.
- Keep local secrets in ignored environment files or an approved secret store. Commit only example configuration with clearly fake placeholders.
- When adding an environment example, verify that the matching real environment files are excluded from Git; an ignore rule does not remove files already tracked.
- Never place secrets in browser bundles or public frontend environment variables, including `NEXT_PUBLIC_*`.
- Do not paste secrets into chats, PRs, screenshots, issues, telemetry, or build logs. Redact sensitive fields at their source.
- If a credential is exposed, stop using it, notify the owner through an approved private channel, and arrange revocation/rotation. Removing a line or commit alone does not invalidate a leaked credential. Coordinate any history rewrite.

## 3. Identity, authorization, and country boundaries

- Enforce authentication and authorization server-side. Hiding a button or trusting a client role is insufficient.
- Derive user, organization/store, country, and permitted operations from verified server-side identity and access rules; do not trust client-supplied scope.
- Scope reads, writes, exports, admin actions, and background jobs to the authorized resources. Test cross-user and cross-country access denial.
- Use least privilege for application/service accounts and integration credentials. Use short-lived or expiring, narrowly scoped credentials where supported.
- Use maintained authentication libraries, secure session handling, and deliberate CSRF/CORS controls for the chosen authentication model. Do not build custom cryptography.

## 4. Payments, inventory, POS, and meter tokens

- Calculate totals, discounts, taxes, inventory eligibility, and payment currency on the server. Never trust client prices or a success redirect as proof of payment.
- Represent money using integer minor units or a suitable decimal type with an explicit currency; use that currency's precision rather than assuming every currency has two decimals.
- Verify provider callbacks/webhooks using the provider's supported authentication/signature scheme. Check transaction identity, amount, currency, and allowed state transition; defend against replay.
- Make payment, refund, POS sync, and meter-token operations idempotent. Duplicate requests, callbacks, or retries must not create duplicate charges, stock movements, refunds, or token issuance.
- Use transactional or equivalent concurrency controls for stock and order state. Test simultaneous checkout, insufficient stock, retries, and reconciliation after provider timeouts.
- Track pending, confirmed, and failed external operations explicitly. A timeout is not proof of failure; reconcile before repeating an irreversible operation.
- Use provider sandboxes and synthetic test data for development. Never fabricate real meter tokens, process live charges, or issue live tokens as a test.
- Keep an access-controlled audit trail of privileged business actions using safe identifiers. Exclude credentials, full payment details, meter tokens, and unnecessary personal data from logs.

## 5. Code, data, and dependencies

- Validate request bodies, parameters, file uploads, and provider responses. Use parameterized data access; prevent injection, unsafe HTML rendering, and untrusted URL fetching.
- Define upload size/type limits and storage permissions when uploads are introduced. Treat file content and third-party data as untrusted.
- Commit reviewed dependency manifests and the project lockfile. Do not add dependencies or update unrelated packages without a task-related reason.
- Pin third-party GitHub Actions to full-length commit SHAs. Check the organization's action allowlist before adding a workflow; do not relax it to get a build running.
- Default workflow permissions to read-only and request extra permissions only for the specific job that needs them.
- Never execute untrusted pull-request code in a privileged workflow with secrets. Pay particular attention to `pull_request_target`, reusable workflows, and downloaded scripts.
- Add schema changes as reviewed migrations. Keep destructive changes, production data operations, and rollback/recovery planning explicit.

## 6. Verification and definition of done

- Run applicable formatting/lint, TypeScript checks, targeted tests, and build commands once these exist. Document missing tooling honestly.
- Add meaningful regression tests for changed business behavior. Cover authorization failures and relevant payment, inventory, currency, or country edge cases.
- For documentation-only changes, check filenames, imports/links, consistency with current repository state, and the final diff; do not invent application test results.
- Check the staged diff for credentials, accidental data, generated output, and unrelated changes before committing.
- Review dependency alerts and scanning results when available. No alerts does not prove safety, especially before application manifests exist.
- A PR should state the problem, resulting behavior, validation performed, and material limitations. Do not claim production readiness while release gates are incomplete.

## 7. Production release gates

Before the first production deployment, confirm and record:

- Enforced `main` protections, independent review, and required CI checks that actually run.
- A functioning secret-detection process, dependency checks, and code security scanning appropriate to the implemented stack.
- Production/staging separation, least-privilege deployment identity, protected credentials, and any supported deployment approvals.
- Reviewed authentication/authorization and country/currency isolation, tested with negative cases.
- Verified payment/POS/meter-provider sandbox flows, idempotency, webhook handling, and reconciliation behavior.
- Tested backup/restore and migration recovery, safe logs/monitoring, and a private security-reporting contact agreed by the owner.
- The responsible human's authorization for the production deployment and any live financial or token-issuance activity.

Do not assume that GitHub Team includes every security scanning product. Check current feature availability. Keep unresolved release gates visible rather than marking the project fully secure.
