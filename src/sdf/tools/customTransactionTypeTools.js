import { z } from "zod";
import { buildCustomTransactionTypeXml } from "../customTransactionType.js";
import { writeValidateOrDeploy, errorResult } from "./writeAndDeploy.js";

const segmentsSchema = z.object({
  classMandatory: z.boolean().optional(),
  classPosition: z.string().optional().describe("NONE | HEADER | LINE"),
  departmentMandatory: z.boolean().optional(),
  departmentPosition: z.string().optional().describe("NONE | HEADER | LINE"),
  locationMandatory: z.boolean().optional(),
  locationPosition: z.string().optional().describe("NONE | HEADER | LINE"),
});

const statusSchema = z.object({
  scriptId: z.string(),
  id: z.string(),
  description: z.string(),
  posting: z.boolean().optional(),
});

export function registerCustomTransactionTypeTools(server) {
  server.tool(
    "netsuite_create_custom_transaction_type",
    "Creates a Custom Transaction Type via SDF (writes XML, then project:validate/deploy). " +
      "scriptid prefix depends on subListStyle: BASIC/JOURNAL/HEADERONLY -> customtransaction_, " +
      "SALES -> customsale_, PURCHASE -> custompurchase_.",
    {
      scriptIdSuffix: z.string(),
      name: z.string(),
      subListStyle: z.string().optional().describe("BASIC | JOURNAL | HEADERONLY | SALES | PURCHASE, default BASIC"),
      isCredit: z.boolean().optional(),
      isPosting: z.boolean().optional(),
      isVoidable: z.boolean().optional(),
      showStatus: z.boolean().optional(),
      segments: segmentsSchema.optional(),
      statuses: z.array(statusSchema).optional(),
      dryRun: z.boolean().optional().describe("Default true: validate only. Set false to deploy."),
    },
    async ({ dryRun = true, ...opts }) => {
      try {
        const { scriptid, xml } = buildCustomTransactionTypeXml(opts);
        return await writeValidateOrDeploy(scriptid, xml, dryRun);
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  return server;
}
