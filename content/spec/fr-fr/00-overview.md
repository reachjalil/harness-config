---
title: Vue d'ensemble
seoTitle: Vue d'ensemble de .harness config
socialTitle: Une couche source neutre pour les surfaces de harness
description: Un layout source et un modèle d'activation local pour une configuration avancée et prévisible des surfaces de harness à travers runtimes, équipes, profils, contrôles locaux et état possédé par le runtime.
socialDescription: Vue d'ensemble de la manière dont .harness s'appuie sur une activation locale en dry-run, des limites de projection, des superpositions de profil, des contrôles locaux aux cibles, des fichiers mutables possédés par le runtime, un outillage sans télémétrie et des cibles explicites pour rendre la configuration agent plus puissante sans la rendre implicite.
canonicalPath: /specifications/v1/
slug: overview
order: 0
locale: fr-fr
sectionCode: "00"
summary: Le layout source, le modèle d'activation locale, les contrôles de projection, les fichiers mutables possédés par le runtime, les superpositions de profil, les contrôles locaux aux cibles, l'outillage sans télémétrie et les bénéfices opérationnels en une lecture.
llmSummary: Présente .harness comme un catalogue source possédé par le dépôt pour la configuration agent, avec activation locale en dry-run, outillage sans télémétrie, fichiers d'instructions composables, superpositions de profil, fichiers mutables possédés par le runtime, contrôles locaux aux cibles et projections runtime explicites qui rendent la configuration avancée prévisible, révisable et réutilisable.
audience: Lecteurs techniques et implémenteurs évaluant une configuration agent locale au dépôt.
contentKind: spec
status: draft
updated: 2026-05-26
---

# Une couche source neutre pour les surfaces de harness

Les harnesses exposent des fichiers et dossiers vivants tels que `AGENTS.md`, `.agents`, `.claude`, `.gemini` et `.cursor`. Ces fichiers et dossiers sont des surfaces de harness utiles, mais ils sont une source de vérité fragile lorsque plusieurs outils ont besoin des mêmes skills, règles, plugins et fichiers d'instructions.

Harness config garde les ressources agent réutilisables dans des racines source possédées par le dépôt, par convention sous `.harness`, déclare chaque sortie de surface de harness comme une cible explicite et matérialise chaque cible par une projection de copie prévisualisée avant écriture. Des racines source ordonnées permettent à un projet de superposer une configuration partagée avec une personnalisation locale optionnelle tout en gardant la source révisée stable.

L'idée centrale est une frontière de propriété. Les prompts, skills, règles, hooks et fragments d'instructions canoniques sont une source possédée par le dépôt. Les surfaces de harness vivantes sont des sorties générées. Les fichiers déclarés dans `.harnessMutable` sont initialisés depuis la source une seule fois, puis deviennent un état cible possédé par le runtime pour les réglages, permissions, commandes apprises et autres données locales qui doivent survivre aux activations suivantes.

Le modèle de confidentialité découle du même contrat fichier. Validation, planification et activation opèrent sur les fichiers du dépôt localement ; le standard n'exige ni télémétrie, ni analytique, ni service hébergé, ni accès réseau.

## Pourquoi l'activation compte

L'activation est le bénéfice opérationnel du standard. Elle transforme la configuration d'agents, dispersée dans plusieurs dossiers vivants, en une étape de projection répétable : lire le catalogue source, appliquer profils et différences propres à une cible, filtrer la limite, prévisualiser le plan, puis écrire des fichiers ordinaires seulement après revue.

Cette limite apporte un comportement secondaire utile sans transformer `.harness` en plateforme produit complète. La CI peut valider le même manifeste qu'un développeur utilise localement. Les éditeurs peuvent prévisualiser ce qu'un harness recevra. Les outils de revue peuvent montrer quels fichiers cibles sont créés, mis à jour, préservés ou intentionnellement laissés mutables. Plusieurs harnesses peuvent consommer la même ressource source sans traiter une surface de harness particulière comme le format canonique, tandis que chaque runtime peut conserver son propre état mutable.

Le résultat n'est pas plus de cérémonie autour de la configuration agent. C'est moins d'état caché : un petit standard qui rend l'activation explicable, répétable et assez sûre pour être automatisée.

## Configuration avancée, forme prévisible

Le standard supporte une configuration expressive sans rendre l'activation opaque. Les profils permettent à une équipe, un développeur ou un sous-arbre cible de sélectionner une couche de configuration. La composition `[[dir]]` permet d'assembler les fichiers d'instructions partagés à partir de fragments révisés. Les fichiers `.harnessIgnore` et `.harnessProfile` au sein des sorties cible permettent à une surface de harness vivante de garder des contrôles locaux sans promouvoir ces contrôles dans la source canonique.

Ces fonctionnalités sont volontairement indirectes. Elles ne demandent pas à chaque outil d'inventer une nouvelle UI de réglages, un registre ou un service de synchronisation. Elles donnent aux outils un contrat fichier stable qu'ils peuvent inspecter : quelle source existe, quel profil est actif, quelle cible reçoit quelle projection, ce qui est filtré et ce qui sera préservé pendant le nettoyage.

C'est la valeur centrale du standard : une configurabilité avancée avec un plan d'activation prévisible. Une équipe plateforme peut livrer un kit sécurité ou déploiement. Un projet peut composer `AGENTS.md` à partir de sections partagées. Un développeur peut conserver une préférence locale dans une cible. Un job CI peut quand même expliquer le même résultat à partir des fichiers du dépôt avant qu'une écriture ait lieu.

## Ce qu'il fait

