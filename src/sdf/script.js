import fs from "fs";
import path from "path";
import { xmlEscape, boolTag, scriptIdRef } from "./xmlUtils.js";
import { resolveScriptCategory, CLIENT_SCRIPT_FUNCTIONS } from "./scriptCategories.js";
import { SDF_PROJECT_DIR } from "./deployRunner.js";

const VALID_STATUSES = ["TESTING", "RELEASED", "NOT_SCHEDULED", "SCHEDULED", "COMPLETE", "PENDING_BUNDLE_UPGRADE"];
const VALID_LOG_LEVELS = ["DEBUG", "AUDIT", "ERROR", "EMERGENCY"];

function looksLikeScriptId(value) {
  return typeof value === "string" && /^(customrecord_|cseg_|customtransaction_|customsale_|custompurchase_)/.test(value);
}

function recordTypeXml(recordType) {
  return looksLikeScriptId(recordType) ? scriptIdRef(recordType) : xmlEscape(recordType);
}

export function buildScriptDeploymentXml(deployment, indent = "        ") {
  const {
    scriptIdSuffix,
    isDeployed = true,
    logLevel = "DEBUG",
    status = "TESTING",
    title,
    recordType,
    executionContext,
    roles = [],
  } = deployment;

  if (!scriptIdSuffix) throw new Error("Each scriptDeployment requires scriptIdSuffix");
  if (!title) throw new Error("Each scriptDeployment requires a title — confirmed live NetSuite rejects a deployment without one (\"the object field title is missing\")");
  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`Invalid deployment status '${status}'. Valid values: ${VALID_STATUSES.join(", ")}`);
  }
  if (!VALID_LOG_LEVELS.includes(logLevel)) {
    throw new Error(`Invalid deployment logLevel '${logLevel}'. Valid values: ${VALID_LOG_LEVELS.join(", ")}`);
  }

  const scriptid = `customdeploy_${scriptIdSuffix}`;
  const lines = [`${indent}<scriptdeployment scriptid="${scriptid}">`];
  lines.push(boolTag("isdeployed", isDeployed, `${indent}    `));
  lines.push(`${indent}    <loglevel>${logLevel}</loglevel>`);
  lines.push(`${indent}    <status>${status}</status>`);
  lines.push(`${indent}    <title>${xmlEscape(title)}</title>`);
  if (recordType) lines.push(`${indent}    <recordtype>${recordTypeXml(recordType)}</recordtype>`);
  if (executionContext) lines.push(`${indent}    <executioncontext>${xmlEscape(executionContext)}</executioncontext>`);
  if (roles.length) {
    lines.push(`${indent}    <audroles>`);
    for (const role of roles) lines.push(`${indent}        <role>${recordTypeXml(role)}</role>`);
    lines.push(`${indent}    </audroles>`);
  }
  lines.push(`${indent}</scriptdeployment>`);
  return { scriptid, xml: lines.join("\n") };
}

/**
 * @param {object} opts
 * @param {string} opts.scriptType - key in SCRIPT_CATEGORIES
 * @param {string} opts.scriptIdSuffix - e.g. 'sync_project_codes' -> customscript_sync_project_codes
 * @param {string} opts.name
 * @param {boolean} [opts.isInactive] - default false
 * @param {boolean} [opts.notifyOwner] - default true
 * @param {string} [opts.notifyEmails]
 * @param {boolean} [opts.notifyAdmins]
 * @param {object} [opts.clientFunctions] - clientScript ONLY: map of entry-point name (see CLIENT_SCRIPT_FUNCTIONS) -> JS function name in the file
 * @param {object[]} [opts.deployments] - array of scriptdeployment opts (see buildScriptDeploymentXml)
 */
