---
title: أنماط عملية
seoTitle: أمثلة وأنماط Harness config
socialTitle: أنماط .harness عملية للفرق والمطورين
description: أمثلة ملموسة للملفات القابلة للتعديل التي يملكها وقت التشغيل، وتجاهلات مخرجات الهدف، والتعليمات القابلة للتركيب، وطبقات ملفات التعريف، وحزم الفرق، والتخصيص الشخصي، والتنظيف الآمن.
socialDescription: أمثلة عملية لـ .harness تجمع حالة وقت التشغيل القابلة للتعديل، وقواعد التجاهل، وملفات التعريف، وتركيب `dir`، وتنظيف الأهداف بأمان.
canonicalPath: /specifications/v1/patterns/
slug: patterns
order: 7
locale: ar
sectionCode: "07"
summary: أمثلة ملموسة تجمع الملفات القابلة للتعديل، وقواعد التجاهل، وملفات التعريف، وتركيب `dir`، والتنظيف بشكل آمن.
llmSummary: يعرض أنماط Harness config العملية للملفات القابلة للتعديل التي يملكها وقت التشغيل، وتجاهلات مخرجات الهدف، والتعليمات القابلة للتركيب، وطبقات ملفات التعريف، وحزم الفرق، والتخصيص الشخصي، وملفات التعريف المحلية للهدف، والترحيل، والتنظيف.
audience: مطورون وفرق منصات يطبقون Harness config في مستودعات حقيقية.
contentKind: spec
status: draft
updated: 2026-05-28
---

# أنماط Harness config

تعرض هذه الصفحة كيفية جمع أجزاء المعيار دون فقدان قاعدة الملكية الأساسية: `.harness/` هو المصدر الرسمي، ومجلدات الأهداف المباشرة مخرجات مولّدة مع بضعة ضوابط محلية محمية.

ابدأ ببيان صريح في `./.harness/harness.toml`:

```toml
version = 1

[[resources]]
path = "./.harness/resources"

[[resources]]
path = "./.harness/local/resources"

[[targets]]
path = "./.agents"

[[targets]]
path = "./.claude"

[[targets]]
path = "./.gemini"

[[dir]]
path = "./.harness/dir"

[[dir]]
path = "./.harness/local/dir"
```

```text
.harness/
  harness.toml
  resources/
    README.md
    skills/
    rules/
  dir/
    AGENTS.md/
      .harnessComposable
  local/
    resources/
    dir/
.agents/
.claude/
.gemini/
```

يسمي البيان جذور المصدر والأهداف. ويوضح شكل الملفات أين يعيش المصدر المراجع، وأي واجهات تشغيل مباشرة يستطيع التفعيل توليدها.

## مجموعات الموارد

في معظم عمليات الترحيل، ابدأ بجذر `.harness/resources` مشترك واحد، واجمع داخله بحسب مسار الهدف الذي يجب توليده. يبقي هذا فهرس المصدر سهل الفحص، ويتجنب اختراع جذور مصدر منفصلة قبل أن يحتاجها المستودع.

```toml
[[resources]]
path = "./.harness/resources"

[[resources]]
path = "./.harness/local/resources"
```

```text
.harness/
  resources/
    README.md
    .claude/
      settings.json
      .harnessMutable
    skills/
      review/
      frontend/
    prompts/
    rules/
    plugins/
  local/
    resources/
```

ملفات جذر الهدف توضع عند مسار جذر الهدف داخل جذر الموارد: مثلاً يصبح `.claude/settings.json` هو `.harness/resources/.claude/settings.json`. وإذا كان هذا الملف مملوكاً لوقت التشغيل بعد البذرة الأولى، فأضف `.harness/resources/.claude/.harnessMutable` وفيه `settings.json`.

تفيد جذور الموارد الإضافية عندما تمثل حداً حقيقياً: فهارس اهتمامات اختيارية مستقلة، أو حدود ملكية، أو تخصصات يختارها ملف تعريف، أو طبقات محلية خاصة. مثلاً، يمكن أن تعيش اهتمامات الاختبار والنشر وواجهة المستخدم في جذور منفصلة عندما يجمعها الفريق قصداً عبر ترتيب البيان أو طبقات ملفات التعريف أو تعليمات `dir` الخاصة بملف تعريف. وتفيد الطبقة المحلية للمهارات والإضافات والوكلاء والمطالبات والتجارب الشخصية قبل ترقيتها إلى مصدر متتبع.

