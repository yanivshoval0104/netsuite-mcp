# netsuite-mcp

MCP server exposing NetSuite's REST Record API as tools for Claude Code: create, read, update,
delete, and query (SuiteQL) against any NetSuite record type, plus a metadata catalog lookup to
discover valid record type names.

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Complete the NetSuite-side OAuth 2.0 Client Credentials (M2M) setup:
   - Enable **REST Web Services** and **OAuth 2.0** features
   - Create an integration role with the record permissions you need
   - Create/assign an integration user with that role
   - Generate a keypair. **Must be 4096-bit (or 3072-bit) RSA** — NetSuite rejects 2048-bit
     with "Provided x509 certificate has an invalid bit length" on upload:
     ```
     openssl genrsa -out secrets/netsuite_private.pem 4096
     openssl req -new -x509 -key secrets/netsuite_private.pem -out secrets/netsuite_public.pem -days 730 -subj "/CN=claude-mcp-integration"
     ```
   - Create the Integration record (Client Credentials grant) → copy the **Client ID**
   - Upload `netsuite_public.pem` and map it to the role/user/integration → copy the **Certificate ID**

3. Copy `.env.example` to `.env` and fill in:
   ```
   NETSUITE_ACCOUNT_ID=
   NETSUITE_CLIENT_ID=
   NETSUITE_CERTIFICATE_ID=
   NETSUITE_PRIVATE_KEY_PATH=./secrets/netsuite_private.pem
   ```

4. Register the server with Claude Code. This project already has a `.mcp.json` at its root, so
   running Claude Code from this folder should auto-detect it. Alternatively:
   ```
   claude mcp add netsuite -- node src/server.js
   ```

## Tools

| Tool | Purpose |
|---|---|
| `netsuite_list_record_types` | List valid REST record type names |
| `netsuite_query` | Read-only SuiteQL query (find internal ids) |
| `netsuite_get_record` | Fetch a record by internal id |
| `netsuite_create_record` | Create a record |
| `netsuite_update_record` | Partial-patch update a record |
| `netsuite_delete_record` | Delete a record by internal id |

`recordType` must match NetSuite's REST endpoint naming (e.g. `customer`, `salesOrder`, `invoice`,
`item`). If unsure, use `netsuite_list_record_types` or `netsuite_query` first.

## Notes

- Access tokens are cached in-memory and refreshed automatically before expiry.
- `secrets/*.pem` and `.env` are gitignored — never commit them.

## Known gaps

- **`netsuite_delete_record` has no safety net.** Unlike `netsuite_create_custom_field`
  (`dryRun` default) or the ServiceNow reference server this was modeled on (no delete tool at
  all, by design), this tool deletes immediately on call — confirmed live (real create → real
  delete → 404, no residue). Deliberately left as-is for now; flagged rather than fixed. Worth
  a dry-run/confirmation guard before this is trusted with anything that isn't a throwaway test
  record.
- **`MCP_SERVER_TOKEN` is implemented but unset.** If deployed to Render as-is today, the `/mcp`
  endpoint runs open — anyone with the URL gets create/update/delete on `customrecord_*` data.
- **Render deployment hasn't happened yet.** Everything below is verified locally only.

Closed: `netsuite_update_record` (PATCH) was untested as of the last check — now verified live
through the actual HTTP gateway (`/mcp`, not just the raw client functions): created a
`customrecord_mm_project_codes` row, PATCHed its `name`, confirmed the new value stuck on
re-fetch, deleted it, confirmed 404. Same sweep reconfirmed the two known permission blockers
(SuiteQL, standard-entity access) still fail the same way through the gateway as they do
directly — the gap there is account permissions, not this server.

## Remote deployment (Render)

