# CRM Hub: Phase 1 Technical Assessment

Source analysed: `crm-hub-google-cloud.zip` (Abacus AI export, Google Cloud hand-off package), 2 Nov 2026. Re-checked the same day against the copy pulled from git (identical; see §1 item 5), and against the written VS Code review (consolidated in §9).
Method: read all config, deployment scripts, Prisma schema and all 20 API route handlers; installed dependencies; ran a TypeScript type-check (0 errors). A full `next build` couldn't finish in the analysis sandbox because its network blocks Google Fonts and Prisma engine downloads. That's a sandbox limit; Cloud Build has open internet.

## 1. Headline findings

1. **The app is portable.** It's a standard Next.js + PostgreSQL app in Docker. It has no Abacus runtime, database, authentication or AI dependency. It will run on GCP, AWS or Azure.
2. **The code is a much narrower CRM than the project brief describes.** The code has no quotations, confirmations, contracts or agreements. It has no PDF generation, no file uploads, no email sending and no scheduled jobs. **Confirmed 2 Nov 2026: all of these are needed at go-live** (see §8). That makes a development phase necessary before production, and adds object storage and an email service to the hosting design.
3. **It's already packaged for Google Cloud** (Cloud Run + Cloud SQL + Secret Manager + Cloud Build), with an idempotent one-command installer.
4. **Fix the security defects before production.** The two most serious are an unauthenticated Google OAuth callback and no record-level permissions. A second, independent review in VS Code confirmed these and found more (consolidated in §9).
5. **Git and the VS Code working copy have diverged.** The copy pulled from git on 2 Nov 2026 is identical to the Google Cloud hand-off zip: the same 20 routes and package versions, a single `0_init` migration, all files dated 28 Oct 2026, and none of the §9 defects fixed. The VS Code working copy has extra files that aren't in git: Render deployment scripts (`migrate-local-to-render.ps1`, `update-render-db.ps1`), demo-data seed scripts and a second `.env` example. The git export also has no `.git` folder, so commit history couldn't be reviewed. **Before any deployment work:** decide which copy is authoritative, commit it to git, and confirm whether the target is Google Cloud Run or Render.

## 2. Technology stack (facts from code)

| Area | Finding |
|---|---|
| Frontend | Next.js 16.4.1 (App Router), React 19.2, Tailwind 3.4, shadcn/ui (Radix) |
| Backend | Same Next.js app. 20 REST/JSON route handlers under `/api/*`. Single full-stack container |
| Language / runtime | TypeScript 5.6, Node.js 22 (`node:22-bookworm-slim`; engines >=20.9), Yarn 4.13 |
| Database | PostgreSQL 16 through Prisma ORM 6.7. 10 tables, one migration (`0_init`) |
| Auth | Auth.js / NextAuth v5 **beta.32**. JWT sessions. Email+password (bcrypt, cost 12) and Google sign-in. Roles: `ADMIN`, `SALES_REP` |
| Data model | Users, Contacts, Companies, Deals (7-stage pipeline), Activities (call/email/meeting/note/task), Transactions (payment/invoice/refund records: amount + status only), Pipeline stages |
| Reporting | One dashboard (KPIs, pipeline funnel/value) using a bundled ECharts-based "abacus-viz" runtime, served as static files |
| Integrations | Google Sheets + Drive API (writes contacts, deals and transactions to sheets in a "CRM Data" folder). Google OAuth |
| File storage | **None.** No uploads, and nothing written to disk. `@aws-sdk/client-s3` and `@azure/storage-blob` are installed but never imported |
| Email | **None.** "EMAIL" is only an activity type for logging |
| PDF / documents | **None** |
| Background jobs | **None.** Sheet sync runs inside the user's request. `crm-migrate` is a deploy-time job only |
| Port / state | Listens on 8080. Stateless (sessions are JWT cookies), so it scales horizontally |
| Outbound network | accounts.google.com, oauth2.googleapis.com, sheets/drive googleapis.com. At build time: fonts.googleapis.com |
| Docker | Yes. Multi-stage: `runner` (web) and `migrator` (prisma migrate + seed) |
| CI/CD | `cloudbuild.yaml`: build → push → run migration job → deploy. Migrations gate the release |

**Hosting profile:** one Node.js container plus managed PostgreSQL. No VM, Kubernetes, PHP or Python needed. Serverless containers (Cloud Run / ECS Fargate / Azure Container Apps) fit best.

## 3. Brief vs. code

