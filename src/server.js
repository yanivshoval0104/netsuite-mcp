#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { registerTools } from "./registerTools.js";
import { registerSdfTools } from "./registerSdfTools.js";

const config = loadConfig();

const server = new McpServer({ name: "netsuite-mcp", version: "0.1.0" });
registerTools(server, config);
registerSdfTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