## تجاهل مخرجات الهدف لواجهة مباشرة واحدة

استخدم `.harnessIgnore` في مخرجات الهدف عندما تخص القاعدة شجرة مخرجات مباشرة واحدة، لا المصدر الرسمي.

```text
.agents/skills/deploy-plan/.harnessIgnore
*.tmp
```

يستبعد هذا مسارات المخرجات النهائية تحت `.agents/skills/deploy-plan/`:

```text
.agents/skills/deploy-plan/scratch.tmp
.agents/skills/deploy-plan/logs/run.tmp
```

ولا يؤثر في:

```text
.claude/skills/deploy-plan/scratch.tmp
```

تطابق تجاهلات مخرجات الهدف مسارات المخرجات، لا مسارات المصدر. وهي لا تشارك إلا بعد وجود ملف `.harnessIgnore` على القرص. ضع القواعد في `.harnessIgnore` بجذر المستودع أو في `.harnessIgnore` محلي للمصدر عندما يجب أن تطبق القاعدة في أول تفعيل.

هذا النمط محلي للهدف عمداً. يفيد أكثر مع واجهات التشغيل المباشرة المتجاهلة في Git، أو تجارب التطوير المحلية، أو ملفات وقت التشغيل الخاصة بالآلة التي لا يجب أن تصبح مصدراً مشتركاً. يُحفظ الملف ويُقرأ من مخرج الهدف، لكنه لا يُنسخ إليه بالإسقاط.

## إعادة التضمين المنطقية في التجاهل

استخدم قواعد سطحية للحدود العريضة وقواعد منطقية أعمق للاستثناءات المختارة. ملفات التجاهل المحلية لملف التعريف تقيّم عند موقع طبقة ملف التعريف المنطقي، لا عند مجلد ملف التعريف الفعلي.

```toml
[[resources]]
path = "./.harness/resources-tooling"

[[targets]]
path = "./.agents"
```

```text
.harnessIgnore
.harnessProfile                  # contains: cloudflare-react
.harness/
  resources-tooling/
    skills/
      vite-worker-imports-config-skill/SKILL.md
      codex-agent-management/SKILL.md
    cloudflare-react/
      .harnessProfileRoot         # contains: cloudflare-react
      .harnessIgnore
```

```gitignore
# .harnessIgnore
.harness/resources-tooling/skills/**
```

```gitignore
# .harness/resources-tooling/cloudflare-react/.harnessIgnore
!skills/
!skills/vite-worker-imports-config-skill/
!skills/vite-worker-imports-config-skill/**
```

عندما يكون `cloudflare-react` نشطاً، تعبر `vite-worker-imports-config-skill` وحدها حد الإسقاط. تبقى `codex-agent-management` متجاهلة لأن الملف المحلي لملف التعريف يشارك عند `.harness/resources-tooling/`، وإعادة التضمين في نسله تسمي مهارة Vite worker فقط.

## الملفات القابلة للتعديل التي يملكها وقت التشغيل

استخدم `.harnessMutable` عندما يجب أن يزرع المستودع ملفاً مرة واحدة ثم يملكه وقت التشغيل بعد ذلك.

```text
.harnessMutable
.harness/resources/**/settings.local.json
```

```text
.harness/resources/skills/review/settings.local.json
.agents/skills/review/settings.local.json
.claude/skills/review/settings.local.json
```

في أول تفعيل، ينشئ قالب المصدر ملف الهدف. بعد ذلك، يبلغ التفعيل عن الهدف كـ `mutable` ويترك بايتاته كما هي، حتى إذا غيّرها وقت التشغيل. هذا هو الشكل المناسب لمنح الصلاحيات والإعدادات المحلية والأوامر المتعلّمة والحالة الأخرى التي يجب أن تظهر في الخطة دون أن تصبح مصدراً رسمياً.

استخدم قواعد التجاهل للملفات التي يجب ألا تعبر حد الإسقاط أبداً. واستخدم `.harnessMutable` للملفات التي يجب أن تعبر مرة واحدة كقالب ثم تنتمي إلى واجهة التشغيل المباشرة.

