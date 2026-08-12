import { buildAuthHeader } from "./auth.js";

async function nsFetch(config, path, options = {}) {
  const url = `${config.baseUrl}/services/rest${path}`;
  const method = options.method || "GET";
  const authHeader = buildAuthHeader(config, method, url);

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const text = await res.text();
  const body = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new Error(`NetSuite API error (${res.status} ${res.statusText}): ${text}`);
  }

  return { status: res.status, body, location: res.headers.get("location") };
}

export async function createRecord(config, recordType, record) {
  return nsFetch(config, `/record/v1/${recordType}`, {
    method: "POST",
    body: JSON.stringify(record),
  });
}

export async function getRecord(config, recordType, id, expandSubResources = false) {
  const query = expandSubResources ? "?expandSubResources=true" : "";
  return nsFetch(config, `/record/v1/${recordType}/${id}${query}`, { method: "GET" });
}

export async function updateRecord(config, recordType, id, patch) {
  return nsFetch(config, `/record/v1/${recordType}/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function deleteRecord(config, recordType, id) {
  return nsFetch(config, `/record/v1/${recordType}/${id}`, { method: "DELETE" });
}

export async function runSuiteQL(config, query, limit = 50, offset = 0) {
  return nsFetch(config, `/query/v1/suiteql?limit=${limit}&offset=${offset}`, {
    method: "POST",
    headers: { Prefer: "transient" },
    body: JSON.stringify({ q: query }),
  });
}

export async function getMetadataCatalog(config) {
  return nsFetch(config, `/record/v1/metadata-catalog`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
}

export async function getRecordMetadata(config, recordType) {
  return nsFetch(config, `/record/v1/metadata-catalog/${recordType}`, {
    method: "GET",
    headers: { Accept: "application/schema+json" },
  });
}
