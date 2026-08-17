import { z } from "zod";
import { buildAdvancedTemplateXml } from "../advancedTemplate.js";
import { ensureManifestObjectDependency } from "../manifestDependencies.js";
import { writeProjectFile, writeValidateOrDeploy, errorResult } from "./writeAndDeploy.js";

export function registerAdvancedTemplateTools(server) {
  server.tool(
    "netsuite_create_advanced_template",
    "Creates an Advanced PDF/HTML Template via SDF (requires the ADVANCEDPRINTING feature). " +
      "Writes the metadata XML plus a companion '<scriptid>.template.xml' body file containing " +
      "the FreeMarker/XML template markup you supply, then runs project:validate/deploy.",
    {
      scriptIdSuffix: z.string().describe("e.g. 'paymentvoucher' -> custtmpl_paymentvoucher"),
      title: z.string(),
      templateBody: z.string().describe("FreeMarker/XML template markup"),
      description: z.string().optional(),
      displaySourceCode: z.boolean().optional(),
      preferred: z.boolean().optional(),
      isInactive: z.boolean().optional(),
      tranType: z.string().optional(),
      printType: z.string().optional(),
      savedSearchScriptId: z.string().describe("Required — scriptid of an existing Saved Search (build in the UI, then netsuite_import_sdf_object; Saved Search can't be authored via SDF)"),
      recordTypeScriptId: z.string().optional().describe("scriptid of a customtransactiontype or customrecordtype this template applies to"),
      dryRun: z.boolean().optional().describe("Default true: validate only. Set false to deploy."),
    },
    async ({ dryRun = true, templateBody, ...opts }) => {
      try {
        const { scriptid, xml, templateFileName } = buildAdvancedTemplateXml(opts);
        writeProjectFile(`Objects/${templateFileName}`, templateBody);
        ensureManifestObjectDependency(opts.savedSearchScriptId);
        return await writeValidateOrDeploy(scriptid, xml, dryRun);
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  return server;
}