## تعليمات قابلة للتركيب

استخدم مصادر `[[dir]]` للملفات طويلة العمر في جذر المستودع وللملفات التي يملكها الهدف وليست عناصر موارد. الورقة القابلة للتركيب مجلد يحمل علامة `.harnessComposable` فارغة. تدمج أجزاؤه المرقمة في ملف مخرج واحد. وعندما تستخدم العلامة نفسها تحت مصدر موارد مهيأ، فإنها تركّب ملف مورد مسقطاً داخل كل هدف بدلاً من مخرج `dir` في جذر المستودع أو مملوك للهدف.

```toml
[[dir]]
path = "./.harness/dir"

[[dir]]
path = "./.harness/local/dir"
```

```text
.harness/
  dir/
    AGENTS.md/
      .harnessComposable
      100_intro.md
      200_rules.md
    CLAUDE.md/
      .harnessComposable
      .harnessRef          # ../AGENTS.md
      300_claude.md
  local/
    dir/
      AGENTS.md/
        900_local.md
```

ينتج:

```text
AGENTS.md
CLAUDE.md
```

يُركّب `AGENTS.md` من الأجزاء المشتركة مع أي أجزاء محلية لاحقة. ويستورد `CLAUDE.md` ورقة `AGENTS.md` أولاً، ثم يضيف الذيل الخاص بـ Claude. استخدم هذا النمط عندما يزيل التوليد تكراراً حقيقياً أو يمكّن ملفات التعريف والطبقات المحلية؛ واحتفظ بملفات الجذر البسيطة كملفات متتبعة عادية عندما لا يفيد التركيب.

تستطيع ملفات `.harnessIgnore` المحلية للمصدر إزالة أجزاء مفردة:

```text
.harness/dir/AGENTS.md/.harnessIgnore
200_rules.md
```

وتستطيع ملفات `.harnessIgnore` في مخرجات الهدف حجب مخرج كامل بعد معرفة مسار المخرج النهائي:

```text
notes/.harnessIgnore
release.md
```

## ملف تعريف على مستوى المستودع

يختار `.harnessProfile` في جذر المستودع ملف تعريف واحداً للإسقاط كله. عندما يقع `.harnessProfileRoot` مباشرة تحت مصدر الموارد المهيأ، فإن أبناءه يركبون فوق مصدر الموارد ذلك.

```toml
[[resources]]
path = "./.harness/resources"

[[dir]]
path = "./.harness/dir"

[[targets]]
path = "./.agents"
```

```text
.harnessProfile          # contains: deploy

.harness/
  resources/
    skills/
      review/
        SKILL.md
    deploy/
      .harnessProfileRoot  # contains: deploy
      skills/
        deploy-plan/
          SKILL.md
```

عندما يكون ملف التعريف `deploy` نشطاً، تُسقط `deploy-plan` كمهارة. ولا يُسقط مجلد `deploy` نفسه كمورد لأنه تخزين طبقة.

استخدم هذا الشكل عندما تنتمي الطبقة إلى نوع موارد واحد.

## حزمة ملف تعريف يقدّمها الفريق

يمكن لملف تعريف على شكل حزمة أن يركب فوق `.harness` نفسه، وأن يضيف عدة جذور مصدر منطقية دفعة واحدة.

```toml
[[resources]]
path = "./.harness/resources"

[[dir]]
path = "./.harness/dir"

[[targets]]
path = "./.agents"
```

```text
.harnessProfile          # contains: deploy-kit

.harness/
  kits/
    deploy-kit/
      .harnessProfileRoot # contains: deploy-kit
      resources/
        skills/
          deploy-plan/
            SKILL.md
      dir/
        AGENTS.md/
          .harnessComposable
          100_deploy.md
```

تركب هذه الحزمة داخل `.harness/resources/skills` و`.harness/dir`. يمكنها إضافة مهارة وإضافة جزء تعليمات خاص بالنشر دون أن تصبح مجلد `.agents/kits/deploy-kit/` مسقطاً.

هذا هو النموذج المناسب لحزم النشر أو الأمان أو الواجهة الأمامية أو الخلفية أو التهيئة التي تقدمها الشركة. الحزمة مصدر مراجع. والمحدد يقرر أين تكون نشطة.

