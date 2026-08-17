import { xmlEscape, boolTag } from "./xmlUtils.js";

// Source: NetSuite SDF XML reference/examples for entryForm / transactionForm / addressForm.
// Oracle's own guidance: "you must import custom forms from a NetSuite account [...] you can
// then edit the form and deploy the changes" — forms are fundamentally override-an-existing-
// standard-form objects (the `standard` attribute references a base STANDARD*FORM), not built
// from nothing. This builder is DELIBERATELY NARROW — basic field-group/tab visibility and
// layout only. For anything beyond that, use netsuite_import_sdf_object to pull the real form
// down and hand-edit it instead of fighting this builder.
//
// scriptid prefix 'custform_' — confirmed correct for entryForm/transactionForm only.
//
// Confirmed live 2026-08-17 (transactionForm): `editingInList` is rejected ("invalid or not
// supported") — removed from the builder entirely. The `standard` attribute's valid values are
// an enumerated list, NOT any STANDARD*FORM name you'd guess — NetSuite's own validate error
// helpfully lists them per record type when you get it wrong; for SALESORDER the value is
// "STANDARDSALESORDER" (no "FORM" suffix), not "STANDARDSALESORDERFORM".
//
// addressForm is DELIBERATELY NOT SUPPORTED here — confirmed live it's a structurally different
// object, not a variant of entry/transaction form: different scriptid prefix
// ("custaddressform_", not "custform_"), no recordType/standard/inactive/preferred/
// storedWithRecord/actionbar/buttons at all (all rejected as "invalid or not supported"), a
// required "addressTemplate" field this builder doesn't produce, and a mainFields structure using
// <defaultFieldGroup> directly rather than a scriptid'd <fieldGroup>. Building this properly needs
// dedicated research, not a shared builder — use netsuite_import_sdf_object for address forms.
//
// entryForm's `recordType` is a CONFIRMED, UNRESOLVED problem — three different value styles were
// tried live and all rejected: the plain record type name ("CUSTOMER", "PROJECTTASK"), lowercase
// ("projecttask"), and the Form ID style that supposedly applies here per one doc summary
// ("STANDARDCUSTOMERFORM"). transactionForm's recordType works fine with plain names (e.g.
// "SALESORDER") — whatever's different about entryForm's expected value isn't solved. Don't
// re-try these same three guesses; use netsuite_import_sdf_object for entry forms until this is
// actually figured out.

const ROOT_TAG_BY_FORM_TYPE = {
  entry: "entryForm",
  transaction: "transactionForm",
};

function buildFieldXmlFragment(field, indent) {
  const { id, label, visible = true, mandatory = false, displayType = "NORMAL", columnBreak = false, sameRowAsPrevious = false } = field;
  if (!id) throw new Error("Each field requires an id");
  const lines = [`${indent}<field>`];
  lines.push(`${indent}    <id>${xmlEscape(id)}</id>`);
  if (label) lines.push(`${indent}    <label>${xmlEscape(label)}</label>`);
  lines.push(boolTag("visible", visible, `${indent}    `));
  lines.push(boolTag("mandatory", mandatory, `${indent}    `));
  lines.push(`${indent}    <displayType>${displayType}</displayType>`);
  lines.push(boolTag("columnBreak", columnBreak, `${indent}    `));
  lines.push(boolTag("sameRowAsPrevious", sameRowAsPrevious, `${indent}    `));
  lines.push(`${indent}</field>`);
  return lines.join("\n");
}

function buildFieldGroupXml(group) {
  const { scriptId, label, visible = true, showTitle = true, singleColumn = false, fields = [] } = group;
  if (!scriptId || !label) throw new Error("Each field group requires scriptId and label");
  const lines = [`        <fieldGroup scriptid="${xmlEscape(scriptId)}">`];
  lines.push(`            <label>${xmlEscape(label)}</label>`);
  lines.push(boolTag("visible", visible, "            "));
  lines.push(boolTag("showTitle", showTitle, "            "));
  lines.push(boolTag("singleColumn", singleColumn, "            "));
  if (fields.length) {
    lines.push('            <fields position="MIDDLE">');
    for (const f of fields) lines.push(buildFieldXmlFragment(f, "                "));
    lines.push("            </fields>");
  }
  lines.push("        </fieldGroup>");
  return lines.join("\n");
}

