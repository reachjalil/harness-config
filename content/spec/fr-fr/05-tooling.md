---
title: Outillage
seoTitle: Outillage .harness
socialTitle: Outillage pour valider et activer .harness config
description: L'implémentation de référence npx harnessc, la validation, le planning et les commandes d'activation.
socialDescription: La couche de commandes pour valider les dépôts .harness et appliquer les projections d'activation.
canonicalPath: /specifications/v1/tooling/
slug: tooling
order: 5
locale: fr-fr
sectionCode: "05"
summary: "L'implémentation de référence npx harnessc: validation, planning et commandes d'activation."
llmSummary: Décrit les attentes d'outillage pour validation, dry-run, activation, diagnostics et helpers autour de .harness.
audience: Auteurs de CLI et développeurs opérant des dépôts .harness.
contentKind: spec
status: draft
updated: 2026-05-26
---

# Outillage

`npx harnessc` est l'implémentation de référence pour valider, planifier et activer Harness config.

## Commandes

```bash
npx harnessc plan
npx harnessc init
npx harnessc validate
npx harnessc activate
npx harnessc extension activate
```

`npx harnessc activate` est dry-run par défaut. Il affiche les créations, mises à jour, fichiers mutables ignorés, suppressions demandées, fichiers inchangés et entrées non gérées préservées avant écriture.

Le manifeste par défaut est `./.harness/harness.toml`. `--config <path>` peut sélectionner un autre fichier TOML repo-local, et `--resources-path <path>` écrit la source `[resources]` configurée pour un dépôt qui ne veut pas utiliser `.harness/resources`.

## Dir

Déclarer `[dir]` active une source unique, par défaut `./.harness/dir`. Les feuilles avec `.harnessComposable` composent leurs parties numériques; les autres fichiers et dossiers se copient vers les chemins relatifs au dépôt.

Les règles `.harnessIgnore` source-side filtrent la collection `[dir]`, y compris dans une source personnalisée hors `.harness` et dans les feuilles `.harnessComposable`. Les règles target-output-local filtrent les sorties finales après le calcul des chemins candidats. Pendant la collecte `[dir]`, seules les règles globales participent; `[mutable]` reste réservé aux projections de ressources vers les cibles.

## Helpers TypeScript

Les outils peuvent utiliser `@harnessconfig/core` pour parser TOML, charger les règles `.harnessIgnore`, valider un dépôt, calculer un plan et appliquer une activation.