export function buildScriptXml(opts) {
  const {
    scriptType,
    scriptIdSuffix,
    name,
    isInactive = false,
    notifyOwner = true,
    notifyEmails = "",
    notifyAdmins = false,
    clientFunctions = {},
    deployments = [],
  } = opts;

  const def = resolveScriptCategory(scriptType);

  if (!scriptIdSuffix || !/^[a-z][a-z0-9_]*$/.test(scriptIdSuffix)) {
    throw new Error("scriptIdSuffix must be lowercase, start with a letter, and contain only letters/digits/underscores");
  }
  if (!name || !name.trim()) throw new Error("name is required");

  const unknownFunctions = Object.keys(clientFunctions).filter((f) => !CLIENT_SCRIPT_FUNCTIONS.includes(f));
  if (unknownFunctions.length) {
    throw new Error(`Unknown clientFunctions key(s): ${unknownFunctions.join(", ")}. Valid: ${CLIENT_SCRIPT_FUNCTIONS.join(", ")}`);
  }
  if (Object.keys(clientFunctions).length && !def.supportsClientFunctions) {
    throw new Error(`clientFunctions is only valid for scriptType 'clientScript', not '${scriptType}' — every other script type's entry points come from the .js file's own exports, with no XML declaration`);
  }

  const scriptid = `customscript_${scriptIdSuffix}`;
  const scriptFileName = `${scriptIdSuffix}.js`;
  const scriptFilePath = `/SuiteScripts/${scriptFileName}`;

  const lines = [`<${def.rootTag} scriptid="${scriptid}">`];
  lines.push(boolTag("isinactive", isInactive));
  lines.push(`    <name>${xmlEscape(name)}</name>`);
  lines.push(boolTag("notifyowner", notifyOwner));
  if (notifyAdmins) lines.push(boolTag("notifyadmins", notifyAdmins));
  if (notifyEmails.trim()) lines.push(`    <notifyemails>${xmlEscape(notifyEmails)}</notifyemails>`);
  lines.push(`    <scriptfile>[${scriptFilePath}]</scriptfile>`);

  if (def.supportsClientFunctions) {
    for (const fn of CLIENT_SCRIPT_FUNCTIONS) {
      if (clientFunctions[fn]) {
        const tag = `${fn.toLowerCase()}function`;
        lines.push(`    <${tag}>${xmlEscape(clientFunctions[fn])}</${tag}>`);
      }
    }
  }

  if (deployments.length) {
    lines.push("    <scriptdeployments>");
    for (const d of deployments) lines.push(buildScriptDeploymentXml(d).xml);
    lines.push("    </scriptdeployments>");
  }

  lines.push(`</${def.rootTag}>`);

  return { scriptid, xml: lines.join("\n") + "\n", scriptFileName, scriptFilePath };
}

/**
 * Attaches a new scriptdeployment to an ALREADY-EXISTING script object's local XML file
 * (sdf/src/Objects/<scriptid>.xml — built by netsuite_create_script or pulled down via
 * netsuite_import_sdf_object), without rewriting the script itself. Text-based edit, not a full
 * XML parse — expects the file to end with a single closing root tag on its own line, which is
 * what every builder in this project produces; a hand-edited or unusually-formatted file may not
 * match and will throw rather than silently corrupt the file.
 */
export function appendScriptDeployment(scriptid, deploymentOpts) {
  const filePath = path.join(SDF_PROJECT_DIR, "src", "Objects", `${scriptid}.xml`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`No local object file found for scriptid '${scriptid}' at ${filePath} — build it first (netsuite_create_script) or pull it down (netsuite_import_sdf_object)`);
  }
  const original = fs.readFileSync(filePath, "utf8");
  const { xml: deploymentXml } = buildScriptDeploymentXml(deploymentOpts);

  let updated;
  if (original.includes("</scriptdeployments>")) {
    updated = original.replace("</scriptdeployments>", `${deploymentXml}\n    </scriptdeployments>`);
  } else {
    const closingTagMatch = original.match(/<\/[a-zA-Z0-9_]+>\s*$/);
    if (!closingTagMatch) {
      throw new Error(`Could not find a closing root tag at the end of ${filePath} — file may be malformed or unusually structured; edit it manually instead`);
    }
    const insertion = `    <scriptdeployments>\n${deploymentXml}\n    </scriptdeployments>\n`;
    updated = original.slice(0, closingTagMatch.index) + insertion + original.slice(closingTagMatch.index);
  }

  fs.writeFileSync(filePath, updated, "utf8");
  return { xml: updated };
}
