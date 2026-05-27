---
title: Spécification
seoTitle: Spécification .harness config
socialTitle: La spécification de configuration de dépôt .harness
description: Définitions normatives de la couche source .harness, des extensions, de la projection d'activation, des surcharges dérivées des cibles et de .harnessIgnore.
socialDescription: Définitions normatives pour ressources source, cibles, surcharges, ignores, extensions et activation.
canonicalPath: /specifications/v1/standard/
slug: standard
order: 2
locale: fr-fr
sectionCode: "02"
summary: Définitions normatives des termes, de la forme du dépôt, du TOML, des extensions, de la projection, des surcharges et des ignores.
llmSummary: Définit la forme du dépôt .harness, le contrat TOML, les extensions, la projection d'activation, les surcharges dérivées des cibles, la précédence des ignores et les limites de conformité.
audience: Auteurs d'outils, réviseurs de standard et implémenteurs techniques.
contentKind: spec
status: draft
updated: 2026-05-27
---

# Spécification Harness config

**Statut:** proposition de specification Version 1. La forme des fichiers, le
schema du manifeste, le contrat de projection et la grammaire des exclusions
sont destines a etre implementables sans consulter le code de reference, mais
le contrat public est encore en revue. Tant qu'il n'existe pas de releases
publiques, de fixtures de conformite, de depots adopteurs et de retours
externes suffisants, les packages TypeScript doivent etre traites comme une
implementation de reference alpha. Une fois v1 acceptee, les changements qui
invalideraient un depot v1 ou une implementation v1 seront reserves a v2.

Les versions de specification sont des versions completes. Les versions patch,
mineures, prerelease et package appartiennent a la CLI, au tooling, aux
extensions et aux implementations, pas a l'espace d'URL de la specification ni
au champ `version` du manifeste.

Un harness est le runtime agent ou outil développeur qui consomme les instructions, le contexte, les outils et la configuration du dépôt. Une surface de harness est l'ensemble de fichiers ou dossiers repo-locaux que ce harness lit, par exemple `AGENTS.md`, `.agents`, `.claude` ou `.cursor`.

Un dépôt conforme contient un manifeste sélectionné, par défaut `./.harness/harness.toml`, une source de ressources configurée, par défaut `.harness/resources`, des cibles explicites, un éventuel `.harnessIgnore` à la racine et une éventuelle source `[dir]` pour les sorties composées ou copiées.

## Forme Du Dépôt

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

Les ressources vivent sous la source `[resources]` configurée. Les types comme `skills`, `rules` ou `plugins` sont des dossiers, pas des tables TOML par type. Les surfaces de harness ne sont des sorties que lorsqu'elles sont déclarées dans `[[targets]]`.

Un dossier de ressource peut aussi contenir le marqueur vide `.harnessComposable`. Dans ce cas, il compose un seul fichier de ressource projeté dans chaque cible déclarée, par exemple `skills/review/SKILL.md`. Cette feuille reste une ressource: elle suit les surcharges de cible, les profils et les règles `.harnessIgnore` de ressources.

## Cibles

Chaque cible est un chemin relatif au dépôt et ne contient que `path`.

```toml
[[targets]]
path = "./.agents"

[[targets]]
path = "./.claude"
```

Le premier segment du chemin choisit la surcharge correspondante dans chaque ressource. Une cible `./.claude` sélectionne les dossiers `.claude` dans les ressources.

## Source Dir Et `.harnessComposable`

La table `[dir]` déclare une seule source repo-locale, par défaut `./.harness/dir`. Cette source peut aussi être hors de `.harness`, par exemple `./resources`.

Dans `[dir]`, un dossier qui contient le fichier vide `.harnessComposable` est une feuille composable de dir: ses parties à préfixe numérique se concatènent pour produire le fichier de sortie repo-relatif correspondant. Les autres dossiers et fichiers se copient tels quels vers leurs chemins relatifs au dépôt. Contrairement aux ressources, `[dir]` n'est pas projeté comme arbre de ressources dans chaque cible; il sert aux sorties repo-relatives comme `AGENTS.md`, `CLAUDE.md` ou des fichiers propres à une cible.

Les fichiers `.harnessIgnore` source-locaux dans la source `[dir]`, y compris dans une feuille `.harnessComposable` hors de `.harness`, filtrent les parties, feuilles et dossiers. Les fichiers `.harnessIgnore` target-output-local filtrent aussi les sorties `[dir]` par chemin final une fois les sorties candidates connues. Pendant la collecte `[dir]`, seules les règles globales participent; `[mutable]` ne s'applique qu'aux projections de ressources vers les cibles.

## `.harnessIgnore`

`.harnessIgnore` définit ce qui ne doit pas entrer dans les projections.

- Le fichier à la racine du dépôt peut viser les chemins source comme `.harness/resources/skills/review/logs/` et les chemins de sortie comme `.agents/skills/review/local.tmp`.
- Un fichier source-local sous `.harness`, sous la source de ressources configurée ou sous la source `[dir]` s'applique à son sous-arbre source.
- Un fichier target-output-local sous une cible existante comme `.agents/skills/review/.harnessIgnore` s'applique aux chemins de sortie sous ce dossier.
- Les fichiers `.harnessIgnore` dans des sorties cible existantes sont protégés: la projection ne les copie pas, ne les écrase pas et ne les supprime pas pendant le nettoyage.

Les règles sont évaluées des fichiers les moins profonds aux plus profonds, de haut en bas dans chaque fichier. La dernière règle participante gagne. Les sections globales comme `[*]` ou `[global]` et la section `[mutable]` restent valides. Les sections ciblées comme `[.claude]`, `[!.cursor]` ou `[mutable .claude]` ne sont pas valides; les règles propres à une cible doivent vivre dans un fichier `.harnessIgnore` target-output-local.

## Activation

L'activation calcule la projection depuis la source de ressources configurée, les surcharges, `.harnessIgnore`, la source `[dir]`, la politique de nettoyage et la politique mutable. Le même ensemble d'entrées doit produire le même arbre cible.

## Symlinks

Harness config v1 traite les symlinks comme des entrées feuilles et ne les suit pas lors de la découverte des sources, des cibles, des ignores, des profils ou des sorties `[dir]`. Si un symlink occupe un chemin que l'activation doit écrire, l'activation peut remplacer le lien lui-même selon les mêmes règles de conflit que les autres fichiers ou entrées non-répertoires.
