import { xmlEscape, boolTag } from "./xmlUtils.js";

// Source: NetSuite SDF XML reference for customtransactiontype. Unlike other objects, the
// scriptid prefix depends on subListStyle: BASIC/JOURNAL/HEADERONLY -> 'customtransaction_',
// SALES -> 'customsale_', PURCHASE -> 'custompurchase_'.

const PREFIX_BY_SUBLIST_STYLE = {
  BASIC: "customtransaction_",
  JOURNAL: "customtransaction_",
  HEADERONLY: "customtransaction_",
  SALES: "customsale_",
  PURCHASE: "custompurchase_",
};

const VALID_POSITIONS = ["NONE", "HEADER", "LINE"];

function buildSegmentsXml(segments) {
  const {
    classMandatory = false,
    classPosition = "NONE",
    departmentMandatory = false,
    departmentPosition = "NONE",
    locationMandatory = false,
    locationPosition = "NONE",
  } = segments || {};

  for (const [name, pos] of [
    ["classPosition", classPosition],
    ["departmentPosition", departmentPosition],
    ["locationPosition", locationPosition],
  ]) {
    if (!VALID_POSITIONS.includes(pos)) {
      throw new Error(`Invalid ${name} '${pos}'. Valid values: ${VALID_POSITIONS.join(", ")}`);
    }
  }

  return [
    "    <segments>",
    boolTag("classmandatory", classMandatory, "        "),
    `        <classposition>${classPosition}</classposition>`,
    boolTag("departmentmandatory", departmentMandatory, "        "),
    `        <departmentposition>${departmentPosition}</departmentposition>`,
    boolTag("locationmandatory", locationMandatory, "        "),
    `        <locationposition>${locationPosition}</locationposition>`,
    "    </segments>",
  ].join("\n");
}

function buildStatusesXml(statuses) {
  const lines = ["    <statuses>"];
  for (const status of statuses) {
    const { scriptId, id, description, posting = false } = status;
    if (!scriptId || !id || !description) {
      throw new Error("Each status requires scriptId, id, and description");
    }
    lines.push(`        <status scriptid="${xmlEscape(scriptId)}">`);
    lines.push(`            <id>${xmlEscape(id)}</id>`);
    lines.push(`            <description>${xmlEscape(description)}</description>`);
    lines.push(boolTag("posting", posting, "            "));
    lines.push("        </status>");
  }
  lines.push("    </statuses>");
  return lines.join("\n");
}

/**
 * @param {object} opts
 * @param {string} opts.scriptIdSuffix
 * @param {string} opts.name
 * @param {string} [opts.subListStyle] - BASIC | JOURNAL | HEADERONLY | SALES | PURCHASE, default BASIC
 * @param {boolean} [opts.isCredit] - default false
 * @param {boolean} [opts.isPosting] - default false
 * @param {boolean} [opts.isVoidable] - default false
 * @param {boolean} [opts.showStatus] - default false
 * @param {object} [opts.segments] - { classMandatory, classPosition, departmentMandatory, departmentPosition, locationMandatory, locationPosition }
 * @param {object[]} [opts.statuses] - array of { scriptId, id, description, posting }
 */
export function buildCustomTransactionTypeXml(opts) {
  const {
    scriptIdSuffix,
    name,
    subListStyle = "BASIC",
    isCredit = false,
    isPosting = false,
    isVoidable = false,
    showStatus = false,
    segments,
    statuses = [],
  } = opts;

  if (!scriptIdSuffix || !/^[a-z][a-z0-9_]*$/.test(scriptIdSuffix)) {
    throw new Error("scriptIdSuffix must be lowercase, start with a letter, and contain only letters/digits/underscores");
  }
  if (!name || !name.trim()) {
    throw new Error("name is required");
  }
  const prefix = PREFIX_BY_SUBLIST_STYLE[subListStyle];
  if (!prefix) {
    throw new Error(`Invalid subListStyle '${subListStyle}'. Valid values: ${Object.keys(PREFIX_BY_SUBLIST_STYLE).join(", ")}`);
  }

  const scriptid = `${prefix}${scriptIdSuffix}`;

  const lines = [`<customtransactiontype scriptid="${scriptid}">`];
  // Omitted unless true — confirmed live NetSuite rejects <iscredit> outright ("object field is
  // invalid or not supported") at least for BASIC subListStyle; unclear if it only applies to a
  // different subliststyle or is deprecated/renamed. Flagged rather than guessed at further.
  if (isCredit) lines.push(boolTag("iscredit", isCredit));
  lines.push(boolTag("isposting", isPosting));
  lines.push(boolTag("isvoidable", isVoidable));
  lines.push(`    <name>${xmlEscape(name)}</name>`);
  lines.push(boolTag("showstatus", showStatus));
  lines.push(`    <subliststyle>${subListStyle}</subliststyle>`);
  if (segments) lines.push(buildSegmentsXml(segments));
  if (statuses.length) lines.push(buildStatusesXml(statuses));
  lines.push("</customtransactiontype>");

  return { scriptid, xml: lines.join("\n") + "\n" };
}
