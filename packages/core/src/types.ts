export type ConventionalHarnessResource = "skills" | "rules" | "plugins";

export type HarnessTargetDefinition = {
  path: string;
};

export type HarnessExtensionActivation = "explicit" | "auto";

export type HarnessExtensionDefinition = {
  version: number;
  activation: HarnessExtensionActivation;
  [key: string]: unknown;
};

export type HarnessSourceDefinition = {
  path: string;
};

export type HarnessDirDefinition = HarnessSourceDefinition;

export type HarnessResourcesDefinition = HarnessSourceDefinition;

export type HarnessPathOptions = {
  configPath?: string;
  config?: {
    resources?: HarnessResourcesDefinition[];
    dir?: HarnessDirDefinition[];
  };
};

export type HarnessConfigPaths = {
  root: string;
  harnessDir: string;
  configPath: string;
  ignorePath: string;
  resourcesDirs: string[];
  dirDirs: string[];
  resourcesDir: string;
  skillsDir: string;
  rulesDir: string;
  pluginsDir: string;
  workspaceReadmePath: string;
};

export type DiagnosticSeverity = "info" | "warning" | "error";

export type HarnessDiagnostic = {
  severity: DiagnosticSeverity;
  code: string;
  message: string;
  path?: string;
  recommendation?: string;
};

export type HarnessInspection = {
  root: string;
  paths: HarnessConfigPaths;
  hasHarnessDir: boolean;
  hasHarnessConfig: boolean;
  hasHarnessIgnore: boolean;
  diagnostics: HarnessDiagnostic[];
};

export type InitializationActionKind = "ensure-dir" | "write-file";

export type HarnessInitializationAction = {
  id: string;
  kind: InitializationActionKind;
  summary: string;
  source?: string;
  target?: string;
  content?: string;
  requiredConfirmation?: boolean;
};

export type HarnessInitializationPlan = {
  root: string;
  actions: HarnessInitializationAction[];
  diagnostics: HarnessDiagnostic[];
};

export type AppliedInitializationAction = HarnessInitializationAction & {
  applied: boolean;
  skipped?: boolean;
  reason?: string;
};

export type HarnessInitializationResult = {
  root: string;
  dryRun: boolean;
  actions: AppliedInitializationAction[];
  diagnostics: HarnessDiagnostic[];
};

export type ApplyHarnessInitializationOptions = {
  dryRun?: boolean;
  yes?: boolean;
  configPath?: string;
  resourcesPath?: string;
  resourceKinds?: string[];
  config?: {
    version: number;
    standard: {
      name: string;
    };
    resources?: HarnessResourcesDefinition[];
    dir?: HarnessDirDefinition[];
    targets: HarnessTargetDefinition[];
    extensions?: Record<string, HarnessExtensionDefinition>;
  };
};

export type HarnessActivationActionKind =
  | "create"
  | "update"
  | "remove"
  | "keep"
  | "preserve"
  | "mutable";

export type HarnessActivationAction = {
  kind: HarnessActivationActionKind;
  targetPath: string;
  relativePath?: string;
  sourcePath?: string;
  reason?: string;
};

export type HarnessActivationTargetPlan = {
  path: string;
  override: string;
  strategy: "copy";
  actions: HarnessActivationAction[];
};

export type HarnessActivationDirActionKind = "create" | "update" | "keep";

export type HarnessActivationDirAction = {
  kind: HarnessActivationDirActionKind;
  relativePath: string;
  targetPath: string;
  sourcePaths: string[];
  outputKind: "composable" | "copy";
  reason?: string;
};

export type HarnessActivationDirPlan = {
  enabled: boolean;
  path?: string;
  paths?: string[];
  actions: HarnessActivationDirAction[];
};

export type HarnessActivationPlan = {
  root: string;
  idempotent: true;
  targets: HarnessActivationTargetPlan[];
  dir: HarnessActivationDirPlan;
  diagnostics: HarnessDiagnostic[];
};

export type HarnessActivationResult = {
  root: string;
  dryRun: boolean;
  plan: HarnessActivationPlan;
  appliedActions: HarnessActivationAction[];
  appliedDirActions: HarnessActivationDirAction[];
};

export type ApplyHarnessActivationOptions = {
  dryRun?: boolean;
  yes?: boolean;
  configPath?: string;
  cleanupUnmanaged?: "keep" | "remove";
  mutablePolicy?: "skip" | "force";
};

export type HarnessResourceItemProjectionOptions = {
  root?: string;
  sourceDir: string;
  targetDir: string;
  targetPath?: string;
  diagnostics?: HarnessDiagnostic[];
};

export type HarnessIgnoreRuleKind = "ignore" | "mutable";
export type HarnessIgnoreMatchBase = "source" | "target" | "both";

export type HarnessIgnoreRule = {
  kind: HarnessIgnoreRuleKind;
  pattern: string;
  negated: boolean;
  directoryOnly: boolean;
  anchored: boolean;
  sourceLine: number;
  scope: "all" | "only" | "except";
  target?: string;
};

export type HarnessIgnoreRuleSet = {
  rules: HarnessIgnoreRule[];
  directory: string;
  sourcePath: string;
  isRoot: boolean;
  matchBase?: HarnessIgnoreMatchBase;
  implicitTarget?: string;
  profile?: string;
};

export type HarnessIgnoreMatcher = {
  rules: HarnessIgnoreRule[];
  ruleSets: HarnessIgnoreRuleSet[];
  ignores(
    relativePath: string,
    options?: {
      isDirectory?: boolean;
      outputPath?: string;
      profile?: string;
      target?: string;
      targetPath?: string;
    }
  ): boolean;
  isMutable(
    relativePath: string,
    options?: {
      isDirectory?: boolean;
      outputPath?: string;
      profile?: string;
      target?: string;
      targetPath?: string;
    }
  ): boolean;
};