| Brief requirement | In code? |
|---|---|
| Web CRM, multi-user, roles | Yes, but only 2 roles, and they don't restrict data access (see §9.1) |
| Secure auth and sessions | Yes, with defects (§9.1) |
| Customer and company records | Yes |
| Quotations / confirmations / contracts / agreements | **No** |
| Invoicing | **Partly.** Transaction records typed INVOICE. No invoice documents, numbering or tax |
| PDF generation | **No** |
| File uploads | **No** |
| Email notifications | **No** |
| Database | Yes (PostgreSQL) |
| API integrations | Google Sheets/Drive only. No public or partner API, no API keys |
| Admin dashboard | User management and pipeline stages only |
| Reporting and analytics | One dashboard. Sheets export for ad-hoc reporting |
| Mobile app readiness | JSON APIs exist, but they're cookie-session only, with no token auth or versioning |

## 4. Abacus AI dependencies

| Item | Impact | Action |
|---|---|---|
| `app/layout.tsx` loads `https://apps.abacus.ai/chatllm/appllm-lib.js` on every page | A third-party script running inside the CRM with full page access. It's a security and privacy exposure, and an outage dependency | **Remove before go-live** |
| `instrumentation-client.js` sends client errors to `/__abacus/client-error` | Returns 404 outside Abacus. Harmless, but errors go nowhere | Remove; replace with Sentry or Cloud Error Reporting |
| `/public/abacus-viz/*` dashboard runtime | Self-contained static JS/CSS. No calls to Abacus | Keep. Delete the sample `components/viz/examples` |
| `allowedDevOrigins` preview hostname | Dev-only | Optional clean-up |
| Unused SDKs (AWS S3, Azure Blob, plotly, mapbox) | Larger image only | Optional clean-up |

There's no Abacus database, authentication or AI dependency, so migration risk is low.

## 5. Security findings (first pass)

> Superseded by the consolidated list in §9.1, which adds findings from the VS Code review. Kept here for reference.

| # | Severity | Finding | Fix |
|---|---|---|---|
| 1 | **High** | `/api/google/callback` has no login check and no OAuth `state`. Anyone can run Google consent with their own account against the app's (public) client ID and land on this callback. That **overwrites the stored token**, and from then on contacts, deals and transactions sync to the attacker's Drive | Require an admin session in the callback. Add a `state` value bound to the session |
| 2 | **High (business)** | No record-level authorization. Any `SALES_REP` can view, edit and **delete** every contact, company, deal, activity and transaction. Any user can trigger a full Sheets re-sync | Define the permission model, then enforce owner/role checks in the API |
| 3 | Medium | Deactivating a user doesn't end open sessions. JWTs last up to the Auth.js default of 30 days, so a leaver keeps access | Re-check `user.active` in the jwt callback and shorten `maxAge` |
| 4 | Medium | Password login has no rate limiting, lockout or MFA | Rate-limit `/api/auth/*` (app or WAF). Prefer Google sign-in with Workspace MFA |
| 5 | Low | Any user can list all users; `allowDangerousEmailAccountLinking` (acceptable while admins pre-create users); `ignoreBuildErrors: true`; NextAuth is a beta release; Google tokens stored unencrypted in the DB | Tidy up in the hardening sprint |
| 6 | Governance | Customer personal data (contacts) is copied to a Google Drive account outside the database's access controls | Use a company-owned Workspace account. Cover it in the PDPA data map |

Already good: no secrets in the repo or images, Secret Manager, a runtime service account with near least-privilege access, Cloud SQL deletion protection, daily backups (14 kept) plus point-in-time recovery, admin-only signup by default.

## 6. Deployment configuration issues (GCP)

- **Region defaults to us-central1.** Set `REGION="asia-southeast1"` in `deploy/config.env`.
- **Custom domain:** Cloud Run's built-in domain mapping is supported in asia-southeast1, but Google labels it **Preview and "not recommended for production services."** Use a global external Application Load Balancer with a serverless NEG. That also enables Cloud Armor. It adds a recurring cost, which goes into Phase 4.
- **DB connections:** `connection_limit=5` per instance × `max-instances=5` = 25, plus the migration job. Size the Cloud SQL tier for this. Avoid `db-f1-micro` in production: it's shared-core with no SLA and a low connection ceiling. Use the script default, `db-custom-1-3840`.
- **Sheet sync is synchronous.** Each save reads the sheet's whole ID column and then writes. Saves will slow as row counts grow into the tens of thousands. That's fine at Scenario A scale; at Scenarios B/C, move it to a queue (Cloud Tasks).
- `min-instances=0` means cold starts. Set it to 1 for business hours if latency matters.
- No staging environment, monitoring alerts or uptime checks are scripted.
- The README's cost figures (Cloud SQL ~USD 50 or ~USD 10 a month) are unverified list prices for us-central1. Re-price for Singapore in Phase 4.

