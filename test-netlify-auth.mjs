import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { webcrypto } from "node:crypto";

globalThis.crypto ??= webcrypto;
const source = await readFile(new URL("./netlify/edge-functions/password-gate.js", import.meta.url), "utf8");
const { default: gate, config } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const env = new Map([["SITE_PASSWORD", "test-only-password-123456789"]]);
globalThis.Netlify = { env: { get: key => env.get(key) } };
const basic = value => `Basic ${Buffer.from(value).toString("base64")}`;
let originCalls = 0;
const context = { next: async () => {
  originCalls++;
  return new Response("protected content", { headers: { "Content-Type": "model/gltf-binary", "Cache-Control": "public, max-age=3600" } });
} };
async function request(path, authorization, method = "GET") {
  return gate(new Request(`https://demo.netlify.app${path}`, {
    method, headers: authorization ? { authorization } : {},
  }), context);
}
assert.deepEqual(config, { path: "/*", onError: "fail" });
for (const path of ["/", "/index.html", "/app.js", "/models/transformer.glb", "/vendor/three/three.module.js", "/.netlify/functions/example"]) {
  for (const auth of [undefined, "Bearer anything", "Basic !!!", "Basic /w==", basic("viewer:wrong"), basic("wrong:test-only-password-123456789")]) {
    const response = await request(path, auth);
    assert.equal(response.status, 401, path);
    assert.match(response.headers.get("WWW-Authenticate"), /^Basic /);
    assert.match(response.headers.get("Cache-Control"), /no-store/);
    assert.doesNotMatch(await response.text(), /protected content/);
  }
}
assert.equal((await request("/models/transformer.glb", undefined, "HEAD")).status, 401);
assert.equal(originCalls, 0, "unauthorized requests must never reach assets");
const allowed = await request("/models/transformer.glb", basic("viewer:test-only-password-123456789"));
assert.equal(allowed.status, 200);
assert.equal(await allowed.text(), "protected content");
assert.equal(allowed.headers.get("Content-Type"), "model/gltf-binary");
assert.equal(allowed.headers.get("Netlify-CDN-Cache-Control"), "no-store");
assert.equal(originCalls, 1);
for (const password of [undefined, ""]) {
  env.set("SITE_PASSWORD", password);
  assert.equal((await request("/", basic("viewer:too-short"))).status, 503);
}
assert.equal(originCalls, 1, "invalid configuration must fail closed");
env.set("SITE_PASSWORD", "abc");
assert.equal((await request("/", basic("viewer:abc"))).status, 200, "owner-selected passwords are supported");
console.log("Password gate: pages/assets denied without credentials, valid login works, caching disabled, missing configuration fails closed.");