function buildTabXml(tab) {
  const { id, label, visible = true } = tab;
  if (!id || !label) throw new Error("Each tab requires id and label");
  return [
    "        <tab>",
    `            <id>${xmlEscape(id)}</id>`,
    `            <label>${xmlEscape(label)}</label>`,
    boolTag("visible", visible, "            "),
    "            <fieldGroups>",
    "                <defaultFieldGroup/>",
    "            </fieldGroups>",
    "            <subItems/>",
    "        </tab>",
  ].join("\n");
}

/**
 * @param {object} opts
 * @param {'entry'|'transaction'|'address'} opts.formType
 * @param {string} opts.scriptIdSuffix - e.g. 'project_task' -> custform_project_task
 * @param {string} opts.standard - base standard form id this form overrides, e.g. 'STANDARDPROJECTTASKFORM'
 * @param {string} opts.recordType - NetSuite record type this form applies to, e.g. 'PROJECTTASK'
 * @param {string} opts.name
 * @param {boolean} [opts.preferred] - default false
 * @param {boolean} [opts.inactive] - default false
 * @param {boolean} [opts.storedWithRecord] - default false
 * @param {object[]} [opts.fieldGroups] - array of { scriptId, label, visible?, showTitle?, singleColumn?, fields?: [{id, label?, visible?, mandatory?, displayType?, columnBreak?, sameRowAsPrevious?}] }
 * @param {object[]} [opts.tabs] - array of { id, label, visible? }
 */
export function buildFormXml(opts) {
  const {
    formType,
    scriptIdSuffix,
    standard,
    recordType,
    name,
    preferred = false,
    inactive = false,
    storedWithRecord = false,
    fieldGroups = [],
    tabs = [],
  } = opts;

  const rootTag = ROOT_TAG_BY_FORM_TYPE[formType];
  if (!rootTag) {
    throw new Error(`Invalid formType '${formType}'. Valid values: ${Object.keys(ROOT_TAG_BY_FORM_TYPE).join(", ")}`);
  }
  if (!scriptIdSuffix || !/^[a-z][a-z0-9_]*$/.test(scriptIdSuffix)) {
    throw new Error("scriptIdSuffix must be lowercase, start with a letter, and contain only letters/digits/underscores");
  }
  if (!standard) throw new Error("standard is required — the base STANDARD*FORM id this form overrides");
  if (!recordType) throw new Error("recordType is required");
  if (!name || !name.trim()) throw new Error("name is required");

  const scriptid = `custform_${scriptIdSuffix}`;

  const lines = [`<${rootTag} scriptid="${scriptid}" standard="${xmlEscape(standard)}">`];
  lines.push(`    <name>${xmlEscape(name)}</name>`);
  lines.push(`    <recordType>${xmlEscape(recordType)}</recordType>`);
  lines.push(boolTag("inactive", inactive));
  lines.push(boolTag("preferred", preferred));
  lines.push(boolTag("storedWithRecord", storedWithRecord));

  if (fieldGroups.length) {
    lines.push("    <mainFields>");
    for (const g of fieldGroups) lines.push(buildFieldGroupXml(g));
    lines.push("    </mainFields>");
  }

  if (tabs.length) {
    lines.push("    <tabs>");
    for (const t of tabs) lines.push(buildTabXml(t));
    lines.push("    </tabs>");
  }

  lines.push("    <actionbar>");
  lines.push("        <buttons/>");
  lines.push("    </actionbar>");
  lines.push(`</${rootTag}>`);

  return { scriptid, xml: lines.join("\n") + "\n" };
}
