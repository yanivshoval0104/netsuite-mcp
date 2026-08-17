import { xmlEscape, boolTag, scriptIdRef } from "./xmlUtils.js";

// Source: NetSuite SDF XML reference for advancedpdftemplate (requires the ADVANCEDPRINTING
// feature). Two-file object, same pattern as emailTemplate.js: metadata XML built here, plus a
// separate "<scriptid>.template.xml" body file (FreeMarker/XML markup) supplied by the caller.

/**
 * @param {object} opts
 * @param {string} opts.scriptIdSuffix - e.g. 'paymentvoucher' -> custtmpl_paymentvoucher
 * @param {string} opts.title
 * @param {string} [opts.description]
 * @param {boolean} [opts.displaySourceCode] - default false
 * @param {boolean} [opts.preferred] - default false
 * @param {boolean} [opts.isInactive] - default false
 * @param {string} [opts.tranType]
 * @param {string} [opts.printType]
 * @param {string} opts.savedSearchScriptId - required (confirmed live: "the savedsearch is missing a required value" without it) — scriptid of an existing Saved Search (build via UI + netsuite_import_sdf_object, see Tier 5)
 * @param {string} [opts.recordTypeScriptId] - ref to a customtransactiontype or customrecordtype
 */
export function buildAdvancedTemplateXml(opts) {
  const {
    scriptIdSuffix,
    title,
    description = "",
    displaySourceCode = false,
    preferred = false,
    isInactive = false,
    tranType = "",
    printType = "",
    savedSearchScriptId,
    recordTypeScriptId,
  } = opts;

  if (!scriptIdSuffix || !/^[a-z][a-z0-9_]*$/.test(scriptIdSuffix)) {
    throw new Error("scriptIdSuffix must be lowercase, start with a letter, and contain only letters/digits/underscores");
  }
  if (!title || !title.trim()) throw new Error("title is required");
  if (!savedSearchScriptId) {
    throw new Error("savedSearchScriptId is required — confirmed live NetSuite rejects an advancedpdftemplate without one. Saved Searches can't be authored via SDF (see netsuite_import_sdf_object); build one in the UI and import it first.");
  }

  const scriptid = `custtmpl_${scriptIdSuffix}`;

  const lines = [`<advancedpdftemplate scriptid="${scriptid}">`];
  lines.push(`    <title>${xmlEscape(title)}</title>`);
  if (description.trim()) lines.push(`    <description>${xmlEscape(description)}</description>`);
  lines.push(boolTag("displaysourcecode", displaySourceCode));
  lines.push(boolTag("preferred", preferred));
  lines.push(boolTag("isinactive", isInactive));
  if (tranType.trim()) lines.push(`    <trantype>${xmlEscape(tranType)}</trantype>`);
  if (printType.trim()) lines.push(`    <printtype>${xmlEscape(printType)}</printtype>`);
  lines.push(`    <savedsearch>${scriptIdRef(savedSearchScriptId)}</savedsearch>`);
  if (recordTypeScriptId) lines.push(`    <recordtype>${scriptIdRef(recordTypeScriptId)}</recordtype>`);
  lines.push("</advancedpdftemplate>");

  return { scriptid, xml: lines.join("\n") + "\n", templateFileName: `${scriptid}.template.xml` };
}
