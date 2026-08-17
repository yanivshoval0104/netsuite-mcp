import { z } from "zod";
import { appendScriptDeployment } from "../script.js";
import { writeValidateOrDeploy, errorResult } from "./writeAndDeploy.js";

export function registerScriptDeploymentTools(server) {
  server.tool(
    "netsuite_create_script_deployment",
    "Attaches a new deployment to an ALREADY-EXISTING script (built earlier with " +
      "netsuite_create_script, or pulled down with netsuite_import_sdf_object) — e.g. to point " +
      "the same script at another record type, role, or execution context — without rewriting " +
      "the script itself. Edits the local Objects/<scriptid>.xml file directly, then runs " +
      "project:validate/deploy.",
    {
      scriptid: z.string().describe("Full scriptid of the existing script, e.g. 'customscript_sync_project_codes'"),
      scriptIdSuffix: z.string().describe("Suffix for the new deployment's own scriptid -> customdeploy_<suffix>"),
      isDeployed: z.boolean().optional().describe("Default true"),
      logLevel: z.string().optional().describe("DEBUG | AUDIT | ERROR | EMERGENCY, default DEBUG"),
      status: z.string().optional().describe("TESTING | RELEASED | NOT_SCHEDULED | SCHEDULED | COMPLETE | PENDING_BUNDLE_UPGRADE, default TESTING"),
      title: z.string().describe("Required"),
      recordType: z.string().optional(),
      executionContext: z.string().optional(),
      roles: z.array(z.string()).optional(),
      dryRun: z.boolean().optional().describe("Default true: validate only. Set false to deploy."),
    },
    async ({ scriptid, dryRun = true, ...deploymentOpts }) => {
      try {
        const { xml } = appendScriptDeployment(scriptid, deploymentOpts);
        return await writeValidateOrDeploy(scriptid, xml, dryRun);
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  return server;
}
