import { z } from "zod";
import { buildCenterXml, buildCenterTabXml, buildCenterCategoryXml } from "../centerFamily.js";
import { writeValidateOrDeploy, errorResult } from "./writeAndDeploy.js";

const portletSchema = z.object({
  scriptId: z.string(),
  portletColumn: z.number(),
  isPortletShown: z.boolean().optional(),
});

const linkSchema = z.object({
  linkId: z.string(),
  linkLabel: z.string(),
  shortList: z.boolean().optional(),
});

export function registerCenterFamilyTools(server) {
  server.tool(
    "netsuite_create_center",
    "Creates a Center (custom navigation center) via SDF (writes XML, then project:validate/deploy).",
    {
      scriptIdSuffix: z.string().describe("e.g. 'ops' -> custcenter_ops"),
      label: z.string(),
      dryRun: z.boolean().optional().describe("Default true: validate only. Set false to deploy."),
    },
    async ({ dryRun = true, ...opts }) => {
      try {
        const { scriptid, xml } = buildCenterXml(opts);
        return await writeValidateOrDeploy(scriptid, xml, dryRun);
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.tool(
    "netsuite_create_center_tab",
    "Creates a Center Tab via SDF. Requires an existing Center (build with netsuite_create_center " +
      "first) — pass its scriptid as centerScriptId. Note: NetSuite automatically adds five trend " +
      "graph portlets to every custom center tab regardless of what's defined here.",
    {
      scriptIdSuffix: z.string().describe("e.g. 'ops' -> custcentertab_ops"),
      label: z.string(),
      centerScriptId: z.string(),
      allRoles: z.boolean().optional().describe("Default true"),
      portlets: z.array(portletSchema).optional(),
      dryRun: z.boolean().optional().describe("Default true: validate only. Set false to deploy."),
    },
    async ({ dryRun = true, ...opts }) => {
      try {
        const { scriptid, xml } = buildCenterTabXml(opts);
        return await writeValidateOrDeploy(scriptid, xml, dryRun);
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.tool(
    "netsuite_create_center_category",
    "Creates a Center Category via SDF. Requires an existing Center (and optionally a Center Tab) " +
      "— pass their scriptids as centerScriptId / centerTabScriptId.",
    {
      scriptIdSuffix: z.string().describe("e.g. 'ops' -> custcentercategory_ops"),
      label: z.string(),
      centerScriptId: z.string(),
      centerTabScriptId: z.string().describe("Required — build the center tab first (netsuite_create_center_tab)"),
      links: z.array(linkSchema).describe("At least one required"),
      dryRun: z.boolean().optional().describe("Default true: validate only. Set false to deploy."),
    },
    async ({ dryRun = true, ...opts }) => {
      try {
        const { scriptid, xml } = buildCenterCategoryXml(opts);
        return await writeValidateOrDeploy(scriptid, xml, dryRun);
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  return server;
}
