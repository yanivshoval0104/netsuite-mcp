import { z } from "zod";
import { buildRoleXml } from "../role.js";
import { writeValidateOrDeploy, errorResult } from "./writeAndDeploy.js";

const permissionSchema = z.object({
  permKey: z.string().describe("e.g. 'ADMI_WORKFLOW', or a permkey for a custom record type/segment once deployed"),
  permLevel: z.string().describe("NONE | VIEW | CREATE | EDIT | FULL"),
  restriction: z.string().optional(),
});

const recordRestrictionSchema = z.object({
  segment: z.string().describe("LOCATION | DEPARTMENT | CLASS"),
  value: z.string().optional(),
});

export function registerRoleTools(server) {
  server.tool(
    "netsuite_create_role",
    "Creates a custom Role via SDF (writes XML, then project:validate/deploy). Subsidiaries, " +
      "Forms, Searches, and Dashboard sublists are NOT supported in SDF (UI-only) and aren't " +
      "modeled here. permkey values for custom record types/segments only resolve once that " +
      "object is already deployed — order matters if you're wiring up new object permissions.",
    {
      scriptIdSuffix: z.string().describe("e.g. 'integration' -> customrole_integration"),
      name: z.string(),
      centerType: z.string().optional().describe("Default 'ACCOUNTCENTER'"),
      isSalesRole: z.boolean().optional(),
      isSupportRole: z.boolean().optional(),
      isWebServiceOnlyRole: z.boolean().optional(),
      employeeRestriction: z.string().optional().describe("NONE | UNASSIGNED | RESTRICT, default NONE"),
      employeeViewingAllowed: z.boolean().optional(),
      restrictTimeAndExpenses: z.boolean().optional(),
      restrictIp: z.boolean().optional(),
      restrictByDevice: z.boolean().optional(),
      coreAdminPermission: z.boolean().optional(),
      permissions: z.array(permissionSchema).describe("At least one required"),
      recordRestrictions: z.array(recordRestrictionSchema).optional(),
      dryRun: z.boolean().optional().describe("Default true: validate only. Set false to deploy."),
    },
    async ({ dryRun = true, ...opts }) => {
      try {
        const { scriptid, xml } = buildRoleXml(opts);
        return await writeValidateOrDeploy(scriptid, xml, dryRun);
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  return server;
}
