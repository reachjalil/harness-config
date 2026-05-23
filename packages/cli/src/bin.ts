#!/usr/bin/env node
import { runHarnessConfigCli } from "./run";

const exitCode = await runHarnessConfigCli(process.argv.slice(2));
process.exitCode = exitCode;
