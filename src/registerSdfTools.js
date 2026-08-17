import { z } from "zod";
import { FIELD_CATEGORIES, VALID_FIELD_TYPES } from "./sdf/fieldCategories.js";
import { buildFieldXml } from "./sdf/buildFieldXml.js";
import { writeValidateOrDeploy, errorResult } from "./sdf/tools/writeAndDeploy.js";
import { registerPendingObjectsTools } from "./sdf/tools/pendingObjectsTools.js";
import { registerImportTools } from "./sdf/tools/importTools.js";
import { registerCustomRecordTypeTools } from "./sdf/tools/customRecordTypeTools.js";
import { registerCustomListTools } from "./sdf/tools/customListTools.js";
import { registerCustomSegmentTools } from "./sdf/tools/customSegmentTools.js";
import { registerCustomTransactionTypeTools } from "./sdf/tools/customTransactionTypeTools.js";
import { registerRoleTools } from "./sdf/tools/roleTools.js";
import { registerCenterFamilyTools } from "./sdf/tools/centerFamilyTools.js";
import { registerSavedCsvImportTools } from "./sdf/tools/savedCsvImportTools.js";
import { registerFileCabinetTools } from "./sdf/tools/fileCabinetTools.js";
import { registerEmailTemplateTools } from "./sdf/tools/emailTemplateTools.js";
import { registerAdvancedTemplateTools } from "./sdf/tools/advancedTemplateTools.js";
import { registerTranslationCollectionTools } from "./sdf/tools/translationCollectionTools.js";
import { registerFormTools } from "./sdf/tools/formTools.js";
import { registerScriptTools } from "./sdf/tools/scriptTools.js";
import { registerScriptDeploymentTools } from "./sdf/tools/scriptDeploymentTools.js";
import { registerWorkflowTools } from "./sdf/tools/workflowTools.js";

// =============================================================
// SDF (SuiteCloud Development Framework) custom-field tools.
//
// Registered on BOTH the local stdio server (server.js) and the remote
// Render HTTP server (httpServer.js) as of the multi-tenant HTTP deploy —
// these shell out to the `suitecloud` Java-backed CLI, need a private key
// file on disk (Render: a Secret File), and mutate a shared local project
// directory (sdf/src/Objects, sdf/src/FileCabinet) that deploy.xml pushes
// as a wildcard on every project:deploy. See withSdfLock below for how
// concurrent remote requests are kept from interleaving into each other's
// deploys.
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

// Process-wide async mutex serializing every SDF tool call end-to-end (from before its first
// local file write through the end of its validate/deploy call). Needed once this server is
// reachable remotely with concurrent requests sharing one process and one sdf/ filesystem: the
// real race is that a handler's first `await` (inside ensureCiAuth) yields the event loop, and
// another request's handler can run its own synchronous file writes into Objects/ during that
// gap — deploy.xml being a wildcard means those get swept into whichever deploy runs next,
// regardless of which request "owns" them. A single chained promise is enough; there's no need
// for a real semaphore/queue library at this traffic level.
let sdfLockChain = Promise.resolve();
function withSdfLock(fn) {
  const result = sdfLockChain.then(fn);
  sdfLockChain = result.catch(() => {}); // one rejection shouldn't wedge the chain for later calls
  return result;
}

