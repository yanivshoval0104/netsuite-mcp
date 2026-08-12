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
5. Confirm Custom Records is checked.
6. Click Save. Accept any Terms of Service popup if one appears.

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

## 5. OAuth 2.0 Client Credentials (M2M) Integration Setup

**Purpose:** Allow authenticating the metadata (SDF) integration, which uses a separate
credential type from the existing token-based data integration.

**Admin tasks:**
1. Go to Setup → Integrations → Manage Integrations.
2. Click New.
3. Set Name to "Claude MCP Integration".
4. Set State to Enabled.
5. Under Authentication, check Client Credentials (Machine to Machine) Grant.
6. If a Scope section appears, check REST Web Services.
7. Click Save.
8. Copy the Client ID shown after saving.
9. Search "OAuth 2.0 Client Credentials Setup" and click New (or Create Certificate).
10. Upload the certificate file we send you (`netsuite_public.pem`).
11. Set Entity to the integration user.
12. Set Role to the role configured in tasks 2-4.
13. Set Application/Integration to "Claude MCP Integration".
14. Click Save.
15. Copy the Certificate ID shown after saving.

---

## 6. Send Credentials Back to Us

**Purpose:** Lets us complete the integration setup on our side.

**Admin tasks:**
1. Send us the Client ID from task 5.
2. Send us the Certificate ID from task 5.
