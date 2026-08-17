import { xmlEscape, boolTag } from "./xmlUtils.js";

// Source: NetSuite SDF XML reference for role. Subsidiaries, Forms, Searches, and Dashboard
// sublists are explicitly unsupported in SDF (UI-only) — not modeled here. permkey/permlevel
// must match what the account actually has (e.g. a permkey for a custom record type or segment
// only exists once that object is deployed) — 'Critical: Permission/restriction levels must match
// between custom roles and custom record objects to deploy successfully' per Oracle's own note.

const VALID_PERM_LEVELS = ["NONE", "VIEW", "CREATE", "EDIT", "FULL"];
const VALID_EMPLOYEE_RESTRICTIONS = ["NONE", "UNASSIGNED", "RESTRICT"];

function buildPermissionsXml(permissions) {
  const lines = ["    <permissions>"];
  for (const perm of permissions) {
    const { permKey, permLevel, restriction = "" } = perm;
    if (!permKey) throw new Error("Each permission requires permKey");
    if (!VALID_PERM_LEVELS.includes(permLevel)) {
      throw new Error(`Invalid permLevel '${permLevel}' for permKey '${permKey}'. Valid values: ${VALID_PERM_LEVELS.join(", ")}`);
    }
    lines.push("        <permission>");
    lines.push(`            <permkey>${xmlEscape(permKey)}</permkey>`);
    lines.push(`            <permlevel>${permLevel}</permlevel>`);
    // Confirmed live: an empty <restriction/> on a standard permkey (e.g. ADMI_WORKFLOW) errors
    // with "There is a restriction on a standard record" — restriction only applies to custom
    // record/segment permkeys, so omit the tag entirely unless one is actually given.
    if (restriction) lines.push(`            <restriction>${xmlEscape(restriction)}</restriction>`);
    lines.push("        </permission>");
  }
  lines.push("    </permissions>");
  return lines.join("\n");
}

function buildRecordRestrictionsXml(recordRestrictions) {
  const lines = ["    <recordrestrictions>"];
  for (const r of recordRestrictions) {
    const { segment, value } = r;
    if (!segment) throw new Error("Each record restriction requires a segment");
    lines.push("        <restriction>");
    lines.push(`            <segment>${xmlEscape(segment)}</segment>`);
    if (value !== undefined) lines.push(`            <value>${xmlEscape(value)}</value>`);
    lines.push("        </restriction>");
  }
  lines.push("    </recordrestrictions>");
  return lines.join("\n");
}

/**
 * @param {object} opts
 * @param {string} opts.scriptIdSuffix - e.g. 'integration' -> customrole_integration
 * @param {string} opts.name
 * @param {string} [opts.centerType] - default 'ACCOUNTCENTER'
 * @param {boolean} [opts.isSalesRole]
 * @param {boolean} [opts.isSupportRole]
 * @param {boolean} [opts.isWebServiceOnlyRole]
 * @param {string} [opts.employeeRestriction] - default 'NONE'
 * @param {boolean} [opts.employeeViewingAllowed]
 * @param {boolean} [opts.restrictTimeAndExpenses]
 * @param {boolean} [opts.restrictIp]
 * @param {boolean} [opts.restrictByDevice]
 * @param {boolean} [opts.coreAdminPermission]
 * @param {object[]} opts.permissions - array of { permKey, permLevel, restriction? }
 * @param {object[]} [opts.recordRestrictions] - array of { segment, value? } (LOCATION/DEPARTMENT/CLASS)
 */
export function buildRoleXml(opts) {
  const {
    scriptIdSuffix,
    name,
    centerType = "ACCOUNTCENTER",
    isSalesRole = false,
    isSupportRole = false,
    isWebServiceOnlyRole = false,
    employeeRestriction = "NONE",
    employeeViewingAllowed = false,
    restrictTimeAndExpenses = false,
    restrictIp = false,
    restrictByDevice = false,
    coreAdminPermission = false,
    permissions = [],
    recordRestrictions = [],
  } = opts;

  if (!scriptIdSuffix || !/^[a-z][a-z0-9_]*$/.test(scriptIdSuffix)) {
    throw new Error("scriptIdSuffix must be lowercase, start with a letter, and contain only letters/digits/underscores");
  }
  if (!name || !name.trim()) {
    throw new Error("name is required");
  }
  if (!VALID_EMPLOYEE_RESTRICTIONS.includes(employeeRestriction)) {
    throw new Error(`Invalid employeeRestriction '${employeeRestriction}'. Valid values: ${VALID_EMPLOYEE_RESTRICTIONS.join(", ")}`);
  }
  if (!permissions.length) {
    throw new Error("permissions must contain at least one entry — a role with no permissions is not useful, and 'Log in using Access Tokens'/'Web Services' are commonly required for integration roles");
  }

  const scriptid = `customrole_${scriptIdSuffix}`;

  const lines = [`<role scriptid="${scriptid}">`];
  lines.push(`    <centertype>${centerType}</centertype>`);
  lines.push(boolTag("issalesrole", isSalesRole));
  lines.push(boolTag("issupportrole", isSupportRole));
  // iswebserviceonlyrole/restrictip omitted unless true — confirmed live each depends on a
  // manifest feature dependency (WEBSERVICES / IPADDRESSRULES) even when set to F.
  if (isWebServiceOnlyRole) lines.push(boolTag("iswebserviceonlyrole", isWebServiceOnlyRole));
  lines.push(`    <employeerestriction>${employeeRestriction}</employeerestriction>`);
  // employeeviewingallowed/coreadminpermission omitted unless true — confirmed live NetSuite
  // rejects them outright ("object field is invalid or not supported") in this account/version;
  // unclear if renamed, edition-gated, or deprecated. Flagged rather than guessed at further.
  if (employeeViewingAllowed) lines.push(boolTag("employeeviewingallowed", employeeViewingAllowed));
  lines.push(boolTag("restricttimeandexpenses", restrictTimeAndExpenses));
  if (restrictIp) lines.push(boolTag("restrictip", restrictIp));
  lines.push(boolTag("restrictbydevice", restrictByDevice));
  if (coreAdminPermission) lines.push(boolTag("coreadminpermission", coreAdminPermission));
  lines.push(`    <name>${xmlEscape(name)}</name>`);
  lines.push(buildPermissionsXml(permissions));
  if (recordRestrictions.length) lines.push(buildRecordRestrictionsXml(recordRestrictions));
  lines.push("</role>");

  return { scriptid, xml: lines.join("\n") + "\n" };
}
