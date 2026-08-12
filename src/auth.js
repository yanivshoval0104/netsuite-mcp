import crypto from "crypto";

function percentEncode(str) {
  return encodeURIComponent(str).replace(
    /[!*'()]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase()
  );
}

function nonce() {
  return crypto.randomBytes(16).toString("hex");
}

export function buildAuthHeader(config, method, url) {
  const urlObj = new URL(url);
  const baseUri = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;

  const oauthParams = {
    oauth_consumer_key: config.consumerKey,
    oauth_token: config.tokenId,
    oauth_signature_method: "HMAC-SHA256",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_nonce: nonce(),
    oauth_version: "1.0",
  };

  const queryParams = {};
  for (const [key, value] of urlObj.searchParams.entries()) {
    queryParams[key] = value;
  }

  const allParams = { ...oauthParams, ...queryParams };
  const paramString = Object.keys(allParams)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(allParams[key])}`)
    .join("&");

  const baseString = [method.toUpperCase(), percentEncode(baseUri), percentEncode(paramString)].join(
    "&"
  );

  const signingKey = `${percentEncode(config.consumerSecret)}&${percentEncode(config.tokenSecret)}`;
  const signature = crypto.createHmac("sha256", signingKey).update(baseString).digest("base64");

  const headerParams = { ...oauthParams, oauth_signature: signature };
  const headerString = Object.keys(headerParams)
    .map((key) => `${percentEncode(key)}="${percentEncode(headerParams[key])}"`)
    .join(", ");

  return `OAuth realm="${percentEncode(config.realm)}", ${headerString}`;
}