## واجهات مولّدة مع تعليمات تفعيل

يمكن تجاهل واجهات التشغيل المولّدة في Git عندما يحتفظ المستودع بمسار تفعيل متتبع. يبقى البيان وفهرس المصدر في التحكم بالإصدارات؛ ويمكن إعادة توليد المجلدات المباشرة بعد checkout.

```toml
[[resources]]
path = "./.harness/resources"

[[targets]]
path = "./.agents"

[[targets]]
path = "./.claude"
```

```text
AGENTS.md                         # activation note for humans and agents
package.json                      # optional setup:harness script
.gitignore
.harness/
  harness.toml
  resources/
    README.md
    skills/
      harness-config/
        SKILL.md
      review/
.agents/                          # generated, gitignored
.claude/                          # generated, gitignored
```

```gitignore
# Harness-generated live surfaces
.agents/
.claude/

# Private Harness overlays
.harness/local/
```

يجب أن تخبر تعليمات التفعيل المستخدمين والوكلاء بتشغيل `npx harnessc validate` وتشغيل التفعيل كتجربة قبل التطبيق. لا تتجاهل الواجهات المولّدة في Git عندما تترك النسخة الجديدة المستخدمين مع مجلدات تشغيل فارغة ودون مسار تفعيل واضح. ولا تتجاهل `.harness/` كلها؛ أبق البيان والموارد المشتركة ومصادر `dir` وتصريحات `.harnessIgnore` و`.harnessMutable` متتبعة حتى تبقى الواجهات المباشرة قابلة للإعادة.

## تجاوز شخصي لـ AGENTS.md

تستطيع ملفات التعريف إضافة أجزاء تعليمات شخصية وإزالة أجزاء أساسية بحسب مسار المصدر المنطقي.

```text
.harnessProfile          # contains: my-profile

.harness/
  profiles/
    my-profile/
      .harnessProfileRoot # contains: my-profile
      dir/
        AGENTS.md/
          .harnessIgnore  # contains: 100_intro.md
          100_my_intro.md
```

إذا كان `AGENTS.md` الأساسي يحتوي `100_intro.md` و`300_rules.md`، يستطيع ملف التعريف النشط استبدال المقدمة مع إبقاء القواعد المشتركة. ويُقيّم `.harnessIgnore` المحلي لملف التعريف مقابل المسار المنطقي `.harness/dir/AGENTS.md/100_intro.md`، لا مقابل مسار التخزين الفعلي تحت `.harness/profiles/my-profile`.

تتبع `.harnessProfile` عندما يجب أن يشارك الفريق الاختيار نفسه. وتجاهله في Git عندما يجب أن يختار كل مطور ملف تعريفه محلياً.

## ملفات تعريف محلية للهدف

تسمح ملفات `.harnessProfile` في مخرجات الهدف لأشجار مباشرة مختلفة باختيار طبقات ملفات تعريف مختلفة.

```text
.agents/
  skills/
    .harnessProfile      # contains: deploy
  rules/
    .harnessProfile      # contains: no-rules
```

ينطبق ملف التعريف `deploy` تحت `.agents/skills/`. وينطبق ملف التعريف `no-rules` تحت `.agents/rules/`. لا يغير أي من المحددين `.claude/` أو مخرجات جذر المستودع أو الأشجار الشقيقة داخل `.agents`.

تحفظ ملفات `.harnessProfile` في مخرجات الهدف أثناء التنظيف للسبب نفسه الذي تحفظ من أجله ملفات `.harnessIgnore` في مخرجات الهدف: هي ضوابط شجرة فرعية مباشرة، لا حمولة مسقطة.

## ترحيل مجلدات وكلاء يدوية

في مستودع قائم، انقل المحتوى المشترك طويل العمر إلى `.harness` أولاً، وأبق الضوابط المحلية المباشرة حيث تكون منطقية بالفعل.

```text
# before
.claude/skills/review/SKILL.md
.agents/skills/review/SKILL.md
.agents/skills/review/.harnessIgnore

# after
.harness/resources/skills/review/SKILL.md
.harness/resources/skills/review/.claude/SKILL.md
.agents/skills/review/.harnessIgnore
```

