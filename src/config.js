import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export function loadConfig() {
  const accountId = required("NETSUITE_ACCOUNT_ID");
  const consumerKey = required("NETSUITE_CONSUMER_KEY");
  const consumerSecret = required("NETSUITE_CONSUMER_SECRET");
  const tokenId = required("NETSUITE_TOKEN_ID");
  const tokenSecret = required("NETSUITE_TOKEN_SECRET");

  const hostAccount = accountId.toLowerCase().replace(/_/g, "-");
  const baseUrl = `https://${hostAccount}.suitetalk.api.netsuite.com`;
  const realm = accountId.toUpperCase();

  return { accountId, consumerKey, consumerSecret, tokenId, tokenSecret, baseUrl, realm };
}
