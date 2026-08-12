import { loadConfig } from "./config.js";
import * as ns from "./netsuiteClient.js";

const config = loadConfig();
const recordType = "customrecord_mm_project_codes";
const testValueName = "CLAUDE_MCP_TEST_DELETE_ME";

try {
  console.log(`Creating test value on '${recordType}'...`);
  const createResult = await ns.createRecord(config, recordType, { name: testValueName });
  console.log("Create response status:", createResult.status);
  console.log("Location header:", createResult.location);

  if (!createResult.location) {
    throw new Error("No Location header returned; cannot determine new record id.");
  }
  const id = createResult.location.split("/").filter(Boolean).pop();
  console.log("New record id:", id);

  console.log("Verifying via GET...");
  const getResult = await ns.getRecord(config, recordType, id);
  console.log("Fetched record:", JSON.stringify(getResult.body, null, 2));

  console.log("Deleting test value...");
  const deleteResult = await ns.deleteRecord(config, recordType, id);
  console.log("Delete response status:", deleteResult.status);

  console.log("Verifying deletion (expect 404)...");
  try {
    await ns.getRecord(config, recordType, id);
    console.error("Unexpected: record still exists after delete.");
    process.exit(1);
  } catch (err) {
    if (err.message.includes("404")) {
      console.log("Confirmed deleted (404 on re-fetch). Full CRUD cycle succeeded, no residue left.");
    } else {
      throw err;
    }
  }
} catch (err) {
  console.error("CRUD test failed:", err.message);
  process.exit(1);
}
