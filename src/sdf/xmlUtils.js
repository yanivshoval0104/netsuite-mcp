export function xmlEscape(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function boolTag(name, value, indent = "    ") {
  return `${indent}<${name}>${value ? "T" : "F"}</${name}>`;
}

// NetSuite SDF's cross-reference syntax for pointing at another object by scriptid,
// e.g. <recordtype>[scriptid=customrecord_cseg_region]</recordtype>
export function scriptIdRef(scriptid) {
  return `[scriptid=${scriptid}]`;
}

export function scriptIdAttrValid(id) {
  return typeof id === "string" && /^[a-z][a-z0-9_]*$/.test(id);
}
