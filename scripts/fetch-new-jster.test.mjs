import assert from "node:assert/strict";
import test from "node:test";

import { categorizeEntry } from "./fetch-new-jster.mjs";
import { cleanLibraryName } from "./sync-blog-catalog.mjs";

function entry(title, url) {
  return { title, url, description: "" };
}

test("categorizes generic launch posts as libraries", () => {
  assert.equal(
    categorizeEntry(
      entry("Formisch v1 is here", "https://formisch.dev/blog/formisch-v1/"),
    ),
    "Libraries",
  );
  assert.equal(
    categorizeEntry(
      entry(
        "htmx 4.0.0 has been released!",
        "https://four.htmx.org/announcements/2026-08-28-htmx-4.0.0-is-released",
      ),
    ),
    "Libraries",
  );
  assert.equal(
    categorizeEntry(
      entry("TresJS - Rapier Physics v1", "https://tresjs.org/blog/tresjs-rapier-v1"),
    ),
    "Libraries",
  );
});

test("keeps framework launches in frameworks", () => {
  assert.equal(
    categorizeEntry(
      entry(
        "The SvelteKit 3 Release Candidate is here",
        "https://svelte.dev/blog/sveltekit-3-release-candidate",
      ),
    ),
    "Frameworks",
  );
  assert.equal(
    categorizeEntry(
      entry("Solid 2.0 RC: The Big <Reveal>", "https://www.solidjs.com/blog/solid-2-0-rc"),
    ),
    "Frameworks",
  );
});

test("strips release wording from catalog names", () => {
  assert.equal(cleanLibraryName("htmx 4.0.0 has been released!"), "htmx");
});