## 7. Cloud compatibility

| Provider | Fit | Notes |
|---|---|---|
| **GCP** | Native | Scripts, Cloud SQL socket, Secret Manager and Cloud Build are ready. The Google Sheets/OAuth integration is same-vendor |
| AWS | Compatible | ECS Fargate (or App Runner) + RDS PostgreSQL + Secrets Manager. Deploy scripts need rewriting. DATABASE_URL switches to TCP/SSL. Google APIs are reached over the internet |
| Azure | Compatible | Container Apps + Azure Database for PostgreSQL Flexible Server + Key Vault. Same rewrite effort as AWS |

## 8. Decisions (answered 2 Nov 2026) and their implications

| # | Question | Answer | Implication |
|---|---|---|---|
| 1 | Must quotations, contracts, PDF generation, file uploads and email notifications exist at go-live? | **Yes, and storage is needed** | A development phase before go-live (see 8.1). Adds Cloud Storage and a transactional email service to the architecture |
| 2 | Does the company use Google Workspace? | **No.** Price requested | Google sign-in and the Sheets log need a published "External" OAuth app (see 8.2). Workspace is optional |
| 3 | Which domain will the CRM use? | **To be determined** | Blocks production go-live: the OAuth redirect URIs, the load balancer certificate and the email sender domain (SPF/DKIM) all depend on it. Staging can run on the default `run.app` URL meanwhile |
| 4 | Should sales reps see all records? | **No. Reps see only their own; Admin and Manager see all** | Add a new `MANAGER` role (the code has only `ADMIN` and `SALES_REP`). Enforce owner checks in every API route (see 8.3) |
| 5 | Separate staging environment from day one? | **Yes, with production on a separate setup** | Two Google Cloud projects, `crm-staging` and `crm-prod`, each with its own database, secrets and service accounts. `deploy.sh` already supports this (one `config.env` per project) |

### 8.1 Development scope now required (before hosting)

- **Data model:** quotations, confirmations, contracts/agreements and invoices, with line items, numbering, tax (GST), statuses, and links to company/contact/deal.
- **PDF generation:** server-side templates for quotation, confirmation, contract and invoice. A headless-Chromium renderer needs about 2 GiB of memory per Cloud Run instance; a pure-JS renderer such as `@react-pdf/renderer` fits in 1 GiB.
- **File uploads:** a private Cloud Storage bucket (asia-southeast1) with signed upload/download URLs. Files never pass through the app's disk. Add size and type limits and per-record access checks.
- **Email notifications:** Google Cloud has no first-party transactional email service. Options: SendGrid, Mailgun or Postmark, Amazon SES called from GCP, or the Google Workspace SMTP relay if Workspace is bought. Needs a sender domain with SPF, DKIM and DMARC, so it depends on Q3.
- **Background work:** move Sheets sync and email sending out of the user's request into Cloud Tasks.
- Size the effort and cost in Phase 5. This is likely the largest single cost item, larger than the hosting setup.

### 8.2 Google Workspace: price and whether you need it

