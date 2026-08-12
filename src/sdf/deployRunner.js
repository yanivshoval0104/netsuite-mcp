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
 * Idempotent-ish: if it's already set up, this just re-registers the same
 * cert/key, which is harmless.
 */
export async function ensureCiAuth() {
  const accountId = requiredEnv("NETSUITE_ACCOUNT_ID");
  const authId = requiredEnv("NETSUITE_SDF_AUTH_ID");
  const certificateId = requiredEnv("NETSUITE_SDF_CERTIFICATE_ID");
  const privateKeyPath = requiredEnv("NETSUITE_SDF_PRIVATE_KEY_PATH");

  return runSuitecloud([
    "account:setup:ci",
    "--account", accountId,
    "--authid", authId,
    "--certificateid", certificateId,
    "--privatekeypath", path.resolve(SDF_PROJECT_DIR, "..", privateKeyPath),
  ]);
}

/**
 * Validates the SDF project against the account without deploying anything.
 */
export async function validateProject() {
  const authId = requiredEnv("NETSUITE_SDF_AUTH_ID");
  return runSuitecloud(["project:validate", "--authid", authId]);
}

/**
 * Deploys the SDF project (everything under sdf/src/Objects, per deploy.xml)
 * to the live account. This is a real, mutating operation on the account.
 */
export async function deployProject() {
  const authId = requiredEnv("NETSUITE_SDF_AUTH_ID");
  return runSuitecloud([
    "project:deploy",
    "--authid", authId,
    "--accountspecificvalues", "WARNING",
  ]);
}
