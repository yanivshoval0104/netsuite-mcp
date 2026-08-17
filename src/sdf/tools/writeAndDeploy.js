import fs from "fs";
import path from "path";
import { ensureCiAuth, validateProject, deployProject, SDF_PROJECT_DIR } from "../deployRunner.js";

// Shared "write object XML -> ensure CI auth -> validate or deploy" flow used by every SDF
// create-tool, extracted from the pattern netsuite_create_custom_field established first.

export function formatCliResult(result, label) {
  const parts = [`${label} exited with code ${result.code}.`];
  if (result.stdout.trim()) parts.push(`--- stdout ---\n${result.stdout.trim()}`);
  if (result.stderr.trim()) parts.push(`--- stderr ---\n${result.stderr.trim()}`);
  return parts.join("\n\n");
}

/**
 * Writes an extra project-relative file under sdf/src/ (e.g. a companion
 * ".template.html"/".template.xml" body file that has to sit alongside an
 * object's own XML, matched by filename convention rather than XML content).
 * Caller is responsible for calling writeValidateOrDeploy afterward for the
 * actual validate/deploy step.
 */
export function writeProjectFile(relativePath, content) {
  const filePath = path.join(SDF_PROJECT_DIR, "src", relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

/**
 * @param {string} scriptid
 * @param {string} xml
 * @param {boolean} dryRun
 * @returns MCP tool result shape ({content, isError})
 */
export async function writeValidateOrDeploy(scriptid, xml, dryRun) {
  const filePath = path.join(SDF_PROJECT_DIR, "src", "Objects", `${scriptid}.xml`);
  fs.writeFileSync(filePath, xml, "utf8");

  const authResult = await ensureCiAuth();
  if (authResult.code !== 0) {
    return {
      content: [{ type: "text", text: `Wrote ${scriptid}.xml, but CI auth setup failed:\n\n${formatCliResult(authResult, "account:setup:ci")}` }],
      isError: true,
    };
  }

  const result = dryRun ? await validateProject() : await deployProject();
  const verb = dryRun ? "Validated (not deployed)" : "Deployed";
  const label = dryRun ? "project:validate" : "project:deploy";

  return {
    content: [
      {
        type: "text",
        text:
          `Wrote ${scriptid}.xml to the SDF project. ${verb}.\n\n${formatCliResult(result, label)}` +
          (dryRun ? "\n\nCall again with dryRun=false to actually create this object on the account." : ""),
      },
    ],
    isError: result.code !== 0,
  };
}

/**
 * Validates or deploys the whole project without a single primary scriptid/xml pair to report on
 * (e.g. after writing a File Cabinet file, which isn't a customization "object").
 */
export async function validateOrDeployProject(dryRun, summary) {
  const authResult = await ensureCiAuth();
  if (authResult.code !== 0) {
    return {
      content: [{ type: "text", text: `${summary}, but CI auth setup failed:\n\n${formatCliResult(authResult, "account:setup:ci")}` }],
      isError: true,
    };
  }

  const result = dryRun ? await validateProject() : await deployProject();
  const verb = dryRun ? "Validated (not deployed)" : "Deployed";
  const label = dryRun ? "project:validate" : "project:deploy";

  return {
    content: [
      {
        type: "text",
        text:
          `${summary}. ${verb}.\n\n${formatCliResult(result, label)}` +
          (dryRun ? "\n\nCall again with dryRun=false to actually push this to the account." : ""),
      },
    ],
    isError: result.code !== 0,
  };
}

/** For tools that report a caught exception before writing/deploying anything. */
export function errorResult(err) {
  return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
}
