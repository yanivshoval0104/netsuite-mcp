import { z } from "zod";
import { buildCustomRecordTypeXml } from "../customRecordType.js";
import { writeValidateOrDeploy, errorResult } from "./writeAndDeploy.js";

const fieldSchema = z.object({
  scriptIdSuffix: z.string().describe("e.g. 'region' -> custrecord_region (flat, independent of the parent record type's scriptid)"),
  label: z.string(),
  fieldType: z.string(),
  selectRecordType: z.union([z.string(), z.number()]).optional(),
  mandatory: z.boolean().optional(),
  storeValue: z.boolean().optional(),
  help: z.string().optional(),
  description: z.string().optional(),
  displayType: z.string().optional(),
});

export function registerCustomRecordTypeTools(server) {
  server.tool(
    "netsuite_create_custom_record_type",
    "Creates a Custom Record Type via SDF (writes XML, then project:validate/deploy). Can " +
      "include its own custom fields inline via the 'fields' param (a nested " +
      "<customrecordcustomfields> block) — Custom Record Custom Field is not a separate tool " +
      "since it's not a standalone SDF object.",
    {
      scriptIdSuffix: z.string().describe("e.g. 'project_code' -> customrecord_project_code"),
      recordName: z.string().describe("Display name shown in the UI"),
      description: z.string().optional(),
      accessType: z.string().optional().describe("Default 'CUSTRECORDENTRYPERM'"),
      allowAttachments: z.boolean().optional(),
      allowQuickAdd: z.boolean().optional(),
      allowUiAccess: z.boolean().optional(),
      enableNumbering: z.boolean().optional(),
      hierarchical: z.boolean().optional(),
      isInactive: z.boolean().optional(),
      showNotes: z.boolean().optional(),
      fields: z.array(fieldSchema).optional().describe("Nested custom fields on this record type"),
      customSegmentScriptId: z.string().optional().describe("Set this when this record type is the VALUES record for a Custom Segment — required reciprocal link, see netsuite_create_custom_segment"),
      dryRun: z.boolean().optional().describe("Default true: validate only. Set false to deploy."),
    },
    async ({ dryRun = true, ...opts }) => {
      try {
        const { scriptid, xml } = buildCustomRecordTypeXml(opts);
        return await writeValidateOrDeploy(scriptid, xml, dryRun);
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  return server;
}
