---
title: 设计理由
seoTitle: Harness config 设计理由
socialTitle: 为什么需要一个仓库本地的 agent 配置标准
description: 多个 harness surface 并存的具体问题，以及该标准引入的协调概念。
socialDescription: 多 harness 漂移的问题，以及 Harness config 提议的小、可审阅、可重复的契约。
canonicalPath: /specifications/v1/rationale/
slug: rationale
order: 1
locale: zh-cn
sectionCode: "01"
summary: 为什么仓库本地标准能帮助使用多个编码 agent 的团队，以及它引入了哪些协调概念。
llmSummary: 解释多个、漂移的、由 runtime 拥有的 harness surface 的具体问题，并介绍协调概念（manifest、resources 和 dir 源、声明的 target、由 target 派生的 override、profile、ignore、mutable、激活投影）。
audience: 评估权衡的工具作者、平台团队和规范审阅者。
contentKind: spec
status: draft
updated: 2026-05-26
---

# Harness config 设计理由

Harnesses 需要活动的仓库 surface。团队需要为这些 harness 消费的资源提供稳定、可审阅的源层。Harness config 把这两个责任分开，而不为任何一方规定应用模型。

源目录住在配置过的源根中，默认约定为 `./.harness`。Harness surface（如 `./.agents`、`./.claude` 或 `./.cursor`）仍然是它们的 harness 读取的活动文件和文件夹。激活把已审阅的目录视图作为普通文件投影到这些 surface。

重要的分离是所有权，而不仅仅是存储。持久的源文件由仓库所有，可审阅。活动的 target 文件是生成的输出。在 `.harnessMutable` 中声明的文件从源初始化一次，然后被当作 runtime 所有的状态，使 harness 可以安全地写入本地设置，而不把那些写入变成规范源。

## 具体问题

到 2026 年，与多个 AI 编码 agent 协作的仓库通常并排携带几个 agent 特定的顶级文件夹：`.claude/`、`.cursor/`、`.agents/`、`.codeium/`、`.continue/`、`.github/copilot-*`，加上手工维护的指令文件（如 `AGENTS.md`、`CLAUDE.md` 或 `.github/copilot-instructions.md`）。每个 runtime 读取其中之一，有时还把数据写回同一文件夹（权限、允许列表、学习到的 hook）。

这在真实仓库中产生可预测的、反复出现的痛点：

1. **几乎重复的文件夹之间的漂移。** 同一个 skill 或 prompt 被复制粘贴到 `.claude/skills/foo/`、`.cursor/skills/foo/` 等等。一个 runtime 中的编辑与其他 runtime 分歧，直到人类去调和。
2. **活动文件夹混合作者源和 runtime 状态。** 一个 runtime 写入的文件（`settings.local.json`、学习到的命令）最终被作为作者内容提交并审阅，或者被 `.gitignore` 而在贡献者之间静默分歧。
3. **没有干净的方式为一个 agent "关闭" 一个 skill。** 从活动文件夹中删除文件要么删除工作，要么需要在 CI 脚本中按 runtime 分支。
4. **指令文件重复散文。** `AGENTS.md`、`CLAUDE.md` 和 `copilot-instructions.md` 重复同样的段落，并再次漂移。
5. **没有可移植契约。** 明天发布的新 agent 没有路径让它消费仓库已经维护的同样源材料。

Harness config 通过让配置过的源层成为规范的、可审阅的，并把每个 harness surface 作为从这些源派生的显式投影 target，来应对这些问题。

## 核心概念

Harness config 定义了一组小的协调概念，而不是产品对象模型：

- 所选 manifest：仓库本地 TOML 文件，默认 `./.harness/harness.toml`，声明标准版本、配置过的源根、显式 target、有序 `[[dir]]` 根和扩展声明。
- 源目录：配置过的 `[[resources]]` 源根下的持久资源，加上配置过的 `[[dir]]` 源根下的相对仓库的输出。
- 声明的 target：一个 harness surface（如 `./.agents` 或 `./.claude`），只在 manifest 中列出时才接收投影。
- 由 target 派生的 override：资源内部的点前缀文件夹（如 `.claude`），为匹配的 target 调整文件。
- profile 覆盖：由 `.harnessProfile` 选择并由 `.harnessProfileRoot` 声明的可选源内容，按逻辑源路径合并，而不把 profile 文件夹变成普通投影项。
- 投影边界：`.harnessIgnore` 用于排除，`.harnessMutable` 用于只初始化、runtime 所有的所有权，包含根、源本地、profile 本地和目标输出本地的 ignore 规则（适用时）。
- runtime 所有的 mutable 文件：从仓库所有的源模板开始的投影 target 文件，然后在第一次激活后成为本地 runtime 状态。
- 激活投影：从所选输入到 target 文件的 dry-run 优先计算计划，包含 create/update/remove/keep/preserve/mutable 动作和显式的清理与 mutable 文件策略。

## 为什么要共享标准

- 团队可以跨多个 harness 检查一个仓库本地契约，而不是把每个 harness surface 当作源格式。
- 一个仓库可以持有完整的资源目录，而每个 harness 只接收针对该上下文的已审阅投影。
- 契约与实现无关：文件夹、TOML、ignore 规则、override 和投影意图。
- 新的资源类型和 target 根直接文件可以使用配置过的 resources 源，在每个 runtime 都支持原生格式之前。
- 每个声明的 target 投影都是显式的、可审阅的，并可从源、ignore、override 和清理策略重现。
- runtime 所有的 mutable 文件给活动 harness 一个稳定的位置存放本地状态，而不把 target 文件夹变成下一个真理源。
- 工具可以在更改活动文件夹之前显示创建、更新、请求的删除、未更改的投影文件和保留的未管理项。