Official Singapore list prices per user per month ([source](https://workspace.google.com/intl/en_sg/lp/business/)), before GST:

| Plan | Flexible (monthly) | Annual commitment | Storage per user | 5 users / month (annual) | 10 users / month (annual) | 20 users / month (annual) |
|---|---:|---:|---|---:|---:|---:|
| Business Starter | S$11.20 | S$9.40 | 30 GB | S$47 | S$94 | S$188 |
| Business Standard | S$22.40 | S$18.80 | 2 TB | S$94 | S$188 | S$376 |
| Business Plus | S$35.20 | S$29.40 | 5 TB | S$147 | S$294 | S$588 |

**Workspace is not required for the CRM to work.** Without it:
- Email + password login works as it does today.
- For Google sign-in and the Sheets log, publish the OAuth app as "External / In production". The 7-day token expiry applies only to apps left in "Testing".
- The `spreadsheets` scope is sensitive and triggers Google's verification review, which can take weeks. Recommended code change: request only `drive.file`. The Sheets API accepts it for files the app created, and it's non-sensitive, so no verification is needed. Confirm in staging.
- The Sheets log then lives in a personal Gmail account. A company-owned account is the minimum for data ownership and PDPA.

**Reasons to buy anyway:** company email on your domain (also usable as the CRM's email sender via SMTP relay), an "Internal" OAuth app with no verification, Workspace-enforced MFA for Google sign-in, and company-owned Drive storage for the Sheets log. If bought, Business Starter covers the CRM's needs. The AI email assistant (§10) also needs a real company mailbox, from either Workspace or Microsoft 365.

### 8.3 Permission model to implement

| Role | Own records | Others' records | User management | Settings / Google connect |
|---|---|---|---|---|
| `SALES_REP` | View, create, edit | None | No | No |
| `MANAGER` (new) | All | View all (edit/delete: **to confirm**) | No (**to confirm**) | No |
| `ADMIN` | All | All | Yes | Yes |

- Ownership: contacts, companies and deals use `ownerId`; activities use `creatorId`. Transactions have no owner, so they inherit from their deal or contact. Quotations, contracts, invoices and files will need `ownerId` from the start.
- Apply the filter to list, detail, update and delete routes, and to the dashboard totals, so reps see only their own figures.
- **Open:** may reps delete their own records, or only admins? Can managers edit, reassign or delete reps' records?

### 8.4 Environments

| | Staging (`crm-staging` project) | Production (`crm-prod` project) |
|---|---|---|
| Cloud Run | min 0 instances, default `run.app` URL | min 0–1, custom domain via load balancer |
| Cloud SQL | `db-f1-micro`, no HA, 7 backups | `db-g1-small` (5–10 users) or `db-custom-1-3840` (20 users), 14 backups + point-in-time recovery |
| Data | Test or anonymised data only, never a production copy (PDPA) | Live |
| Access | Developers + testers | Admins and end users. Developers have no standing database access |
| Release | Every merge to `main` deploys automatically | Promote the same image tag after UAT sign-off |

Staging adds roughly US$10–15 (S$13–19) a month, mostly the small database. That's an estimate to confirm in Phase 4.

### 8.5 Still open

1. Domain name and who registers it (needed before production go-live).
2. Buy Google Workspace or not (§8.2).
3. Reps' delete rights, and managers' edit and user-management rights (§8.3).
4. Templates and business rules for quotations, contracts and invoices: numbering format, GST treatment, approval steps, e-signature needed?
5. Expected email volume per month, and upload volume and maximum file size, to size storage and email costs.
6. Which codebase is authoritative (git or the VS Code working copy), and whether the deployment target is Cloud Run or Render (§1 item 5).

## 9. Consolidated code review (2 Nov 2026)

This section merges this assessment with an independent Claude review run in VS Code on the working copy. That review's full written report was ingested on 2 Nov 2026, and each claim was re-checked against the git copy. **Verified** means confirmed in the git copy. **Differs** means it's in the VS Code copy only.

### 9.1 Security

| # | Finding | Severity | Verified |
|---|---|---|---|
| S1 | No record-level access control. `ownerId` is stored but never enforced, so any `SALES_REP` can read, edit and delete every contact, company, deal, activity and transaction. Only user management, pipeline stages and Google connect check for `ADMIN` | High | Yes |
| S2 | Mass assignment and no input validation. Request fields go straight into Prisma: a rep can set `ownerId` to anyone, `parseFloat` can store `NaN`, and enums and email formats aren't checked. `zod` is installed but unused | High | Yes (e.g. `deals/route.ts`, `contacts/[id]/route.ts`) |
| S3 | Google OAuth callback: no `state` (CSRF), no admin check, and one org-wide token shared by everyone. An outsider can replace the token and receive all synced data. Tokens are stored in plaintext in `GoogleOAuthToken` | High | Yes |
| S4 | `allowDangerousEmailAccountLinking: true`. With open signup (`DISABLE_PUBLIC_SIGNUP` not `true`), someone can pre-register a victim's email and get linked to their Google sign-in. That's an account-takeover risk | High if signup is open; Medium otherwise | Yes |
| S5 | Sessions outlive deactivation and demotion. `active` is checked only at login, the JWT lasts 30 days, and `role` is cached in the token | Medium | Yes |
| S6 | No password-strength rule, no email normalisation (case or trim) at signup, and no rate limiting or lockout on login or signup, so credentials can be brute-forced | Medium | Yes |
| S7 | `GET /api/settings/users` exposes every user's email and role to any logged-in user | Medium | Yes |
| S8 | No `middleware.ts`/`proxy.ts`, no security headers (CSP, HSTS, frame options) and no CSRF protection beyond `SameSite=Lax` cookies. Every route depends on remembering to call `auth()` | Medium | Yes |
| S9 | A third-party Abacus script (`apps.abacus.ai/chatllm/appllm-lib.js`) loads on every page | Medium | Yes |
| S10 | No audit trail of who changed what, and when | Medium | Yes |

### 9.2 Data integrity

| # | Finding | Verified |
|---|---|---|
| D1 | Money stored as `Float` (deal value, transaction amount, annual revenue). Causes rounding errors; no currency field. Use `Decimal` or integer cents | Yes |
| D2 | Hard deletes, no soft delete. Deleting a contact either fails on foreign keys or orphans related data | Yes |
| D3 | Two sources of truth for stages: the `DealStage` enum and the `PipelineStage` table. The enum has both `PROPOSAL` and `PROPOSAL_SENT` | Yes |
| D4 | Dashboard "won/lost this month" filters on `updatedAt`, so editing an old won deal moves it into this month. Needs `closedAt` | Yes |
| D5 | No duplicate detection or unique constraint on contact/company email | Yes |
| D6 | `probability` isn't tied to stage, and stage changes aren't validated | Yes |
| D7 | Transactions have no company link, currency, invoice number or GST | Yes |
| D8 | Each contact has one company and one owner; deals have no multi-contact roles | Yes |

### 9.3 Scalability and performance

| # | Finding | Verified |
|---|---|---|
| P1 | No pagination. Lists stop at 200 (contacts, companies, transactions, activities) or 500 (deals), with no cursor or total count. Search and filtering are client-side | Yes |
| P2 | Google Sheets sync runs inside the user's request, so every save waits on an external API and fails if Google is slow. The full sync loops one record at a time and caps at 500 contacts and 500 deals | Yes |
| P3 | No caching. The dashboard runs 7 queries per load | Yes |

### 9.4 Missing features

| Area | Gap |
|---|---|
| Documents | Quotations, contracts, invoices, products and line items, PDF generation, file attachments (S3 and Azure SDKs installed but unused) |
| Communication | Email send, log and sync; calendar sync; reminders and notifications; workflow automation |
| Data handling | CSV import/export (the `csv` package is installed but unused), bulk actions, saved views, custom fields, duplicate merge |
| Structure and reporting | Teams and territories, forecasting, reports beyond the single dashboard |
| Integration | API keys and webhooks for other systems or a mobile app |

### 9.5 Code quality and operations

| # | Finding | Verified |
|---|---|---|
| Q1 | No tests (unit, integration or end-to-end). No CI beyond `cloudbuild.yaml`. `ignoreBuildErrors: true` | Yes |
| Q2 | Heavy use of `any` (63 occurrences, e.g. `where: any`, `catch (err: any)`, `(user as any).role`) and no shared API types | Yes |
| Q3 | Dependency bloat: swr and react-query; formik, react-hook-form, yup and zod; plotly, recharts, chart.js and abacus-viz; plus mapbox-gl, webpack, AWS S3 and Azure Blob SDKs, all unused. Larger bundle and supply-chain exposure. `components/viz/examples/india_story` is unrelated demo content | Yes |
| Q4 | Duplicate files (`components/ui/use-toast.ts` and `hooks/use-toast.ts`). next-auth is pinned to a beta. Every page fetches client-side through a `*-client.tsx`, so server rendering benefits are lost | Yes. The two `.env` examples are **differs** |
| Q5 | Observability: only `console.error`. No structured logs, error tracking or health endpoint. API error responses are generic ("Failed to create company"), which makes support harder | Yes |
| Q6 | Operations: one `0_init` migration. The seed scripts with dummy data and the Render migration scripts suggest the deploy target is changing with no single documented path. The VS Code review found no documented backup or restore plan | **Differs.** The git copy has only `seed-production.ts`, and its README §7 documents the Cloud Run path with backups and restore. Carry that README over to whichever copy is chosen |
| Q7 | No accessibility review, localisation or timezone handling. Mobile layout unreviewed | Yes |

### 9.6 Improvement plan (merged)

**Phase 1: Fix before go-live (security and correctness)**
1. A central `proxy.ts` plus an `authorize(session, resource)` helper that enforces ownership and role. Add the `MANAGER` role (decision Q4).
2. Zod schemas on every API route, with field whitelists. Users can't set `ownerId` unless they're a manager or admin.
3. Admin-only `GET /api/settings/users`. Add `state` and an admin check to the Google callback, and encrypt stored tokens.
4. Remove `allowDangerousEmailAccountLinking`. Normalise emails, add password rules and rate-limit login and signup. Keep `DISABLE_PUBLIC_SIGNUP=true`.
5. Re-check `active` and `role` from the database on each request, or use a short JWT expiry.
6. Money as `Decimal`, plus `closedAt`, `currency` and GST fields. Remove the stage duplication.
7. Security headers. Remove the Abacus script and error hook.
8. An audit log table (who changed what, and when). The VS Code review places this in Phase 2. It stays in Phase 1 here because the AI email assistant (§10) and PDPA accountability both depend on it.
9. **Confirm the authoritative codebase and the deployment target** (Cloud Run vs Render), and commit it to git.

**Phase 2: Stabilise (first 1–3 months)**

10. Server-side pagination, search and sort.
11. Move the Sheets sync to a queue (Cloud Tasks) or cron job (Cloud Scheduler).
12. Soft delete.
13. Tests for auth and permissions plus API contract tests. CI to lint, type-check, test and build. Turn off `ignoreBuildErrors`.
14. Remove unused dependencies and standardise on one library each for data fetching, forms and charts. Delete the demo content and duplicate files.
15. Structured logging, error tracking and a health endpoint.

**Phase 3: Product value**

16. Quotations, contracts and invoices with line items and PDFs; file attachments on one storage provider (Cloud Storage). *Confirmed as required at go-live (decision Q1), so this is scheduled in parallel with Phase 1.*
17. Email sending, task reminders and notifications. Gmail and Calendar integration.
18. The AI email assistant (§10).
19. CSV import/export and duplicate merge; custom fields, saved views, bulk actions; forecasting reports.

## 10. New requirement: AI assistant for email and activity monitoring

**Requirement (2 Nov 2026):** an AI bot that checks email, responds, and monitors all CRM activities.

**Proposed scope**
1. **Ingest.** Watch a shared mailbox (and optionally each rep's mailbox). Match each email to a contact by sender address, log it as an `EMAIL` activity on the contact or deal, and store attachments in Cloud Storage. Unmatched senders go to a review queue.
2. **Understand.** Classify each email (enquiry, quote request, complaint, payment, other), summarise it, extract action items and dates, and suggest the next step.
3. **Respond.** Draft replies using CRM context (open deal, past emails, quotation status) for a rep to approve. Auto-send only safe acknowledgements, if at all.
4. **Monitor.** A daily job flags emails unanswered after 24 hours, overdue tasks, deals idle for X days, and quotations awaiting a reply. Reps get a digest; managers get a team summary.

**Architecture (Google Cloud):** Gmail API push (or the Microsoft Graph API) → Pub/Sub → Cloud Run worker → Cloud Tasks → AI model API (Vertex AI or the vendor directly) → PostgreSQL. Cloud Scheduler runs the daily checks.

**Fit with the existing code:** the `Activity` model already has an `EMAIL` type and links to contact, company and deal, and `Contact.email` is indexed for sender matching. Schema additions:
- `Activity`: `direction`, `messageId`, `threadId`, `fromEmail`, `aiSummary`, `aiCategory`, `draftReply`.
- A new `EmailAccount` table for mailbox connections, with encrypted tokens.
- A new `AiAction` table that audits every AI suggestion and every human approval.

**Implications**
- A real company mailbox is needed, which makes Google Workspace (S$9.40 per user a month on Business Starter) or Microsoft 365 effectively required.
- PDPA: customer emails go to an AI provider. Choose one that doesn't train on your data, confirm the processing region, and update the privacy notice.
- Running cost: about 2,000 emails a month is roughly 7 million tokens. Likely tens of US dollars a month; to be priced once the model is chosen.
- Build effort (rough): 18–28 developer days.
  - Mailbox connection and matching: 4–6 days
  - AI classify, summarise and draft: 5–8 days
  - Approval screen: 3–5 days
  - Monitor and digests: 3–4 days
  - Security and testing: 3–5 days
- Depends on the Phase 1 security fixes (record-level access, audit log) and the email-sending work.

**Open questions:**
1. Shared mailbox only, or each rep's inbox too?
2. Gmail or Outlook?
3. May the AI ever send replies without a person approving them?
4. Which activity checks matter most?
