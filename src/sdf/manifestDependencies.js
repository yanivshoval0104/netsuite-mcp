import fs from "fs";
import path from "path";
import { SDF_PROJECT_DIR } from "./deployRunner.js";

// Confirmed live: referencing an object by scriptid that ISN'T itself part of the local project
// (e.g. a Saved Search, which can't be authored via SDF at all — see Tier 5) fails validation
// unless manifest.xml explicitly lists it under <dependencies><objects>. Objects that ARE part of
// the same local deploy (already have their own file in Objects/) do not need this — only true
// external references do.

const MANIFEST_PATH = path.join(SDF_PROJECT_DIR, "src", "manifest.xml");

/**
 * Idempotently adds <object>scriptid</object> under manifest.xml's <dependencies><objects>,
 * creating that <objects> block if it doesn't exist yet. No-op if already present.
 */
export function ensureManifestObjectDependency(scriptid) {
  const manifest = fs.readFileSync(MANIFEST_PATH, "utf8");
  if (manifest.includes(`<object>${scriptid}</object>`)) return;

  let updated;
  if (manifest.includes("<objects>")) {
    updated = manifest.replace("<objects>", `<objects>\n            <object>${scriptid}</object>`);
  } else if (manifest.includes("<dependencies>")) {
    updated = manifest.replace(
      "<dependencies>",
      `<dependencies>\n        <objects>\n            <object>${scriptid}</object>\n        </objects>`
    );
  } else {
    updated = manifest.replace(
      "</manifest>",
      `    <dependencies>\n        <objects>\n            <object>${scriptid}</object>\n        </objects>\n    </dependencies>\n</manifest>`
    );
  }

  fs.writeFileSync(MANIFEST_PATH, updated, "utf8");
}
