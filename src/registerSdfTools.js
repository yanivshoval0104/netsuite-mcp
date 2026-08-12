import fs from "fs";
import path from "path";
import { z } from "zod";
import { FIELD_CATEGORIES, VALID_FIELD_TYPES } from "./sdf/fieldCategories.js";
import { buildFieldXml } from "./sdf/buildFieldXml.js";
import { ensureCiAuth, validateProject, deployProject, SDF_PROJECT_DIR } from "./sdf/deployRunner.js";

// =============================================================
// SDF (SuiteCloud Development Framework) custom-field tools.
//
// Deliberately NOT registered on the remote/Render HTTP server
// (see httpServer.js) — these shell out to the `suitecloud` Java-backed
// CLI and need a private key file on disk, neither of which belongs in a
// stateless, ephemeral, remotely-reachable container. Local/stdio use only.
//
// These use OAuth 2.0 Client Credentials (M2M certificate) auth, which is
// SEPARATE from the NETSUITE_CONSUMER_KEY/TOKEN_ID (TBA) vars used by the
// REST tools in registerTools.js. As of NetSuite 2024.2, TBA is not
// accepted for SuiteCloud CLI CI auth — only OAuth2 M2M works. See
// NETSUITE_ADMIN_SETUP.md steps 4-6 for how to obtain the Certificate ID.
//
// Safety: every create call defaults to dryRun=true (project:validate only).
// Call again with dryRun=false to actually deploy the field to the account.
// There is no delete tool by design, matching the ServiceNow build-tools
// pattern this was modeled on — removing a bad field is a manual step.
// =============================================================

function formatCliResult(result, label) {
  const parts = [`${label} exited with code ${result.code}.`];
  if (result.stdout.trim()) parts.push(`--- stdout ---\n${result.stdout.trim()}`);
  if (result.stderr.trim()) parts.push(`--- stderr ---\n${result.stderr.trim()}`);
  return parts.join("\n\n");
}

export function registerSdfTools(server) {
  server.tool(
    "netsuite_list_sdf_field_categories",
    "Lists the custom-field categories supported by netsuite_create_custom_field " +
      "(e.g. 'entity' for Customer/Vendor/Employee, 'transactionBody' for Sales Order/Invoice, " +
      "'item'), each with its valid appliesTo flags and description. Call this before " +
      "netsuite_create_custom_field to pick the right category and appliesTo values.",
    {},
    async () => {
      const summary = Object.entries(FIELD_CATEGORIES).map(([key, def]) => ({
        category: key,
        scriptidPrefix: def.scriptidPrefix,
        description: def.description,
        appliesTo: def.appliesTo,
      }));
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ categories: summary, validFieldTypes: VALID_FIELD_TYPES }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "netsuite_create_custom_field",
    "Creates a custom field on a standard NetSuite record (entity, transaction body, or item) " +
      "via SDF. Writes the XML object definition into the local SDF project, then runs " +
      "'suitecloud project:validate' (dryRun=true, default) or 'project:deploy' (dryRun=false) " +
      "against the live account. Use netsuite_list_sdf_field_categories first to see valid " +
      "'category' and 'appliesTo' values. Requires OAuth2 M2M CLI auth to be configured " +
      "(NETSUITE_SDF_AUTH_ID/CERTIFICATE_ID/PRIVATE_KEY_PATH) — separate from the TBA vars " +
      "used by the other NetSuite tools.",
    {
      category: z.string().describe("One of the categories from netsuite_list_sdf_field_categories, e.g. 'entity', 'transactionBody', 'item'"),
      scriptIdSuffix: z.string().describe("Lowercase suffix after the auto-added prefix, e.g. 'loyalty_tier' -> custentity_loyalty_tier"),
      label: z.string().describe("Field label shown to users"),
      fieldType: z.string().describe(`One of: ${VALID_FIELD_TYPES.join(", ")}`),
      appliesTo: z.array(z.string()).describe("Which appliesTo flags to set true for this category (see netsuite_list_sdf_field_categories)"),
      selectRecordType: z.union([z.string(), z.number()]).optional().describe("Required if fieldType is SELECT or MULTISELECT — internal id or name of the list/record type"),
      mandatory: z.boolean().optional(),
      storeValue: z.boolean().optional().describe("Default true"),
      help: z.string().optional(),
      description: z.string().optional(),
      displayType: z.string().optional().describe("NORMAL | DISABLED | HIDDEN, default NORMAL"),
      dryRun: z.boolean().optional().describe("Default true: validate only, do not deploy. Set false to actually create the field on the live account."),
    },
    async (args) => {
      try {
        const { dryRun = true, ...fieldOpts } = args;
        const { scriptid, xml } = buildFieldXml(fieldOpts);

        const filePath = path.join(SDF_PROJECT_DIR, "src", "Objects", `${scriptid}.xml`);
        fs.writeFileSync(filePath, xml, "utf8");

        const authResult = await ensureCiAuth();
        if (authResult.code !== 0) {
          return {
            content: [{ type: "text", text: `Wrote ${scriptid}.xml, but CI auth setup failed:\n\n${formatCliResult(authResult, "account:setup:ci")}` }],
            isError: true,
          };
        }

        const result = dryRun ? await validateProject() : await deployProject();
        const verb = dryRun ? "Validated (not deployed)" : "Deployed";
        const label = dryRun ? "project:validate" : "project:deploy";

        return {
          content: [
            {
              type: "text",
              text: `Wrote ${scriptid}.xml to the SDF project. ${verb}.\n\n${formatCliResult(result, label)}` +
                (dryRun ? "\n\nCall again with dryRun=false to actually create this field on the account." : ""),
            },
          ],
          isError: result.code !== 0,
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  return server;
}
