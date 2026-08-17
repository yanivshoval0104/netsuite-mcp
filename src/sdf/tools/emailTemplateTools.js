import { z } from "zod";
import { buildEmailTemplateXml } from "../emailTemplate.js";
import { writeProjectFile, writeValidateOrDeploy, errorResult } from "./writeAndDeploy.js";

export function registerEmailTemplateTools(server) {
  server.tool(
    "netsuite_create_email_template",
    "Creates an Email Template via SDF (requires the CRM feature). Writes the metadata XML plus " +
      "a companion '<scriptid>.template.html' body file containing the HTML/FreeMarker content " +
      "you supply, then runs project:validate/deploy.",
    {
      scriptIdSuffix: z.string().describe("e.g. 'quoterequest' -> custemailtmpl_quoterequest"),
      name: z.string(),
      templateBody: z.string().describe("HTML/FreeMarker content for the email body"),
      description: z.string().optional(),
      recordType: z.string().optional(),
      isInactive: z.boolean().optional(),
      subject: z.string().optional(),
      isPrivate: z.boolean().optional(),
      addUnsubscribeLink: z.boolean().optional().describe("Default true"),
      addCompanyAddress: z.boolean().optional().describe("Default true"),
      dryRun: z.boolean().optional().describe("Default true: validate only. Set false to deploy."),
    },
    async ({ dryRun = true, templateBody, ...opts }) => {
      try {
        const { scriptid, xml, templateFileName } = buildEmailTemplateXml(opts);
        writeProjectFile(`Objects/${templateFileName}`, templateBody);
        return await writeValidateOrDeploy(scriptid, xml, dryRun);
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  return server;
}
