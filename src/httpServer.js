#!/usr/bin/env node
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { loadConfig } from "./config.js";
import { registerTools } from "./registerTools.js";
import { registerSdfTools } from "./registerSdfTools.js";

// =============================================================
// NetSuite MCP Server — remote entry point.
// Hosted on Render (Docker runtime — see Dockerfile), Streamable HTTP
// transport. A fresh McpServer + transport is created per request (no
// session affinity needed across Render restarts), but registerSdfTools
// shares one process-wide mutex (see registerSdfTools.js) across all of
// those per-request McpServer instances, since they all share the same
// underlying sdf/ project directory and suitecloud CLI state.
//
// Requires the Docker runtime (not Render's native Node runtime) — the SDF
// tools shell out to the Java-backed `suitecloud` CLI, and Render's native
// Node runtime has no system package access to install a JRE. Also
// requires a Secret File for the private key (NETSUITE_SDF_PRIVATE_KEY_PATH
// should point at that mount path, not a local ./secrets/... path) and a
// fixed instance count of 1 (no autoscaling) — the mutex only protects a
// single process.
//
// Render start command:
//   npm run start:http
//
// Env vars:
//   NETSUITE_ACCOUNT_ID, NETSUITE_CONSUMER_KEY, NETSUITE_CONSUMER_SECRET,
//   NETSUITE_TOKEN_ID, NETSUITE_TOKEN_SECRET   (see config.js — REST data tools)
//   NETSUITE_SDF_AUTH_ID, NETSUITE_SDF_CERTIFICATE_ID,
//   NETSUITE_SDF_PRIVATE_KEY_PATH, SUITECLOUD_CI, SUITECLOUD_CI_PASSKEY
//                       (SDF metadata tools — see NETSUITE_ADMIN_SETUP.md)
//   MCP_SERVER_TOKEN   (strongly recommended once SDF tools are exposed —
//                       if set, every request to /mcp must carry
//                       "Authorization: Bearer <that token>")
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
    registerSdfTools(server);
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
