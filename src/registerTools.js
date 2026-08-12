import { z } from "zod";
import * as ns from "./netsuiteClient.js";

function textResult(data) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function errorResult(err) {
  return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
}

export function registerTools(server, config) {
  server.tool(
    "netsuite_list_record_types",
    "List all NetSuite record types available through the REST Record API metadata catalog.",
    {},
    async () => {
      try {
        return textResult(await ns.getMetadataCatalog(config));
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.tool(
    "netsuite_get_record_metadata",
    "Fetch the JSON schema for a specific NetSuite record type (fields, types, sublists) from the metadata catalog.",
    {
      recordType: z.string().describe("REST record type, e.g. 'customer', 'salesOrder', or a custom record like 'customrecord_il_salary_import_mappings'"),
    },
    async ({ recordType }) => {
      try {
        return textResult(await ns.getRecordMetadata(config, recordType));
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.tool(
    "netsuite_query",
    "Run a read-only SuiteQL SELECT query against NetSuite. Use this to find internal ids before update/delete.",
    {
      query: z.string().describe("SuiteQL SELECT statement"),
      limit: z.number().optional().describe("Max rows to return (default 50)"),
      offset: z.number().optional().describe("Row offset for pagination (default 0)"),
    },
    async ({ query, limit, offset }) => {
      try {
        return textResult(await ns.runSuiteQL(config, query, limit, offset));
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.tool(
    "netsuite_get_record",
    "Fetch a single NetSuite record by internal id.",
    {
      recordType: z.string().describe("REST record type, e.g. 'customer', 'salesOrder', 'invoice'"),
      id: z.string().describe("Internal id of the record"),
      expandSubResources: z.boolean().optional(),
    },
    async ({ recordType, id, expandSubResources }) => {
      try {
        return textResult(await ns.getRecord(config, recordType, id, expandSubResources));
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.tool(
    "netsuite_create_record",
    "Create a new NetSuite record of any record type.",
    {
      recordType: z.string().describe("REST record type, e.g. 'customer', 'salesOrder', 'invoice'"),
      body: z.record(z.any()).describe("Record field values as a JSON object"),
    },
    async ({ recordType, body }) => {
      try {
        return textResult(await ns.createRecord(config, recordType, body));
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.tool(
    "netsuite_update_record",
    "Update (partial patch) fields on an existing NetSuite record.",
    {
      recordType: z.string().describe("REST record type, e.g. 'customer', 'salesOrder', 'invoice'"),
      id: z.string().describe("Internal id of the record"),
      body: z.record(z.any()).describe("Fields to update as a JSON object"),
    },
    async ({ recordType, id, body }) => {
      try {
        return textResult(await ns.updateRecord(config, recordType, id, body));
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.tool(
    "netsuite_delete_record",
    "Delete a NetSuite record by internal id.",
    {
      recordType: z.string().describe("REST record type, e.g. 'customer', 'salesOrder', 'invoice'"),
      id: z.string().describe("Internal id of the record"),
    },
    async ({ recordType, id }) => {
      try {
        return textResult(await ns.deleteRecord(config, recordType, id));
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  return server;
}
