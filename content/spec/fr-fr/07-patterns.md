---
title: Patterns
seoTitle: Patterns et exemples Harness config
socialTitle: Patterns .harness pratiques pour équipes et développeurs
description: Exemples concrets pour ignores de sortie, instructions composables, profils, kits d'équipe, personnalisation et nettoyage sûr.
socialDescription: Exemples .harness pour combiner ignores, profils, composition dir et nettoyage des cibles.
canonicalPath: /specifications/v1/patterns/
slug: patterns
order: 7
locale: fr-fr
sectionCode: "07"
summary: Exemples concrets pour combiner ignores, profils, composition dir et nettoyage sûr.
llmSummary: Montre des patterns pratiques Harness config pour ignores de sortie, instructions composables, profils, kits d'équipe, personnalisation, profils locaux aux cibles, migration et nettoyage.
audience: Développeurs et équipes plateforme adoptant Harness config dans des dépôts réels.
contentKind: spec
status: draft
updated: 2026-05-26
---

# Patterns Harness config

Cette page montre comment combiner les pièces du standard sans perdre la règle d'ownership principale: `.harness/` est la source canonique, et les dossiers cibles live sont des sorties générées avec quelques contrôles locaux protégés.

## Ignore De Sortie Pour Une Surface

Utilisez un `.harnessIgnore` dans une sortie cible quand la règle appartient à une surface de harness précise, pas à la source canonique.

```text
.agents/skills/deploy-plan/.harnessIgnore
*.tmp
```

Cela filtre les fichiers finaux sous `.agents/skills/deploy-plan/` sans affecter `.claude/skills/deploy-plan/`.

## Instructions Composables

Utilisez `[dir]` pour les fichiers de dépôt comme `AGENTS.md`. Une feuille qui contient `.harnessComposable` concatène ses parties numériques en une sortie repo-relative:

```text
.harness/dir/AGENTS.md/
  .harnessComposable
  100_intro.md
  200_rules.md
```

Le même marqueur sous la source de ressources compose un fichier de ressource projeté dans chaque cible, par exemple `skills/review/SKILL.md`; ce cas reste une ressource, pas une sortie `[dir]`.

## Profil De Dépôt

Un `.harnessProfile` à la racine sélectionne une couche pour toute la projection. Une `.harnessProfileRoot` sous les ressources peut ajouter ou remplacer des ressources logiques sans projeter le dossier de profil lui-même.

## Kit D'Équipe

Un kit peut fournir skills, règles et instructions partagées depuis `.harness/kits/<name>`. Le kit est une source révisée; le sélecteur décide où il est actif.

## Personnalisation Locale

Les profils peuvent ajouter des parties personnelles et exclure des parties de base par chemin source logique. Versionnez `.harnessProfile` quand l'équipe doit partager le même choix; ignorez-le quand chaque développeur choisit localement.
