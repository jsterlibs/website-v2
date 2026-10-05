import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Run against a local Worker after building the site.
const baseUrl = process.env.JSTER_TEST_URL || "http://localhost:8787";
const missing = "jster-404-test-does-not-exist";

for (const pathname of [
  "/bl",
  `/nested/${missing}/`,
  `/blog/${missing}/`,
  `/category/${missing}/`,
  `/tag/${missing}/`,
  `/library/${missing}`,
  "/404",
  "/404.html",
]) {
  test(`${pathname} serves the shared page with HTTP 404`, async () => {
    const response = await fetch(new URL(pathname, baseUrl), {
      headers: { "Sec-Fetch-Mode": "navigate" },
    });
    assert.equal(response.status, 404);
    assert.match(response.headers.get("content-type"), /text\/html/);
    assert.match(response.headers.get("x-robots-tag"), /noindex/);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const html = await response.text();
    assert.match(html, /<title>Page not found – JSter<\/title>/);
    assert.match(html, /<h1[^>]*>Page not found<\/h1>/);
    assert.match(html, /<nav\b/);
    assert.match(html, /<footer\b/);
    for (const href of ["/", "/catalog/", "/blog/"]) {
      assert.ok(html.includes(`href="${href}"`), href);
    }
  });
}

test("HEAD returns 404 headers without a body", async () => {
  for (const pathname of ["/bl", `/tag/${missing}/`]) {
    const response = await fetch(new URL(pathname, baseUrl), { method: "HEAD" });
    assert.equal(response.status, 404);
    assert.match(response.headers.get("content-type"), /text\/html/);
    assert.equal(await response.text(), "");
  }
});

test("Markdown clients receive the 404 content and status", async () => {
  const response = await fetch(new URL("/bl", baseUrl), {
    headers: { Accept: "text/markdown" },
  });
  assert.equal(response.status, 404);
  assert.match(response.headers.get("content-type"), /text\/markdown/);
  assert.match(await response.text(), /# Page not found/);
});

test("missing API endpoints keep JSON errors", async () => {
  for (const pathname of ["/api/unknown", `/api/tag/${missing}`]) {
    const response = await fetch(new URL(pathname, baseUrl));
    assert.equal(response.status, 404);
    assert.match(response.headers.get("content-type"), /application\/json/);
    assert.deepEqual(await response.json(), { error: "Not found" });
  }
});

test("existing pages and redirects still work", async () => {
  for (const pathname of ["/", "/catalog/", "/blog/", "/about/"]) {
    const response = await fetch(new URL(pathname, baseUrl));
    assert.equal(response.status, 200, pathname);
    assert.doesNotMatch(await response.text(), /id="not-found-title"/);
  }
  const redirect = await fetch(new URL("/library/react-19", baseUrl), {
    redirect: "manual",
  });
  assert.equal(redirect.status, 301);
  assert.match(redirect.headers.get("location"), /\/library\/react$/);
});

test("asset-only misses also show the page", async () => {
  const response = await fetch(new URL(`/assets/${missing}.css`, baseUrl));
  assert.equal(response.status, 404);
  assert.match(await response.text(), /Page not found/);
});

test("the built error page is styled, noindex, and omitted from the sitemap", async () => {
  const html = await readFile(new URL("../build/404.html", import.meta.url), "utf8");
  assert.match(html, /<meta name="robots" content="noindex,follow"/);
  const css = html.match(/<link[^>]+href="([^"]+\.css)"/);
  assert.ok(css, "The shared layout includes a stylesheet");
  const response = await fetch(new URL(css[1], baseUrl));
  assert.equal(response.status, 200);
  assert.match(await response.text(), /\.not-found-code/);
  const sitemap = await readFile(new URL("../build/sitemap.xml", import.meta.url), "utf8");
  assert.doesNotMatch(sitemap, /<loc>[^<]*\/404(?:\.html|\/)?<\/loc>/);
});
