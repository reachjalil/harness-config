---
title: Justification
seoTitle: Justification de Harness config
socialTitle: Pourquoi un standard de configuration agent local au dépôt
description: Le problème concret de plusieurs surfaces de harness en parallèle et les concepts coordonnés qu'introduit le standard.
socialDescription: Le problème de la dérive multi-harness et le contrat petit, révisable et reproductible que Harness config propose.
canonicalPath: /specifications/v1/rationale/
slug: rationale
order: 1
locale: fr-fr
sectionCode: "01"
summary: Pourquoi un standard local au dépôt aide les équipes utilisant plusieurs agents de codage, et quels concepts coordonnés il introduit.
llmSummary: Explique le problème concret des surfaces de harness multiples, divergentes et possédées par les runtimes, et présente les concepts coordonnés (manifeste, sources de ressources et de dir, cibles déclarées, surcharges dérivées des cibles, profils, ignores, mutables, projection d'activation).
audience: Auteurs d'outils, équipes plateforme et auditeurs de spécification évaluant les compromis.
contentKind: spec
status: draft
updated: 2026-05-26
---

# Justification de Harness config

Les harnesses ont besoin de surfaces de dépôt vivantes. Les équipes ont besoin d'une couche source stable et révisable pour les ressources que ces harnesses consomment. Harness config sépare ces responsabilités sans prescrire un modèle applicatif pour l'une ou l'autre.

Le catalogue source vit sous des racines source configurées, avec `./.harness` comme convention par défaut. Les surfaces de harness telles que `./.agents`, `./.claude` ou `./.cursor` restent des fichiers et dossiers vivants que leurs harnesses lisent. L'activation projette la vue de catalogue révisée dans ces surfaces sous forme de fichiers ordinaires.

La séparation importante est la propriété, pas seulement le stockage. Les fichiers source durables sont possédés par le dépôt et révisables. Les fichiers cibles vivants sont des sorties générées. Un fichier déclaré dans `.harnessMutable` est initialisé depuis la source une seule fois, puis traité comme un état possédé par le runtime, de sorte qu'un harness peut écrire en toute sécurité des réglages locaux sans transformer ces écritures en source canonique.

## Le problème concret

À partir de 2026, les dépôts qui travaillent avec plusieurs agents de codage AI portent couramment plusieurs dossiers de premier niveau spécifiques à un agent : `.claude/`, `.cursor/`, `.agents/`, `.codeium/`, `.continue/`, `.github/copilot-*`, plus des fichiers d'instructions maintenus à la main tels que `AGENTS.md`, `CLAUDE.md` ou `.github/copilot-instructions.md`. Chaque runtime lit l'un d'eux et écrit parfois en retour dans le même dossier (permissions, listes d'autorisation, hooks appris).

Cela produit une douleur récurrente et prévisible dans de vrais dépôts :

1. **Dérive entre dossiers quasi-dupliqués.** Le même skill ou prompt est copié-collé dans `.claude/skills/foo/`, `.cursor/skills/foo/`, etc. Les éditions dans un runtime divergent des autres jusqu'à ce qu'un humain les réconcilie.
2. **Les dossiers vivants mélangent source rédigée et état runtime.** Un fichier écrit par le runtime (`settings.local.json`, commandes apprises) finit par être commité et révisé comme s'il s'agissait de contenu rédigé, ou il est ignoré par Git et diverge silencieusement entre contributeurs.
3. **Aucun moyen propre de « désactiver » un skill pour un seul agent.** Supprimer des fichiers d'un dossier vivant supprime du travail ou nécessite un branchement par runtime dans les scripts CI.
4. **Les fichiers d'instructions dupliquent la prose.** `AGENTS.md`, `CLAUDE.md` et `copilot-instructions.md` répètent les mêmes paragraphes, et dérivent à leur tour.
5. **Aucun contrat portable.** Un nouvel agent publié demain n'a aucun chemin lui permettant de consommer le même matériau source qu'un dépôt maintient déjà.

Harness config s'attaque à ces points en rendant les couches source configurées canoniques et révisables, et chaque surface de harness une cible de projection explicite dérivée de ces sources.

## Concepts centraux

Harness config définit un petit ensemble de concepts coordonnés plutôt qu'un modèle objet produit :

