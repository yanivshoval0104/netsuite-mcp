import { xmlEscape, boolTag, scriptIdRef } from "./xmlUtils.js";

// Source: NetSuite SDF XML reference for customsegment. scriptid prefix is 'cseg_' (not
// 'customsegment_'). SDF only supports custom segments that use unified IDs (the default/only
// mode SDF creates).
//
// IMPORTANT: every custom segment needs an ASSOCIATED customrecordtype that defines its possible
// values — this builder does NOT create that record type for you. Build it first with
// buildCustomRecordTypeXml/netsuite_create_custom_record_type, then pass its scriptid here as
// recordTypeScriptId. This is a deliberate composition, not an oversight — auto-creating a hidden
// companion object would be a surprising side effect for a tool that's supposed to be mechanical.
//
// CONFIRMED LIVE 2026-08-17: a one-way reference from the segment to the record type is NOT
// enough ("A custom segment cannot reference a custom record type that is not associated with
// it") — the record type must ALSO carry a reciprocal <customsegment> link back to the segment.
// Pass customSegmentScriptId when building that record type (see customRecordType.js). With
// both links present, this validates completely clean.
//
// segmentapplication's presence-tag shape (<transactionbody/> present = enabled, absent =
// disabled, rather than T/F booleans) is confirmed correct — validated clean live.

const VALID_ACCESS_LEVELS = ["VIEW", "EDIT", "FULL"];
const VALID_ITEM_SUBTYPES = ["BOTH", "INVTPART", "NONINVTPART"];
const APPLICATION_AREAS = ["transactionbody", "transactionline", "entities", "crm", "customrecords"];

/**
 * @param {object} opts
 * @param {string} opts.scriptIdSuffix - e.g. 'region' -> cseg_region
 * @param {string} opts.label
 * @param {string} opts.recordTypeScriptId - scriptid of the associated customrecordtype (build separately)
 * @param {string} [opts.fieldType] - 'SELECT' or 'MULTISELECT', default 'SELECT'
 * @param {string[]} opts.applicationAreas - which of APPLICATION_AREAS to enable
 * @param {string} [opts.itemSubtype] - if 'items' should be enabled, one of VALID_ITEM_SUBTYPES; omit to leave items disabled
 * @param {boolean} [opts.hasGlImpact] - default false. Cannot be changed after creation on a live account.
 * @param {boolean} [opts.isMandatory] - default false
 * @param {string} [opts.defaultRecordAccessLevel] - default 'VIEW'
 * @param {string} [opts.defaultSearchAccessLevel] - default 'VIEW'
 */
export function buildCustomSegmentXml(opts) {
  const {
    scriptIdSuffix,
    label,
    recordTypeScriptId,
    fieldType = "SELECT",
    applicationAreas = [],
    itemSubtype,
    hasGlImpact = false,
    isMandatory = false,
    defaultRecordAccessLevel = "VIEW",
    defaultSearchAccessLevel = "VIEW",
  } = opts;

  if (!scriptIdSuffix || !/^[a-z][a-z0-9_]*$/.test(scriptIdSuffix)) {
    throw new Error("scriptIdSuffix must be lowercase, start with a letter, and contain only letters/digits/underscores");
  }
  if (!label || !label.trim()) {
    throw new Error("label is required");
  }
  if (!recordTypeScriptId) {
    throw new Error("recordTypeScriptId is required — build the associated customrecordtype first (netsuite_create_custom_record_type) and pass its scriptid here");
  }
  if (!["SELECT", "MULTISELECT"].includes(fieldType)) {
    throw new Error("fieldType must be 'SELECT' or 'MULTISELECT'");
  }
  const unknownAreas = applicationAreas.filter((a) => !APPLICATION_AREAS.includes(a));
  if (unknownAreas.length) {
    throw new Error(`Unknown applicationAreas: ${unknownAreas.join(", ")}. Valid: ${APPLICATION_AREAS.join(", ")}`);
  }
  if (!applicationAreas.length && !itemSubtype) {
    throw new Error(`applicationAreas must name at least one target area (or set itemSubtype). Valid areas: ${APPLICATION_AREAS.join(", ")}`);
  }
  if (itemSubtype && !VALID_ITEM_SUBTYPES.includes(itemSubtype)) {
    throw new Error(`Invalid itemSubtype '${itemSubtype}'. Valid values: ${VALID_ITEM_SUBTYPES.join(", ")}`);
  }
  if (!VALID_ACCESS_LEVELS.includes(defaultRecordAccessLevel)) {
    throw new Error(`Invalid defaultRecordAccessLevel. Valid values: ${VALID_ACCESS_LEVELS.join(", ")}`);
  }
  if (!VALID_ACCESS_LEVELS.includes(defaultSearchAccessLevel)) {
    throw new Error(`Invalid defaultSearchAccessLevel. Valid values: ${VALID_ACCESS_LEVELS.join(", ")}`);
  }

  const scriptid = `cseg_${scriptIdSuffix}`;

  const lines = [`<customsegment scriptid="${scriptid}">`];
  lines.push(`    <label>${xmlEscape(label)}</label>`);
  lines.push(`    <fieldtype>${fieldType}</fieldtype>`);
  lines.push(`    <recordtype>${scriptIdRef(recordTypeScriptId)}</recordtype>`);
  lines.push(boolTag("hasglimpact", hasGlImpact));
  lines.push(boolTag("ismandatory", isMandatory));
  lines.push(`    <defaultrecordaccesslevel>${defaultRecordAccessLevel}</defaultrecordaccesslevel>`);
  lines.push(`    <defaultsearchaccesslevel>${defaultSearchAccessLevel}</defaultsearchaccesslevel>`);
  lines.push("    <segmentapplication>");
  for (const area of APPLICATION_AREAS) {
    lines.push(applicationAreas.includes(area) ? `        <${area}></${area}>` : "");
  }
  if (itemSubtype) {
    lines.push("        <items>");
    lines.push(`            <subtype>${itemSubtype}</subtype>`);
    lines.push("        </items>");
  }
  lines.push("    </segmentapplication>");
  lines.push("</customsegment>");

  return { scriptid, xml: lines.filter((l) => l !== "").join("\n") + "\n" };
}
