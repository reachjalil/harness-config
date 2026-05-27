---
title: 标准
seoTitle: .harness config 标准
socialTitle: .harness 仓库配置标准
description: .harness 源布局、TOML manifest、激活投影、目标派生覆盖、.harnessIgnore、profile overlay 和一致性边界的规范定义。
socialDescription: 资源、目标、覆盖、ignore、profile、扩展和激活行为的规范定义。
canonicalPath: /specifications/v1/standard/
slug: standard
order: 2
locale: zh-cn
sectionCode: "02"
summary: 术语、仓库形状、TOML、投影、覆盖、ignore、profile、扩展和一致性的规范定义。
llmSummary: 定义 .harness 仓库形状、TOML 合同、激活投影、目标派生覆盖、ignore 优先级、profile overlay、扩展声明和一致性边界。
audience: 工具作者、标准审查者和技术实现者。
contentKind: spec
status: draft
updated: 2026-05-27
---

# Harness config 标准

**状态：** Version 1 specification proposal。文件形状、manifest schema、
投影契约和 ignore 语法应当无需参考实现代码即可实现，但公开契约仍处于提案评审
阶段。在公开 release、一致性 fixture、真实采用仓库和外部反馈成熟之前，
TypeScript packages 应视为 alpha reference implementation。v1 被接受后，
会使 v1 仓库或 v1 实现失效的变更保留给 v2。

规范版本是完整版本。patch、minor、prerelease 和 package 版本属于 CLI、
tooling、extension 和实现发布，不属于规范 URL 空间，也不属于 manifest
`version` 字段。

Harness 是消费仓库指令、上下文、工具和配置的智能体 runtime 或开发者工具。Harness surface 是该 harness 读取的仓库本地文件或文件夹，例如 `AGENTS.md`、`.agents`、`.claude` 或 `.cursor`。

一个一致的仓库包含选中的 manifest，默认 `./.harness/harness.toml`；配置过的资源源；显式目标；可选的根 `.harnessIgnore`；以及可选 `[dir]` 源，用于组合或复制输出。

## 仓库形状

```text
.harness/
  harness.toml
  resources/
    skills/
      review/
        SKILL.md
        .claude/
          SKILL.md
.harnessIgnore
.agents/
  skills/
    review/
      .harnessIgnore
```

资源位于配置的 `[resources]` 源下。`skills`、`rules`、`plugins` 等类型是文件夹，不是每种类型一张 TOML 表。Harness surface 只有在 `[[targets]]` 中声明后才是输出。

资源文件夹也可以包含空的 `.harnessComposable` 标记。此时它组合的是一个会投影到每个声明目标中的资源文件，例如 `skills/review/SKILL.md`。这个叶子仍然是资源：它参与目标覆盖、profile 和资源侧 `.harnessIgnore` 规则。

## 目标

每个目标都是仓库相对路径，并且只包含 `path`。

```toml
[[targets]]
path = "./.agents"

[[targets]]
path = "./.claude"
```

路径的第一段选择每个资源中的对应覆盖。目标 `./.claude` 会选择资源里的 `.claude` 文件夹。

## `[dir]` 和 `.harnessComposable`

`[dir]` 声明一个仓库本地源，默认 `./.harness/dir`。在 `[dir]` 中，包含空文件 `.harnessComposable` 的文件夹是 dir 可组合叶子：编号片段会连接成一个仓库相对输出文件。与资源不同，`[dir]` 不会作为资源树投影到每个目标；它用于 `AGENTS.md`、`CLAUDE.md` 或目标自有配置文件这类仓库相对输出。

## `.harnessIgnore`

`.harnessIgnore` 定义哪些内容不能穿过投影边界。它可以位于仓库根、声明源内部或已有目标输出内部。目标输出中已经存在的 `.harnessIgnore` 受保护：投影不会从源复制、覆盖或在清理时删除它们。

规则按从浅到深的文件顺序、每个文件从上到下求值，最后参与的规则获胜。`[.claude]` 等目标化 section 无效；目标专属规则应位于该目标输出内的 `.harnessIgnore`。

## 激活

激活从资源、覆盖、profile、ignore、`[dir]`、清理策略和 mutable 策略计算投影。同一组输入必须产生同一目标树。

## 文件系统语义

Harness config v1 固定一组保守的文件系统行为：

- Symlink 是叶子项；发现源、目标、ignore、profile 或 `[dir]` 输出时绝不跟随。
- 受管理文件在目标字节不同的时候，从当前源投影更新。
- 匹配 `[mutable]` 的文件只创建一次，之后由 runtime 拥有。
- 目标中的未管理文件默认保留，除非显式选择清理。
- 目标输出中的 `.harnessIgnore` 和 `.harnessProfile` 是受保护的本地状态。
- 相同的源树、manifest、profile、ignore 规则、清理策略和 mutable 策略会产生确定性的激活结果。
- 目标不能指向 `.harness`，不能与配置源重叠，也不能彼此重叠。

例如，`.harness/resources/hooks.json` 这样的源文件可以更新 `.agents/hooks.json`；而匹配 `[mutable]` 的目标自有文件 `.agents/skills/review/settings.local.json` 在第一次投影后会保持不变。`.claude/skills/review/.harnessIgnore` 这样的目标输出文件可以过滤该目标子树，并在清理期间保留。
