import fs from "fs";
import path from "path";
import { SDF_PROJECT_DIR } from "../deployRunner.js";

// deploy.xml is a wildcard manifest (~/Objects/*, ~/FileCabinet/*, ~/Translations/*), so a
// project:deploy always pushes everything listed here at once, not just what the most recent
// tool call wrote. This tool exists so a caller can see that full blast radius before deploying.

function listXmlObjects(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".xml"))
    .map((f) => {
      const content = fs.readFileSync(path.join(dir, f), "utf8");
      const tagMatch = content.match(/<([a-zA-Z0-9_]+)[\s>]/);
      const scriptidMatch = content.match(/scriptid="([^"]+)"/);
      return {
        file: f,
        rootTag: tagMatch ? tagMatch[1] : null,
        scriptid: scriptidMatch ? scriptidMatch[1] : null,
      };
    });
}

function listFilesRecursive(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  let out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out = out.concat(listFilesRecursive(full, base));
    } else if (entry.name !== ".gitkeep") {
      out.push(path.relative(base, full));
    }
  }
  return out;
}

export function registerPendingObjectsTools(server) {
  server.tool(
    "netsuite_list_pending_sdf_objects",
    "Lists everything currently staged in the local SDF project (sdf/src/Objects, " +
      "sdf/src/FileCabinet, sdf/src/Translations) that a project:deploy would push to the live " +
      "account. deploy.xml is a wildcard deploy manifest, so a deploy pushes EVERYTHING listed " +
      "here at once, not just what the most recent tool call wrote — call this before any " +
      "dryRun=false deploy to see the full blast radius.",
    {},
    async () => {
      const objectsDir = path.join(SDF_PROJECT_DIR, "src", "Objects");
      const fileCabinetDir = path.join(SDF_PROJECT_DIR, "src", "FileCabinet");
      const translationsDir = path.join(SDF_PROJECT_DIR, "src", "Translations");
      const result = {
        objects: listXmlObjects(objectsDir),
        fileCabinetFiles: listFilesRecursive(fileCabinetDir),
        translationFiles: listFilesRecursive(translationsDir),
      };
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  return server;
}
