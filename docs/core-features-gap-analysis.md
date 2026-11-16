# CRM Hub: Core Features, Gap Analysis and Improvements

Prepared 2 Nov 2026. Based on the git copy of the code (see `phase1-technical-assessment.md`) and the business requirements confirmed so far.

**Basis.** "Core features" are what this company needs from its CRM, given the brief: customer management, quotations, confirmations, contracts and agreements, invoicing, and internal admin. This is a quote-to-cash CRM, not just a sales pipeline. Effort figures are rough developer-day estimates, to be refined in the Phase 5 implementation costing.

**Priority key**
- **Must:** needed at go-live (confirmed by you, or needed for security or legal reasons).
- **Should:** within 1–3 months of go-live.
- **Could:** when the business grows.

## 1. Summary

The current CRM covers about one third of what the business needs. The **sales front end** (contacts, companies, deals pipeline, activities, dashboard) is in place but basic. The **quote-to-cash back end** (products, quotations, confirmations, contracts, invoices, PDFs, file attachments, outgoing email) **doesn't exist yet**, and you've confirmed it's needed at go-live. Security and data-integrity fixes are also required before any live customer data goes in.

| Module | Status today | Gap | Priority |
|---|---|---|---|
| 1. Customer records (contacts, companies) | Built, basic | Medium | Must (fixes), Should (extras) |
| 2. Sales pipeline (deals) | Built, basic | Medium | Must (fixes), Should (forecasting) |
| 3. Products and price list | **Missing** | Full | Must |
| 4. Quotations | **Missing** | Full | Must |
| 5. Confirmations (sales orders) | **Missing** | Full | Must |
| 6. Contracts and agreements | **Missing** | Full | Must |
| 7. Invoices and payments | Record-keeping only | Large | Must |
| 8. Documents, PDFs and file attachments | **Missing** | Full | Must |
| 9. Email and notifications | **Missing** | Full | Must |
| 10. Activities and tasks | Built, basic | Small–medium | Should |
| 11. Users, roles and security | Built, with serious defects | Large | Must |
| 12. Reporting and analytics | One dashboard | Large | Should |
| 13. Admin settings | Users and stages only | Medium | Must |
| 14. Integrations | Google Sheets only | Medium | Should |
| 15. AI email and activity assistant | **Missing** | Full | Should (after go-live) |
| 16. Data governance (PDPA) | Partly (backups) | Medium | Must |

## 2. Gap analysis by module

### 1. Customer records

**Have:** contacts (name, email, phone, job title, address, lifecycle stage Lead/Prospect/Customer/Churned, tags, notes, owner, one company) and companies (name, industry, website, phone, address, employees, revenue, owner). List, detail, create, edit and delete screens.

| Gap | Why it matters | Priority | Effort |
|---|---|---|---|
| Billing and delivery addresses as separate structured fields (address is one text field today) | Invoices and quotations need a proper billing address | Must | 1 day |
| Company UEN and GST registration number fields | Expected on Singapore B2B quotations and tax invoices | Must | 0.5 day |
| Duplicate detection and merge; unique email check | Duplicates split history and corrupt reports | Should | 2–3 days |
| CSV import and export | Loading existing customer lists at go-live | Must (import) | 2–3 days |
| Custom fields | Industry-specific data without code changes | Could | 4–6 days |
| A contact linked to more than one company | Consultants, group companies | Could | 2 days |
| Soft delete (archive) instead of permanent delete | Deletes currently fail or orphan data | Should | 2 days |
| Server-side search, filters and pagination (lists stop at 200) | Records beyond 200 become invisible | Should | 3–4 days |

### 2. Sales pipeline

**Have:** deals with value, stage (7 stages), probability, close date, owner, contact and company; Kanban board; configurable pipeline stage table.

| Gap | Why it matters | Priority | Effort |
|---|---|---|---|
| Single source of stages (enum and table conflict; duplicate PROPOSAL / PROPOSAL_SENT) | Wrong counts and broken stage changes | Must | 1–2 days |
| `closedAt` date and lost reason | "Won this month" is wrong today; lost-reason analysis | Must | 1 day |
| Money as Decimal with currency | Float causes rounding errors on amounts | Must | 1–2 days |
| Probability set by stage; validated stage moves | Reliable forecast | Should | 1 day |
| Deal line items (from product list) feeding the quotation | Deal value comes from what's actually quoted | Must | Part of module 4 |
| Several contacts on a deal, with roles (decision-maker, finance) | B2B deals involve several people | Could | 2–3 days |
| Forecast by month and by rep | Management planning | Should | 3–4 days |

### 3. Products and price list (missing)

