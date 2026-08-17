import { resolveCategory, VALID_FIELD_TYPES } from "./fieldCategories.js";
import { xmlEscape, boolTag } from "./xmlUtils.js";

/**
 * Builds the SDF XML definition for a custom field object.
 *
 * Two category shapes exist (see fieldCategories.js): most categories are "appliesTo" mode (a
 * set of boolean target-subtype flags); `other` is "rectype" mode (a single target record type
 * value instead). This function branches on `def.mode` to build the right target element(s), then
 * shares the rest of the field-shape lines (label/fieldtype/etc.) across both.
 *
 * @param {object} opts
 * @param {string} opts.category - one of the keys in FIELD_CATEGORIES
 * @param {string} opts.scriptIdSuffix - short name, e.g. 'my_field' -> custentity_my_field
 * @param {string} opts.label
 * @param {string} opts.fieldType - one of VALID_FIELD_TYPES
 * @param {string[]} [opts.appliesTo] - appliesTo-mode categories only: which appliesto-/col-prefixed flags to set true
 * @param {string|number} [opts.rectype] - rectype-mode categories only: a key in def.rectypes, or a raw numeric override
 * @param {number|string} [opts.selectRecordType] - required if fieldType is SELECT/MULTISELECT
 * @param {boolean} [opts.mandatory]
 * @param {boolean} [opts.storeValue] - default true
 * @param {string} [opts.help]
 * @param {string} [opts.description]
 * @param {string} [opts.displayType] - NORMAL | DISABLED | HIDDEN, default NORMAL
 */
export function buildFieldXml(opts) {
  const {
    category,
    scriptIdSuffix,
    label,
    fieldType,
    appliesTo = [],
    rectype,
    selectRecordType,
    mandatory = false,
    storeValue = true,
    help = "",
    description = "",
    displayType = "NORMAL",
  } = opts;

  const def = resolveCategory(category);

  if (!scriptIdSuffix || !/^[a-z][a-z0-9_]*$/.test(scriptIdSuffix)) {
    throw new Error(
      "scriptIdSuffix must be lowercase, start with a letter, and contain only letters/digits/underscores (e.g. 'loyalty_tier')"
    );
  }
  if (!label || !label.trim()) {
    throw new Error("label is required");
  }
  if (!VALID_FIELD_TYPES.includes(fieldType)) {
    throw new Error(`Invalid fieldType '${fieldType}'. Valid values: ${VALID_FIELD_TYPES.join(", ")}`);
  }
  if ((fieldType === "SELECT" || fieldType === "MULTISELECT") && !selectRecordType) {
    throw new Error("selectRecordType is required when fieldType is SELECT or MULTISELECT");
  }

  const targetLines = [];
  if (def.mode === "rectype") {
    if (rectype === undefined || rectype === null || rectype === "") {
      const valid = Object.keys(def.rectypes).join(", ");
      throw new Error(
        `rectype is required for category '${category}'. Known keys: ${valid} (or pass a raw numeric rectype not in this list)`
      );
    }
    const rectypeValue = typeof rectype === "number" ? rectype : def.rectypes[rectype];
    if (rectypeValue === undefined) {
      const valid = Object.keys(def.rectypes).join(", ");
      throw new Error(`Unknown rectype key '${rectype}' for category '${category}'. Known keys: ${valid} (or pass a raw numeric value)`);
    }
    targetLines.push(`    <rectype>${rectypeValue}</rectype>`);
  } else {
    const unknownFlags = appliesTo.filter((f) => !def.appliesTo.includes(f));
    if (unknownFlags.length) {
      throw new Error(
        `Unknown appliesTo flag(s) for category '${category}': ${unknownFlags.join(", ")}. ` +
          `Valid flags: ${def.appliesTo.join(", ")}`
      );
    }
    if (!appliesTo.length) {
      throw new Error(
        `appliesTo must name at least one target record type for category '${category}'. ` +
          `Valid flags: ${def.appliesTo.join(", ")}`
      );
    }
    // Only emit flags actually being set true — NOT the full flag set with F for the rest.
    // Confirmed live: NetSuite's validator flags a manifest feature-dependency requirement for
    // every appliesto*/col* field PRESENT in the XML regardless of its T/F value (e.g. emitting
    // <colexpense>F</colexpense> still demands the ACCOUNTING feature be declared). Omitting
    // unused flags avoids inflating the project's required-feature list with capabilities that
    // aren't even being used.
    for (const flag of appliesTo) {
      targetLines.push(boolTag(flag, true));
    }
  }

  const scriptid = `${def.scriptidPrefix}${scriptIdSuffix}`;

  const lines = [`<${def.tag} scriptid="${scriptid}">`, ...targetLines];
  lines.push(`    <label>${xmlEscape(label)}</label>`);
  lines.push(`    <fieldtype>${fieldType}</fieldtype>`);
  if (selectRecordType) {
    lines.push(`    <selectrecordtype>${xmlEscape(selectRecordType)}</selectrecordtype>`);
  }
  lines.push(boolTag("ismandatory", mandatory));
  lines.push(boolTag("storevalue", storeValue));
  if (help.trim()) lines.push(`    <help>${xmlEscape(help)}</help>`);
  if (description.trim()) lines.push(`    <description>${xmlEscape(description)}</description>`);
  lines.push(`    <displaytype>${displayType}</displaytype>`);
  lines.push(`</${def.tag}>`);

  return { scriptid, xml: lines.join("\n") + "\n" };
}
