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
   - Generate a keypair:
     ```
     openssl genrsa -out secrets/netsuite_private.pem 2048
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

`src/httpServer.js` is a second entry point — same tools, same NetSuite client/auth code
(`registerTools.js`), but served over Streamable HTTP instead of stdio, so it can run as an
always-on remote service instead of a local Claude Code subprocess. Stateless: a fresh
`McpServer` + transport is created per request, so no session affinity is needed across
Render restarts or instances.

1. Push this repo to GitHub (`secrets/`, `.env`, and `node_modules/` stay out per `.gitignore`).
2. In Render: **New → Web Service**, connect the GitHub repo. Render auto-detects Node; set:
   - **Build Command**: `npm install`
   - **Start Command**: `npm run start:http`
3. Add environment variables on the Render service (Settings → Environment):
   - `NETSUITE_ACCOUNT_ID`, `NETSUITE_CONSUMER_KEY`, `NETSUITE_CONSUMER_SECRET`,
     `NETSUITE_TOKEN_ID`, `NETSUITE_TOKEN_SECRET` — same values as local `.env`
   - `MCP_SERVER_TOKEN` — strongly recommended for anything beyond a throwaway demo; this
     server has create/update/delete tools, so leaving it unset means **anyone with the URL
     can write to NetSuite**. If set, every client must send `Authorization: Bearer <token>`.
4. Deploy. Render gives you a URL like `https://netsuite-mcp-xxxx.onrender.com`. The MCP
   endpoint is `https://<that-host>/mcp` (POST only — this server is stateless, so GET/DELETE
   on `/mcp` return 405). `/healthz` returns 200 and is safe to hit unauthenticated as a
   warm-up/keep-alive ping.
5. Point any remote MCP client (e.g. a gateway's `NETSUITE_MCP_URL`) at that `/mcp` URL with
   the Streamable HTTP transport, sending the bearer token if one was configured.

**Free-tier caveat**: Render's Free instance tier sleeps after ~15 min idle, with a 30-60s
cold start on the next request — the first call after any idle gap will hang/slow until the
instance wakes. Issue a throwaway warm-up call (e.g. hit `/healthz`) before relying on this
in a live demo, or upgrade to a paid instance if that's not acceptable.

## SDF tools (custom fields on standard entities)

The REST Record API tools above can't create custom fields at all — NetSuite doesn't expose
field *definitions* over REST, on standard entities or custom ones. `src/registerSdfTools.js`
adds that capability via the **SuiteCloud Development Framework (SDF)**: it generates an XML
object definition and deploys it through the `suitecloud` CLI (`@oracle/suitecloud-cli`, a
Java-backed tool — requires a local Java runtime).

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

| Tool | Purpose |
|---|---|
| `netsuite_list_sdf_field_categories` | Lists supported categories (`entity`, `transactionBody`, `item`) and their valid `appliesTo` flags |
| `netsuite_create_custom_field` | Writes an SDF XML field object and validates (default) or deploys it |

`netsuite_create_custom_field` defaults to `dryRun=true` (`project:validate` — checks the
object against the account without changing anything). Pass `dryRun=false` to actually run
`project:deploy` and create the field live. There is no delete tool by design — removing a
field is a manual step, the same deliberate speed bump the ServiceNow build tools use.

Supported categories cover the common attributes (label, fieldtype, appliesTo, mandatory,
storeValue, help, description, displayType) but not every possible SDF element (e.g. no
`customfieldfilters`/`roleaccesses` nesting yet) — extend `src/sdf/fieldCategories.js` and
`src/sdf/buildFieldXml.js` if you need those.

**Status: code-complete but not yet verified against a live account.** `NETSUITE_SDF_CERTIFICATE_ID`
has never been provisioned for this account (only TBA creds exist in `.env` today), so
`ensureCiAuth`/`validateProject`/`deployProject` are untested beyond confirming the CLI itself
runs and the generated XML is well-formed. Complete the Setup steps above, then run
`netsuite_create_custom_field` with `dryRun=true` first and confirm `project:validate` succeeds
before ever setting `dryRun=false`.
