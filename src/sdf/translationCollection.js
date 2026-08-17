import { xmlEscape } from "./xmlUtils.js";

// Source: NetSuite SDF XML reference for translationcollection. scriptid prefix
// 'custcollection_'. Inline <strings> is used here (scriptid + defaulttranslation + description
// per string) rather than external XLIFF files — XLIFF is the alternative NetSuite supports for
// per-language translated values, not modeled here.
//
// UNVERIFIED placement: this writes into sdf/src/Objects/ like every other object, matching the
// "SDF Custom Object File Structure" doc's general claim that all objects live in Objects/. The
// project's deploy.xml separately has a dedicated <translationimports> section pointed at
// sdf/src/Translations/*, which may be a distinct mechanism (importing translated UI strings
// project-wide) rather than where this specific object type belongs. Confirm placement with a
// live project:validate before trusting this beyond a smoke test.

/**
 * @param {object} opts
 * @param {string} opts.scriptIdSuffix - e.g. 'mystrings' -> custcollection_mystrings
 * @param {string} opts.name
 * @param {string} opts.defaultLanguage - e.g. 'en'
 * @param {string} [opts.description]
 * @param {object[]} opts.strings - array of { scriptId, defaultTranslation, description? }
 */
export function buildTranslationCollectionXml(opts) {
  const { scriptIdSuffix, name, defaultLanguage, description = "", strings = [] } = opts;

  if (!scriptIdSuffix || !/^[a-z][a-z0-9_]*$/.test(scriptIdSuffix)) {
    throw new Error("scriptIdSuffix must be lowercase, start with a letter, and contain only letters/digits/underscores");
  }
  if (!name || !name.trim()) throw new Error("name is required");
  if (!defaultLanguage || !defaultLanguage.trim()) throw new Error("defaultLanguage is required");
  if (!strings.length) throw new Error("strings must contain at least one entry");

  const scriptid = `custcollection_${scriptIdSuffix}`;

  const lines = [`<translationcollection scriptid="${scriptid}">`];
  lines.push(`    <name>${xmlEscape(name)}</name>`);
  lines.push(`    <defaultlanguage>${xmlEscape(defaultLanguage)}</defaultlanguage>`);
  if (description.trim()) lines.push(`    <description>${xmlEscape(description)}</description>`);
  lines.push("    <strings>");
  for (const s of strings) {
    const { scriptId, defaultTranslation, description: stringDescription } = s;
    if (!scriptId || defaultTranslation === undefined) {
      throw new Error("Each string requires scriptId and defaultTranslation");
    }
    lines.push(`        <string scriptid="${xmlEscape(scriptId)}">`);
    lines.push(`            <defaulttranslation>${xmlEscape(defaultTranslation)}</defaulttranslation>`);
    if (stringDescription) lines.push(`            <description>${xmlEscape(stringDescription)}</description>`);
    lines.push("        </string>");
  }
  lines.push("    </strings>");
  lines.push("</translationcollection>");

  return { scriptid, xml: lines.join("\n") + "\n" };
}
