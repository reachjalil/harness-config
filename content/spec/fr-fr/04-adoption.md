---
title: Adoption
seoTitle: Adopter .harness config
socialTitle: Comment adopter .harness dans un dépôt
description: Workflows pratiques pour démarrage greenfield, migration, profils, instructions composables et nettoyage.
socialDescription: Un chemin pratique pour déplacer la configuration agent dans un catalogue source .harness durable avec profils et nettoyage sûr.
canonicalPath: /specifications/v1/adoption/
slug: adoption
order: 4
locale: fr-fr
sectionCode: "04"
summary: Workflows pratiques pour démarrage greenfield, migration, profils, instructions composables et nettoyage.
llmSummary: Couvre les workflows de création d'un catalogue .harness, de déclaration des cibles, de prévisualisation de l'activation, de migration, de profils et de nettoyage sûr.
audience: Développeurs introduisant .harness dans des dépôts nouveaux ou existants.
contentKind: spec
status: draft
updated: 2026-05-26
---

# Adoption

Ce guide décrit deux chemins: greenfield, sans dossier runtime agent existant,
et migration, quand un dépôt contient déjà `.claude/`, `.cursor/`, `.agents/`
ou un dossier similaire.

## Greenfield

Harness config v1 commence par un petit contrat source:

1. Créez `./.harness/harness.toml` avec `version = 1`, ou choisissez un autre manifeste TOML repo-local et passez-le explicitement à l'outillage.
2. Ajoutez les dossiers et fichiers de ressources sous la source de ressources configurée, par défaut `.harness/resources`.
3. Déclarez chaque cible de projection explicitement dans le manifeste sélectionné.
4. Utilisez `.harnessIgnore` pour garder les fichiers source-only hors des cibles live et marquez les fichiers runtime-owned avec `[mutable]`.
5. Faites un dry run avant d'écrire les dossiers cibles.

`npx harnessc` est l'implémentation standard pour ce workflow:

```bash
npx harnessc init
npx harnessc init --yes --resource skills --target ./runtime/agent
npx harnessc validate
npx harnessc activate
npx harnessc activate --yes
```

## Migrer Un Dépôt Existant

Un dépôt qui contient déjà des dossiers runtime comme `.claude/` ou `.cursor/`
adopte Harness config progressivement. La règle importante: les sources
configurées deviennent l'entrée canonique, pas la cible.

Séquence recommandée:

1. **Snapshot des cibles existantes.** Commitez les dossiers live actuels ou copiez-les sur une branche pour garder une base de comparaison.
2. **Déplacez le contenu durable dans la source de ressources.** Le contenu de `.claude/skills/foo/` devient souvent `./.harness/resources/skills/foo/`. Les différences propres à une cible vont dans un dossier de surcharge comme `./.harness/resources/skills/foo/.claude/`.
3. **Déclarez les cibles dans le manifeste sélectionné.** Ajoutez un `[[targets]]` pour chaque dossier runtime à régénérer. Si la source de ressources n'est pas `./.harness/resources`, déclarez-la avec `[resources] path`.
4. **Écrivez `.harnessIgnore` pour les artefacts source-only.** Logs, scratch files, métadonnées et fixtures appartiennent généralement aux règles d'ignore. Les fichiers écrits par le runtime appartiennent à `[mutable]`.
5. **Ajoutez des profils seulement quand ils clarifient l'ownership.** Placez `.harnessProfileRoot` sous `.harness`, sous la source de ressources configurée ou sous la source `[dir]`, puis sélectionnez ces profils avec `.harnessProfile`.
6. **Dry run, revue, puis apply.** `npx harnessc activate` affiche le plan sans écrire; relancez avec `--yes` après revue.
7. **Relancez l'activation.** Un second dry run sans changement doit converger vers `keep` pour les fichiers gérés et `mutable` pour les fichiers runtime-owned.

## Règles D'Ignore

Utilisez `.harnessIgnore` pour garder logs, caches, métadonnées, fixtures et préférences locales hors des projections.

- Les règles globales vont souvent dans `./.harnessIgnore`.
- Les règles qui voyagent avec une ressource vont dans un fichier source-local, par exemple `.harness/resources/skills/review/.harnessIgnore`.
- Les préférences locales ou d'entreprise pour une sortie peuvent vivre dans un fichier target-output-local, par exemple `.agents/skills/review/.harnessIgnore`.
- Les sources `[dir]` personnalisées peuvent aussi contenir des `.harnessIgnore`, y compris dans une feuille `.harnessComposable` hors de `.harness`.

Un fichier target-output-local ne participe qu'après avoir été créé dans la sortie. Il est ensuite préservé par activation et par le nettoyage des fichiers non gérés.

## Pièges Courants

- **Traiter un dossier live comme source et cible.** Ne déclarez pas comme cible un dossier que vous continuez à éditer comme source durable.
- **Oublier de déclarer une cible.** Les ressources ne se projettent que vers les cibles déclarées dans `[[targets]]`.
- **Mettre de l'état produit ou runtime sous `.harness/`.** `.harness/` sert au contenu durable et révisable. Les caches produit et états d'activation appartiennent à des dossiers produit et à `.harnessIgnore`.
- **Utiliser les surcharges pour forker largement.** Une surcharge remplace des chemins exacts ou ajoute des fichiers. Si une cible a besoin d'une compétence très différente, préférez une ressource séparée.
- **Committer des fichiers écrits par le runtime comme source.** Les fichiers comme `.claude/settings.local.json` doivent souvent être déclarés sous `[mutable]`.
- **Attendre une règle target-output avant sa création.** Une `.harnessIgnore` target-output ne participe qu'après avoir été matérialisée dans la sortie.
- **Symlinker les cibles.** Remplacez les symlinks de sources ou de cibles par de vrais fichiers ou dossiers avant activation.

## Rappel De Portée

Le standard reste limité au layout source, aux déclarations de cibles, aux
surcharges, aux ignores de projection, aux fichiers mutables et à une
projection de copie déterministe. Sélection produit, marketplace, revue
d'édition de cible, capture et synchronisation distante appartiennent aux
couches au-dessus du standard.
