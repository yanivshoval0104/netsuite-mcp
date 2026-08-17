import { xmlEscape, scriptIdRef } from "./xmlUtils.js";

// Source: NetSuite SDF XML reference for savedcsvimport. scriptid prefix 'custimport_' per
// Oracle's own example. Note: this object holds import options + mappings only — it does NOT
// contain the CSV data itself. The actual CSV file, if you want one bundled with the project,
// has to go through the File Cabinet tools (Tier 2) as its own file; this builder only wires up
// the mapping definition.

const VALID_DATA_HANDLING = ["ADD", "UPDATE", "ADDUPDATE"];
const VALID_COLUMN_DELIMITERS = ["TAB", "COMMA", "SEMICOLON", "PIPE", "OTHER"];
// "DOT" confirmed live as an invalid value ("Invalid decimaldelimiter reference key DOT") —
// replaced with "PERIOD" as the best-guess corrected value; not independently re-confirmed live.
const VALID_DECIMAL_DELIMITERS = ["COMMA", "PERIOD"];

function buildFieldMappingXml(fm) {
  const { field, value, columnReference } = fm;
  if (!field) throw new Error("Each fieldMapping requires a field");
  if (value === undefined && !columnReference) {
    throw new Error(`fieldMapping for '${field}' requires either value or columnReference`);
  }
  const lines = ["                <fieldmapping>"];
  lines.push(`                    <field>${xmlEscape(field)}</field>`);
  if (columnReference) {
    const { file, column } = columnReference;
    if (!file || !column) throw new Error(`fieldMapping for '${field}': columnReference requires file and column`);
    lines.push("                    <columnreference>");
    lines.push(`                        <file>${xmlEscape(file)}</file>`);
    lines.push(`                        <column>${xmlEscape(column)}</column>`);
    lines.push("                    </columnreference>");
  } else {
    lines.push(value === "" ? "                    <value/>" : `                    <value>${xmlEscape(value)}</value>`);
  }
  lines.push("                </fieldmapping>");
  return lines.join("\n");
}

/**
 * @param {object} opts
 * @param {string} opts.scriptIdSuffix - e.g. 'salesorder' -> custimport_salesorder
 * @param {string} opts.recordType - NetSuite record type constant, e.g. 'SALESORDER'
 * @param {string} opts.importName
 * @param {string} [opts.dataHandling] - default 'ADDUPDATE'
 * @param {string} [opts.columnDelimiter] - default 'COMMA'
 * @param {string} [opts.decimalDelimiter] - default 'PERIOD'
 * @param {string} [opts.description]
 * @param {string} [opts.entryFormScriptId] - required for entity-type imports (e.g. Customer) — one of entryFormScriptId/transactionFormScriptId is required
 * @param {string} [opts.transactionFormScriptId] - required for transaction-type imports (e.g. Sales Order) — one of entryFormScriptId/transactionFormScriptId is required
 * @param {object[]} opts.fileMappings - array of { file, primaryKey?, foreignKey? }
 * @param {object[]} opts.recordMappings - array of { record, fieldMappings: [{ field, value? | columnReference: {file, column} }] }
 */
