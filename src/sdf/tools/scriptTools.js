import { z } from "zod";
import { SCRIPT_CATEGORIES, CLIENT_SCRIPT_FUNCTIONS } from "../scriptCategories.js";
import { buildScriptXml } from "../script.js";
import { writeProjectFile, writeValidateOrDeploy, errorResult } from "./writeAndDeploy.js";

const deploymentSchema = z.object({
  scriptIdSuffix: z.string(),
  isDeployed: z.boolean().optional().describe("Default true"),
  logLevel: z.string().optional().describe("DEBUG | AUDIT | ERROR | EMERGENCY, default DEBUG"),
  status: z.string().optional().describe("TESTING | RELEASED | NOT_SCHEDULED | SCHEDULED | COMPLETE | PENDING_BUNDLE_UPGRADE, default TESTING"),
  title: z.string().describe("Required"),
  recordType: z.string().optional().describe("A NetSuite record type constant, or the scriptid of a custom record/transaction type"),
  executionContext: z.string().optional(),
  roles: z.array(z.string()).optional(),
});

export function registerScriptTools(server) {
  server.tool(
    "netsuite_list_script_categories",
    "Lists the script types supported by netsuite_create_script, each with a description. Only " +
      "'clientScript' declares entry-point function names in XML (clientFunctions param) — every " +
      "other type's entry points are determined purely by what the .js file you supply exports " +
      "(e.g. exports.onRequest for a Suitelet), with no XML declaration.",
    {},
    async () => {
      const summary = Object.entries(SCRIPT_CATEGORIES).map(([key, def]) => ({
        scriptType: key,
        rootTag: def.rootTag,
        description: def.description,
        supportsClientFunctions: !!def.supportsClientFunctions,
      }));
      return {
        content: [
          { type: "text", text: JSON.stringify({ scriptTypes: summary, clientScriptFunctions: CLIENT_SCRIPT_FUNCTIONS }, null, 2) },
        ],
      };
    }
  );

  server.tool(
    "netsuite_create_script",
    "Creates a script object (any type from netsuite_list_script_categories) via SDF. Writes " +
      "your supplied JS source to sdf/src/FileCabinet/SuiteScripts/<scriptIdSuffix>.js, writes " +
      "the script's XML object, then runs project:validate/deploy. You are responsible for the " +
      "JS source being correct SuiteScript (with the right @NScriptType/@NApiVersion header and " +
      "exported entry-point functions) — this tool is mechanical, not an author.",
    {
      scriptType: z.string().describe("One of the keys from netsuite_list_script_categories"),
      scriptIdSuffix: z.string().describe("e.g. 'sync_project_codes' -> customscript_sync_project_codes, and file SuiteScripts/sync_project_codes.js"),
      name: z.string(),
      jsSource: z.string().describe("Full JS source for the script file, including @NApiVersion/@NScriptType header"),
      isInactive: z.boolean().optional(),
      notifyOwner: z.boolean().optional().describe("Default true"),
      notifyEmails: z.string().optional(),
      notifyAdmins: z.boolean().optional(),
      clientFunctions: z
        .record(z.string())
        .optional()
        .describe(`Only for scriptType 'clientScript': map of entry-point name (${CLIENT_SCRIPT_FUNCTIONS.join(", ")}) to the JS function name in your source`),
      deployments: z.array(deploymentSchema).optional(),
      dryRun: z.boolean().optional().describe("Default true: validate only. Set false to deploy."),
    },
    async ({ dryRun = true, jsSource, ...opts }) => {
      try {
        const { scriptid, xml, scriptFileName } = buildScriptXml(opts);
        writeProjectFile(`FileCabinet/SuiteScripts/${scriptFileName}`, jsSource);
        return await writeValidateOrDeploy(scriptid, xml, dryRun);
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  return server;
}
