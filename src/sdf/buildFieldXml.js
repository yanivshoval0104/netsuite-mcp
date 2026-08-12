import { resolveCategory, VALID_FIELD_TYPES } from "./fieldCategories.js";

function xmlEscape(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function boolTag(name, value) {
  return `    <${name}>${value ? "T" : "F"}</${name}>`;
}

/**
 * Builds the SDF XML definition for a custom field object.
 *
 * @param {object} opts
 * @param {string} opts.category - one of the keys in FIELD_CATEGORIES ('entity', 'transactionBody', 'item')
 * @param {string} opts.scriptIdSuffix - short name, e.g. 'my_field' -> custentity_my_field
 * @param {string} opts.label
 * @param {string} opts.fieldType - one of VALID_FIELD_TYPES
 * @param {string[]} opts.appliesTo - which of the category's appliesto* flags to set true (rest default false)
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

  const scriptid = `${def.scriptidPrefix}${scriptIdSuffix}`;

  const lines = [`<${def.tag} scriptid="${scriptid}">`];
  for (const flag of def.appliesTo) {
    lines.push(boolTag(flag, appliesTo.includes(flag)));
  }
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
