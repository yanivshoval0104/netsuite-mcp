import { xmlEscape, boolTag } from "./xmlUtils.js";

// Source: NetSuite SDF XML reference for customlist. The system prefixes whatever scriptid
// suffix you give with 'customlist_'. Custom values are nested under <customvalues>; each
// <customvalue> needs its own scriptid, which is otherwise just a local reference id (not a
// NetSuite internal id) — this generates one from a slug of the value's label, since NetSuite
// itself only shows real system-generated ids (e.g. val_53391_399334_433) for values that
// already exist in an account, not for ones you're authoring fresh.

function slugify(str, index) {
  const slug = String(str)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || `value_${index}`;
}

/**
 * @param {object} opts
 * @param {string} opts.scriptIdSuffix - e.g. 'account_type' -> customlist_account_type
 * @param {string} opts.name - display name for the list
 * @param {string[]|object[]} opts.values - either plain label strings, or { label, abbreviation?, isInactive? }
 * @param {boolean} [opts.isOrdered] - default false (whether display order matches value order)
 * @param {boolean} [opts.isMatrixOption] - default false
 */
export function buildCustomListXml(opts) {
  const { scriptIdSuffix, name, values = [], isOrdered = false, isMatrixOption = false } = opts;

  if (!scriptIdSuffix || !/^[a-z][a-z0-9_]*$/.test(scriptIdSuffix)) {
    throw new Error("scriptIdSuffix must be lowercase, start with a letter, and contain only letters/digits/underscores");
  }
  if (!name || !name.trim()) {
    throw new Error("name is required");
  }
  if (!values.length) {
    throw new Error("values must contain at least one entry");
  }

  const scriptid = `customlist_${scriptIdSuffix}`;

  const lines = [`<customlist scriptid="${scriptid}">`];
  lines.push(`    <name>${xmlEscape(name)}</name>`);
  lines.push(boolTag("isordered", isOrdered));
  // Omitted when false (not emitted as F) — confirmed live that even <ismatrixoption>F</ismatrixoption>
  // triggers a MATRIXITEMS manifest-dependency requirement. Only declare it when actually used.
  if (isMatrixOption) lines.push(boolTag("ismatrixoption", isMatrixOption));
  lines.push("    <customvalues>");

  const seenSlugs = new Set();
  values.forEach((v, index) => {
    const entry = typeof v === "string" ? { label: v } : v;
    if (!entry.label || !entry.label.trim()) {
      throw new Error(`values[${index}] is missing a label`);
    }
    let slug = `val_${slugify(entry.label, index)}`;
    while (seenSlugs.has(slug)) slug = `${slug}_${index}`;
    seenSlugs.add(slug);

    lines.push(`        <customvalue scriptid="${slug}">`);
    lines.push(`            <value>${xmlEscape(entry.label)}</value>`);
    if (entry.abbreviation) lines.push(`            <abbreviation>${xmlEscape(entry.abbreviation)}</abbreviation>`);
    lines.push(boolTag("isinactive", entry.isInactive || false, "            "));
    lines.push("        </customvalue>");
  });

  lines.push("    </customvalues>");
  lines.push("</customlist>");

  return { scriptid, xml: lines.join("\n") + "\n" };
}
