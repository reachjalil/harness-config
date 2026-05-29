import assert from "node:assert/strict";
import test from "node:test";

import { distTag } from "./publish-npm.mjs";

test("publishes every release version on the default npm dist-tag during alpha", () => {
  assert.equal(distTag("1.0.0-alpha.6"), "latest");
  assert.equal(distTag("1.0.0-beta.1"), "latest");
  assert.equal(distTag("1.0.0-rc.1"), "latest");
  assert.equal(distTag("1.0.0"), "latest");
});

test("requires a package version before selecting an npm dist-tag", () => {
  assert.throws(() => distTag(""), /Package version is required/);
});
