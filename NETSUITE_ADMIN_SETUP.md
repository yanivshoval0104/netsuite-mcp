# NetSuite Admin Setup — Full Integration Checklist

Hand this to whoever administers the NetSuite account (must be logged in as **Administrator**).

Tip: NetSuite's exact menu wording can shift slightly by version/release. If a path below
doesn't match exactly, use the global search bar at the top of any NetSuite page (magnifying
glass icon) and type the page name in bold below — it will jump straight there.

---

## 1. Enable Account Features

**Purpose:** Turns on the platform capabilities the integration depends on.

**Admin tasks:**
1. Go to Setup → Company → Enable Features.
2. Click the SuiteCloud subtab.
3. Check REST Web Services.
4. Check OAuth 2.0.
5. Check **SuiteCloud Development Framework** — required for `account:setup:ci`/SDF deploys to
   work at all; easy to miss since it's a separate checkbox from OAuth 2.0/REST Web Services.
6. Confirm Custom Records is checked.
7. Click Save. Accept any Terms of Service popup if one appears.

---

## 2. Full CRUD on Standard + Custom Entities

**Purpose:** Allow creating, reading, updating, and deleting records on standard entities
(Customer, Vendor, Sales Order, Invoice, etc.) and custom record types.

**Admin tasks:**
1. Go to Setup → Users/Roles → Manage Roles.
2. Open the integration's role.
3. Click the Permissions subtab, then the Lists sub-subtab.
4. Add every record type needed (Customer, Contact, Vendor, Employee, Partner, Lead, Prospect,
   etc.) with Level = Full.
5. Click the Transactions sub-subtab.
6. Add every transaction type needed (Sales Order, Invoice, Estimate, Purchase Order, Credit
   Memo, Vendor Bill, Journal Entry, etc.) with Level = Full.
7. Click Save.

---

## 3. Enable SuiteQL / Search

**Purpose:** Allow running SuiteQL queries against any record type.

**Admin tasks:**
1. On the same role's Permissions subtab, search the sub-subtabs (commonly under Reports or
   Setup — varies by account) for a permission named "Perform Search".
2. Set it to Full.
3. Click Save.

---

## 4. Metadata Permissions

**Purpose:** Allow retrieving and creating custom field, custom record, and custom list
definitions.

**Admin tasks:**
1. On the same role's Permissions subtab, click the Setup sub-subtab.
2. Add each of the following with Level = Full:
   - Custom Record Types
   - Custom Fields (or, if listed separately: Entity Fields, Item Fields, CRM Fields, Custom
     Record Fields, Transaction Body Fields, Transaction Column Fields — add each)
   - Custom Lists
   - Log in using Access Tokens
   - Web Services / REST Web Services
3. Click Save.

---

## 5. OAuth 2.0 Client Credentials (M2M) Certificate Setup

**Purpose:** Allow authenticating the metadata (SDF) integration, which uses a separate
credential type from the existing token-based data integration.

**Correction (verified live 2026-08-16):** a custom Integration record (with Client Credentials
Grant) is **not** needed for this — and creating one, as earlier drafts of this doc said, doesn't
work: the SuiteCloud CLI's `account:setup:ci` requires the certificate to be mapped to NetSuite's
own **pre-built "SuiteCloud Development Integration"** application, not a custom one. Using a
custom Integration record here produces a Certificate ID that looks valid but fails with "Server
error... verify OAuth 2.0 and SuiteCloud Development Framework are enabled" regardless of feature
state.

**Admin tasks:**
1. Search "OAuth 2.0 Client Credentials Setup" and click New (or Create Certificate).
2. Upload the certificate file we send you (`netsuite_public.pem`).
3. Set Entity to the integration user.
4. Set Role to the role configured in tasks 2-4.
5. Set Application to **"SuiteCloud Development Integration"** (a pre-built option in the
   dropdown — not something you create yourself).
6. Click Save.
7. Copy the Certificate ID shown after saving.

(A custom Integration record like the one described in earlier instructions may still be useful
for other OAuth 2.0 purposes, but is not part of this specific SDF/CLI setup.)

---

## 6. Send Credentials Back to Us

**Purpose:** Lets us complete the integration setup on our side.

**Admin tasks:**
1. Send us the Client ID from task 5.
2. Send us the Certificate ID from task 5.

---

## 7. Additional Account Features for Extended Metadata Coverage

**Purpose:** Tasks 1-6 cover TBA data access and enough SDF access to manage custom fields.
Extending metadata deploy to custom record types/segments/transaction types, scripts, workflow,
and advanced templates needs a few more account-level feature toggles that tasks 1-6 don't turn
on. This task is independent of tasks 1-6 — it doesn't block sending back the Client ID/Certificate ID.

**Admin tasks:**
1. Go to Setup → Company → Enable Features → SuiteCloud.
2. Check **Custom Segments** — needed for Custom Segment objects.
3. Check **Custom Transactions** (may be on this tab or under the Transactions subtab, varies
   by version) — needed for Custom Transaction Type objects.
4. Confirm **Client SuiteScript** and **Server SuiteScript** are checked — needed for every
   script type (Client Script, User Event Script, Scheduled Script, Map/Reduce Script, Suitelet,
   RESTlet, Portlet, Mass Update Script, Workflow Action Script, plug-ins).
5. Check **Workflow** (may be on this tab or under Company, varies by version) — needed for
   SuiteFlow/Workflow objects.
6. Check **Advanced PDF/HTML Templates** (may be under Company → Printing & Fax/Email, varies
   by version) — needed for Advanced PDF/HTML Template objects.
7. Click Save on each screen. Accept any Terms of Service popup if one appears.

**Note:** exact menu locations for several of these shift by NetSuite version/edition — use the
global search bar (magnifying glass) and search the feature name in **bold** above if a path
doesn't match. If any feature is still missing once we start deploying, `suitecloud
project:validate` reports an explicit "feature not enabled" error naming exactly which one —
that's the fastest way to close any gap this list misses.
