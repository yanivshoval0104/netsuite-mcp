import { z } from "zod";
import { buildCustomSegmentXml } from "../customSegment.js";
import { writeValidateOrDeploy, errorResult } from "./writeAndDeploy.js";

export function registerCustomSegmentTools(server) {
  server.tool(
    "netsuite_create_custom_segment",
    "Creates a Custom Segment via SDF (writes XML, then project:validate/deploy). REQUIRES an " +
      "associated Custom Record Type — build BOTH in the same batch: (1) pick this segment's " +
      "scriptIdSuffix first, (2) build the Custom Record Type via netsuite_create_custom_record_type " +
      "passing customSegmentScriptId='cseg_<yourSuffix>' (a REQUIRED reciprocal link back to this " +
      "segment — a one-way reference from the segment alone fails validation), (3) call this tool " +
      "passing recordTypeScriptId as that record type's scriptid. This tool does not auto-create " +
      "the companion record for you.",
    {
      scriptIdSuffix: z.string().describe("e.g. 'region' -> cseg_region"),
      label: z.string(),
      recordTypeScriptId: z.string().describe("scriptid of the associated customrecordtype"),
      fieldType: z.string().optional().describe("'SELECT' or 'MULTISELECT', default 'SELECT'"),
      applicationAreas: z.array(z.string()).optional().describe("Any of: transactionbody, transactionline, entities, crm, customrecords"),
      itemSubtype: z.string().optional().describe("If items should be enabled: 'BOTH' | 'INVTPART' | 'NONINVTPART'"),
      hasGlImpact: z.boolean().optional().describe("Cannot be changed after creation on a live account"),
      isMandatory: z.boolean().optional(),
      defaultRecordAccessLevel: z.string().optional().describe("VIEW | EDIT | FULL, default VIEW"),
      defaultSearchAccessLevel: z.string().optional().describe("VIEW | EDIT | FULL, default VIEW"),
      dryRun: z.boolean().optional().describe("Default true: validate only. Set false to deploy."),
    },
    async ({ dryRun = true, ...opts }) => {
      try {
        const { scriptid, xml } = buildCustomSegmentXml(opts);
        return await writeValidateOrDeploy(scriptid, xml, dryRun);
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  return server;
}