- Manifeste sélectionné : un fichier TOML local au dépôt, par défaut `./.harness/harness.toml`, qui déclare la version du standard, les racines source configurées, les cibles explicites, les racines `[[dir]]` ordonnées et les déclarations d'extension.
- Catalogue source : les ressources durables sous les racines source `[[resources]]` configurées, plus les sorties relatives au dépôt sous les racines source `[[dir]]` configurées.
- Cible déclarée : une surface de harness, telle que `./.agents` ou `./.claude`, qui ne reçoit la projection que lorsqu'elle est listée dans le manifeste.
- Surcharge dérivée de la cible : un dossier préfixé par un point à l'intérieur d'une ressource, tel que `.claude`, qui ajuste les fichiers pour la cible correspondante.
- Superposition de profil : un contenu source optionnel sélectionné par `.harnessProfile` et déclaré avec `.harnessProfileRoot`, fusionné par chemin source logique sans transformer le dossier de profil en un élément projeté ordinaire.
- Limites de projection : `.harnessIgnore` pour les exclusions et `.harnessMutable` pour la propriété runtime-seule sur initialisation, y compris les règles d'ignore racine, source-locales, profil-locales et locales aux sorties cibles le cas échéant.
- Fichier mutable possédé par le runtime : un fichier cible projeté qui démarre depuis un modèle source possédé par le dépôt, puis devient un état runtime local après la première activation.
- Projection d'activation : le plan calculé en dry-run-first à partir des entrées sélectionnées vers les fichiers cibles, comprenant les actions create/update/remove/keep/preserve/mutable et les politiques explicites de nettoyage et de fichiers mutables.

## Pourquoi un standard partagé

- Les équipes peuvent inspecter un seul contrat local au dépôt à travers plusieurs harnesses au lieu de traiter chaque surface de harness comme un format source.
- Un dépôt peut contenir le catalogue complet de ressources tandis que chaque harness ne reçoit que la projection révisée pour ce contexte.
- Le contrat est neutre vis-à-vis de l'implémentation : dossiers, TOML, règles d'ignore, surcharges et intention de projection.
- De nouveaux types de ressources et fichiers directs à la racine cible peuvent utiliser la source de ressources configurée avant que chaque runtime supporte un format natif.
- Chaque projection cible déclarée est explicite, révisable et reproductible depuis la source, les ignores, les surcharges et la politique de nettoyage.
- Les fichiers mutables possédés par le runtime donnent aux harnesses vivants un endroit stable pour l'état local sans transformer les dossiers cibles en prochaine source de vérité.
- Les outils peuvent montrer créations, mises à jour, suppressions demandées, fichiers projetés inchangés et entrées non gérées préservées avant de modifier un dossier vivant.

## Noyau et extensions

Le comportement qui change le plan de projection de base fait partie du standard du noyau : ressources, cibles déclarées, surcharges dérivées des cibles, superpositions de profil, `.harnessIgnore`, `.harnessMutable`, nettoyage et composition/copie dir. Ces fonctionnalités interagissent directement avec l'idempotence, le nettoyage des non gérés et la préservation des cibles, et ont donc besoin d'un contrat partagé.

Les extensions sont réservées au comportement enregistré adjacent à ce contrat. Le standard de base définit les champs de découverte d'extension et de politique d'activation, tandis que chaque extension possède son schéma, sa compatibilité, ses diagnostics, sa planification et ses écritures. Une extension ne doit pas redéfinir les sources de ressources, les cibles, les surcharges, les profils, `.harnessIgnore`, les fichiers mutables, le nettoyage ou le plan d'activation du noyau.

## Parties prenantes

Les équipes plateforme peuvent définir une politique unique locale au dépôt pour stocker les ressources de harness, réviser les changements et valider les chemins en CI.

Les créateurs d'outils peuvent consommer un modèle de ressources stable au lieu de scraper les surfaces de harness vivantes ou d'inventer un autre layout.

Les équipes sécurité peuvent réviser les ressources source canoniques, l'intention d'activation et les fichiers ignorés ou mutables avant que quoi que ce soit n'atteigne une surface d'exécution.

Les projets open source peuvent publier des instructions agent réutilisables sans choisir un runtime agent unique comme format canonique.

## Fichiers possédés par le runtime

Les harnesses écrivent fréquemment dans les surfaces qu'ils lisent. Les permissions accordées, les commandes autorisées et les hooks appris atterrissent dans des fichiers comme `.claude/settings.local.json`. Harness config garde l'activation unidirectionnelle volontairement — la projection circule toujours de la source vers la cible. Le standard de base reconnaît les fichiers mutables déclarés par le dépôt mais n'essaie pas d'inférer pourquoi les octets cibles ont changé :