يمكن أن يبقى ملف التجاهل في `.agents` داخل واجهة التشغيل المباشرة لضبط شجرة المخرجات تلك وحدها. وينتقل مصدر المهارة طويل العمر إلى `.harness`، ويصبح اختلاف `.claude` تجاوزاً مشتقاً من الهدف داخل المورد.

## توصيات الملكية

أبق أدوار المصدر والهدف منفصلة:

- لا توجه مدخل `[[targets]]` إلى مجلد يبقى هو المصدر طويل العمر.
- انقل المحتوى المشترك المؤلف إلى مصادر الموارد المهيأة.
- تجاهل واجهات التشغيل المباشرة في Git عندما تكون التجارب المحلية أو حالة وقت التشغيل أهم من الالتزام بالمخرج المولّد.
- أبق حالة وقت التشغيل أو حالة المنتج خارج `.harness/`؛ ضع ذاكرات المنتج وسجلات التفعيل في مجلدات يملكها المنتج وتجاهلها.
- استخدم التجاوزات المشتقة من الهدف لفروقات الملفات الدقيقة. إذا احتاج هدف مهارة مختلفة جداً، ففضل عنصر مورد منفصلاً على شجرة تجاوز عميقة.
- صرّح بالملفات التي يملكها وقت التشغيل في `.harnessMutable` حتى يزرعها الإسقاط مرة واحدة ثم يتركها.
- لا تعتمد على اتباع الروابط الرمزية في المصدر أو الهدف. عاملها كمدخلات ورقية، وراجع أي إجراء استبدال أو إزالة قبل التفعيل.

تحافظ هذه التوصيات على التفعيل باتجاه واحد: جذور المصدر المهيأة تنتج مخرجات الهدف، وواجهات التشغيل المباشرة لا تصبح أبداً مصدر الحقيقة التالي.

## قائمة فحص التنظيف

قبل تشغيل التنظيف باستخدام `--remove-unmanaged`، افحص الخطة:

- يجب أن تكون الملفات المُدارة `keep` أو `create` أو `update`.
- يجب أن تكون الملفات التي يملكها وقت التشغيل والمعلنة في `.harnessMutable` هي `mutable` بعد أول تفعيل.
- يجب ألا تزال الملفات غير المُدارة إلا عندما تعرض الخطة `remove` صراحة.
- يجب أن تبقى ملفات `.harnessIgnore` و`.harnessProfile` في مخرجات الهدف محفوظة.
- لا ينطبق التنظيف إلا على الأهداف التي ما زالت مصرحاً بها. نظف الهدف قبل إزالة مدخل `[[targets]]` الخاص به، أو استخدم مسار عمل أعلى لحالة التفعيل يستطيع التوفيق مع الأهداف اليتيمة.

يفيد التنظيف بعد الترحيل، لكنه صريح عمداً. إذا كان ملف ما ما زال ذا قيمة، فانقله إلى `.harness`، أو صرّح به قابلاً للتعديل، أو أبقه كضابط في مخرجات الهدف قبل تطبيق الإزالة.

## فحوصات السلامة

استخدم هذه الفحوص قبل الثقة بمستودع أو بتنفيذ أداة:

- يجب أن يكون `validate` للقراءة فقط وأن يرفض المسارات خارج المستودع.
- يجب أن تشرح أول تجربة كل `create` و`update` و`remove` و`keep` و`mutable` وكل مدخل غير مُدار محفوظ قبل الكتابة.
- يجب أن يتقارب تفعيل ثان على مدخلات غير متغيرة إلى `keep` للملفات المُدارة و`mutable` للملفات التي يملكها وقت التشغيل.
- يجب أن يحفظ التنظيف المدخلات غير المُدارة افتراضياً، ولا يحذفها إلا عندما تكون الإزالة صريحة.
- يجب حفظ ملفات `.harnessIgnore` و`.harnessProfile` في مخرجات الهدف حتى أثناء التنظيف غير المُدار.
- لا يجوز الكتابة فوق الملفات القابلة للتعديل إلا عندما يختار المستخدم صراحة إعادة إسقاط قسرية.
- يجب رفض مخرجات `dir` التي ستستبدل جذر هدف مصرح به أو تحتويه قبل التطبيق.