Harness config répond à quatre questions pratiques :

- **Où vit la configuration agent durable ?** Dans des racines source configurées, sous `.harness/` par défaut, pas dans une surface de harness qu'un outil peut aussi écrire.
- **Quels dossiers vivants reçoivent les fichiers générés ?** Uniquement les chemins déclarés comme `[[targets]]` dans le manifeste sélectionné, qui vaut `./.harness/harness.toml` par défaut.
- **Qu'est-ce qui est autorisé à franchir la limite de projection ?** Les fichiers `.harnessIgnore` peuvent filtrer par chemin source et par chemin de sortie final.
- **Quels fichiers cibles le runtime peut-il posséder ?** Les règles `.harnessMutable` initialisent les fichiers une seule fois puis préservent les octets cibles vivants comme état possédé par le runtime.
- **Comment les équipes font-elles varier la sortie en toute sécurité ?** Les surcharges dérivées des cibles gèrent les différences de runtime ; les superpositions de profil gèrent les kits d'équipe, les personnalisations personnelles et les variantes locales aux cibles.
- **Comment la variation locale reste-t-elle responsable ?** Les profils et ignores en sortie cible sont préservés comme contrôles vivants, tandis que l'activation rapporte toujours le plan calculé avant écriture.

## Ce que définit le standard

- Le manifeste sélectionné, par défaut `./.harness/harness.toml`, déclare la version du standard, les sources `[[resources]]` ordonnées, les sources `[[dir]]` ordonnées et les `[[targets]]` explicites.
- Les dossiers de ressources vivent sous les sources de ressources configurées, avec des chemins courants tels que `.harness/resources/skills/<name>` ou tout dossier personnalisé qu'un dépôt y porte. Une feuille `.harnessComposable` dans une source de ressources compose un fichier de ressource projeté pour chaque cible déclarée.
- Les dossiers de surcharge dérivés des cibles tels que `.claude` ou `.agents` vivent à l'intérieur d'une ressource et ne fusionnent que lorsque la cible correspondante est projetée.
- Les fichiers `.harnessIgnore` définissent la limite de projection. Le fichier racine du dépôt peut matcher les chemins source et de sortie. Les fichiers source-locaux suivent les chemins source. Les fichiers locaux aux sorties cibles suivent les chemins de sortie finaux et sont préservés pendant le nettoyage.
- Les sources `[[dir]]` sont séparées des ressources ; elles composent les feuilles `.harnessComposable` en sorties relatives au dépôt telles que `AGENTS.md`, ou copient les fichiers vers des chemins de sortie relatifs au dépôt.
- `.harnessProfile` sélectionne un profil actif. `.harnessProfileRoot` déclare une racine de superposition de profil sous `.harness` ou une racine source configurée. Les superpositions actives peuvent ajouter ou surcharger des ressources et des fragments composables de dir sans transformer le dossier de profil en un élément projeté ordinaire.

## Pourquoi cela aide

Le catalogue complet reste révisable en un seul endroit. Les surfaces de harness restent des fichiers et dossiers vivants ordinaires qui peuvent être régénérés, nettoyés ou ignorés par Git lorsqu'une équipe le choisit. Cette flexibilité est utile pour expérimenter : un développeur peut essayer des réglages de harness locaux, des fichiers scratch ou un état runtime sans transformer ces éditions en source partagée. Le modèle des fichiers mutables rend cette distinction explicite plutôt que de la laisser reposer sur une convention ou un état produit caché.

Les contrôles d'ignore et de profil comptent parce que les vrais dépôts ont une variation locale. Une équipe peut vouloir que `.claude` exclue un fichier scratch généré pendant que `.agents` le garde. Un développeur peut vouloir un préambule personnel dans `AGENTS.md` sans changer les instructions d'équipe. Un groupe plateforme peut livrer un kit de déploiement qui contribue des skills et des fragments d'instructions seulement lorsqu'il est sélectionné. Ces flux ont besoin d'un contrôle précis de la sortie, pas d'un autre arbre source caché dans une surface de harness.

## Flux d'activation

1. Parser le manifeste sélectionné et les racines source configurées.
2. Découvrir les sélecteurs `.harnessProfile` et les superpositions `.harnessProfileRoot` actives.
3. Construire la projection cible à partir des ressources source, des superpositions de profil et des surcharges cibles correspondantes.
4. Appliquer les règles `.harnessIgnore` racine, source-locales, profil-locales et locales aux sorties cibles en utilisant le chemin source ou de sortie correct pour chaque jeu de règles.
5. Composer ou copier les sorties dir et fusionner les sorties qui tombent sous des cibles déclarées.
6. Prévisualiser créations, mises à jour, sauts de mutables, suppressions, conservations et entrées non gérées préservées avant écriture.

La contrainte importante est une propriété à sens unique : `.harness/` est canonique, les cibles vivantes sont des sorties générées, les fichiers de déclaration en sortie cible tels que `.harnessIgnore` et `.harnessProfile` sont des contrôles locaux protégés plutôt que des fichiers source projetés, et les fichiers `.harnessMutable` sont possédés par le runtime après leur première projection.

## Proposition ouverte

Harness config est développé comme une proposition de spécification ouverte. Les retours issus de vrais dépôts, d'auteurs de runtimes et de créateurs d'outils sont particulièrement utiles tant que la frontière reste suffisamment petite pour être raisonnée.

Utilisez le dépôt [`reachjalil/harness-config`](https://github.com/reachjalil/harness-config) pour les questions, issues, notes de compatibilité, exemples et pull requests.