- Les fichiers gérés sont comparés directement avec la projection courante. Si les octets cibles diffèrent, l'activation peut rapporter `update`.
- Les fichiers mutables sont explicitement déclarés dans `.harnessMutable`. Le runtime les possède après la première projection. La projection les crée une seule fois puis les laisse tranquilles, même lorsque leurs octets correspondent encore au modèle source.

C'est différent d'ignorer un fichier. Les fichiers ignorés ne traversent pas la limite de projection. Les fichiers mutables la traversent : le catalogue source fournit la forme initiale, la revue voit que le fichier est attendu, et l'activation suivante préserve les octets cibles parce que le runtime en est maintenant propriétaire. Cela rend les fichiers de permissions, réglages locaux et état appris auditables sans en faire une configuration sous contrôle source.

La revue d'édition cible, la projection inverse et la capture cible-vers-source sont des flux légitimes en aval, mais ils dépendent fortement des pratiques de contrôle de version et de l'UX produit. Ils appartiennent aux couches produit au-dessus de v1.

## Non-objectifs

Harness config ne standardise pas les flux produit, les services hébergés, les places de marché, les systèmes de distribution, l'état de récupération, le comportement runtime, le regroupement, la politique de sélection, la revue d'édition cible, la capture ou la synchronisation distante. Cela appartient à des produits qui se construisent au-dessus du standard de base.

## Relation aux approches existantes

Harness config s'inspire de schémas qui fonctionnent dans des systèmes largement déployés. Ce n'est pas une généralisation de l'un d'eux ; il emprunte les parties qui correspondent à un problème de projection source-vers-runtime local au dépôt et laisse le reste.

- Les **fichiers de patron de style `.gitignore`** inspirent la syntaxe et la précédence ordonnée à dernière correspondance gagnante de `.harnessIgnore` et `.harnessMutable`. Différences : `.harnessIgnore` exclut les fichiers, tandis que `.harnessMutable` déclare des fichiers d'initialisation unique, parce que la projection a plus de dimensions que « tracké vs non tracké » : un fichier peut être initialisé depuis la source tout en restant possédé par le runtime après l'activation.
- Les **superpositions Helm / Kustomize** (Kubernetes) inspirent l'idée d'un arbre source de base composé avec des surcharges par cible. Harness config garde la portée des surcharges plus étroite : un dossier préfixé par un point *à l'intérieur de l'élément de ressource* dont le premier segment correspond au premier segment du chemin de la cible, sans langage de patch ni templating. Les fichiers de surcharge soit remplacent des chemins exacts, soit en ajoutent de nouveaux ; rien d'autre.
- Les **superpositions de dotfiles spécifiques au profil** inspirent `.harnessProfile` et `.harnessProfileRoot` : les équipes peuvent garder des kits optionnels ou des superpositions personnelles sous `.harness`, les sélectionner par dépôt ou par sous-arbre de sortie cible et toujours réviser la projection finale comme des créations et remplacements au niveau fichier.
- **EditorConfig** a inspiré le choix d'un seul fichier à la racine du dépôt avec une petite grammaire déclarative que n'importe quel outil peut implémenter sans couplage runtime.
- Les **gestionnaires de dotfiles (chezmoi, GNU Stow, yadm)** s'attaquent à un problème connexe — projeter un arbre source organisé sur des emplacements système vivants — pour `$HOME` personnel plutôt que pour les surfaces d'agent par dépôt. La distinction source-de-vérité / cible-comme-projection, y compris le besoin d'un filtre « ignore pour projection », vient de cette lignée.
- **Conventional commits / SemVer / RFC 2119** ont inspiré le langage normatif explicite et la politique de compatibilité ascendante dans [STANDARD.md](./STANDARD.md). Une spécification que les futurs implémenteurs peuvent lire isolément a plus de chance de survivre à un changement de mainteneur.
- **`AGENTS.md`, `CLAUDE.md` et `copilot-instructions.md`** sont l'art antérieur immédiat de *ce qui* est projeté. Harness config ne définit pas leur contenu ; il leur donne un emplacement source partagé et un moyen cohérent de les composer à travers les racines source `[[dir]]` configurées plutôt que de synchroniser manuellement la prose dupliquée.

Ce que Harness config ne cherche délibérément *pas* à être : un gestionnaire de paquets, un runtime de plugins, un service mesh, un système de permissions, un moteur de templating ou un SDK agent. Ce sont des problèmes précieux mais séparables.
