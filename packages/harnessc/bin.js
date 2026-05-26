#!/usr/bin/env node
import { runHarnessConfigCli } from "@harnessconfig/cli";

const exitCode = await runHarnessConfigCli(process.argv.slice(2));
process.exitCode = exitCode;