`src/httpServer.js` is a second entry point served over Streamable HTTP instead of stdio, so it
can run as an always-on remote service instead of a local Claude Code subprocess. As of the
multi-tenant HTTP deploy, it registers **both** the REST data tools (`registerTools.js`) and the
SDF metadata tools (`registerSdfTools.js`) — not just data. A fresh `McpServer` + transport is
created per request, but all of those per-request instances share one process, one `sdf/` project
directory, and one `suitecloud` CLI auth state — see `registerSdfTools.js`'s `withSdfLock` mutex,
which serializes every SDF tool call end-to-end so concurrent requests can't interleave writes
into each other's `project:deploy` (deploy.xml is a wildcard — it pushes everything currently
staged, not just what the current request wrote).

**Requires the Docker runtime, not Render's native Node runtime** — the SDF tools shell out to
the Java-backed `suitecloud` CLI, and native Node has no system package access to install a JRE.
This repo's `Dockerfile` installs `default-jre-headless` before `npm ci`; verified locally
(`docker build` + `docker run`, confirmed Java 17 + `suitecloud --version` + all 29 tools
reachable through a real `/mcp` request).

1. Push this repo to GitHub (`secrets/`, `.env`, and `node_modules/` stay out per `.gitignore`
   and `.dockerignore`).
2. In Render: **New → Web Service**, connect the GitHub repo, select **Docker** as the runtime
   (Render will detect the `Dockerfile` automatically — no Build/Start Command fields needed,
   those come from the Dockerfile).
3. **Set the instance count to 1 and do not enable autoscaling.** The `withSdfLock` mutex only
   protects a single process — multiple instances would each have their own independent lock and
   independent `sdf/` filesystem, defeating the whole point.
4. Add a **Secret File** (Environment → Secret Files) for the private key — e.g. mount
   `netsuite_private_pointfive.pem` at `/etc/secrets/netsuite_private_pointfive.pem`. Never pass
   key material as a plain environment variable or commit it.
5. Add environment variables (Settings → Environment):
   - `NETSUITE_ACCOUNT_ID`, `NETSUITE_CONSUMER_KEY`, `NETSUITE_CONSUMER_SECRET`,
     `NETSUITE_TOKEN_ID`, `NETSUITE_TOKEN_SECRET` — REST data tools, same values as local `.env`
   - `NETSUITE_SDF_AUTH_ID`, `NETSUITE_SDF_CERTIFICATE_ID` — SDF metadata tools, same values as
     local `.env`
   - `NETSUITE_SDF_PRIVATE_KEY_PATH` — the Secret File's mount path (e.g.
     `/etc/secrets/netsuite_private_pointfive.pem`), **not** a local `./secrets/...` path
   - `SUITECLOUD_CI=1`, `SUITECLOUD_CI_PASSKEY` — required by `suitecloud` CLI v3+ for
     machine-to-machine auth, same values as local `.env`
   - `MCP_SERVER_TOKEN` — **no longer optional** once SDF tools are exposed; this server now has
     full metadata deploy capability, so leaving it unset means anyone with the URL can create,
     modify, or delete NetSuite configuration, not just data. If set, every client must send
     `Authorization: Bearer <token>`.
6. Deploy. Render gives you a URL like `https://netsuite-mcp-xxxx.onrender.com`. The MCP
   endpoint is `https://<that-host>/mcp` (POST only — this server is stateless, so GET/DELETE
   on `/mcp` return 405). `/healthz` returns 200 and is safe to hit unauthenticated as a
   warm-up/keep-alive ping.
