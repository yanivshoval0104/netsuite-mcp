import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SDF_PROJECT_DIR = path.join(__dirname, "..", "..", "sdf");

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name} (SDF/OAuth2 M2M setup is separate from the TBA vars used for REST calls — see NETSUITE_ADMIN_SETUP.md steps 4-6)`);
  return value;
}

function runSuitecloud(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["suitecloud", ...args], {
      cwd: SDF_PROJECT_DIR,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));

    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

/**
 * Ensures the SuiteCloud CLI has a saved CI auth id for this account, by
 * running `account:setup:ci` if the configured authid isn't already known.
 * NOT idempotent by default — re-running account:setup:ci with an authid
 * that's already registered fails with "This authentication ID is already in
 * use" (exit code 1), even though nothing is actually wrong. When that
 * specific failure happens, fall back to `--select` to just make the
 * already-registered authid the project default again, which is what every
 * caller here actually needs.
 */
export async function ensureCiAuth() {
  const accountId = requiredEnv("NETSUITE_ACCOUNT_ID");
  const authId = requiredEnv("NETSUITE_SDF_AUTH_ID");
  const certificateId = requiredEnv("NETSUITE_SDF_CERTIFICATE_ID");
  const privateKeyPath = requiredEnv("NETSUITE_SDF_PRIVATE_KEY_PATH");

  // Passed relative to SDF_PROJECT_DIR (the child process's cwd), not as an absolute path —
  // this repo lives under a directory with a space in its name ("Salesforce Projects"), and the
  // suitecloud CLI's internal process invocation mis-splits absolute paths containing spaces
  // ("Option '-privatekeypath' expects only one value"). A relative path never spells out the
  // space-containing parent directory as literal argument text, so it can't be split there.
  const absoluteKeyPath = path.resolve(SDF_PROJECT_DIR, "..", privateKeyPath);
  const relativeKeyPath = path.relative(SDF_PROJECT_DIR, absoluteKeyPath);

  const result = await runSuitecloud([
    "account:setup:ci",
    "--account", accountId,
    "--authid", authId,
    "--certificateid", certificateId,
    "--privatekeypath", relativeKeyPath,
  ]);

  if (result.code !== 0 && /already in use/i.test(result.stdout + result.stderr)) {
    return runSuitecloud(["account:setup:ci", "--select", authId]);
  }

  return result;
}

/**
 * Validates the SDF project against the account without deploying anything.
 * No --authid here — project:validate doesn't accept that option at all; it
 * always uses whatever ensureCiAuth() most recently set as the project's
 * default auth (account:setup:ci is what controls the default, not per-call flags).
 */
export async function validateProject() {
  return runSuitecloud(["project:validate"]);
}

/**
 * Deploys the SDF project (everything under sdf/src/Objects, per deploy.xml)
 * to the live account. This is a real, mutating operation on the account.
 */
export async function deployProject() {
  return runSuitecloud(["project:deploy", "--accountspecificvalues", "WARNING"]);
}

/**
 * Imports an existing object's XML definition from the live account into
 * the local SDF project. This is the primary path for object types Oracle
 * recommends importing rather than hand-authoring (forms, dashboards,
 * workbooks/datasets, KPI scorecards, financial layouts, etc.) — writes only
 * to the local project, but still requires CI auth to reach the account.
 */
export async function importObject({ type, scriptId, destinationFolder = "/Objects" }) {
  return runSuitecloud([
    "object:import",
    "--type", type,
    "--scriptid", scriptId,
    "--destinationfolder", destinationFolder,
  ]);
}