| Feature | Priority | Effort |
|---|---|---|
| Product and service catalogue: code, name, description, unit, unit price, GST applicable, active flag | Must | 2–3 days |
| Price changes don't alter quotations already issued (prices are copied onto each line) | Must | Included |

### 4. Quotations (missing)

| Feature | Priority | Effort |
|---|---|---|
| Quotation linked to deal, company and contact; auto-numbering (e.g. `Q-2026-0001`) | Must | 6–9 days for this whole module |
| Line items: product, description, quantity, unit price, discount, line total | Must | |
| Subtotal, GST (currently 9% in Singapore) and grand total; validity date; payment terms; terms and conditions | Must | |
| Statuses: Draft → Sent → Accepted / Rejected / Expired | Must | |
| Revisions (Rev A, Rev B) keeping earlier versions | Must | |
| Internal approval above a discount or value threshold | Should (confirm rule) | +2 days |
| One click: accepted quotation → confirmation → invoice | Must | Included in modules 5 and 7 |

### 5. Confirmations / sales orders (missing)

| Feature | Priority | Effort |
|---|---|---|
| Created from an accepted quotation, with numbering; customer PO number and date | Must | 2–3 days |
| Record of customer acceptance (signed copy uploaded, or accepted by email) | Must | Included |

### 6. Contracts and agreements (missing)

| Feature | Priority | Effort |
|---|---|---|
| Contract record: type, parties, start and end dates, value, status (Draft / Active / Expired / Terminated), linked to company and deal | Must | 4–6 days |
| Templates with merge fields (customer name, dates, amounts) | Must | Included |
| Signed copy upload and version history | Must | Included |
| Renewal and expiry reminders (e.g. 60 and 30 days before) | Should | 1–2 days |
| Electronic signature (e.g. DocuSign or a similar provider) | Could (confirm) | 2–4 days plus subscription |

### 7. Invoices and payments (record-keeping only)

**Have:** a "transaction" record of type Payment / Invoice / Refund with amount, date and status. No invoice document, numbering, line items or tax.

| Gap | Priority | Effort |
|---|---|---|
| Invoice created from a confirmation or quotation; auto-numbering; due date from payment terms | Must | 6–9 days for this whole module |
| Tax-invoice content if the company is GST-registered (confirm the IRAS requirements with your accountant) | Must | |
| Partial payments recorded against an invoice; outstanding balance; status Unpaid / Part-paid / Paid / Overdue | Must | |
| Credit notes and refunds against an invoice | Should | +2 days |
| Accounts-receivable ageing (0–30 / 31–60 / 61–90 / 90+ days) | Should | Included in module 12 |
| Decide: is the CRM the official invoicing system, or does it hand invoices to accounting software (Xero, QuickBooks)? | **Decision needed** | Changes scope |

### 8. Documents, PDFs and file attachments (missing)

| Feature | Priority | Effort |
|---|---|---|
| Branded PDF templates for quotation, confirmation, contract and invoice (logo, letterhead, bank details) | Must | 4–6 days |
| File attachments on any customer, deal, quotation, contract or invoice, in private Cloud Storage with access checks, size and type limits | Must | 3–4 days |
| Every generated PDF saved against the record (a copy of exactly what was sent) | Must | Included |

### 9. Email and notifications (missing)

**Have:** "EMAIL" exists only as an activity type for typing notes manually.

| Feature | Priority | Effort |
|---|---|---|
| Send a quotation, invoice or contract by email from the CRM with the PDF attached; logged automatically as an activity | Must | 4–6 days |
| Email templates (quotation cover note, invoice, payment reminder) | Must | Included |
| In-app and email notifications: task due, deal assigned to you, quotation accepted, invoice overdue | Must | 2–3 days |
| Automatic overdue-invoice reminders to customers | Should | 1–2 days |
| Sender domain set up (SPF, DKIM, DMARC). Depends on the domain decision | Must | 0.5 day |

### 10. Activities and tasks

**Have:** call, email, meeting, note and task records with date, duration, outcome, due date and completed flag, linked to contact, company or deal.

| Gap | Priority | Effort |
|---|---|---|
| Assign a task to another user (only a "creator" exists today) | Should | 1 day |
| Reminders before due dates; "My tasks today" view | Should | 2 days |
| Calendar sync (Google or Outlook) | Could | 3–4 days |
| Activity timeline on each customer that also shows quotations, invoices, emails and files | Should | 2 days |

### 11. Users, roles and security (serious defects)

**Have:** email + password and Google sign-in; ADMIN and SALES_REP roles; admin user management.

