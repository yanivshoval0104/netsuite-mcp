import { loadConfig } from "./config.js";
import * as ns from "./netsuiteClient.js";

const config = loadConfig();

const recordType = process.argv[2] || "customer";

try {
  const result = await ns.getRecordMetadata(config, recordType);
  const fields = Object.keys(result.body.properties || {});
  console.log(`Connection OK. ${fields.length} fields on '${recordType}':`);
  console.log(fields.join(", "));
} catch (err) {
  console.error("Connection failed:", err.message);
  process.exit(1);
}