export function registerSdfTools(server) {
  const originalTool = server.tool.bind(server);
  server.tool = (...args) => {
    const handler = args[args.length - 1];
    args[args.length - 1] = (...handlerArgs) => withSdfLock(() => handler(...handlerArgs));
    return originalTool(...args);
  };

  server.tool(
    "netsuite_list_sdf_field_categories",
    "Lists the custom-field categories supported by netsuite_create_custom_field " +
      "(e.g. 'entity' for Customer/Vendor/Employee, 'transactionBody' for Sales Order/Invoice, " +
      "'item', 'crm', 'transactionColumn', 'other'), each with its valid appliesTo flags (or, " +
      "for 'other', its valid rectype keys) and description. Call this before " +
      "netsuite_create_custom_field to pick the right category and appliesTo/rectype values.",
    {},
    async () => {
      const summary = Object.entries(FIELD_CATEGORIES).map(([key, def]) => ({
        category: key,
        scriptidPrefix: def.scriptidPrefix,
        description: def.description,
        mode: def.mode || "appliesTo",
        appliesTo: def.appliesTo,
        rectypes: def.rectypes,
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
    "Creates a custom field on a standard NetSuite record (entity, transaction body, item, CRM " +
      "record, transaction line/column, or 'other' record types like Account/Address/Department) " +
      "via SDF. Writes the XML object definition into the local SDF project, then runs " +
      "'suitecloud project:validate' (dryRun=true, default) or 'project:deploy' (dryRun=false) " +
      "against the live account. Use netsuite_list_sdf_field_categories first to see valid " +
      "'category' values and, for most categories, valid 'appliesTo' flags — the 'other' " +
      "category instead takes a single 'rectype' value (no 'appliesTo'). Requires OAuth2 M2M " +
      "CLI auth to be configured (NETSUITE_SDF_AUTH_ID/CERTIFICATE_ID/PRIVATE_KEY_PATH) — " +
      "separate from the TBA vars used by the other NetSuite tools.",
    {
      category: z.string().describe("One of the categories from netsuite_list_sdf_field_categories, e.g. 'entity', 'transactionBody', 'item', 'crm', 'transactionColumn', 'other'"),
      scriptIdSuffix: z.string().describe("Lowercase suffix after the auto-added prefix, e.g. 'loyalty_tier' -> custentity_loyalty_tier"),
      label: z.string().describe("Field label shown to users"),
      fieldType: z.string().describe(`One of: ${VALID_FIELD_TYPES.join(", ")}`),
      appliesTo: z.array(z.string()).optional().describe("Required for all categories except 'other': which appliesTo/col* flags to set true (see netsuite_list_sdf_field_categories)"),
      rectype: z.union([z.string(), z.number()]).optional().describe("Only for category 'other': a rectype key from netsuite_list_sdf_field_categories (e.g. 'account'), or a raw numeric rectype value"),
      selectRecordType: z.union([z.string(), z.number()]).optional().describe("Required if fieldType is SELECT or MULTISELECT — internal id or name of the list/record type"),
      mandatory: z.boolean().optional(),
      storeValue: z.boolean().optional().describe("Default true"),
      help: z.string().optional(),
      description: z.string().optional(),
      displayType: z.string().optional().describe("NORMAL | DISABLED | HIDDEN, default NORMAL"),
      dryRun: z.boolean().optional().describe("Default true: validate only, do not deploy. Set false to actually create the field on the live account."),
    },
    async ({ dryRun = true, ...fieldOpts }) => {
      try {
        const { scriptid, xml } = buildFieldXml(fieldOpts);
        return await writeValidateOrDeploy(scriptid, xml, dryRun);
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  // Tier 0 foundation tools + Tier 1 flat structural objects
  // (see /Users/yaniv/.claude/plans/generic-leaping-stonebraker.md).
  registerPendingObjectsTools(server);
  registerImportTools(server);
  registerCustomRecordTypeTools(server);
  registerCustomListTools(server);
  registerCustomSegmentTools(server);
  registerCustomTransactionTypeTools(server);
  registerRoleTools(server);
  registerCenterFamilyTools(server);
  registerSavedCsvImportTools(server);

  // Tier 2: File Cabinet + content-bearing objects.
  registerFileCabinetTools(server);
  registerEmailTemplateTools(server);
  registerAdvancedTemplateTools(server);
  registerTranslationCollectionTools(server);

  // Tier 3: Forms & UI layout family. Entry/Transaction/Address Form get a narrow
  // create-from-scratch tool below; Sublist and Subtab rely entirely on
  // netsuite_import_sdf_object (Tier 0) — Oracle doesn't support authoring either from scratch.
  registerFormTools(server);

  // Tier 4: Scripts & automation family.
  registerScriptTools(server);
  registerScriptDeploymentTools(server);

  // Tier 5 (Analytics & output) needed no new tools — netsuite_import_sdf_object (Tier 0)
  // covers all of it; see the plan doc for why the originally-planned Saved Search
  // create-from-scratch tool was dropped.

  // Tier 6: Workflow (SuiteFlow) — last and most fragile object type.
  registerWorkflowTools(server);

  server.tool = originalTool;

  return server;
}
