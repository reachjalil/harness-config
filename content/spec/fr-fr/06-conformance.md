---
title: Conformité
seoTitle: Conformité Harness config
socialTitle: Claims de conformité testables pour les outils Harness config
description: Claims testables pour dépôts, ressources, cibles, projections, introspection de chemin et outils.
socialDescription: Critères de conformité pour les dépôts et outils qui implémentent la spécification Harness config.
canonicalPath: /specifications/v1/conformance/
slug: conformance
order: 6
locale: fr-fr
sectionCode: "06"
summary: Claims testables pour dépôts, ressources, cibles, projections, introspection de chemin et outils.
llmSummary: Liste les attentes de conformité testables pour forme du dépôt, chemins de ressources, projection, surcharges, ignores, extensions, activation et introspection de chemin.
audience: Auteurs de tests et implémenteurs validant la compatibilité Harness config.
contentKind: spec
status: draft
updated: 2026-05-29
---

# Conformité Harness config

Une revendication de support Harness config devrait être testable depuis la forme des fichiers et le contrat d'activation seuls. Un dépôt, un outil ou une politique d'organisation peut revendiquer le support lorsque les vérifications pertinentes ci-dessous peuvent être reproduites sans dépendre d'un runtime, d'une CLI ou d'un service hébergé spécifique.

## Niveaux de conformité

- Conformité de dépôt : un dépôt déclare `version = 1` dans le manifeste local sélectionné, garde chaque chemin déclaré local au dépôt et stocke les ressources cibles durables sous des sources de ressources configurées.
- Conformité de ressource : une ressource est un fichier ou dossier sous une source de ressources configurée. Les éléments de ressources conventionnels sont des dossiers sous `<resources>/<kind>/<name>`. Une surcharge à la racine cible apparaît comme dossier préfixé par un point directement sous une source de ressources ; une surcharge d'élément apparaît comme dossier préfixé par un point directement à l'intérieur d'un élément conventionnel. Les fichiers de ressources peuvent aussi être composés depuis des dossiers marqués `.harnessComposable`.
- Conformité de cible : une entrée `[[targets]]` contient uniquement un chemin local au dépôt. Le dossier de surcharge correspondant est inféré depuis le premier segment de chemin. Aucune cible ne peut pointer vers `.harness`, chevaucher une racine source configurée ou redéclarer les mappings de ressources.
- Conformité dir : chaque table `[[dir]]` déclare une racine source dir locale au dépôt ordonnée. Les dossiers à l'intérieur de cette source marqués avec un fichier `.harnessComposable` vide sont des feuilles composables dont les parties à préfixe numérique se concatènent en un seul fichier de sortie ; tous les autres dossiers et fichiers copient tels quels vers leurs chemins relatifs au dépôt correspondants. Ces sorties sont séparées des éléments de ressources projetés dans chaque cible.
- Conformité de déclaration d'extension : une table `[extensions.<id>]` contient un entier positif `version`, peut définir `activation` sur `explicit` ou `auto`, et laisse tous les autres champs à l'implémentation d'extension.
- Conformité de projection : l'activation applique les exclusions `.harnessIgnore` et les règles de propriété sur initialisation `.harnessMutable`, y compris les fichiers d'ignore source-locaux, profil-locaux et locaux en sortie cible le cas échéant, distingue les fichiers ignorés des fichiers mutables possédés par le runtime, traite chaque cible déclarée comme une projection de copie et donne le même arbre cible pour les mêmes entrées, politique de nettoyage et politique de mutable.
- Conformité d'outil : une implémentation rapporte le plan d'activation avant d'écrire, liste les créations, mises à jour, suppressions demandées, fichiers conservés, entrées non gérées préservées et fichiers mutables sautés, et ne lit jamais un dossier cible vivant comme source de vérité. Lorsqu'un outil offre l'introspection de chemin, cette explication est en lecture seule et est dérivée du même manifeste sélectionné, des racines source configurées, des sélecteurs de profil, des règles d'ignore, des règles de mutables, de la politique de mutables et du modèle de projection que l'activation.

## Liste de vérification du dépôt