export function buildSavedCsvImportXml(opts) {
  const {
    scriptIdSuffix,
    recordType,
    importName,
    dataHandling = "ADDUPDATE",
    columnDelimiter = "COMMA",
    decimalDelimiter = "PERIOD",
    description = "",
    entryFormScriptId,
    transactionFormScriptId,
    fileMappings = [],
    recordMappings = [],
  } = opts;

  if (!scriptIdSuffix || !/^[a-z][a-z0-9_]*$/.test(scriptIdSuffix)) {
    throw new Error("scriptIdSuffix must be lowercase, start with a letter, and contain only letters/digits/underscores");
  }
  if (!recordType) throw new Error("recordType is required");
  if (!importName || !importName.trim()) throw new Error("importName is required");
  if (!VALID_DATA_HANDLING.includes(dataHandling)) {
    throw new Error(`Invalid dataHandling '${dataHandling}'. Valid values: ${VALID_DATA_HANDLING.join(", ")}`);
  }
  if (!VALID_COLUMN_DELIMITERS.includes(columnDelimiter)) {
    throw new Error(`Invalid columnDelimiter '${columnDelimiter}'. Valid values: ${VALID_COLUMN_DELIMITERS.join(", ")}`);
  }
  if (!VALID_DECIMAL_DELIMITERS.includes(decimalDelimiter)) {
    throw new Error(`Invalid decimalDelimiter '${decimalDelimiter}'. Valid values: ${VALID_DECIMAL_DELIMITERS.join(", ")}`);
  }
  if (!entryFormScriptId && !transactionFormScriptId) {
    throw new Error("Either entryFormScriptId or transactionFormScriptId is required — confirmed live NetSuite rejects a savedcsvimport with neither ('the object field entryform is missing' for entity-type imports)");
  }
  if (!fileMappings.length) throw new Error("fileMappings must contain at least one entry");
  if (!recordMappings.length) throw new Error("recordMappings must contain at least one entry");

  const scriptid = `custimport_${scriptIdSuffix}`;

  const lines = [`<savedcsvimport scriptid="${scriptid}">`];
  lines.push(`    <recordtype>${xmlEscape(recordType)}</recordtype>`);
  lines.push(`    <importname>${xmlEscape(importName)}</importname>`);
  lines.push(`    <datahandling>${dataHandling}</datahandling>`);
  lines.push(`    <columndelimiter>${columnDelimiter}</columndelimiter>`);
  if (entryFormScriptId) lines.push(`    <entryform>${scriptIdRef(entryFormScriptId)}</entryform>`);
  if (transactionFormScriptId) lines.push(`    <transactionform>${scriptIdRef(transactionFormScriptId)}</transactionform>`);
  if (description.trim()) lines.push(`    <description>${xmlEscape(description)}</description>`);
  lines.push(`    <decimaldelimiter>${decimalDelimiter}</decimaldelimiter>`);

  // Confirmed live: primarykey/foreignkey are only valid when multiple files are being joined —
  // "The filemapping cannot contain a primarykey or foreignkey because one file was specified."
  if (fileMappings.length === 1 && (fileMappings[0].primaryKey || fileMappings[0].foreignKey)) {
    throw new Error("primaryKey/foreignKey are only valid when fileMappings has more than one entry (they join multiple files) — omit them for a single-file import");
  }
  lines.push("    <filemappings>");
  for (const fm of fileMappings) {
    const { file, primaryKey, foreignKey } = fm;
    if (!file) throw new Error("Each fileMapping requires a file");
    lines.push("        <filemapping>");
    lines.push(`            <file>${xmlEscape(file)}</file>`);
    if (primaryKey) lines.push(`            <primarykey>${xmlEscape(primaryKey)}</primarykey>`);
    if (foreignKey) lines.push(`            <foreignkey>${xmlEscape(foreignKey)}</foreignkey>`);
    lines.push("        </filemapping>");
  }
  lines.push("    </filemappings>");

  lines.push("    <recordmappings>");
  for (const rm of recordMappings) {
    const { record, fieldMappings = [] } = rm;
    if (!record) throw new Error("Each recordMapping requires a record");
    if (!fieldMappings.length) throw new Error(`recordMapping for '${record}' requires at least one fieldMapping`);
    lines.push("        <recordmapping>");
    lines.push(`            <record>${xmlEscape(record)}</record>`);
    lines.push("            <fieldmappings>");
    for (const fm of fieldMappings) lines.push(buildFieldMappingXml(fm));
    lines.push("            </fieldmappings>");
    lines.push("        </recordmapping>");
  }
  lines.push("    </recordmappings>");

  lines.push("</savedcsvimport>");

  return { scriptid, xml: lines.join("\n") + "\n" };
}
