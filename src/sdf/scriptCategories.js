// Source: NetSuite SDF XML reference for each script type, confirmed via direct fetches for
// clientscript / usereventscript / scheduledscript / mapreducescript / suitelet / restlet.
//
// IMPORTANT, non-obvious finding from that research: only `clientscript` declares entry-point
// function NAMES in its own XML (fieldchangedfunction, pageinitfunction, etc.) — every other
// script type (usereventscript, scheduledscript, mapreducescript, suitelet, restlet, and by
// strong inference the rest below) determines its entry points purely from what the referenced
// .js file exports (e.g. `exports.onRequest = ...`), with NO corresponding XML element at all.
// Do not add xxxfunction fields for any type below except clientscript.
//
// rootTag case: an Oracle doc example showed `<Restlet>` (capital R), but confirmed LIVE that
// using that capitalization gets the object miscategorized as a generic data file, not
// recognized as a script at all ("The object 'Restlet' will be categorized as a data file").
// Using lowercase "restlet" like every other type — the capitalized example was apparently wrong
// or outdated.
//
// Root tags for massupdatescript/workflowactionscript/bundleinstallationscript/
// sdfinstallationscript/portlet still aren't individually confirmed (untested even after the
// 2026-08-17 live pass). plugintype/pluginimplementation ARE confirmed to exist as valid script
// types, but need MORE required fields than this generic builder supports — see script.js.

export const SCRIPT_CATEGORIES = {
  clientScript: { rootTag: "clientscript", supportsClientFunctions: true, description: "Runs in the browser on record forms (field/save/validate events)" },
  userEventScript: { rootTag: "usereventscript", description: "Server-side beforeLoad/beforeSubmit/afterSubmit on record save" },
  scheduledScript: { rootTag: "scheduledscript", description: "Runs on a schedule or on demand, single execute() entry point" },
  mapReduceScript: { rootTag: "mapreducescript", description: "getInputData/map/reduce/summarize batch processing" },
  suitelet: { rootTag: "suitelet", description: "Server-side web page/API endpoint, single onRequest() entry point" },
  restlet: { rootTag: "restlet", description: "REST API endpoint, get/post/put/delete() entry points" },
  portlet: { rootTag: "portlet", description: "Dashboard portlet, single render() entry point" },
  massUpdateScript: { rootTag: "massupdatescript", description: "Bulk record update, single each() entry point" },
  workflowActionScript: { rootTag: "workflowactionscript", description: "Custom workflow action, single onAction() entry point" },
  bundleInstallationScript: { rootTag: "bundleinstallationscript", description: "Runs on SuiteApp/bundle install/update/uninstall" },
  sdfInstallationScript: { rootTag: "sdfinstallationscript", description: "Runs during SDF project deployment lifecycle" },
  pluginType: { rootTag: "plugintype", description: "Defines a plug-in interface other scripts implement" },
  pluginImplementation: { rootTag: "pluginimplementation", description: "Implements a plugin type (e.g. Custom GL Lines, Email Capture)" },
};

// clientscript's entry-point function fields — the one exception to "no XML tag" above.
export const CLIENT_SCRIPT_FUNCTIONS = [
  "fieldChanged",
  "lineInit",
  "pageInit",
  "postSourcing",
  "recalc",
  "saveRecord",
  "validateDelete",
  "validateField",
  "validateInsert",
  "validateLine",
];

export function resolveScriptCategory(scriptType) {
  const def = SCRIPT_CATEGORIES[scriptType];
  if (!def) {
    throw new Error(`Unknown scriptType '${scriptType}'. Valid values: ${Object.keys(SCRIPT_CATEGORIES).join(", ")}`);
  }
  return def;
}