- Le manifeste sélectionné existe et déclare `version = 1`.
- Les ressources cibles durables vivent sous des sources de ressources configurées.
- Les éléments de ressources conventionnels vivent sous `<resources>/<kind>/<name>` ; les fichiers de ressources directs tels que `.harness/resources/hooks.json` sont autorisés sous toute source de ressources configurée.
- Les feuilles composables de ressources utilisent un dossier nommé pour le fichier projeté, un marqueur `.harnessComposable` vide et des parties à préfixe numérique.
- Les surcharges dérivées des cibles n'apparaissent qu'en tant que dossiers préfixés par un point directement sous une source de ressources ou directement à l'intérieur d'un élément de ressource conventionnel.
- Les entrées `[[targets]]` contiennent uniquement des chemins locaux au dépôt.
- Aucune cible ne redéfinit les ressources, modes ou noms de surcharge.
- Aucune cible ne pointe vers `./.harness`.
- Les identifiants d'extension et les champs de base d'extension valident lorsque des extensions sont déclarées.
- Les patrons `.harnessIgnore` sont relatifs au dépôt et parsent proprement.
- Les sections d'ignore globales telles que `[*]` et `[global]` sont reconnues.
- Les patrons `.harnessMutable` sont reconnus et identifient les fichiers que la projection source peut initialiser une fois avant que le runtime possède les octets cibles.
- Si des entrées `[[dir]]` sont déclarées, chaque racine source dir se résout localement au dépôt et chaque feuille composable porte un marqueur `.harnessComposable`. Les dossiers de copie et fichiers individuels sous les sources dir ne portent pas de marqueur.

## Exigences d'implémentation

- `./.harness` DOIT (MUST) être traité comme une couche source conventionnelle de dépôt, pas un workspace d'application ou un emplacement de manifeste requis.
- Les catégories de ressources DOIVENT (MUST) être traitées comme noms d'arbre source. `skills`, `rules`, `hooks` et `plugins` sont des conventions courantes, pas des catégories de schéma requises.
- Les types de ressources en dehors des conventions courantes PEUVENT (MAY) être utilisés lorsqu'ils vivent sous des sources de ressources configurées et suivent le même contrat de surcharge.
- Les feuilles composables de ressources DOIVENT (MUST) se projeter comme un fichier au chemin de la feuille et NE DOIVENT PAS (MUST NOT) projeter leur marqueur, `.harnessRef`, `.harnessIgnore`, `.harnessMutable` ou fichiers de parties numérotés individuellement.
- Les surcharges DOIVENT (MUST) être dérivées du chemin cible.
- Le manifeste sélectionné DOIT (MUST) garder les entrées de cibles uniquement-chemin. Les cibles NE DOIVENT PAS (MUST NOT) redéfinir les ressources, modes ou noms de surcharge. Les tables `[[resources]]` et `[[dir]]` de premier niveau déclarent les racines source ordonnées.
- L'activation DEVRAIT (SHOULD) être dérivée de la projection.
- L'activation DOIT (MUST) être idempotente pour les mêmes arbres source configurés, manifeste, surcharges, règles `.harnessIgnore`, règles `.harnessMutable`, choix de nettoyage, politique de mutables et politique de liens symboliques cibles.
- Les implémentations NE DOIVENT PAS (MUST NOT) suivre les liens symboliques lors de la découverte des racines source configurées, des arbres cibles déclarés, des fichiers d'ignore, des sélecteurs de profil ou des sorties dir.
- Les implémentations DOIVENT (MUST) rapporter les conflits de liens symboliques cibles lorsqu'un lien symbolique occupe un chemin projeté et que la politique de liens symboliques cibles sélectionnée est `conflict`. Les implémentations PEUVENT (MAY) remplacer le lien lui-même uniquement lorsque la politique sélectionnée est `replace`.
- Les implémentations DOIVENT (MUST) rapporter les fichiers cibles gérés comme des mises à jour lorsque les octets cibles diffèrent de la projection source calculée, et appliquer l'activation DOIT (MUST) écrire la projection source courante.
- Les implémentations DOIVENT (MUST) préserver les entrées cibles non gérées par défaut et DOIVENT (MUST) exiger un choix de nettoyage explicite avant suppression.
- Les implémentations DOIVENT (MUST) supporter `.harnessIgnore` pour les fichiers racine, source-locaux, profil-locaux, dérivés de surcharge cible et locaux en sortie cible qui restent hors des projections vivantes. La précédence DOIT (MUST) utiliser l'emplacement logique et la profondeur de dossier logique avec dernière règle correspondante participante gagne. Les fichiers profil-locaux DOIVENT (MUST) évaluer à l'emplacement de superposition du profil, les fichiers de surcharge dérivés des cibles DOIVENT (MUST) évaluer à leurs emplacements source et cible logiques, et les fichiers `.harnessIgnore` en sortie cible qui existent déjà DOIVENT (MUST) rester la limite finale et être préservés pendant l'activation et le nettoyage des non gérés.
- Les implémentations DOIVENT (MUST) supporter les sélecteurs `.harnessProfile` et les superpositions `.harnessProfileRoot`. Les racines de profil DOIVENT (MUST) vivre sous `./.harness`, une source de ressources configurée ou une source dir configurée, DOIVENT (MUST) être sautées comme éléments de ressources normaux et DOIVENT (MUST) fusionner par chemin source logique pour les ressources et les sorties dir.
- Les implémentations DOIVENT (MUST) supporter `.harnessMutable` et traiter les fichiers correspondants comme fichiers cibles à création unique possédés par le runtime même lorsque les octets cibles correspondent encore au modèle source. Ce comportement est séparé du comportement d'ignore : les fichiers ignorés restent hors de la projection, tandis que les fichiers mutables peuvent être projetés lorsqu'ils sont manquants et préservés après création.
- Les dossiers cibles déclarés DOIVENT (MUST) être traités comme sorties de projection, pas comme dépôts source.
- Les dossiers cibles déclarés NE DOIVENT PAS (MUST NOT) pointer vers `./.harness`, chevaucher les racines source configurées ou se chevaucher entre eux.
- Lorsque des entrées `[[dir]]` sont déclarées, l'activation DOIT (MUST) composer chaque dossier avec un marqueur `.harnessComposable` depuis ses parties à préfixe numérique et DOIT (MUST) copier chaque autre dossier et fichier sous chaque source dir vers son chemin relatif au dépôt correspondant. Les chemins de sortie dir qui tombent sous une cible déclarée DOIVENT (MUST) être fusionnés dans la projection de cette cible ; les chemins de sortie dir qui remplaceraient ou contiendraient une racine de cible déclarée DOIVENT (MUST) être rejetés. Les fichiers `.harnessIgnore` source-locaux à l'intérieur des sources dir, y compris une source dir personnalisée en dehors de `.harness`, DOIVENT (MUST) filtrer les fichiers de la source dir. Les fichiers `.harnessIgnore` en sortie cible PEUVENT (MAY) filtrer les sorties dir par chemin de sortie final une fois les sorties candidates connues. Les fichiers `.harnessProfile` en sortie cible PEUVENT (MAY) sélectionner les superpositions de profil pour les sorties dir une fois les sorties candidates connues.

