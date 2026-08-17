import { xmlEscape, boolTag, scriptIdRef } from "./xmlUtils.js";

// Source: NetSuite SDF XML reference for customrecordtype. Not exhaustive — subtabs, sublists,
// and permissions blocks are not supported here; this covers recordname/access/behavior flags
// plus nested custom fields (customrecordcustomfields), the common case for a new custom record.
//
// Custom Record Custom Field (from your original list) is NOT a standalone SDF object — it's a
// <customrecordcustomfield> nested inside this object's <customrecordcustomfields>, which is why
// it's built here via the `fields` param rather than as its own category/tool.
//
// Nested field scriptid: NetSuite's docs describe a "<parentScriptId>.<childScriptId>" dotted
// convention, but confirmed live that's wrong two ways over — a literal dot fails validation
// ("Script ID can only contain lowercase alphabet, digit or underscore"), and prefixing with the
// parent's full scriptid also fails ("must not be empty and start with 'custrecord'"). The nested
// field's scriptid is just a flat, independent custrecord_<suffix> — no parent prefix at all.

const VALID_ACCESS_TYPES = ["CUSTRECORDENTRYPERM", "NOPERM", "CUSTRECORDNONE"];

function buildNestedFieldXml(field) {
  const {
    scriptIdSuffix,
    label,
    fieldType,
    selectRecordType,
    mandatory = false,
    storeValue = true,
    help = "",
    description = "",
    displayType = "NORMAL",
  } = field;

  if (!scriptIdSuffix || !/^[a-z][a-z0-9_]*$/.test(scriptIdSuffix)) {
    throw new Error(`Custom record field scriptIdSuffix '${scriptIdSuffix}' must be lowercase, start with a letter, and contain only letters/digits/underscores`);
  }
  if (!label || !label.trim()) {
    throw new Error(`Custom record field '${scriptIdSuffix}' requires a label`);
  }
  if ((fieldType === "SELECT" || fieldType === "MULTISELECT") && !selectRecordType) {
    throw new Error(`Custom record field '${scriptIdSuffix}' requires selectRecordType when fieldType is SELECT/MULTISELECT`);
  }

  const scriptid = `custrecord_${scriptIdSuffix}`;
  const lines = [`        <customrecordcustomfield scriptid="${scriptid}">`];
  lines.push(`            <label>${xmlEscape(label)}</label>`);
  lines.push(`            <fieldtype>${fieldType}</fieldtype>`);
  if (selectRecordType) lines.push(`            <selectrecordtype>${xmlEscape(selectRecordType)}</selectrecordtype>`);
  lines.push(boolTag("ismandatory", mandatory, "            "));
  lines.push(boolTag("storevalue", storeValue, "            "));
  if (help.trim()) lines.push(`            <help>${xmlEscape(help)}</help>`);
  if (description.trim()) lines.push(`            <description>${xmlEscape(description)}</description>`);
  lines.push(`            <displaytype>${displayType}</displaytype>`);
  lines.push(`        </customrecordcustomfield>`);
  return lines.join("\n");
}

/**
 * @param {object} opts
 * @param {string} opts.scriptIdSuffix - e.g. 'project_code' -> customrecord_project_code
 * @param {string} opts.recordName - display name shown in the UI
 * @param {string} [opts.description]
 * @param {string} [opts.accessType] - default 'CUSTRECORDENTRYPERM'
 * @param {boolean} [opts.allowAttachments] - default true
 * @param {boolean} [opts.allowQuickAdd] - default true
 * @param {boolean} [opts.allowUiAccess] - default true
 * @param {boolean} [opts.enableNumbering] - default false
 * @param {boolean} [opts.hierarchical] - default false
 * @param {boolean} [opts.isInactive] - default false
 * @param {boolean} [opts.showNotes] - default true
 * @param {object[]} [opts.fields] - array of { scriptIdSuffix, label, fieldType, selectRecordType?, mandatory?, storeValue?, help?, description?, displayType? }
 * @param {string} [opts.customSegmentScriptId] - set this when this record type is the VALUES record for a Custom Segment (netsuite_create_custom_segment) — confirmed live this reciprocal link is required, a plain one-way reference from the segment isn't enough ("A custom segment cannot reference a custom record type that is not associated with it"). When set, recordName/accessType/allowUiAccess/enableNumbering/hierarchical/isInactive are omitted from the output — NetSuite manages those for a segment's values record and rejects them if present.
 */
export function buildCustomRecordTypeXml(opts) {
  const {
    scriptIdSuffix,
    recordName,
    description = "",
    accessType = "CUSTRECORDENTRYPERM",
    allowAttachments = true,
    allowQuickAdd = true,
    allowUiAccess = true,
    enableNumbering = false,
    hierarchical = false,
    isInactive = false,
    showNotes = true,
    fields = [],
    customSegmentScriptId,
  } = opts;

  if (!scriptIdSuffix || !/^[a-z][a-z0-9_]*$/.test(scriptIdSuffix)) {
    throw new Error("scriptIdSuffix must be lowercase, start with a letter, and contain only letters/digits/underscores");
  }
  if (!recordName || !recordName.trim()) {
    throw new Error("recordName is required");
  }
  if (!VALID_ACCESS_TYPES.includes(accessType)) {
    throw new Error(`Invalid accessType '${accessType}'. Valid values: ${VALID_ACCESS_TYPES.join(", ")}`);
  }

  const scriptid = `customrecord_${scriptIdSuffix}`;

  // Confirmed live: once a record type is linked to a Custom Segment (customSegmentScriptId set),
  // several normally-required fields become "invalid or not supported" — recordname, accesstype,
  // allowuiaccess, enablenumbering, hierarchical, isinactive. NetSuite auto-manages these for a
  // segment's values record, so they're omitted entirely in that mode rather than emitted and
  // warned about.
  const lines = [`<customrecordtype scriptid="${scriptid}">`];
  if (!customSegmentScriptId) {
    lines.push(`    <recordname>${xmlEscape(recordName)}</recordname>`);
    lines.push(`    <accesstype>${accessType}</accesstype>`);
  }
  if (description.trim()) lines.push(`    <description>${xmlEscape(description)}</description>`);
  lines.push(boolTag("allowattachments", allowAttachments));
  lines.push(boolTag("allowquickadd", allowQuickAdd));
  if (!customSegmentScriptId) {
    lines.push(boolTag("allowuiaccess", allowUiAccess));
    lines.push(boolTag("enablenumbering", enableNumbering));
    lines.push(boolTag("hierarchical", hierarchical));
    lines.push(boolTag("isinactive", isInactive));
  }
  lines.push(boolTag("shownotes", showNotes));
  if (customSegmentScriptId) lines.push(`    <customsegment>${scriptIdRef(customSegmentScriptId)}</customsegment>`);

  if (fields.length) {
    lines.push("    <customrecordcustomfields>");
    for (const field of fields) {
      lines.push(buildNestedFieldXml(field));
    }
    lines.push("    </customrecordcustomfields>");
  }

  lines.push("</customrecordtype>");

  return { scriptid, xml: lines.join("\n") + "\n" };
}
