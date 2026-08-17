import { z } from "zod";
import { buildCustomListXml } from "../customList.js";
import { writeValidateOrDeploy, errorResult } from "./writeAndDeploy.js";

const valueSchema = z.union([
  z.string(),
  z.object({
    label: z.string(),
    abbreviation: z.string().optional(),
    isInactive: z.boolean().optional(),
  }),
]);

export function registerCustomListTools(server) {
  server.tool(
    "netsuite_create_custom_list",
    "Creates a Custom List via SDF (writes XML, then project:validate/deploy).",
    {
      scriptIdSuffix: z.string().describe("e.g. 'account_type' -> customlist_account_type"),
      name: z.string().describe("Display name for the list"),
      values: z.array(valueSchema).describe("Plain label strings, or {label, abbreviation?, isInactive?}"),
      isOrdered: z.boolean().optional(),
      isMatrixOption: z.boolean().optional(),
      dryRun: z.boolean().optional().describe("Default true: validate only. Set false to deploy."),
    },
    async ({ dryRun = true, ...opts }) => {
      try {
        const { scriptid, xml } = buildCustomListXml(opts);
        return await writeValidateOrDeploy(scriptid, xml, dryRun);
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  return server;
}
