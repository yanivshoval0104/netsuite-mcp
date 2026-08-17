import { xmlEscape, boolTag, scriptIdAttrValid } from "./xmlUtils.js";

function requireValidScriptIdSuffix(scriptIdSuffix, label) {
  if (!scriptIdAttrValid(scriptIdSuffix)) {
    throw new Error(`${label} scriptIdSuffix '${scriptIdSuffix}' must be lowercase, start with a letter, and contain only letters/digits/underscores — confirmed live that NetSuite rejects mixed-case scriptids ("Script ID can only contain lowercase alphabet, digit or underscore")`);
  }
}

// Source: NetSuite SDF XML reference + a full worked example for `workflow` (an Estimate
// Approval Routing workflow), confirmed via direct fetch — states, transitions, and two action
// types (setfieldvalueaction, addbuttonaction) below are drawn from that real example, not
// inferred. Built LAST and narrowest on purpose (see plan) — this is the most fragile/complex SDF
// object type, and Oracle itself steers toward building workflows in the UI. Only the two action
// types below are supported; extend ACTION_BUILDERS for more (sendemailaction etc. exist but
// weren't confirmed with a real field list during research).
//
// Key structural quirk confirmed by the example: a workflowstate's own scriptid attribute is
// simple (e.g. "workflowstate_entry"), but a transition's <tostate> reference to another state
// uses the COMPOUND id "<workflowScriptid>.<stateScriptid>" — not a bare state id.

const VALID_RELEASE_STATUSES = ["RELEASED", "TESTING", "NOTINITIATING", "SUSPENDED"];
const VALID_KEEP_HISTORY = ["ALWAYS", "NEVER", "ONLYWHENTESTING"];

function conditionXml(condition, indent) {
  if (!condition) return `${indent}<initcondition>\n${indent}    <formula></formula>\n${indent}    <type>VISUAL_BUILDER</type>\n${indent}</initcondition>`;
  const { formula = "", type = "FORMULA" } = condition;
  return [
    `${indent}<initcondition>`,
    `${indent}    <formula><![CDATA[${formula}]]></formula>`,
    `${indent}    <type>${type}</type>`,
    `${indent}</initcondition>`,
  ].join("\n");
}

const ACTION_BUILDERS = {
  setfieldvalueaction: (action, indent) => {
    const { scriptIdSuffix, field, valueType = "STATIC", valueText = "", valueField = "", valueFormula = "" } = action;
    if (!scriptIdSuffix || !field) throw new Error("setfieldvalueaction requires scriptIdSuffix and field");
    requireValidScriptIdSuffix(scriptIdSuffix, "setfieldvalueaction");
    const lines = [`${indent}<setfieldvalueaction scriptid="workflowaction_${scriptIdSuffix}">`];
    lines.push(`${indent}    <field>${xmlEscape(field)}</field>`);
    lines.push(`${indent}    <valuetype>${valueType}</valuetype>`);
    if (valueType === "STATIC" && valueText) lines.push(`${indent}    <valuetext>${xmlEscape(valueText)}</valuetext>`);
    if (valueType === "FIELD" && valueField) lines.push(`${indent}    <valuefield>${xmlEscape(valueField)}</valuefield>`);
    if (valueType === "FORMULA" && valueFormula) lines.push(`${indent}    <valueformula><![CDATA[${valueFormula}]]></valueformula>`);
    lines.push(`${indent}</setfieldvalueaction>`);
    return lines.join("\n");
  },
  addbuttonaction: (action, indent) => {
    const { scriptIdSuffix, label, saveRecordFirst = false, checkConditionBeforeExecution = true, condition } = action;
    if (!scriptIdSuffix || !label) throw new Error("addbuttonaction requires scriptIdSuffix and label");
    requireValidScriptIdSuffix(scriptIdSuffix, "addbuttonaction");
    const lines = [`${indent}<addbuttonaction scriptid="workflowaction_${scriptIdSuffix}">`];
    lines.push(boolTag("checkconditionbeforeexecution", checkConditionBeforeExecution, `${indent}    `));
    lines.push(`${indent}    <label>${xmlEscape(label)}</label>`);
    lines.push(boolTag("saverecordfirst", saveRecordFirst, `${indent}    `));
    if (condition) lines.push(conditionXml(condition, `${indent}    `));
    lines.push(`${indent}</addbuttonaction>`);
    return lines.join("\n");
  },
};

