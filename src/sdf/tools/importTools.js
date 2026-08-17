import { z } from "zod";
import { importObject } from "../deployRunner.js";

function formatCliResult(result, label) {
  const parts = [`${label} exited with code ${result.code}.`];
  if (result.stdout.trim()) parts.push(`--- stdout ---\n${result.stdout.trim()}`);
  if (result.stderr.trim()) parts.push(`--- stderr ---\n${result.stderr.trim()}`);
  return parts.join("\n\n");
}

export function registerImportTools(server) {
  server.tool(
    "netsuite_import_sdf_object",
    "Imports an EXISTING object's XML definition from the live NetSuite account into the " +
      "local SDF project (sdf/src/Objects), via 'suitecloud object:import'. This is the " +
      "primary/recommended path for object types that are impractical, risky, or (per Oracle's " +
      "own docs) simply unsupported to hand-author from scratch: Entry/Transaction/Address Form, " +
      "Sublist, Published Dashboard, Workbook, Dataset, KPI Scorecard, Financial Layout, Report " +
      "Definition, SSP Application, and Saved Search (Saved Search's XML 'definition' field is " +
      "an encoded/compressed blob — Oracle explicitly says not to hand-edit it; always build " +
      "searches in the NetSuite UI and import). Configure/build the object in the NetSuite UI " +
      "first, then import it here to bring it under SDF management, inspect it, or redeploy it " +
      "elsewhere. Requires the object to already exist in the account with the given scriptid.",
    {
      type: z
        .string()
        .describe(
          "SDF object type, e.g. 'entryform', 'transactionform', 'addressform', 'sublist', " +
            "'publisheddashboard', 'workbook', 'customdataset', 'kpiscorecard', 'financiallayout', " +
            "'reportdefinition', 'sspapplication', 'savedsearch'"
        ),
      scriptId: z.string().describe("The scriptid of the existing object in the live account to import"),
      destinationFolder: z
        .string()
        .optional()
        .describe("Project-relative folder to import into, default '/Objects'"),
    },
    async ({ type, scriptId, destinationFolder }) => {
      try {
        const result = await importObject({ type, scriptId, destinationFolder });
        return {
          content: [{ type: "text", text: formatCliResult(result, "object:import") }],
          isError: result.code !== 0,
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  return server;
}