## Évidence

L'évidence du dépôt est un manifeste versionné, des arbres source configurés partagés, `.harnessIgnore` et `.harnessMutable` visibles dans le contrôle de version lorsque des fichiers mutables sont déclarés. Lorsque les surfaces de harness vivantes générées sont gitignored, l'évidence du dépôt devrait aussi inclure des instructions d'activation trackées qui expliquent comment valider et régénérer ces surfaces. L'évidence de profil, lorsque utilisée, est le fichier `.harnessProfile` sélectionné et les dossiers `.harnessProfileRoot` correspondants sous les racines source configurées.

L'évidence d'outil est un rapport de dry-run qui liste créations, mises à jour, suppressions demandées, fichiers conservés, fichiers mutables sautés et entrées non gérées préservées avant toute écriture.

L'évidence de projection est deux activations consécutives contre des entrées inchangées qui produisent des arbres cibles identiques octet pour octet pour les fichiers gérés et laissent les fichiers mutables intacts après la première application.

L'évidence de mutables devrait montrer la transition de propriété : la première application crée le fichier mutable déclaré depuis la source, une édition runtime change les octets cibles, et une activation ultérieure rapporte le fichier comme mutable sans l'écraser.

L'évidence de politique est une étape CI qui exécute la validation contre les mêmes règles qu'un contributeur utilise localement.

L'évidence de confidentialité est simple : la validation, la planification et l'activation peuvent être démontrées depuis les fichiers du dépôt sans télémétrie, analytique, rapport d'erreurs distant ou accès réseau.

## Codes de diagnostic

Les outils conformes DEVRAIENT (SHOULD) rapporter des codes de diagnostic lisibles par machine à côté des messages humains. Le catalogue des codes v1 est maintenu dans [`./DIAGNOSTICS.md`](./DIAGNOSTICS.md). Les outils qui émettent un code `harness.*` DOIVENT (MUST) utiliser un code de ce catalogue. Les outils PEUVENT (MAY) émettre des codes dans leur propre espace de noms (par exemple `my-tool.*`) pour les conditions hors du standard.
