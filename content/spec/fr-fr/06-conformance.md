---
title: Conformité
seoTitle: Conformité .harness
socialTitle: Claims de conformité testables pour les outils .harness
description: Claims testables pour dépôts, ressources, cibles, projections, introspection de chemin et outils.
socialDescription: Critères de conformité pour les dépôts et outils qui implémentent la spécification .harness.
canonicalPath: /specifications/v1/conformance/
slug: conformance
order: 6
locale: fr-fr
sectionCode: "06"
summary: Claims testables pour dépôts, ressources, cibles, projections, introspection de chemin et outils.
llmSummary: Liste les attentes de conformité testables pour forme du dépôt, chemins de ressources, projection, surcharges, ignores, extensions, activation et introspection de chemin.
audience: Auteurs de tests et implémenteurs validant la compatibilité .harness.
contentKind: spec
status: draft
updated: 2026-05-27
---

# Conformité

Une revendication de support Harness config doit être testable depuis la forme des fichiers et le contrat d'activation.

## Niveaux

- Conformité dépôt: le manifeste sélectionné, par défaut `./.harness/harness.toml`, déclare `version = 1`, une source de ressources repo-locale et des chemins repo-locaux.
- Conformité ressource: une ressource est un fichier, un dossier ou une feuille `.harnessComposable` sous la source de ressources configurée, et les surcharges sont des dossiers pointés dans cette ressource.
- Conformité cible: chaque `[[targets]]` contient seulement un chemin repo-local et ne pointe pas vers `.harness`.
- Conformité dir: `[[dir]]` compose ses feuilles `.harnessComposable` et copie les autres fichiers vers des chemins repo-relatifs; ces sorties sont séparées des ressources projetées dans les cibles.
- Conformité projection: l'activation applique `.harnessIgnore`, y compris les fichiers racine, source-locaux, target-output-locaux et les sections `.harnessMutable`. Les sections ciblées comme `[.claude]` sont invalides.
- Conformité outil: l'outil rapporte le plan avant écriture et ne lit jamais une surface de harness comme source de vérité. S'il fournit une introspection de chemin, cette explication est en lecture seule et utilise le même manifeste sélectionné, les sources configurées, les profils, les règles ignore, la politique mutable et le modèle de projection que l'activation.

## Exigences Clés

Les implémentations doivent préserver les fichiers `.harnessIgnore` déjà présents dans les sorties cible: ne pas les projeter depuis la source, ne pas les écraser et ne pas les supprimer pendant le nettoyage des entrées non gérées.

Quand `[[dir]]` est déclaré, les `.harnessIgnore` source-locaux dans la source `[[dir]]`, y compris une source personnalisée hors `.harness`, doivent filtrer les parties et feuilles. Les `.harnessIgnore` target-output-locaux peuvent filtrer les sorties dir par chemin final.
