---
title: Vue d'ensemble
seoTitle: Vue d'ensemble de .harness config
socialTitle: Une couche source neutre pour la configuration des harness agents
description: Un layout source et un modèle d'activation pour une configuration de harness agents avancée, prévisible et portable entre runtimes, équipes, profils et contrôles locaux.
socialDescription: Vue d'ensemble de la façon dont .harness utilise activation en dry-run, limites de projection, profils, contrôles locaux aux cibles et cibles explicites pour rendre la configuration agent plus capable sans la rendre implicite.
canonicalPath: /specifications/v1/
slug: overview
order: 0
locale: fr-fr
sectionCode: "00"
summary: Le layout source, le modèle d'activation, les contrôles de projection, les profils, les contrôles locaux aux cibles et les bénéfices opérationnels en une lecture.
llmSummary: Présente .harness comme catalogue source possédé par le dépôt, avec activation en dry-run, fichiers d'instructions composables, profils, contrôles locaux aux cibles et projections runtime explicites qui rendent la configuration avancée prévisible, révisable et réutilisable.
audience: Lecteurs techniques et implémenteurs évaluant une configuration agent locale au dépôt.
contentKind: spec
status: draft
updated: 2026-05-26
---

# Une couche source neutre pour les surfaces de harness

Les harnesses exposent des fichiers et dossiers vivants comme `AGENTS.md`, `.agents`, `.claude` et `.cursor`. Ces surfaces de harness sont utiles, mais elles ne remplacent pas un catalogue source durable et révisable.

Harness config garde les ressources réutilisables dans des sources configurées, sous `.harness` par défaut, déclare chaque sortie de surface de harness comme cible explicite et matérialise chaque cible par une projection de copie prévisualisée avant écriture.

## Pourquoi l'activation compte

L'activation est le bénéfice opérationnel du standard. Elle transforme la configuration d'agents, souvent dispersée dans des dossiers actifs, en étape de projection répétable: lire le catalogue source, appliquer les profils et différences propres à une cible, filtrer la frontière, prévisualiser le plan, puis écrire des fichiers ordinaires seulement après revue.

Cette frontière apporte des bénéfices indirects sans transformer `.harness` en plateforme produit complète. La CI peut valider le même manifeste qu'un développeur utilise localement. Un éditeur peut prévisualiser ce qu'un harness recevra. Les outils de revue peuvent montrer quels fichiers cible sont créés, mis à jour, préservés ou laissés mutables intentionnellement. Plusieurs harnesses peuvent consommer la même ressource source sans traiter une surface de harness comme format canonique.

Le résultat n'est pas plus de cérémonie autour de la configuration agent. C'est moins d'état caché: un petit standard qui rend l'activation explicable, répétable et assez sûre pour être automatisée.

## Configuration avancée, forme prévisible

Le standard permet une configuration expressive sans rendre l'activation opaque. Les profils permettent à une équipe, un développeur ou un sous-arbre cible de sélectionner une couche de configuration. La composition `[[dir]]` permet d'assembler des fichiers d'instructions partagés depuis des fragments révisés. Les fichiers `.harnessIgnore` et `.harnessProfile` dans les sorties cible permettent à une surface de harness de garder des contrôles locaux sans les promouvoir dans la source canonique.

Ces fonctionnalités sont volontairement indirectes. Elles ne demandent pas à chaque outil d'inventer une nouvelle UI de settings, un registry ou un service de synchronisation. Elles donnent aux outils un contrat fichier stable à inspecter: quelle source existe, quel profil est actif, quelle cible reçoit quelle projection, ce qui est filtré, et ce qui sera préservé pendant le nettoyage.

C'est la valeur centrale du standard: une configurabilité avancée avec un plan d'activation prévisible. Une équipe plateforme peut fournir un kit sécurité ou déploiement. Un projet peut composer `AGENTS.md` depuis des sections partagées. Un développeur peut garder une préférence locale dans une cible. Un job CI peut quand même expliquer le même résultat depuis les fichiers du dépôt avant toute écriture.

## Ce que définit la spécification

- Le manifeste sélectionné, par défaut `./.harness/harness.toml`, déclare la version, les sources `[[resources]]`, les sources `[[dir]]` et les `[[targets]]` explicites.
- Les ressources vivent sous la source de ressources configurée, par défaut `.harness/resources`, par exemple `.harness/resources/skills/<name>` ou un type personnalisé. Une feuille `.harnessComposable` dans la source de ressources compose un fichier de ressource projeté pour chaque cible déclarée.
- Les surcharges dérivées de cible comme `.claude` ou `.agents` se trouvent dans une ressource et fusionnent seulement pour la cible correspondante.
- Les fichiers `.harnessIgnore` définissent la limite de projection. Le fichier racine peut viser les chemins source et les chemins de sortie; les fichiers locaux peuvent vivre dans les sources déclarées ou dans des sorties cible existantes.
- Les sources `[[dir]]` sont séparées des ressources; elles composent des feuilles `.harnessComposable` en sorties repo-relatives, ou copient des fichiers vers des chemins relatifs au dépôt, même si une source `[[dir]]` est hors de `.harness`.
- Les profils et exclusions locaux aux cibles restent des contrôles runtime préservés, tandis que l'activation rapporte toujours le plan calculé avant écriture.

## Proposition ouverte

Harness config est développé comme une proposition de spécification ouverte. Les retours issus de vrais dépôts, d'auteurs de runtimes et de créateurs d'outils sont particulièrement utiles tant que la frontière reste assez petite pour être raisonnée.

Utilisez le dépôt [`reachjalil/harness-config`](https://github.com/reachjalil/harness-config) pour les questions, issues, notes de compatibilité, exemples et pull requests.
