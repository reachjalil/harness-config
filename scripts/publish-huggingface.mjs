import { execFileSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const datasetRepo =
  process.env.HF_DATASET_REPO ?? "reachjalil/harness-config-specification";
const spaceRepo = process.env.HF_SPACE_REPO ?? "reachjalil/harness-config-spec";
const dryRun = process.argv.includes("--dry-run");

function run(command, args) {
  const printable = [command, ...args].join(" ");
  console.log(`$ ${printable}`);
  if (dryRun && command === "hf") {
    return;
  }
  execFileSync(command, args, {
    cwd: root,
    stdio: "inherit",
  });
}

run("node", ["scripts/build-huggingface.mjs"]);

const datasetDir = path.join("dist", "huggingface", "dataset");
const spaceDir = path.join("dist", "huggingface", "space");
const commitMessage = "Publish Harness config v1 specification mirror";

run("hf", ["repos", "create", datasetRepo, "--type", "dataset", "--exist-ok"]);
run("hf", [
  "upload",
  datasetRepo,
  datasetDir,
  "--type",
  "dataset",
  "--commit-message",
  commitMessage,
]);

run("hf", [
  "repos",
  "create",
  spaceRepo,
  "--type",
  "space",
  "--space-sdk",
  "static",
  "--exist-ok",
]);
run("hf", [
  "upload",
  spaceRepo,
  spaceDir,
  "--type",
  "space",
  "--commit-message",
  commitMessage,
]);

console.log(`Dataset: https://huggingface.co/datasets/${datasetRepo}`);
console.log(`Space: https://huggingface.co/spaces/${spaceRepo}`);