function buildActionsXml(actionsByTrigger, indent) {
  const lines = [];
  for (const [triggerType, actions] of Object.entries(actionsByTrigger)) {
    lines.push(`${indent}<workflowactions triggertype="${triggerType}">`);
    for (const action of actions) {
      const builder = ACTION_BUILDERS[action.type];
      if (!builder) {
        throw new Error(`Unsupported action type '${action.type}'. Supported: ${Object.keys(ACTION_BUILDERS).join(", ")}`);
      }
      lines.push(builder(action, `${indent}    `));
    }
    lines.push(`${indent}</workflowactions>`);
  }
  return lines.join("\n");
}

function buildTransitionsXml(transitions, workflowScriptid, indent) {
  const lines = [`${indent}<workflowtransitions>`];
  for (const t of transitions) {
    const { scriptIdSuffix, toStateSuffix, triggerType = "ONENTRY", condition } = t;
    if (!scriptIdSuffix || !toStateSuffix) {
      throw new Error("Each transition requires scriptIdSuffix and toStateSuffix");
    }
    requireValidScriptIdSuffix(scriptIdSuffix, "transition");
    requireValidScriptIdSuffix(toStateSuffix, "transition toStateSuffix");
    lines.push(`${indent}    <workflowtransition scriptid="workflowtransition_${scriptIdSuffix}">`);
    lines.push(`${indent}        <tostate>[scriptid=${workflowScriptid}.workflowstate_${toStateSuffix}]</tostate>`);
    lines.push(`${indent}        <triggertype>${triggerType}</triggertype>`);
    lines.push(conditionXml(condition, `${indent}        `));
    lines.push(`${indent}    </workflowtransition>`);
  }
  lines.push(`${indent}</workflowtransitions>`);
  return lines.join("\n");
}

function buildStateXml(state, workflowScriptid) {
  const {
    scriptIdSuffix,
    name,
    description = "",
    donotExitWorkflow = false,
    positionX = 0,
    positionY = 0,
    actions = {},
    transitions = [],
  } = state;

  if (!scriptIdSuffix || !name) throw new Error("Each workflow state requires scriptIdSuffix and name");
  requireValidScriptIdSuffix(scriptIdSuffix, "workflow state");

  const lines = [`        <workflowstate scriptid="workflowstate_${scriptIdSuffix}">`];
  if (description.trim()) lines.push(`            <description>${xmlEscape(description)}</description>`);
  lines.push(boolTag("donotexitworkflow", donotExitWorkflow, "            "));
  lines.push(`            <name>${xmlEscape(name)}</name>`);
  lines.push(`            <positionx>${positionX}</positionx>`);
  lines.push(`            <positiony>${positionY}</positiony>`);
  if (Object.keys(actions).length) lines.push(buildActionsXml(actions, "            "));
  if (transitions.length) lines.push(buildTransitionsXml(transitions, workflowScriptid, "            "));
  lines.push("        </workflowstate>");
  return lines.join("\n");
}

