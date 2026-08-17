import { z } from "zod";
import { buildSavedCsvImportXml } from "../savedCsvImport.js";
import { ensureManifestObjectDependency } from "../manifestDependencies.js";
import { writeValidateOrDeploy, errorResult } from "./writeAndDeploy.js";

const columnReferenceSchema = z.object({ file: z.string(), column: z.string() });

const fieldMappingSchema = z.object({
  field: z.string(),
  value: z.string().optional(),
  columnReference: columnReferenceSchema.optional(),
});

const fileMappingSchema = z.object({
  file: z.string(),
  primaryKey: z.string().optional(),
  foreignKey: z.string().optional(),
});

const recordMappingSchema = z.object({
  record: z.string(),
  fieldMappings: z.array(fieldMappingSchema),
});

export function registerSavedCsvImportTools(server) {
  server.tool(
    "netsuite_create_saved_csv_import",
    "Creates a Saved CSV Import map via SDF (writes XML, then project:validate/deploy). This " +
      "object holds import options + field mappings only — it does NOT contain CSV data. If you " +
      "want an actual CSV file bundled with the project, deploy it separately via the File " +
      "Cabinet tools.",
    {
      scriptIdSuffix: z.string().describe("e.g. 'salesorder' -> custimport_salesorder"),
      recordType: z.string().describe("NetSuite record type constant, e.g. 'SALESORDER'"),
      importName: z.string(),
      dataHandling: z.string().optional().describe("ADD | UPDATE | ADDUPDATE, default ADDUPDATE"),
      columnDelimiter: z.string().optional().describe("TAB | COMMA | SEMICOLON | PIPE | OTHER, default COMMA"),
      decimalDelimiter: z.string().optional().describe("COMMA | PERIOD, default PERIOD"),
      description: z.string().optional(),
      entryFormScriptId: z.string().optional().describe("Required for entity-type imports (e.g. Customer) if transactionFormScriptId isn't given"),
      transactionFormScriptId: z.string().optional().describe("Required for transaction-type imports (e.g. Sales Order) if entryFormScriptId isn't given"),
      fileMappings: z.array(fileMappingSchema).describe("At least one required"),
      recordMappings: z.array(recordMappingSchema).describe("At least one required"),
      dryRun: z.boolean().optional().describe("Default true: validate only. Set false to deploy."),
    },
    async ({ dryRun = true, ...opts }) => {
      try {
        const { scriptid, xml } = buildSavedCsvImportXml(opts);
        if (opts.entryFormScriptId) ensureManifestObjectDependency(opts.entryFormScriptId);
        if (opts.transactionFormScriptId) ensureManifestObjectDependency(opts.transactionFormScriptId);
        return await writeValidateOrDeploy(scriptid, xml, dryRun);
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  return server;
}
