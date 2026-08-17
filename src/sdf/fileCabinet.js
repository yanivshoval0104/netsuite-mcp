import path from "path";

// File Cabinet files deploy as literal files, not XML customization objects — SDF pushes
// whatever's under sdf/src/FileCabinet/* per deploy.xml's wildcard <files> entry. No XML to
// generate here; this just validates the target path is actually inside FileCabinet before
// anything gets written to disk.

/**
 * @param {string} targetPath - path relative to the File Cabinet root, e.g. 'SuiteScripts/lib/util.js'
 * @returns {string} the sanitized, project-relative path (under 'FileCabinet/')
 */
export function resolveFileCabinetPath(targetPath) {
  if (!targetPath || typeof targetPath !== "string") {
    throw new Error("targetPath is required");
  }
  if (path.isAbsolute(targetPath)) {
    throw new Error(`targetPath '${targetPath}' must be relative, not absolute`);
  }
  const normalized = path.normalize(targetPath);
  if (normalized.split(/[/\\]/).includes("..")) {
    throw new Error(`targetPath '${targetPath}' must not contain '..' segments (would traverse outside the File Cabinet)`);
  }
  return path.join("FileCabinet", normalized);
}
