import assert from "node:assert/strict";
import test from "node:test";

import {
  changedCurrentRootDirOutputs,
  disallowedConvergenceActions,
  summarizePlan,
} from "./harness-check.mjs";

test("convergence check allows keep and mutable target actions", () => {
  const plan = {
    targets: [
      {
        path: "./.agents",
        actions: [
          { kind: "keep", relativePath: "skills/a/SKILL.md" },
          { kind: "mutable", relativePath: "settings.local.json" },
        ],
      },
    ],
    dir: {
      actions: [{ kind: "keep", relativePath: "AGENTS.md" }],
    },
  };

  assert.deepEqual(disallowedConvergenceActions(plan), []);
});

test("convergence check reports create, update, remove, and preserve actions", () => {
  const plan = {
    targets: [
      {
        path: "./.agents",
        actions: [
          { kind: "create", relativePath: "skills/a/SKILL.md" },
          { kind: "preserve", relativePath: "cache" },
        ],
      },
    ],
    dir: {
      actions: [{ kind: "update", relativePath: "AGENTS.md" }],
    },
  };

  assert.deepEqual(disallowedConvergenceActions(plan), [
    { kind: "create", path: "./.agents/skills/a/SKILL.md" },
    { kind: "preserve", path: "./.agents/cache" },
    { kind: "update", path: "AGENTS.md" },
  ]);
});

test("current root output check only cares about tracked instruction outputs", () => {
  const plan = {
    dir: {
      actions: [
        { kind: "update", relativePath: "AGENTS.md" },
        { kind: "create", relativePath: "docs/example.md" },
      ],
    },
  };

  assert.deepEqual(changedCurrentRootDirOutputs(plan), [
    { kind: "update", relativePath: "AGENTS.md" },
  ]);
});

test("plan summary is stable and sorted", () => {
  const plan = {
    targets: [
      {
        actions: [{ kind: "mutable" }, { kind: "keep" }, { kind: "keep" }],
      },
    ],
    dir: {
      actions: [{ kind: "keep" }],
    },
  };

  assert.equal(summarizePlan(plan), "keep 3, mutable 1");
});
