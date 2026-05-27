---
title: Extensions
seoTitle: Extensions .harness
socialTitle: Déclarations d'extensions pour la spécification .harness
description: Comment les extensions déclarées ajoutent un comportement enregistré sans élargir le schéma de projection central.
socialDescription: Comment les extensions .harness ajoutent un comportement optionnel tout en gardant le noyau étroit.
canonicalPath: /specifications/v1/extensions/
slug: extensions
order: 3
locale: fr-fr
sectionCode: "03"
summary: Comment les extensions déclarées ajoutent un comportement enregistré sans élargir le schéma de projection central.
llmSummary: Décrit la déclaration, la version, l'activation, la découverte et la séparation des extensions par rapport au modèle central .harness.
audience: Implémenteurs ajoutant un comportement optionnel à des outils compatibles .harness.
contentKind: spec
status: draft
updated: 2026-05-26
---

# Extensions

Les extensions ajoutent un comportement enregistré sans élargir le schéma central de projection des ressources et des cibles.

## Déclaration

Les déclarations vivent sous `[extensions.<id>]` dans le manifeste sélectionné, par défaut `./.harness/harness.toml`.

```toml
[extensions.example]
version = 1
activation = "explicit"
```

Le noyau possède seulement `version` et `activation`. Tous les autres champs appartiennent à l'extension. Une extension inconnue peut être présente dans la configuration, mais une extension sélectionnée et non supportée doit échouer clairement.

## Limite Avec Le Noyau

Une extension ne doit pas redéfinir la source de ressources, les cibles, les surcharges, `.harnessIgnore`, les fichiers mutables ou le contrat de planification.

Les sources `[[dir]]` sont une surface du noyau v1, pas une extension: leurs sorties interagissent directement avec les cibles déclarées, le nettoyage et les fichiers `.harnessIgnore` target-output-local.
