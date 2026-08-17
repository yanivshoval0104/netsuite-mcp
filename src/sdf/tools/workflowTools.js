import { z } from "zod";
import { buildWorkflowXml } from "../workflow.js";
import { writeValidateOrDeploy, errorResult } from "./writeAndDeploy.js";

const conditionSchema = z.object({
  formula: z.string().optional(),
  type: z.string().optional().describe("FORMULA | VISUAL_BUILDER, default FORMULA when formula is set"),
});

const actionSchema = z.object({
  type: z.string().describe("'setfieldvalueaction' or 'addbuttonaction' (the only two confirmed action types)"),
  scriptIdSuffix: z.string(),
  // setfieldvalueaction fields
  field: z.string().optional(),
  valueType: z.string().optional().describe("STATIC | FIELD | FORMULA"),
  valueText: z.string().optional(),
  valueField: z.string().optional(),
  valueFormula: z.string().optional(),
  // addbuttonaction fields
  label: z.string().optional(),
  saveRecordFirst: z.boolean().optional(),
  checkConditionBeforeExecution: z.boolean().optional(),
  condition: conditionSchema.optional(),
});

const transitionSchema = z.object({
  scriptIdSuffix: z.string(),
  toStateSuffix: z.string().describe("scriptIdSuffix of another state in the same 'states' array"),
  triggerType: z.string().optional().describe("Default 'ONENTRY'"),
  condition: conditionSchema.optional(),
});

const stateSchema = z.object({
  scriptIdSuffix: z.string(),
  name: z.string(),
  description: z.string().optional(),
  donotExitWorkflow: z.boolean().optional(),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
  actions: z.record(z.array(actionSchema)).optional().describe("Map of triggertype (e.g. 'ONENTRY') to an array of actions"),
  transitions: z.array(transitionSchema).optional(),
});

export function registerWorkflowTools(server) {
  server.tool(
    "netsuite_create_workflow",
    "Creates a Workflow (SuiteFlow) via SDF (writes XML, then project:validate/deploy). Built " +
      "from structured states/transitions/actions — you never write raw workflow XML yourself. " +
      "Only 'setfieldvalueaction' and 'addbuttonaction' are supported action types for now (the " +
      "two confirmed against a real Oracle example during research) — most real workflows will " +
      "need more (sendemailaction, etc.); for those, build the workflow in the NetSuite UI and " +
      "use netsuite_import_sdf_object instead of fighting this tool. This is the most complex " +
      "and fragile SDF object type — always dryRun=true first and read the validate output " +
      "carefully.",
    {
      scriptIdSuffix: z.string().describe("e.g. 'approvals' -> customworkflow_approvals"),
      name: z.string(),
      recordType: z.string().describe("Base record type, e.g. 'ESTIMATE', or a custom record/transaction type scriptid"),
      releaseStatus: z.string().optional().describe("RELEASED | TESTING | NOTINITIATING | SUSPENDED, default TESTING"),
      isInactive: z.boolean().optional(),
      isLogEnabled: z.boolean().optional().describe("Default true"),
      keepHistory: z.string().optional().describe("ALWAYS | NEVER | ONLYWHENTESTING, default ALWAYS"),
      runAsAdmin: z.boolean().optional(),
      initOnCreate: z.boolean().optional().describe("Default true"),
      initOnVieworUpdate: z.boolean().optional(),
      initTriggerType: z.string().optional().describe("e.g. 'BEFORESUBMIT'"),
      initCondition: conditionSchema.optional(),
      description: z.string().optional(),
      states: z.array(stateSchema).describe("At least one required"),
      dryRun: z.boolean().optional().describe("Default true: validate only. Set false to deploy."),
    },
    async ({ dryRun = true, ...opts }) => {
      try {
        const { scriptid, xml } = buildWorkflowXml(opts);
        return await writeValidateOrDeploy(scriptid, xml, dryRun);
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  return server;
}
