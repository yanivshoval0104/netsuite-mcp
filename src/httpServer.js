#!/usr/bin/env node
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { loadConfig } from "./config.js";
import { registerTools } from "./registerTools.js";

// =============================================================
// NetSuite MCP Server — remote entry point.
// Hosted on Render, Streamable HTTP transport, stateless (a fresh
// McpServer + transport per request — no session affinity needed
// across Render instances/restarts).
//
// Render start command:
//   npm run start:http
//
// Env vars:
//   NETSUITE_ACCOUNT_ID, NETSUITE_CONSUMER_KEY, NETSUITE_CONSUMER_SECRET,
//   NETSUITE_TOKEN_ID, NETSUITE_TOKEN_SECRET   (see config.js)
//   MCP_SERVER_TOKEN   (optional — if set, every request to /mcp must
//                       carry "Authorization: Bearer <that token>")
//   PORT               (Render sets this automatically)
// =============================================================

const config = loadConfig();
const MCP_SERVER_TOKEN = (process.env.MCP_SERVER_TOKEN || "").trim();
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());

app.get("/healthz", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

function requireBearerToken(req, res, next) {
  if (!MCP_SERVER_TOKEN) return next(); // open/demo mode if unset
  const auth = req.headers["authorization"] || "";
  if (auth !== `Bearer ${MCP_SERVER_TOKEN}`) {
    return res.status(401).json({ error: "Unauthorized: missing or invalid bearer token" });
  }
  next();
}

app.post("/mcp", requireBearerToken, async (req, res) => {
  try {
    const server = new McpServer({ name: "netsuite-mcp", version: "0.1.0" });
    registerTools(server, config);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    res.on("close", () => {
      transport.close();
      server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("MCP request error:", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

// Stateless mode has no session to resume/terminate, so GET (server-initiated
// SSE stream) and DELETE (session teardown) are not meaningful here.
app.get("/mcp", requireBearerToken, (_req, res) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed. This server runs in stateless mode." },
    id: null,
  });
});

app.delete("/mcp", requireBearerToken, (_req, res) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed. This server runs in stateless mode." },
    id: null,
  });
});

app.listen(PORT, () => {
  console.log(`netsuite-mcp HTTP server listening on port ${PORT}`);
  console.log(MCP_SERVER_TOKEN ? "Bearer token protection: ON" : "Bearer token protection: OFF (demo mode)");
});
