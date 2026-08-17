import { z } from "zod";
import { resolveFileCabinetPath } from "../fileCabinet.js";
import { writeProjectFile, validateOrDeployProject, errorResult } from "./writeAndDeploy.js";

export function registerFileCabinetTools(server) {
  server.tool(
    "netsuite_deploy_file",
    "Writes a file into the local SDF project's File Cabinet folder (sdf/src/FileCabinet), " +
      "then runs project:validate (dryRun=true, default) or project:deploy (dryRun=false). File " +
      "Cabinet files deploy as literal files, not XML customization objects. targetPath is " +
      "relative to the File Cabinet root and cannot contain '..' segments.",
    {
      targetPath: z.string().describe("Path relative to the File Cabinet root, e.g. 'SuiteScripts/lib/util.js'"),
      content: z.string().describe("File content (text). For binary files, pass base64 and set encoding='base64'"),
      encoding: z.string().optional().describe("'utf8' (default) or 'base64'"),
      dryRun: z.boolean().optional().describe("Default true: validate only. Set false to deploy."),
    },
    async ({ targetPath, content, encoding = "utf8", dryRun = true }) => {
      try {
        const relativePath = resolveFileCabinetPath(targetPath);
        const buffer = encoding === "base64" ? Buffer.from(content, "base64") : content;
        writeProjectFile(relativePath, buffer);
        return await validateOrDeployProject(dryRun, `Wrote ${relativePath}`);
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  return server;
}
