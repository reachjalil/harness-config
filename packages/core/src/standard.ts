import { parse, stringify } from "smol-toml";
import { z } from "zod";

import {
  CONVENTIONAL_HARNESS_RESOURCES,
  defaultHarnessResourcePath,
} from "./paths";
import type { HarnessResourceDefinition } from "./types";

export const CURRENT_HARNESS_CONFIG_VERSION = 1;
export const SUPPORTED_HARNESS_CONFIG_VERSIONS = [1] as const;

export const resourceIdSchema = z
  .string()
  .regex(
    /^[a-z][a-z0-9_-]*$/,
    "Resource ids must start with a lowercase letter and contain only lowercase letters, numbers, underscores, or dashes."
  );

export const repoLocalPathSchema = z
  .string()
  .min(1)
  .refine((value) => !value.startsWith("/"), {
    message: "Paths must be repo-local and cannot be absolute.",
  })
  .refine((value) => !value.split(/[\\/]/).includes(".."), {
    message: "Paths must be repo-local and cannot contain .. segments.",
  });

export const harnessTargetPathSchema = repoLocalPathSchema
  .refine((value) => {
    const firstSegment = value
      .replaceAll("\\", "/")
      .replace(/^\.\//, "")
      .split("/")
      .find(Boolean);
    return Boolean(firstSegment?.startsWith("."));
  }, "Target paths must start with a dot-prefixed harness folder such as .claude.")
  .refine((value) => {
    const firstSegment = value
      .replaceAll("\\", "/")
      .replace(/^\.\//, "")
      .split("/")
      .find(Boolean);
    return firstSegment !== ".harness";
  }, "Target paths cannot point at .harness.");

export const overrideDirectorySchema = z
  .string()
  .regex(
    /^\.[a-z][a-z0-9_-]*$/,
    "Override directories must be dot-prefixed harness ids such as .claude."
  );

export const harnessResourceSchema = z
  .object({
    path: repoLocalPathSchema,
  })
  .strict();

export const harnessTargetSchema = z
  .object({ path: harnessTargetPathSchema })
  .strict();

export const conventionalHarnessResources: Record<
  string,
  HarnessResourceDefinition
> = Object.fromEntries(
  CONVENTIONAL_HARNESS_RESOURCES.map((resource) => [
    resource,
    {
      path: defaultHarnessResourcePath(resource),
    },
  ])
);

const harnessResourcesSchema = z
  .record(z.string(), harnessResourceSchema)
  .default({})
  .superRefine((resources, context) => {
    for (const resource of Object.keys(resources)) {
      const result = resourceIdSchema.safeParse(resource);
      if (!result.success) {
        context.addIssue({
          code: "custom",
          message: `Invalid resource id "${resource}".`,
          path: [resource],
        });
      }
    }
  });

export const harnessConfigSchema = z
  .object({
    version: z
      .number()
      .int()
      .positive()
      .superRefine((version, context) => {
        const isSupported = SUPPORTED_HARNESS_CONFIG_VERSIONS.includes(
          version as (typeof SUPPORTED_HARNESS_CONFIG_VERSIONS)[number]
        );
        if (!isSupported) {
          context.addIssue({
            code: "custom",
            message: `Unsupported HarnessConfig version ${version}. Supported versions: ${SUPPORTED_HARNESS_CONFIG_VERSIONS.join(
              ", "
            )}`,
          });
        }
      }),
    standard: z
      .object({
        name: z.string().default("harness-config"),
      })
      .strict()
      .default({ name: "harness-config" }),
    resources: harnessResourcesSchema,
    targets: z.array(harnessTargetSchema).default([]),
  })
  .strict();

export type HarnessConfig = z.infer<typeof harnessConfigSchema>;

export function createDefaultHarnessConfig(): HarnessConfig {
  return harnessConfigSchema.parse({
    version: CURRENT_HARNESS_CONFIG_VERSION,
    resources: conventionalHarnessResources,
    targets: [],
  });
}

export function listHarnessProjectionTargets(config: HarnessConfig): string[] {
  return config.targets.map((target) => target.path);
}

export function inferHarnessOverrideDirectory(
  targetPath: string
): string | undefined {
  const firstSegment = targetPath
    .replaceAll("\\", "/")
    .replace(/^\.\//, "")
    .split("/")
    .find(Boolean);
  if (!firstSegment) {
    return undefined;
  }
  return firstSegment.startsWith(".") ? firstSegment : `.${firstSegment}`;
}

export function parseHarnessConfigToml(raw: string): HarnessConfig {
  const parsed = parse(raw);
  return harnessConfigSchema.parse(parsed);
}

export function safeParseHarnessConfigToml(raw: string):
  | {
      success: true;
      data: HarnessConfig;
    }
  | {
      success: false;
      error: z.ZodError | Error;
    } {
  let parsed: unknown;
  try {
    parsed = parse(raw);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
  const result = harnessConfigSchema.safeParse(parsed);
  if (result.success) {
    return result;
  }
  return result;
}

export function formatHarnessConfigTomlError(
  error: z.ZodError | Error
): string {
  if (error instanceof z.ZodError) {
    return error.issues.map((issue) => issue.message).join("; ");
  }
  return error.message;
}

export function stringifyHarnessConfig(config: HarnessConfig): string {
  return `${stringify(config)}\n`;
}

export function createDefaultHarnessConfigToml(): string {
  return stringifyHarnessConfig(createDefaultHarnessConfig());
}
