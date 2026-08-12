#!/usr/bin/env node
// One-time (or re-run-when-cert-rotates) setup: registers this account's
// OAuth2 M2M certificate with the local SuiteCloud CLI as a saved CI auth id.
// Run with: npm run sdf:auth
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { ensureCiAuth } from "./deployRunner.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

const result = await ensureCiAuth();
console.log(result.stdout);
if (result.stderr) console.error(result.stderr);
process.exit(result.code);
