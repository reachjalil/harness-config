---
title: Adoption
seoTitle: Adopter Harness config
socialTitle: Comment adopter Harness config dans un dépôt
description: Workflows pratiques pour démarrage greenfield, migration, profils, instructions composables et nettoyage.
socialDescription: Un chemin pratique pour déplacer la configuration agent dans un catalogue source Harness config durable avec profils et nettoyage sûr.
canonicalPath: /specifications/v1/adoption/
slug: adoption
order: 4
locale: fr-fr
sectionCode: "04"
summary: Workflows pratiques pour démarrage greenfield, migration, profils, instructions composables et nettoyage.
llmSummary: Couvre les workflows de création d'un catalogue Harness config, de déclaration des cibles, de prévisualisation de l'activation, de migration, de profils et de nettoyage sûr.
audience: Développeurs introduisant Harness config dans des dépôts nouveaux ou existants.
contentKind: spec
status: draft
updated: 2026-05-29
---

# Adoption de Harness config

Ce guide décrit deux chemins : greenfield (pas de dossiers d'agent vivants existants) et migration (un dépôt qui a déjà `.claude/`, `.cursor/`, `.agents/` ou similaire).

## Greenfield

Harness config v1 démarre depuis un petit contrat source :

1. Créer `./.harness/harness.toml` avec `version = 1`, ou choisir un autre chemin de manifeste local au dépôt et le passer explicitement à l'outillage.
2. Ajouter des dossiers de ressources et fichiers sous des racines source `[[resources]]` explicites, couramment `.harness/resources`, tels que `.harness/resources/skills`, `.harness/resources/rules` ou `.harness/resources/hooks.json`.
3. Déclarer chaque cible de projection explicitement dans le manifeste sélectionné.
4. Utiliser `.harnessIgnore` pour garder les fichiers uniquement-source hors des cibles vivantes, et utiliser `.harnessMutable` pour les fichiers possédés par le runtime qui devraient être initialisés une seule fois. Un fichier mutable devrait généralement être un modèle source pour l'état cible local, pas une configuration partagée durable.
5. Dry-run l'activation avant d'écrire les dossiers cibles.

Pour un premier petit setup, montrer à la fois le manifeste sélectionné et l'arbre source :

```toml
version = 1

[[resources]]
path = "./.harness/resources"

[[targets]]
path = "./.agents"
```

```text
AGENTS.md                         # instructions racine / d'activation trackées
.harnessIgnore
.harnessMutable
.harness/
  harness.toml
  resources/
    README.md
    skills/
      review/
        SKILL.md
.agents/                          # généré après activation
```

Garder `AGENTS.md`, `CLAUDE.md` ou des fichiers d'instructions racine similaires comme fichiers trackés normaux lorsqu'ils sont simples et déjà cohérents. Les déplacer dans `[[dir]]` uniquement lorsque la génération, la composition, les profils ou les superpositions locales rendent le dépôt plus facile à comprendre.

`harnessc` est l'implémentation standard pour ce workflow :

```bash
harnessc init
harnessc init --yes --resource skills --target ./runtime/agent
harnessc validate
harnessc explain .agents/skills/review/SKILL.md
harnessc activate
harnessc activate --yes
```

## Migration d'un dépôt existant

Un dépôt qui a déjà des surfaces de harness telles que `.claude/` ou `.cursor/` adopte Harness config de façon incrémentale. La forme de la migration compte : les racines source configurées doivent devenir l'entrée canonique, pas la cible.

Séquence recommandée :

1. **Snapshot des cibles existantes.** Commiter les dossiers vivants actuels ou les copier dans une branche. L'adoption est réversible, mais une base de référence connue facilite la revue.
2. **Déplacer le contenu durable dans un layout de ressources clair.** Pour la première migration complète, préférer une racine `./.harness/resources` partagée et grouper à l'intérieur par utilité : workflow, stratégie, équipe, mode, ensemble d'agents, domaine produit ou kit. La plupart des contenus `.claude/skills/foo/` deviennent `./.harness/resources/skills/foo/`. Les fichiers qui ne diffèrent que pour un agent passent dans le dossier de surcharge d'élément correspondant (par exemple `./.harness/resources/skills/foo/.claude/`). Les fichiers à la racine cible tels que `.claude/settings.json` ou `.claude/hooks.json` appartiennent au chemin dérivé de la cible correspondant sous la racine de ressources, tel que `./.harness/resources/.claude/settings.json` ou `./.harness/resources/.claude/hooks.json`. Ajouter d'autres racines de ressources configurées uniquement pour des catalogues de préoccupations optionnels tels que testing, déploiement ou travail UI, des frontières de propriété distinctes, des spécialisations sélectionnées par profil ou des superpositions locales/privées.

   ```toml
   [[resources]]
   path = "./.harness/resources"

   [[resources]]
   path = "./.harness/local/resources"

   [[targets]]
   path = "./.agents"

   [[targets]]
   path = "./.claude"
   ```

   ```text
   .harness/
     resources/
       README.md
       .claude/
         settings.json
         .harnessMutable
       skills/
       prompts/
       rules/
       plugins/
     local/
       resources/
   ```

   Ce couplage garde la revue de migration concrète : les reviewers peuvent voir quelle racine source partagée est projetée, quels fichiers au niveau cible sont initialisés et quelle racine source locale est privée ou expérimentale. Au fur et à mesure que Harness config mûrit, les équipes peuvent diviser les préoccupations en racines supplémentaires telles que `./.harness/resources-testing`, `./.harness/resources-deployment` ou `./.harness/resources-ui` et les combiner avec des superpositions de profil ou des instructions dir spécifiques au profil.
3. **Déclarer les cibles dans le manifeste sélectionné.** Ajouter une entrée `[[targets]]` pour chaque surface de harness que vous voulez régénérer. Une cible ne reçoit des projections que lorsqu'elle apparaît ici. Déclarer chaque source partagée avec une entrée `[[resources]]` explicite.
4. **Écrire `.harnessIgnore` et `.harnessMutable` délibérément.** Les logs, fichiers scratch, métadonnées par outil et `metadata.toml` de skill appartiennent typiquement aux règles d'ignore parce qu'ils ne devraient pas traverser la limite de projection. Les fichiers que le runtime écrit en retour (permissions, réglages locaux, commandes apprises) appartiennent à `.harnessMutable` lorsque le catalogue source devrait les initialiser une seule fois et que le runtime cible devrait les posséder après. Copier ces fichiers d'initialisation dans `.harness` avant de les déclarer mutables, pour que les nouveaux checkouts reçoivent une version initiale. Les règles à l'échelle du dépôt vivent généralement dans `./.harnessIgnore` ; les règles spécifiques aux ressources ou dir peuvent vivre dans des fichiers `.harnessIgnore` source-locaux, et les préférences de sortie utilisateur/locales peuvent vivre dans des fichiers en sortie cible tels que `runtime/agent/skills/foo/.harnessIgnore`. Les fichiers en sortie cible sont utiles lorsque la surface de harness vivante est gitignored et qu'un développeur a besoin d'une limite locale temporaire ; les règles partagées devraient vivre dans la source. La précédence suit la profondeur de dossier logique, donc les règles source/profil plus profondes peuvent ré-inclure des chemins sélectionnés tandis que les règles en sortie cible restent la limite finale.
5. **Ajouter des surcharges de profil uniquement là où elles clarifient la propriété.** Placer `.harnessProfileRoot` sous `.harness`, une source de ressources configurée ou une source dir configurée pour les kits optionnels ou superpositions personnelles, et les sélectionner avec des fichiers `.harnessProfile` racine ou en sortie cible. Les fichiers `.harnessIgnore` profil-locaux peuvent cacher les fichiers de base ou les parties composables pour ce profil et sont évalués à l'emplacement de superposition du profil. Utiliser les profils comme modes commutables à travers les groupes de ressources d'abord, et comme superpositions de fichiers uniquement lorsqu'ils ajoutent ou remplacent réellement du contenu.
6. **Dry run, expliquer, réviser, puis appliquer.** `harnessc activate` imprime le plan sans écrire. Utiliser `harnessc explain <path>` pour une source ou sortie spécifique qui a besoin d'inspection, puis réviser les actions `create` / `update` / `remove` par rapport au snapshot et relancer avec `--yes`.
7. **Relancer l'activation.** Un deuxième dry run sur des entrées inchangées devrait converger vers `keep` pour les fichiers gérés et `mutable` pour les fichiers possédés par le runtime. Si ce n'est pas le cas, l'arbre source dérive encore par rapport à la cible ; réconcilier avant de s'appuyer sur le standard.

Après la migration, les dossiers vivants sont dérivés : ils peuvent être supprimés et régénérés depuis les racines source configurées plus le manifeste à tout moment. Les équipes peuvent aussi gitignored ces surfaces de harness vivantes lorsqu'elles veulent plus d'espace pour des expérimentations locales, de l'état runtime ou des fichiers scratch spécifiques à l'outil. Le compromis est délibéré : la revue se passe dans `.harness` et le manifeste sélectionné, les fichiers cibles gérés restent reproductibles et les fichiers cibles `.harnessMutable` gardent l'état possédé par le runtime hors de l'arbre source canonique.

## Recommandations gitignore

Utiliser `.gitignore` uniquement après que la source de vérité est claire :

- **Tracker la source Harness partagée.** Commiter `.harness/harness.toml`, le `.harness/resources/**` partagé, `.harness/dir/**` lorsqu'utilisé, `.harnessIgnore` et les déclarations `.harnessMutable` nécessaires pour reproduire les sorties générées.
- **Gitignored les surfaces de harness générées après convergence.** Une fois que l'activation converge et que chaque ressource durable est représentée dans `.harness`, les dossiers tels que `.agents/`, `.claude/`, `.cursor/` et `.gemini/` peuvent être ignorés. Garder les instructions d'activation trackées, telles qu'une note d'instructions racine, une étape README ou un script de paquet qui exécute la validation et l'activation.
- **Gitignored les superpositions développeur locales si souhaité.** Utiliser `.harness/local/` pour les skills, prompts, expérimentations et superpositions dir locales privées, puis l'ajouter à `.gitignore` lorsque ces fichiers ne devraient pas être partagés.
- **Ne pas s'appuyer sur des contrôles en sortie cible gitignored pour la première activation.** Un `.harnessIgnore` ou `.harnessProfile` en sortie cible ne participe qu'après son existence dans la sortie générée. Placer les limites partagées de première activation dans des fichiers `.harnessIgnore` source-locaux ou le `.harnessIgnore` racine.

Exemple après une migration complète :

```gitignore
# Surfaces vivantes générées par Harness
.agents/
.claude/
.cursor/
.gemini/

# Superpositions Harness privées
.harness/local/
```

Ne pas ignorer tout `.harness/` ; cela cacherait le manifeste et la source révisée requis pour régénérer les surfaces de harness vivantes.

## Pièges courants

- **Traiter un dossier vivant comme à la fois source et cible.** Ne pas pointer une entrée `[[targets]]` vers un dossier que vous éditez aussi directement. La prochaine activation rapportera une dérive ou écrasera les éditions vivantes. Si un dossier doit rester la source pour le moment, le laisser hors de `[[targets]]`.
- **Oublier de déclarer une cible.** Les ressources ne se projettent que vers les cibles déclarées. Un dépôt peut avoir `./.harness/resources/skills/foo/` et `.claude/` sur disque et toujours voir « aucune création » — parce que `./.claude` n'est pas dans `[[targets]]`.
- **Mettre l'état produit ou runtime sous `.harness/`.** `./.harness/` est pour la source durable et révisable. Les enregistrements d'activation, les hashs de dérive et les caches produit appartiennent aux dossiers possédés par le produit tels que `.harnex/` et à `.harnessIgnore`.
- **Mettre des fichiers à la racine cible dans un kit par accident.** Un fichier à la racine cible tel que `.claude/settings.json` devrait être représenté à `.harness/resources/.claude/settings.json`, pas à l'intérieur d'un dossier de skill ou d'un groupe de ressources non lié. Le marquer mutable lorsqu'il devrait initialiser une seule fois puis devenir possédé par le runtime.
- **Utiliser les surcharges pour forker du contenu largement.** Les dossiers de surcharge remplacent des chemins relatifs exacts ou en ajoutent de nouveaux. Ce sont volontairement un petit marteau ; si une cible a besoin d'une version très différente d'un skill, préférer un élément de ressource séparé plutôt qu'un arbre de surcharge profond.
- **Commiter des fichiers écrits par le runtime comme s'ils étaient source.** Les fichiers comme `.claude/settings.local.json` devraient typiquement être copiés dans `.harness` comme graine et déclarés dans `.harnessMutable` pour que la projection les initialise une seule fois puis les laisse tranquilles. Si le fichier devient plus tard une politique partagée, promouvoir les octets désirés en racine source configurée et forcer la re-projection mutable délibérément.
- **S'attendre à un fichier d'ignore en sortie cible avant qu'il n'existe.** Un `.harnessIgnore` en sortie cible ne participe qu'après son existence sur disque. Utiliser le fichier racine pour les règles qui doivent s'appliquer à la première activation.
- **Projeter les contrôles Harness config comme payload.** Les fichiers de déclaration tels que `.harnessIgnore`, `.harnessMutable`, `.harnessProfile` et `.harnessProfileRoot` sont lus comme des contrôles et ne sont pas copiés dans les cibles comme fichiers gérés.
- **Liens symboliques de cibles.** Harness config v1 ne suit pas les liens symboliques. Si un lien symbolique occupe un chemin que l'activation doit écrire, l'activation rapporte un conflit par défaut. Remplacer le lien manuellement, définir `[activation].targetSymlinks = "replace"` ou utiliser `--replace-target-symlinks` uniquement lorsque remplacer le lien lui-même est intentionnel.

## Rappel de portée

Le standard lui-même reste limité au layout source, aux déclarations de cibles, aux surcharges, aux ignores de projection, aux fichiers mutables et à la projection de copie déterministe. La sélection spécifique au produit, la place de marché, la revue d'édition cible, les enregistrements d'activation, la capture et la synchronisation distante appartiennent au-dessus du standard de base.