| Gap | Priority | Effort |
|---|---|---|
| Record-level access: reps see only their own records; new MANAGER role sees all (decision confirmed) | Must | 10–15 days for all security fixes together (Phase 1 list in the technical assessment) |
| Input validation on every screen and API; reps can't reassign records | Must | |
| Fix the Google connection weakness; remove risky account linking | Must | |
| Deactivated users lose access immediately | Must | |
| Password rules, login rate limiting; MFA | Must (MFA: Should) | |
| Audit log: who viewed, changed or deleted what, and when | Must | |
| Remove the Abacus script; add security headers | Must | |

### 12. Reporting and analytics (one dashboard)

**Have:** one dashboard with KPIs and pipeline funnel and value. Google Sheets copy for ad-hoc analysis.

| Report | Priority | Effort |
|---|---|---|
| Dashboard figures filtered to the user's own records (reps) or the team (managers) | Must | Included in module 11 |
| Sales by rep, by month, won vs lost | Should | 5–8 days for this set |
| Quotation conversion rate and average time to close | Should | |
| Outstanding invoices and AR ageing | Should | |
| Activity report (calls, meetings per rep per week) | Should | |
| Export any report to Excel or CSV | Should | |

### 13. Admin settings

**Have:** user management and pipeline stages.

| Gap | Priority | Effort |
|---|---|---|
| Company profile: name, UEN, GST number, address, logo, bank details (used on PDFs) | Must | 2–3 days |
| Numbering formats for quotations, confirmations, contracts and invoices | Must | Included |
| Default GST rate, payment terms, currency, quotation validity | Must | Included |
| Email templates and sender settings | Must | Included in module 9 |

### 14. Integrations

**Have:** Google Sheets copy of contacts, deals and transactions (runs during each save, so saves slow down).

| Gap | Priority | Effort |
|---|---|---|
| Move Sheets sync to a background queue | Should | 2–3 days |
| Accounting software (Xero or QuickBooks): push invoices and pull payment status | Should (decision needed) | 5–8 days |
| API keys and webhooks for other systems; token login for a future mobile app | Could | 4–6 days |

### 15. AI email and activity assistant (missing)

Reads the company mailbox, logs each email against the right customer or deal, summarises and classifies it, drafts replies for a person to approve, and sends a daily digest of unanswered emails, overdue tasks, idle deals and quotations awaiting reply. Full design is in §10 of the technical assessment.

| Priority | Effort | Depends on |
|---|---|---|
| Should (first major release after go-live) | 18–28 days | Company mailbox (Workspace or Microsoft 365), record-level security, audit log, email sending |

### 16. Data governance (PDPA)

| Gap | Priority | Effort |
|---|---|---|
| Data retention rules (how long to keep customer and lost-deal data) | Must (policy) | Policy + 1–2 days |
| Handle customer requests to access or correct their data (export a contact's full record) | Should | 1–2 days |
| Data map covering the Google Sheets copy and, later, the AI provider | Must (policy) | Non-development |
| Backups and restore test (already scripted for Google Cloud) | Must | Included in hosting setup |

## 3. Improvement roadmap

| Stage | Contents | Rough effort |
|---|---|---|
| **A. Go-live release** | Security and data fixes (module 11, stage and money fixes); products; quotations; confirmations; contracts; invoices and payments; PDFs; file attachments; outgoing email and notifications; admin settings; customer import; data-governance basics; testing and UAT | **≈ 48–72 developer days** (about 10–15 weeks for one developer, or 6–8 weeks for two) |
| **B. Stabilise (1–3 months)** | Pagination and search; soft delete; duplicates; background Sheets sync; task assignment and reminders; reports set; credit notes; contract renewal reminders; automated tests and CI | ≈ 25–35 days |
| **C. Grow (3–6 months)** | AI email and activity assistant; accounting integration; forecasting; calendar sync | ≈ 30–45 days |
| **D. Later** | Custom fields; e-signature; multi-contact deals; API and mobile app; MFA for all users if not done earlier | As needed |

**What this means for the budget.** The go-live development work is likely to cost more than the cloud hosting setup. Phase 5 will price it alongside the hosting implementation.

## 4. Decisions needed to firm up scope

1. Is the CRM the official invoicing system, or will invoices go to accounting software (Xero, QuickBooks or other)?
2. Is the company GST-registered? This sets the tax-invoice format.
3. Quotation approval: is approval needed above a discount or value threshold, and who approves?
4. Is electronic signature needed for contracts at go-live, or is uploading the signed copy enough?
5. Single currency (SGD) or several?
6. Number formats for quotations, confirmations, contracts and invoices.
7. Existing data to import at go-live (spreadsheets, an old system) and roughly how many records.