/**
 * @param {object} opts
 * @param {string} opts.scriptIdSuffix - e.g. 'approvals' -> customworkflow_approvals
 * @param {string} opts.name
 * @param {string} opts.recordType - base record type, e.g. 'ESTIMATE', or a custom record/transaction type scriptid
 * @param {string} [opts.releaseStatus] - default 'TESTING'
 * @param {boolean} [opts.isInactive] - default false
 * @param {boolean} [opts.isLogEnabled] - default true
 * @param {string} [opts.keepHistory] - default 'ALWAYS'
 * @param {boolean} [opts.runAsAdmin] - default false
 * @param {boolean} [opts.initOnCreate] - default true
 * @param {boolean} [opts.initOnVieworUpdate] - default false
 * @param {string} [opts.initTriggerType] - e.g. 'BEFORESUBMIT'
 * @param {object} [opts.initCondition] - { formula, type }
 * @param {string} [opts.description]
 * @param {object[]} opts.states - array of { scriptIdSuffix, name, description?, donotExitWorkflow?, positionX?, positionY?, actions?: {TRIGGERTYPE: [{type, ...}]}, transitions?: [{scriptIdSuffix, toStateSuffix, triggerType?, condition?}] }
 */
export function buildWorkflowXml(opts) {
  const {
    scriptIdSuffix,
    name,
    recordType,
    releaseStatus = "TESTING",
    isInactive = false,
    isLogEnabled = true,
    keepHistory = "ALWAYS",
    runAsAdmin = false,
    initOnCreate = true,
    initOnVieworUpdate = false,
    initTriggerType = "",
    initCondition,
    description = "",
    states = [],
  } = opts;

  if (!scriptIdSuffix || !/^[a-z][a-z0-9_]*$/.test(scriptIdSuffix)) {
    throw new Error("scriptIdSuffix must be lowercase, start with a letter, and contain only letters/digits/underscores");
  }
  if (!name || !name.trim()) throw new Error("name is required");
  if (!recordType) throw new Error("recordType is required");
  if (!VALID_RELEASE_STATUSES.includes(releaseStatus)) {
    throw new Error(`Invalid releaseStatus '${releaseStatus}'. Valid values: ${VALID_RELEASE_STATUSES.join(", ")}`);
  }
  if (!VALID_KEEP_HISTORY.includes(keepHistory)) {
    throw new Error(`Invalid keepHistory '${keepHistory}'. Valid values: ${VALID_KEEP_HISTORY.join(", ")}`);
  }
  if (!states.length) throw new Error("states must contain at least one entry");

  const scriptid = `customworkflow_${scriptIdSuffix}`;
  const stateSuffixes = new Set(states.map((s) => s.scriptIdSuffix));
  for (const s of states) {
    for (const t of s.transitions || []) {
      if (!stateSuffixes.has(t.toStateSuffix)) {
        throw new Error(`Transition '${t.scriptIdSuffix}' in state '${s.scriptIdSuffix}' references unknown toStateSuffix '${t.toStateSuffix}'`);
      }
    }
  }

  const lines = [`<workflow scriptid="${scriptid}">`];
  if (description.trim()) lines.push(`    <description>${xmlEscape(description)}</description>`);
  lines.push(boolTag("initoncreate", initOnCreate));
  lines.push(boolTag("initonvieworupdate", initOnVieworUpdate));
  if (initTriggerType) lines.push(`    <inittriggertype>${initTriggerType}</inittriggertype>`);
  lines.push(boolTag("isinactive", isInactive));
  lines.push(boolTag("islogenabled", isLogEnabled));
  lines.push(`    <keephistory>${keepHistory}</keephistory>`);
  lines.push(`    <name>${xmlEscape(name)}</name>`);
  lines.push(`    <recordtypes>${xmlEscape(recordType)}</recordtypes>`);
  lines.push(`    <releasestatus>${releaseStatus}</releasestatus>`);
  lines.push(boolTag("runasadmin", runAsAdmin));
  lines.push(conditionXml(initCondition, "    "));
  lines.push("    <workflowstates>");
  for (const s of states) lines.push(buildStateXml(s, scriptid));
  lines.push("    </workflowstates>");
  lines.push("</workflow>");

  return { scriptid, xml: lines.join("\n") + "\n" };
}
