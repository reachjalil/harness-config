---
title: Extensions
seoTitle: Extensions .harness
socialTitle: Déclarations d'extensions pour la spécification .harness
description: Comment les extensions déclarées ajoutent un comportement enregistré sans élargir le schéma de projection des ressources central.
socialDescription: Comment les extensions .harness déclarent un comportement optionnel tout en gardant le schéma de projection central petit.
canonicalPath: /specifications/v1/extensions/
slug: extensions
order: 3
locale: fr-fr
sectionCode: "03"
summary: Comment les extensions déclarées ajoutent un comportement enregistré sans élargir le schéma de projection des ressources central.
llmSummary: Décrit la déclaration, le versionnage, l'activation, la découverte des extensions et leur séparation du modèle de projection .harness central.
audience: Implémenteurs ajoutant un comportement optionnel à des outils compatibles .harness.
contentKind: spec
status: draft
updated: 2026-05-26
---

# Extensions

Les extensions permettent aux outils d'ajouter un comportement enregistré sans élargir le schéma de projection des ressources et des cibles du noyau. Le standard de base définit comment les déclarations d'extension sont découvertes et quand une implémentation peut les exécuter ; chaque extension possède son propre schéma, sa compatibilité, ses diagnostics, sa planification et ses écritures.

## Déclaration

Les déclarations d'extension vivent au niveau supérieur du manifeste sélectionné, par défaut `./.harness/harness.toml`, sous `[extensions.<id>]`.

```toml
[extensions.example]
version = 1
activation = "explicit"
```

Le noyau possède uniquement deux champs :

- `version` : un entier positif requis pour le propre schéma de configuration de l'extension.
- `activation` : optionnel ; `"explicit"` par défaut, ou `"auto"` lorsque l'extension peut s'exécuter dans les flux d'activation routiniers proposés par un outil.

Tous les autres champs appartiennent à l'implémentation de l'extension. Les déclarations d'extension inconnues devraient valider en tant que forme du dépôt, mais un comportement non supporté sélectionné doit échouer clairement plutôt que d'être appliqué silencieusement.

## Limite avec le noyau

Une extension peut ajouter un comportement, mais elle ne doit pas redéfinir les sources de ressources, les mappings de cibles, les surcharges dérivées des cibles, la sémantique de `.harnessIgnore`, la sémantique de `.harnessMutable`, la sémantique de superposition de `.harnessProfile`, le comportement des fichiers mutables, le nettoyage des non gérés ou le contrat de plan d'activation.

Les sources `[[dir]]` configurées font partie de l'activation v1 du noyau, pas d'une extension. Elles sont documentées dans les pages Standard et Outillage parce que leurs sorties interagissent directement avec les cibles déclarées, le nettoyage et les fichiers `.harnessIgnore` locaux aux sorties cibles.

## Attentes d'implémentation

- Résoudre les extensions sélectionnées via un registre supporté par l'implémentation.
- Valider les champs possédés par l'extension avant de planifier les écritures.
- Garder les écritures d'extension locales au dépôt.
- Exécuter d'abord en dry-run et montrer les actions create, update, keep, remove ou preserve avant d'appliquer.
- Refuser les extensions sélectionnées qui sont inconnues, non déclarées, non supportées, incompatibles ou de version non supportée avec des diagnostics clairs.
