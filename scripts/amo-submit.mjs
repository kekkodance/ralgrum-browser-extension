// Submits the built Firefox package to addons.mozilla.org (AMO) for listed
// review. Zero dependencies on purpose: the JWT is minted with node:crypto
// and the upload uses the global fetch API (Node 18+).
// Usage:
//   node scripts/amo-submit.mjs --zip dist/firefox.zip --version 0.2.0 \
//     --slug ralgrum-browser-extension [--notes "What changed"] \
//     [--api-base https://addons.mozilla.org/api/v5]
// Required env: AMO_API_KEY, AMO_API_SECRET (from AMO account API keys).
import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

const POLL_INTERVAL_MS = 5000;
const POLL_ATTEMPTS = 60;
const REQUEST_TIMEOUT_MS = 60000;

function argValue(name) {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  if (index < 0 || index + 1 >= process.argv.length) {
    return null;
  }
  return process.argv[index + 1];
}

function base64urlEncode(value) {
  return Buffer.from(value).toString("base64url");
}

// AMO authenticates API calls with a short-lived HS256 JWT.
function mintToken(key, secret) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64urlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64urlEncode(
    JSON.stringify({
      iss: key,
      jti: randomUUID(),
      iat: now,
      exp: now + 60,
    }),
  );
  const signature = createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

async function requestJson(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      Authorization: `JWT ${token}`,
      Accept: "application/json",
      ...(options.headers || {}),
    },
  });
  let body;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    throw new Error(
      `AMO request failed: ${options.method || "GET"} ${url} -> HTTP ${response.status} ${JSON.stringify(body)}`,
    );
  }
  return body;
}

function summarizeValidation(validation) {
  if (!validation || !validation.messages) {
    return "no validation details returned";
  }
  return validation.messages
    .filter((message) => message.type === "error")
    .slice(0, 10)
    .map((message) => `${message.message} (${(message.file || []).join(", ")})`)
    .join("\n");
}

async function waitForValidation(apiBase, token, uuid) {
  for (let attempt = 1; attempt <= POLL_ATTEMPTS; attempt += 1) {
    const upload = await requestJson(
      `${apiBase}/addons/upload/${uuid}/`,
      token,
    );
    if (upload.processed) {
      return upload;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error(
    `Upload ${uuid} was not validated after polling; check it on AMO and re-run if needed.`,
  );
}

async function main() {
  const zipPath = argValue("zip");
  const version = argValue("version");
  const slug = argValue("slug");
  const notes = argValue("notes");
  const apiBase = argValue("api-base") || "https://addons.mozilla.org/api/v5";
  const key = process.env.AMO_API_KEY;
  const secret = process.env.AMO_API_SECRET;
  if (!zipPath || !version || !slug) {
    throw new Error(
      "Missing required args: --zip <file> --version <x.y.z> --slug <addon-slug> [--notes <text>]",
    );
  }
  if (!key || !secret) {
    throw new Error(
      "Missing AMO_API_KEY / AMO_API_SECRET env vars (AMO account API keys).",
    );
  }
  const data = readFileSync(zipPath);

  const form = new FormData();
  form.append("channel", "listed");
  form.append(
    "upload",
    new File([data], "firefox.zip", { type: "application/zip" }),
  );

  const created = await requestJson(
    `${apiBase}/addons/upload/`,
    mintToken(key, secret),
    {
      method: "POST",
      body: form,
    },
  );
  console.log(`uploaded, uuid=${created.uuid}, waiting for validation...`);

  const upload = await waitForValidation(
    apiBase,
    mintToken(key, secret),
    created.uuid,
  );
  if (!upload.valid) {
    throw new Error(
      `AMO validation failed:\n${summarizeValidation(upload.validation)}`,
    );
  }
  if (upload.version !== version) {
    throw new Error(
      `Manifest version ${upload.version} does not match requested version ${version}.`,
    );
  }

  const payload = { upload: upload.uuid };
  if (notes) {
    payload.release_notes = { "en-US": notes };
  }
  const createdVersion = await requestJson(
    `${apiBase}/addons/addon/${encodeURIComponent(slug)}/versions/`,
    mintToken(key, secret),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  console.log(`submitted version ${createdVersion.version} for listed review.`);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