7. Point any remote MCP client (e.g. a gateway's "Register MCP server" form) at that `/mcp` URL
   with the Streamable HTTP transport and the bearer token as a static header.

**Free-tier caveat**: Render's Free instance tier sleeps after ~15 min idle, with a 30-60s
cold start on the next request — the first call after any idle gap will hang/slow until the
instance wakes. Issue a throwaway warm-up call (e.g. hit `/healthz`) before relying on this
in a live demo, or upgrade to a paid instance if that's not acceptable.

## SDF tools (metadata: custom fields, records, scripts, forms, workflow, and more)

The REST Record API tools above can't touch metadata at all — NetSuite doesn't expose object
*definitions* over REST. `src/registerSdfTools.js` adds that capability via the **SuiteCloud
Development Framework (SDF)**: for each object type, a builder module in `src/sdf/` generates an
XML object definition (or, for scripts/templates, an XML definition plus a companion body file),
which then gets validated/deployed through the `suitecloud` CLI (`@oracle/suitecloud-cli`, a
Java-backed tool — requires a local Java runtime).

Coverage is organized in risk-ascending tiers (see the build plan referenced in git history for
the full rationale) — flat structural objects first, scripts and forms in the middle, Workflow
last since it's the most complex/fragile SDF object type. A few object types Oracle's own docs
say to author in the NetSuite UI and *import* rather than hand-roll (Entry/Transaction/Address
Form, Sublist, Published Dashboard, Workbook, Dataset, KPI Scorecard, Financial Layout, Report
Definition, SSP Application, Saved Search) are covered by `netsuite_import_sdf_object` instead of
a create tool — notably Saved Search, whose XML `definition` field is an encoded/compressed blob
that Oracle explicitly says not to hand-edit.

These tools are registered **only on the local stdio server** (`npm run start`), not on the
remote HTTP server — they shell out to a CLI and need a private key file on disk, neither of
which belongs in a stateless Render container.

### Setup (separate credential set — do not reuse the TBA vars above)

SDF's CI auth uses OAuth 2.0 Client Credentials (M2M certificate). As of NetSuite 2024.2,
**Token-Based Authentication is no longer accepted for this** — it's a hard requirement, not
a preference, so the TBA vars used by the REST tools cannot be reused here.

1. The keypair is already generated at `secrets/netsuite_private.pem` / `secrets/netsuite_public.pem`
   (see `openssl` commands in the Setup section above if you need to regenerate it).
2. Hand `secrets/netsuite_public.pem` to whoever administers the NetSuite account and follow
   **`NETSUITE_ADMIN_SETUP.md` steps 4-6** (create the Integration record with Client
   Credentials grant, upload the certificate, map it to a role/user). That produces a
   **Client ID** and a **Certificate ID**.
3. Fill in `.env`:
   ```
   NETSUITE_SDF_AUTH_ID=netsuite-mcp-ci        # any alias you like
   NETSUITE_SDF_CERTIFICATE_ID=<from step 2>
   NETSUITE_SDF_PRIVATE_KEY_PATH=./secrets/netsuite_private.pem
   ```
4. Register the cert with the local CLI: `npm run sdf:auth` (this is also run automatically
   before every `netsuite_create_custom_field` call, so this step is mostly for a manual smoke
   test).

### Tools

Foundation / cross-cutting:

| Tool | Purpose |
|---|---|
| `netsuite_list_pending_sdf_objects` | Lists everything currently staged in `Objects/`/`FileCabinet/`/`Translations/` — deploy.xml is a wildcard, so this shows the full blast radius of the next deploy |
| `netsuite_import_sdf_object` | Pulls an existing object's XML down from the account (`object:import`) — the required path for the import-only types listed above |

Data model / security / nav (Tier 1, 1b):

| Tool | Purpose |
|---|---|
| `netsuite_list_sdf_field_categories` | Lists field categories (`entity`, `transactionBody`, `item`, `crm`, `transactionColumn`, `other`) and their `appliesTo` flags / `rectype` keys |
| `netsuite_create_custom_field` | Entity/Transaction Body/Item/CRM/Transaction Column/Other custom fields |
| `netsuite_create_custom_record_type` | Custom Record Type, optionally with nested custom fields (Custom Record Custom Field isn't a separate object) |
| `netsuite_create_custom_list` | Custom List |
| `netsuite_create_custom_segment` | Custom Segment (requires an existing Custom Record Type) |
| `netsuite_create_custom_transaction_type` | Custom Transaction Type |
| `netsuite_create_role` | Custom Role |
| `netsuite_create_center` / `netsuite_create_center_tab` / `netsuite_create_center_category` | Custom navigation Center family |
| `netsuite_create_saved_csv_import` | Saved CSV Import map (mappings only — no CSV data) |

Content-bearing objects (Tier 2) and forms (Tier 3):

| Tool | Purpose |
|---|---|
| `netsuite_deploy_file` | Writes a file into the local File Cabinet folder |
| `netsuite_create_email_template` | Email Template (metadata XML + `.template.html` body) |
| `netsuite_create_advanced_template` | Advanced PDF/HTML Template (metadata XML + `.template.xml` body) |
| `netsuite_create_translation_collection` | Translation Collection (inline strings, not XLIFF) |
| `netsuite_create_form` | Narrow Entry/Transaction/Address Form override (basic layout only — see note above on importing instead) |

Scripts (Tier 4):

| Tool | Purpose |
|---|---|
| `netsuite_list_script_categories` | Lists script types and whether they support `clientFunctions` |
| `netsuite_create_script` | Any script type — Client/User Event/Scheduled/Map-Reduce/Suitelet/RESTlet/Portlet/Mass Update/Workflow Action/Bundle Installation/SDF Installation Script, Plug-in Type/Implementation |
| `netsuite_create_script_deployment` | Attaches a new deployment to an already-created script without rewriting it |

Workflow (Tier 6):

| Tool | Purpose |
|---|---|
| `netsuite_create_workflow` | Workflow (SuiteFlow) from structured states/transitions/actions — only `setfieldvalueaction`/`addbuttonaction` supported so far |

Every `create`/`deploy` tool defaults to `dryRun=true` (`project:validate` — checks against the
account without changing anything). Pass `dryRun=false` to actually run `project:deploy`. There
are no delete tools anywhere by design — removing an object is a manual step, the same
deliberate speed bump the ServiceNow build tools use.

**Status: live-verified against a real account (PointFive Ltd sandbox, 2026-08-17, three passes).**
`project:validate` has passed cleanly (exit 0) for: Custom Record Type (+ nested custom field),
Custom Transaction Type, Role, Center/Center Tab/Center Category, Saved CSV Import, **Custom
Segment (full round trip, including the required record-type association — see below)**, all six
custom field categories (`entity`, `item`, `crm`, `transactionColumn`, `other`, and
`transactionBody` with caveats — see below), Email Template, Advanced Template, Translation
Collection, File Cabinet, Workflow (including `setfieldvalueaction`/`addbuttonaction` actions),
**Transaction Form**, `netsuite_create_script_deployment`, `netsuite_import_sdf_object` (imported
a real live object back down and confirmed the local representation matches byte-for-byte on the
parts that matter), and 8 of 13 script types (Client Script, Suitelet, RESTlet, Scheduled Script,
Map/Reduce Script, Portlet, Mass Update Script, Workflow Action Script, Bundle Installation
Script, SDF Installation Script). `netsuite_create_custom_list` was additionally verified with a
real `dryRun=false` deploy — an actual Custom List was created on the live account and confirmed.
Getting here surfaced and fixed real bugs (see git history) — most notably:

- **`manifest.xml` needs an explicit `<dependencies>` block** naming every account feature any
  object in the project depends on (`CUSTOMRECORDS`, `CUSTOMSEGMENTS`, `CUSTOMTRANSACTIONS`,
  `SERVERSIDESCRIPTING`, `WORKFLOW`, `ADVANCEDPRINTING`, `CRM`, `ADVANCEDJOBS`) — having the
  feature enabled on the *account* isn't enough. Field builders also omit `F`-valued boolean
  flags entirely now, since even `<colexpense>F</colexpense>` demands a manifest declaration for
  its feature — only declare what you actually use. Some deploys need a further, form/record-type-
  specific feature too (e.g. `SALESORDERS` for a Sales Order transaction form) — the validate
  error names it, add it to `manifest.xml` as needed rather than expecting it pre-declared.
- **References to objects outside the local project** (a Saved Search, an existing Entry Form)
  must also be declared, under `<dependencies><objects>` — `src/sdf/manifestDependencies.js`
  handles this automatically for `netsuite_create_advanced_template` and
  `netsuite_create_saved_csv_import`.
- **Custom Segment needs a RECIPROCAL link, not just a one-way reference** — the segment
  referencing its record type isn't enough; the record type must also carry a `customSegmentScriptId`
  (emits `<customsegment>`) pointing back. With both sides linked, it's a completely clean
  validate. Build both together: pick the segment's scriptid first, build the record type with
  `customSegmentScriptId` set, then build the segment with `recordTypeScriptId` pointing at it.
  Also: once a record type is linked this way, `recordName`/`accessType`/`allowUiAccess`/
  `enableNumbering`/`hierarchical`/`isInactive` are rejected — NetSuite manages those for a
  segment's values record, so the builder omits them automatically in that mode.
- **`restlet`'s root tag is lowercase** (`<restlet>`), not `<Restlet>` as an Oracle doc example
  showed — that capitalization gets it miscategorized as a generic data file, not a script.
- **Script deployments require a `title`** — confirmed live, now enforced by the builder.
- **Transaction Form's `standard` attribute is an enumerated value, not a guessable
  `STANDARD<X>FORM` pattern** — e.g. `STANDARDSALESORDER` for Sales Order, not
  `STANDARDSALESORDERFORM`. Guess wrong and NetSuite's own validate error lists every valid value
  for that record type. `editingInList` is also rejected outright and was removed from the builder.
- **`transactionBody` field category is less trustworthy than the others** — `appliestosalesorder`
  hard-errors and `appliestoinvoice` warns, both "invalid or not supported"; `entity`/`item`
  validated clean. Re-test whichever specific flag you need before relying on it.

**Still open / unverified:**
- **Entry Form's `recordType` is a confirmed, unresolved problem** — three different value styles
  were tried live and all rejected (plain name `CUSTOMER`/`PROJECTTASK`, lowercase, and Form-ID
  style `STANDARDCUSTOMERFORM`). Transaction Form works fine with plain record type names: this
  is specific to Entry Form. `netsuite_create_form` no longer accepts `formType: 'entry'` blindly
  — use `netsuite_import_sdf_object` for entry forms until this is actually solved.
- **Address Form is explicitly NOT supported** by `netsuite_create_form` — confirmed live it's a
  structurally different object (different scriptid prefix `custaddressform_`, no
  recordType/standard/inactive/preferred/storedWithRecord/actionbar/buttons at all, a required
  `addressTemplate` field, and a `mainFields` shape using `<defaultFieldGroup>` directly rather
  than a scriptid'd `<fieldGroup>`). Needs dedicated work, not a variant of the shared builder —
  use `netsuite_import_sdf_object` for it.
- **Plugin Type / Plugin Implementation** need more required fields than this generic script
  builder supports (`customplugintype`, `status`, `deploymentmodel`) — confirmed to exist as
  valid script types, but not fully buildable via `netsuite_create_script` yet.
- **Root tags for `bundleinstallationscript`/`sdfinstallationscript`/`workflowactionscript`/
  `massupdatescript`/`portlet`** validated clean this pass but weren't independently
  fetch-confirmed from docs beforehand (same lowercase-of-type-name pattern as everything else
  except the `restlet` exception above).
- **The true import-only types** (Saved Search, Dashboard, Workbook, KPI Scorecard, Financial
  Layout, Report Definition, SSP Application) are still untested — `netsuite_import_sdf_object`
  itself is proven to work, but needs a real existing object of each specific type on the account
  to test against.
