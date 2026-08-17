import { xmlEscape, boolTag } from "./xmlUtils.js";

// Source: NetSuite SDF XML reference for emailtemplate (requires the CRM feature). Two-file
// object: the metadata XML this builds, plus a separate "<scriptid>.template.html" body file
// containing the actual HTML/FreeMarker content — NetSuite matches the two by filename, not by
// anything inside the XML. The caller supplies that body; this builder is mechanical.

/**
 * @param {object} opts
 * @param {string} opts.scriptIdSuffix - e.g. 'quoterequest' -> custemailtmpl_quoterequest
 * @param {string} opts.name
 * @param {string} [opts.description]
 * @param {string} [opts.recordType] - see emailtemplate_recordtype for valid values
 * @param {boolean} [opts.isInactive] - default false
 * @param {string} [opts.subject]
 * @param {boolean} [opts.isPrivate] - default false
 * @param {boolean} [opts.addUnsubscribeLink] - default true
 * @param {boolean} [opts.addCompanyAddress] - default true
 */
export function buildEmailTemplateXml(opts) {
  const {
    scriptIdSuffix,
    name,
    description = "",
    recordType,
    isInactive = false,
    subject = "",
    isPrivate = false,
    addUnsubscribeLink = true,
    addCompanyAddress = true,
  } = opts;

  if (!scriptIdSuffix || !/^[a-z][a-z0-9_]*$/.test(scriptIdSuffix)) {
    throw new Error("scriptIdSuffix must be lowercase, start with a letter, and contain only letters/digits/underscores");
  }
  if (!name || !name.trim()) throw new Error("name is required");

  const scriptid = `custemailtmpl_${scriptIdSuffix}`;

  const lines = [`<emailtemplate scriptid="${scriptid}">`];
  lines.push(`    <name>${xmlEscape(name)}</name>`);
  if (description.trim()) lines.push(`    <description>${xmlEscape(description)}</description>`);
  if (recordType) lines.push(`    <recordtype>${xmlEscape(recordType)}</recordtype>`);
  lines.push(boolTag("isinactive", isInactive));
  if (subject.trim()) lines.push(`    <subject>${xmlEscape(subject)}</subject>`);
  lines.push(boolTag("isprivate", isPrivate));
  lines.push(boolTag("addunsubscribelink", addUnsubscribeLink));
  lines.push(boolTag("addcompanyaddress", addCompanyAddress));
  lines.push(boolTag("usesmedia", false));
  lines.push("</emailtemplate>");

  return { scriptid, xml: lines.join("\n") + "\n", templateFileName: `${scriptid}.template.html` };
}