## 核心与扩展

更改基础投影计划的行为是核心标准的一部分：resources、声明的 target、由 target 派生的 override、profile 覆盖、`.harnessIgnore`、`.harnessMutable`、清理和 dir 组合/拷贝。这些功能直接与幂等性、未管理项清理和 target 保留交互，因此需要一个共享契约。

扩展为该契约旁边的注册行为保留。基础标准定义扩展发现和激活策略字段，每个扩展拥有自己的 schema、兼容性、诊断、计划和写入。扩展不得重新定义 resources 源、target、override、profile、`.harnessIgnore`、mutable 文件、清理或核心激活计划。

## 利益相关者

平台团队可以定义一个仓库本地策略，用于存储 harness 资源、审阅更改和在 CI 中校验路径。

工具构建者可以消费稳定的资源模型，而不是从活动 harness surface 抓取或发明另一种布局。

安全团队可以在任何东西到达执行 surface 之前审阅规范源资源、激活意图以及被忽略或 mutable 的文件。

开源项目可以发布可复用的 agent 指令，而不选择某个 agent runtime 作为规范格式。

## runtime 所有的文件

Harnesses 经常写回它们读取的 surface。授予的权限、允许列表的命令和学习到的 hook 落在像 `.claude/settings.local.json` 这样的文件中。Harness config 有意保持激活单向 — 投影总是从源流向 target。基础标准识别仓库声明的 mutable 文件，但不尝试推断 target 字节为什么改变：

- 受管理文件直接与当前投影比较。如果 target 字节不同，激活可以报告 `update`。
- Mutable 文件在 `.harnessMutable` 中显式声明。runtime 在第一次投影后拥有它们。投影创建它们一次然后让它们独自存在，即使它们的字节仍然与源模板匹配。

这不同于忽略一个文件。被忽略的文件不跨越投影边界。Mutable 文件跨越：源目录提供初始形状，审阅可以看到该文件是被期望的，后续激活保留 target 字节，因为 runtime 现在是所有者。这让权限文件、本地设置和学习到的状态可被审计，而不把它们变成受源控制的配置。

Target 编辑审阅、反向投影和 target 到源的捕获是合法的后续工作流，但它们严重依赖版本控制实践和产品 UX。它们属于 v1 之上的产品层。

## 非目标

Harness config 不标准化产品工作流、托管服务、市场、分发系统、恢复状态、runtime 行为、分组、选择策略、target 编辑审阅、捕获或远程同步。这些属于在基础标准之上构建的产品。

## 与已有方法的关系

Harness config 借鉴了在广泛部署的系统中工作的模式。它不是任何一个的泛化；它借用适合仓库本地源到 runtime 投影问题的部分，留下其余的。

- **`.gitignore` 风格的模式文件** 启发了 `.harnessIgnore` 和 `.harnessMutable` 的语法以及有序、最后匹配获胜的优先级。差异：`.harnessIgnore` 排除文件，而 `.harnessMutable` 声明只初始化的种子文件，因为投影有比"已跟踪 vs 未跟踪"更多的维度：一个文件可以从源初始化，同时在激活后仍由 runtime 拥有。
- **Helm / Kustomize 覆盖**（Kubernetes）启发了基础源树由按 target 覆盖组合的想法。Harness config 把覆盖范围保持更窄：资源项 *内部* 的点前缀文件夹，其第一段与 target 的第一段路径匹配，没有补丁语言也没有模板。覆盖文件要么替换精确路径，要么添加新文件；没有别的。
- **profile 特定的 dotfile 覆盖** 启发了 `.harnessProfile` 和 `.harnessProfileRoot`：团队可以在 `.harness` 下保留可选工具包或个人覆盖，按仓库或目标输出子树选择它们，并且仍然把最终投影作为文件级别的创建和替换来审阅。
- **EditorConfig** 启发了在仓库根选择单个文件、带有任何工具都可以在不绑定 runtime 的情况下实现的小型声明式语法的选择。
- **dotfile 管理器（chezmoi、GNU Stow、yadm）** 解决相关问题 — 把一个精心策划的源树投影到活动系统位置 — 用于个人 `$HOME` 而不是按仓库的 agent surface。源真理 / target 作为投影的区分（包括"为投影忽略"过滤器的需要）来自那个谱系。
- **Conventional commits / SemVer / RFC 2119** 启发了 [Standard](/specifications/v1/standard/) 中的显式规范语言和向前兼容策略。一个未来的实现者可以独立阅读的规范更有可能在维护者变更后存活下来。
- **`AGENTS.md`、`CLAUDE.md` 和 `copilot-instructions.md`** 是 *什么* 被投影的直接前作。Harness config 不定义它们的内容；它给它们一个共享的源位置以及一个一致的方式通过配置过的 `[[dir]]` 源根来组合它们，而不是手工同步重复的散文。

Harness config 故意不试图成为：包管理器、插件 runtime、服务网格、权限系统、模板引擎或 agent SDK。这些是有价值的但可分离的问题。
