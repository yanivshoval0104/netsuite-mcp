import { xmlEscape, boolTag, scriptIdRef } from "./xmlUtils.js";

// Source: NetSuite SDF XML reference for center / centercategory / centertab. Three small,
// related nav-customization objects — grouped in one module since each is only a few fields.
// Note per Oracle's docs: custom center tabs automatically include five trend graph portlets
// even if not explicitly defined in the XML — not modeled here, that's account-side default
// behavior, not something this builder needs to emit.

/**
 * @param {object} opts
 * @param {string} opts.scriptIdSuffix - e.g. 'ops' -> custcenter_ops
 * @param {string} opts.label
 */
export function buildCenterXml(opts) {
  const { scriptIdSuffix, label } = opts;
  if (!scriptIdSuffix || !/^[a-z][a-z0-9_]*$/.test(scriptIdSuffix)) {
    throw new Error("scriptIdSuffix must be lowercase, start with a letter, and contain only letters/digits/underscores");
  }
  if (!label || !label.trim()) throw new Error("label is required");

  const scriptid = `custcenter_${scriptIdSuffix}`;
  const xml = [`<center scriptid="${scriptid}">`, `    <label>${xmlEscape(label)}</label>`, "</center>"].join("\n") + "\n";
  return { scriptid, xml };
}

/**
 * @param {object} opts
 * @param {string} opts.scriptIdSuffix - e.g. 'ops' -> custcentertab_ops
 * @param {string} opts.label
 * @param {string} opts.centerScriptId - scriptid of the associated center
 * @param {boolean} [opts.allRoles] - default true
 * @param {object[]} [opts.portlets] - array of { scriptId, portletColumn, isPortletShown? }
 */
export function buildCenterTabXml(opts) {
  const { scriptIdSuffix, label, centerScriptId, allRoles = true, portlets = [] } = opts;
  if (!scriptIdSuffix || !/^[a-z][a-z0-9_]*$/.test(scriptIdSuffix)) {
    throw new Error("scriptIdSuffix must be lowercase, start with a letter, and contain only letters/digits/underscores");
  }
  if (!label || !label.trim()) throw new Error("label is required");
  if (!centerScriptId) throw new Error("centerScriptId is required — build the center first (netsuite_create_center)");

  const scriptid = `custcentertab_${scriptIdSuffix}`;
  const lines = [`<centertab scriptid="${scriptid}">`];
  lines.push(boolTag("allroles", allRoles));
  lines.push(`    <center>${scriptIdRef(centerScriptId)}</center>`);
  lines.push(`    <label>${xmlEscape(label)}</label>`);
  if (portlets.length) {
    lines.push("    <portlets>");
    for (const p of portlets) {
      const { scriptId, portletColumn, isPortletShown = true } = p;
      if (!scriptId || portletColumn === undefined) throw new Error("Each portlet requires scriptId and portletColumn");
      lines.push(`        <portlet scriptid="${xmlEscape(scriptId)}">`);
      lines.push(`            <portletcolumn>${portletColumn}</portletcolumn>`);
      lines.push(boolTag("isportletshown", isPortletShown, "            "));
      lines.push("        </portlet>");
    }
    lines.push("    </portlets>");
  }
  lines.push("</centertab>");

  return { scriptid, xml: lines.join("\n") + "\n" };
}

/**
 * @param {object} opts
 * @param {string} opts.scriptIdSuffix - e.g. 'ops' -> custcentercategory_ops
 * @param {string} opts.label
 * @param {string} opts.centerScriptId
 * @param {string} opts.centerTabScriptId - required (confirmed live: "the object field 'centertab' is missing" without it)
 * @param {object[]} [opts.links] - array of { linkId, linkLabel, shortList? }
 */
export function buildCenterCategoryXml(opts) {
  const { scriptIdSuffix, label, centerScriptId, centerTabScriptId, links = [] } = opts;
  if (!scriptIdSuffix || !/^[a-z][a-z0-9_]*$/.test(scriptIdSuffix)) {
    throw new Error("scriptIdSuffix must be lowercase, start with a letter, and contain only letters/digits/underscores");
  }
  if (!label || !label.trim()) throw new Error("label is required");
  if (!centerScriptId) throw new Error("centerScriptId is required — build the center first (netsuite_create_center)");
  if (!centerTabScriptId) throw new Error("centerTabScriptId is required — build the center tab first (netsuite_create_center_tab)");
  if (!links.length) throw new Error("links must contain at least one entry");

  const scriptid = `custcentercategory_${scriptIdSuffix}`;
  const lines = [`<centercategory scriptid="${scriptid}">`];
  lines.push(`    <center>${scriptIdRef(centerScriptId)}</center>`);
  lines.push(`    <centertab>${scriptIdRef(centerTabScriptId)}</centertab>`);
  lines.push(`    <label>${xmlEscape(label)}</label>`);
  lines.push("    <links>");
  for (const link of links) {
    const { linkId, linkLabel, shortList = false } = link;
    if (!linkId || !linkLabel) throw new Error("Each link requires linkId and linkLabel");
    lines.push("        <link>");
    lines.push(`            <linkid>${xmlEscape(linkId)}</linkid>`);
    lines.push(`            <linklabel>${xmlEscape(linkLabel)}</linklabel>`);
    lines.push(boolTag("shortlist", shortList, "            "));
    lines.push("        </link>");
  }
  lines.push("    </links>");
  lines.push("</centercategory>");

  return { scriptid, xml: lines.join("\n") + "\n" };
}
