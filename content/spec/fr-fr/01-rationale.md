---
title: Justification
seoTitle: Justification de .harness config
socialTitle: Pourquoi .harness sépare sources et dossiers runtime
description: Pourquoi la spécification sépare un catalogue source durable des surfaces runtime actives.
socialDescription: La justification du modèle qui traite les dossiers runtime comme des projections générées.
canonicalPath: /specifications/v1/rationale/
slug: rationale
order: 1
locale: fr-fr
sectionCode: "01"
summary: Pourquoi la spécification sépare un catalogue source durable des surfaces runtime actives.
llmSummary: Explique pourquoi les dossiers runtime agents doivent être des sorties dérivées pendant que .harness reste la source révisable.
audience: Implémenteurs organisant une configuration agent multi-runtime.
contentKind: spec
status: draft
updated: 2026-05-26
---

# Justification

Les runtimes agents ont besoin de dossiers actifs. Les équipes ont besoin d'une source stable et révisable pour les ressources que ces runtimes consomment. Harness config sépare ces responsabilités sans imposer de modèle applicatif.

Le catalogue source vit sous `./.harness`. Les surfaces runtime comme `./.agents`, `./.claude` ou `./.cursor` restent des dossiers actifs lus par leurs runtimes. L'activation projette la vue révisée du catalogue vers ces surfaces sous forme de fichiers ordinaires.

## Problèmes Résolus

- Les copies proches dans plusieurs dossiers runtime dérivent facilement.
- Les fichiers écrits par un runtime sont difficiles à relire comme source durable.
- Désactiver une ressource pour un seul agent devient une règle de projection, pas une suppression manuelle.
- Les fichiers `AGENTS.md`, `CLAUDE.md` et autres instructions peuvent être assemblés depuis une source `[dir]` révisable.
- Un nouvel agent peut consommer le même catalogue dès qu'une cible est déclarée.

## Concepts Du Noyau

- Manifeste sélectionné: TOML repo-local, par défaut `./.harness/harness.toml`, qui déclare version, sources configurées, cibles explicites, `[dir]` optionnel et extensions.
- Catalogue source: ressources durables sous la source de ressources configurée et sorties `[dir]` repo-relatives sous la source dir configurée.
- Cible déclarée: dossier runtime comme `./.agents` ou `./.claude` qui reçoit une projection seulement quand il est listé dans le manifeste.
- Surcharge dérivée de cible: dossier comme `.claude` dans une ressource pour ajuster les fichiers de la cible correspondante.
- Profil: overlay sélectionné par `.harnessProfile` et déclaré avec `.harnessProfileRoot`, fusionné par chemin source logique sans projeter le dossier de profil.
- Limite de projection: `.harnessIgnore`, y compris les règles racine, source-locales, profile-locales, target-output-locales et `[mutable]`.
- Projection d'activation: plan dry-run-first avec actions `create`, `update`, `remove`, `keep`, `preserve` et `mutable`, plus politiques explicites de nettoyage et fichiers mutables.

## Non-Objectifs

`[dir]` fait partie du noyau v1, pas d'une extension: ses sorties participent à la projection, au nettoyage et aux règles target-output. Les extensions restent réservées au comportement enregistré qui ne redéfinit pas sources, cibles, profils, ignores, mutables, nettoyage ni plan d'activation.

La spécification ne standardise pas marketplaces, services hébergés, capture inverse, revue de modifications runtime, politique de sélection, état de récupération ou comportement interne des agents. Ces choix appartiennent aux produits construits au-dessus du standard.
