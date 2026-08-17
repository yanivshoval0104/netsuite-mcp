import { z } from "zod";
import { buildFormXml } from "../form.js";
import { writeValidateOrDeploy, errorResult } from "./writeAndDeploy.js";

const fieldSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  visible: z.boolean().optional(),
  mandatory: z.boolean().optional(),
  displayType: z.string().optional(),
  columnBreak: z.boolean().optional(),
  sameRowAsPrevious: z.boolean().optional(),
});

const fieldGroupSchema = z.object({
  scriptId: z.string(),
  label: z.string(),
  visible: z.boolean().optional(),
  showTitle: z.boolean().optional(),
  singleColumn: z.boolean().optional(),
  fields: z.array(fieldSchema).optional(),
});

const tabSchema = z.object({
  id: z.string(),
  label: z.string(),
  visible: z.boolean().optional(),
});

export function registerFormTools(server) {
  server.tool(
    "netsuite_create_form",
    "Creates a narrow, basic Entry or Transaction Form via SDF — field-group and tab " +
      "visibility/layout only, always as an override of an existing standard form ('standard' " +
      "param). Address Form is NOT supported here (confirmed live it's a structurally different " +
      "object — use netsuite_import_sdf_object for it). Entry Form's 'recordType' value is also " +
      "a confirmed, unresolved problem as of 2026-08-17 — Transaction Form works reliably " +
      "(recordType is a plain constant like 'SALESORDER'), Entry Form does not (three different " +
      "value styles were all rejected live) — use netsuite_import_sdf_object for entry forms " +
      "until that's solved. Oracle's own guidance is to import an existing form and edit it " +
      "rather than author one from scratch — reach for this tool only for simple Transaction " +
      "Form overrides, not anything beyond basic layout.",
    {
      formType: z.string().describe("'entry' | 'transaction' — 'transaction' is the reliable one, see tool description"),
      scriptIdSuffix: z.string().describe("e.g. 'project_task' -> custform_project_task"),
      standard: z.string().describe("Base standard form id this overrides — an enumerated value per record type, e.g. 'STANDARDSALESORDER' for SALESORDER (not '...FORM' — a wrong guess here surfaces the valid list in the validate error). Deploying may also require declaring a record-type-specific feature in manifest.xml (e.g. SALESORDERS) — the validate error names it if so."),
      recordType: z.string().describe("NetSuite record type this form applies to — reliable for formType 'transaction' (e.g. 'SALESORDER'); confirmed broken for 'entry', see tool description"),
      name: z.string(),
      preferred: z.boolean().optional(),
      inactive: z.boolean().optional(),
      storedWithRecord: z.boolean().optional(),
      fieldGroups: z.array(fieldGroupSchema).optional(),
      tabs: z.array(tabSchema).optional(),
      dryRun: z.boolean().optional().describe("Default true: validate only. Set false to deploy."),
    },
    async ({ dryRun = true, ...opts }) => {
      try {
        const { scriptid, xml } = buildFormXml(opts);
        return await writeValidateOrDeploy(scriptid, xml, dryRun);
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  return server;
}
