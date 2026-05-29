---
title: Spécification
seoTitle: Spécification Harness config
socialTitle: La spécification de configuration de dépôt Harness config
description: Définitions normatives pour le layout source .harness, la projection d'activation, les fichiers mutables possédés par le runtime, les surcharges dérivées des cibles, la précédence de .harnessIgnore et .harnessMutable, les superpositions de profil et les limites de conformité.
socialDescription: Définitions normatives pour ressources source, fichiers mutables possédés par le runtime, cibles, surcharges, ignores, déclarations mutables, superpositions de profil, extensions et comportement d'activation.
canonicalPath: /specifications/v1/standard/
slug: standard
order: 2
locale: fr-fr
sectionCode: "02"
summary: Définitions normatives des termes, de la forme du dépôt, du TOML, de la projection, des fichiers mutables possédés par le runtime, des surcharges, des ignores, des déclarations mutables, des profils, des extensions et de la conformité.
llmSummary: Définit la forme du dépôt .harness, le contrat TOML, la projection d'activation, les fichiers mutables possédés par le runtime, les surcharges dérivées des cibles, la précédence des ignores et mutables, les superpositions de profil, les déclarations d'extension et les limites de conformité.
audience: Auteurs d'outils, réviseurs du standard et implémenteurs techniques.
contentKind: spec
status: draft
updated: 2026-05-28
---

# Standard Harness config

**Statut :** proposition de spécification Version 1. La forme des fichiers, le schéma du manifeste, le contrat de projection et la grammaire des ignores décrits ici sont conçus pour être implémentables sans consulter le code de référence, mais le contrat public est encore en revue. Tant que les releases publiques, les fixtures de conformité, les dépôts adopteurs et les retours externes n'auront pas mûri, les paquets TypeScript doivent être considérés comme une implémentation de référence alpha. Une fois v1 acceptée, les changements qui invalideraient un dépôt v1 ou une implémentation v1 sont réservés à v2.

Harness config est un standard local au dépôt pour déclarer des *ressources de harness* durables (les prompts, skills, règles, plugins et fichiers similaires qui conditionnent le comportement d'un agent de codage AI) et les projeter dans les surfaces de harness de façon révisable et reproductible.

Le standard sépare trois catégories de propriété : la source canonique possédée par le dépôt, les sorties de surface de harness générées, et les fichiers cibles mutables possédés par le runtime. Un fichier mutable est toujours déclaré depuis la source et peut être initialisé par la projection, mais après la première activation, les octets cibles vivants appartiennent au runtime jusqu'à ce qu'une décision explicite de forçage re-projette le modèle source.

Un dépôt garde des racines source neutres et les projette dans des dossiers cibles déclarés. Le manifeste par défaut est `./.harness/harness.toml` ; les outils PEUVENT (MAY) aussi utiliser un autre fichier TOML local au dépôt lorsque ce chemin est explicitement sélectionné. Les ressources durables vivent sous des racines source `[[resources]]` ordonnées. Les sorties uniques relatives au dépôt vivent sous des racines source `[[dir]]` ordonnées. Le dossier `./.harness` est donc une convention pour le stockage source, pas l'emplacement requis du manifeste. La projection est filtrée par des fichiers de règles `.harnessIgnore`, tandis que les fichiers possédés par le runtime initialisés uniquement à la création sont déclarés séparément dans des fichiers de règles `.harnessMutable`. Le fichier `./.harnessIgnore` racine définit les limites d'exclusion à l'échelle du dépôt, et le fichier `./.harnessMutable` racine définit les limites d'initialisation mutable à l'échelle du dépôt. Des fichiers locaux PEUVENT (MAY) être placés à côté des sous-arbres source. Des fichiers `.harnessIgnore` en sortie cible PEUVENT (MAY) être placés dans les sous-arbres de sortie vivants comme filtres de sortie locaux. Chaque dossier de sortie cible qui reçoit une projection est explicite ; il n'y a pas de cibles implicites ni de noms de dossier cible réservés.

La projection des ressources du noyau ne définit volontairement pas de registre activé/désactivé ni de format de sélection. L'activation est une propriété émergente de la projection : une ressource est *active* dans une cible lorsque ses fichiers sont présents dans l'arbre cible calculé, et *inactive* lorsqu'ils sont absents de la projection suivante. La sélection, le regroupement, le comportement de place de marché et les préoccupations similaires appartiennent aux couches produit au-dessus du standard.

Les extensions ont une déclaration minimale et une politique d'activation au niveau du standard ; le comportement par extension appartient à chaque extension.

## Langage normatif

Les mots clés `MUST`, `MUST NOT`, `REQUIRED`, `SHALL`, `SHALL NOT`, `SHOULD`, `SHOULD NOT`, `RECOMMENDED`, `MAY` et `OPTIONAL` dans ce document doivent être interprétés tels que décrits dans [RFC 2119] et [RFC 8174] lorsque, et seulement lorsque, ils apparaissent en majuscules comme indiqué ici. Les mots clés normatifs sont conservés en anglais en majuscules conformément à la définition RFC 2119.

[RFC 2119]: https://www.rfc-editor.org/rfc/rfc2119
[RFC 8174]: https://www.rfc-editor.org/rfc/rfc8174

## Terminologie

Ces termes ont des sens spécifiques dans ce document. Lorsqu'une section ultérieure donne une définition plus détaillée, cette section fait autorité.

- **Harness** — le runtime agent AI ou outil orienté développeur qui consomme les instructions, le contexte, les outils et la configuration du dépôt pour opérer sur un projet.
- **Surface de harness** — les fichiers et dossiers locaux au dépôt qu'un harness lit, tels que `AGENTS.md`, `.agents`, `.claude`, `.cursor` ou une autre sortie cible déclarée.
- **Racine de convention** — le dossier `./.harness` à la racine d'un dépôt, couramment utilisé pour les ressources, les fichiers source dir, les profils et autres stockages source. Il n'est pas l'emplacement requis du manifeste.
- **Manifeste** — le fichier TOML sélectionné local au dépôt, par défaut `./.harness/harness.toml`, qui déclare la version du standard, les sources de ressources ordonnées, les sources dir ordonnées, les cibles et les extensions.
- **Source de ressources** — un dossier local au dépôt déclaré par un `path` `[[resources]]`, dont les fichiers, dossiers et feuilles composables de ressources sont projetés dans chaque cible déclarée. Plusieurs sources de ressources sont superposées dans l'ordre du manifeste.
- **Type de ressource** — une catégorie de matériau source telle que `skills`, `rules`, `hooks` ou `plugins` sous une source de ressources. Les types sont des noms de dossier, pas des concepts de schéma réservés.
- **Élément de ressource** — couramment un dossier sous `<resources>/<kind>/<name>`, tel que `./.harness/resources/skills/review`. Les dossiers d'élément sont des unités conventionnelles de revue, mais une source de ressources peut aussi contenir des fichiers directs tels que `./.harness/resources/hooks.json`.
- **Cible** — un dossier local au dépôt déclaré dans le manifeste sélectionné qui reçoit les projections des sources de ressources configurées.
- **Dossier de surcharge** — un sous-dossier immédiat préfixé par un point à l'intérieur d'un élément de ressource (par exemple `.claude/` dans `./.harness/resources/skills/review/`) ou directement dans `./.harness/resources`, dont les fichiers remplacent ou ajoutent aux fichiers canoniques lors de la projection vers la cible correspondante.
- **Source dir** — un dossier local au dépôt déclaré par un `path` `[[dir]]`. Son contenu se projette vers des chemins de sortie relatifs au dépôt, soit par composition (un dossier marqué par `.harnessComposable` dont les parties numérotées se concatènent en un seul fichier de sortie), soit par copie directe (tout autre dossier ou fichier sous une source dir copie vers le chemin relatif au dépôt correspondant). Plusieurs sources dir sont superposées dans l'ordre du manifeste.
- **Marqueur composable** — le fichier vide `.harnessComposable` placé à l'intérieur d'un dossier sous une source de ressources ou une source dir pour le marquer comme feuille composable. Sous resources, la feuille compose un fichier de ressource projeté à l'intérieur de chaque cible. Sous les sources dir, la feuille compose un fichier de sortie relatif au dépôt. Sans le marqueur, les dossiers de ressources restent des dossiers de ressources normaux et les dossiers dir sont traités comme des dossiers de copie.
- **Projection** — la correspondance calculée entre `(racine source, manifeste, sources configurées, surcharges, règles d'ignore, règles de mutables)` et un arbre de fichiers par cible.
- **Activation** — l'acte de matérialiser une projection dans un ou plusieurs dossiers cibles sur disque.
- **Fichier mutable** — un fichier cible projeté déclaré par `.harnessMutable` ; la source fournit le modèle initial, et le runtime possède les octets cibles après la première projection.
- **Dépôt / outil conforme** — voir [Conformité](./CONFORMANCE.md).

## Versionnage

La version actuelle du standard est `1`. Les versions de spécification sont des versions complètes du standard. Les versions patch, mineures, prerelease et de paquet appartiennent aux releases CLI, outillage, extension et implémentation, pas à l'espace d'URL de la spécification ni au champ `version` du manifeste.

Les implémentations DOIVENT (MUST) rejeter les fichiers manifeste sélectionnés dont le `version` de premier niveau n'est pas un entier supporté, avec un diagnostic qui nomme à la fois la valeur rencontrée et la ou les versions supportées.

```toml
version = 1
```

La version `1` standardise :

- la racine de convention `./.harness`,
- le schéma de manifeste TOML sélectionné pour les cibles uniquement de chemin, les racines source `[[resources]]` ordonnées, les racines source `[[dir]]` ordonnées et les déclarations d'extension de premier niveau,
- les arbres de sources de ressources configurées,
- les dossiers de surcharge dérivés des cibles,
- la projection de copie (idempotente sous des entrées fixes),
- la composition dir (feuilles `.harnessComposable`) et le contrat de copie pour les fichiers qui se projettent vers des chemins relatifs au dépôt,
- les fichiers d'ignore de projection `.harnessIgnore`, incluant les règles racine, source-locales et locales aux sorties cibles,
- les fichiers mutables de projection `.harnessMutable`, incluant les règles racine, source-locales et profil-locales.

Dans v1, ce document PEUT (MAY) recevoir des clarifications éditoriales et des raffinements normatifs rétro-compatibles (par exemple, des champs optionnels avec des valeurs par défaut définies). Les changements qui invalideraient un dépôt v1 ou une implémentation v1 sont réservés à v2.

## Portée

Harness config standardise :

- le fichier de manifeste sélectionné et son schéma,
- le layout de ressources sous les sources de ressources configurées,
- les surcharges cibles par ressource sous forme de dossiers immédiats préfixés par un point,
- les déclarations de cibles explicites uniquement par chemin,
- la politique d'activation de premier niveau avec des valeurs par défaut définies,
- les racines source dir ordonnées, avec des feuilles composables (`.harnessComposable`) et des dossiers en mode copie qui se projettent vers des chemins relatifs au dépôt,
- les déclarations d'extension de premier niveau (politique de découverte et d'activation uniquement),
- la projection de copie des sources de ressources configurées vers les cibles déclarées,
- `.harnessIgnore` comme filtre d'exclusion de projection, y compris les exclusions en sortie cible,
- `.harnessMutable` comme filtre de fichiers mutables de projection.

Les cibles déclarées sont des surfaces de harness vivantes, pas des dépôts source. Un dépôt PEUT (MAY) commiter les sorties cibles générées, les ignorer par .gitignore ou mélanger fichiers gérés commits avec des contrôles locaux, tant que la source de vérité révisée reste dans le manifeste sélectionné et les racines source configurées. Cela permet aux équipes d'expérimenter dans `.agents`, `.claude`, `.cursor` ou une autre surface sans promouvoir les éditions runtime dans le layout source canonique.

Lorsqu'un dépôt ignore par gitignore les sorties cibles générées, il DEVRAIT (SHOULD) garder les instructions d'activation trackées, telles qu'une note d'instructions racine, une étape README ou un script, pour qu'un nouveau checkout puisse valider et régénérer ces sorties. Les racines source configurées partagées qui rendent les cibles reproductibles DEVRAIENT (SHOULD) rester trackées ; les racines locales privées ou expérimentales telles que `.harness/local/` PEUVENT (MAY) être gitignored lorsque le dépôt les traite intentionnellement comme des superpositions locales au développeur.

Le modèle `.harnessMutable` est la version au niveau fichier de cette frontière. Il permet à un dépôt de publier un modèle initial révisable pour des réglages ou un état local aux cibles tout en gardant les éditions runtime ultérieures hors de l'arbre source canonique.

### Hors portée

Harness config ne standardise **pas** :

- les flux de produit, surfaces de commandes ou UX utilisateur final,
- les services hébergés, registres ou places de marché,
- la distribution, la résolution de dépendances ou la gestion de paquets pour les ressources,
- le comportement du runtime de harness ni la façon dont les harnesses consomment les fichiers cibles,
- les schémas de skill, prompt ou règle au-delà de « dossier avec fichiers »,
- la sélection, le regroupement, les sessions, les presets ou les kits,
- la capture cible-vers-source ou la projection inverse,
- les flux de revue d'édition cible (voir [Fichiers mutables](#fichiers-mutables) pour le contrat de base),
- la synchronisation distante, la télémétrie ou la journalisation d'audit.

Harness config est un contrat fichier local. Le standard ne requiert pas de télémétrie, d'analytique, d'identifiants machine, de rapport d'erreurs distant, de services hébergés ou d'accès réseau pour valider, planifier ou activer un dépôt.

Ces préoccupations appartiennent aux outils, produits ou politiques organisationnelles qui se construisent au-dessus du standard. Les garder hors de v1 est ce qui permet à plusieurs implémentations d'interopérer sur les mêmes arbres source configurés.

## Forme des ressources

Chaque source de ressources est un dossier local au dépôt sélectionné par une entrée `[[resources]]` dans le manifeste. Les sources de ressources sont ordonnées ; les sources ultérieures surchargent les sources antérieures au chemin de fichier projeté logique exact. Une source de ressources manquante est une couche vide valide. Les types de ressources tels que `skills`, `rules`, `hooks` et `plugins` sont des dossiers ordinaires sous chaque source. Les fichiers directs sont autorisés, de sorte qu'un dépôt peut porter une configuration à la racine cible telle que `hooks.json` sans inventer un dossier d'élément de ressource.

```text
.harness/
  resources/
    hooks.json
    hooks/
      post-tool-use.sh
    skills/
      code-review/
        SKILL.md
        examples/
          checklist.md
        .claude/
          SKILL.md
    rules/
      release-policy/
        RULE.md
    plugins/
      browser-tools/
        PLUGIN.md
        .cursor/
          plugin.json
    .gemini/
      hooks.json
```

`skills`, `rules` et `plugins` sont des types de ressources conventionnels. Leurs noms de fichier markdown courants sont des conventions, pas des exigences de schéma. D'autres types de ressources PEUVENT (MAY) exister sous toute source de ressources sans déclaration de manifeste par type.

Tout dossier sous une source de ressources PEUT (MAY) être une source de fichiers composables lorsqu'il contient un marqueur vide `.harnessComposable`. Le nom du dossier est le chemin du fichier projeté, et ses parties à préfixe numérique se composent avec la même sémantique `.harnessRef` et `.harnessIgnore` définie pour les feuilles composables dir. Par exemple, `./.harness/resources/skills/review/SKILL.md/.harnessComposable` projette un fichier cible à `skills/review/SKILL.md` ; les fichiers numérotés à l'intérieur de ce dossier ne sont pas projetés individuellement. Les feuilles composables de ressources restent des ressources : elles se projettent à l'intérieur des dossiers cibles déclarés et participent aux surcharges de ressources, profils et règles d'ignore de ressources.

Un dossier immédiat préfixé par un point directement sous une source de ressources est une surcharge à la racine cible. Pour la cible `./.gemini`, les fichiers sous le conventionnel `./.harness/resources/.gemini/` superposent cette source de ressources et le segment `.gemini` est retiré du chemin de sortie. C'est ainsi que les fichiers spécifiques à la racine cible tels que `.gemini/hooks.json` sont représentés.

Un dossier immédiat préfixé par un point à l'intérieur d'un élément de ressource conventionnel, tel que `./.harness/resources/skills/code-review/.claude/` sous une source de ressources conventionnelle, est une surcharge au niveau élément. Ses fichiers superposent cet élément et le segment de surcharge est retiré du chemin de sortie.

## Manifeste

```toml
version = 1

[activation]
targetSymlinks = "conflict"

[[resources]]
path = "./.harness/resources"

[[resources]]
path = "./.harness/local/resources"

[[targets]]
path = "./.claude"

[[targets]]
path = "./runtime/agent"

[[dir]]
path = "./.harness/dir"

[[dir]]
path = "./.harness/local/dir"

[extensions.example]
version = 1
activation = "explicit"
```

### Ressources

La projection de ressources utilise uniquement les racines source `[[resources]]` déclarées. Si aucune entrée `[[resources]]` n'est déclarée, la projection de ressources est désactivée.

Chaque table `[[resources]]` DOIT (MUST) contenir uniquement `path`. Le chemin DOIT (MUST) être local au dépôt, DOIT (MUST) se résoudre à l'intérieur du dépôt et NE DOIT PAS (MUST NOT) contenir de segments `..`. Un manifeste NE DOIT PAS (MUST NOT) contenir une seule table `[resources]` ni de tables `[resources.<kind>]` ; les types de ressources restent des noms d'arbre source, pas des entrées de schéma de manifeste.

Les noms de dossiers de ressources de premier niveau DEVRAIENT (SHOULD) utiliser des lettres minuscules, des chiffres, des soulignés ou des tirets. Les noms préfixés par un point directement sous une source de ressources sont des surcharges à la racine cible, pas des dossiers de sortie canoniques partagés. Les fichiers et dossiers de ressources NE DOIVENT PAS (MUST NOT) s'appuyer sur la traversée de chemin ; tous les chemins de sortie projetés DOIVENT (MUST) rester à l'intérieur de leur cible déclarée.

### Cibles

Chaque cible est explicite. Harness config ne réserve, ne préfère ni n'implique aucun nom de dossier cible runtime. Chaque entrée `[[targets]]` dans le manifeste sélectionné déclare un chemin cible local au dépôt et DOIT (MUST) contenir uniquement `path`.

Les chemins cibles DOIVENT (MUST) se résoudre à l'intérieur du dépôt, DOIVENT (MUST) pointer vers un dossier sous la racine du dépôt, NE DOIVENT PAS (MUST NOT) contenir de segments `..` après normalisation, NE DOIVENT PAS (MUST NOT) pointer vers `./.harness` lui-même ni vers un descendant de celui-ci, et NE DOIVENT PAS (MUST NOT) chevaucher les racines source configurées telles que `[[resources]]` ou `[[dir]]`.

Le dossier de surcharge pour une cible est le premier segment de chemin après le `./` initial, normalisé en dossier de surcharge source préfixé par un point. Cela garde les chemins cibles libres tout en préservant la convention de l'arbre source selon laquelle les dossiers immédiats préfixés par un point à l'intérieur d'un élément de ressource sont des surcharges. Après normalisation des chemins (réduction des séparateurs dupliqués et suppression du `./` initial) :

- `./.agents` → dossier de surcharge `.agents`.
- `./.claude` → dossier de surcharge `.claude`.
- `./runtime/agent` → dossier de surcharge `.runtime`.
- `./.github/copilot/agents` → dossier de surcharge `.github`.

Deux entrées `[[targets]]` dont les chemins normalisés sont égaux sont des doublons et DOIVENT (MUST) être rejetées avec un diagnostic.

Les cibles sont une configuration, pas une mutation cachée. Les outils DEVRAIENT (SHOULD) montrer le plan cible avant de créer, remplacer, copier ou supprimer des fichiers.

### Politique d'activation

La table optionnelle de premier niveau `[activation]` contient la politique d'activation du standard. Lorsqu'elle est omise, tous les champs utilisent leurs valeurs par défaut.

`targetSymlinks` contrôle les liens symboliques dans les arbres cibles déclarés qui occupent un chemin requis par la projection :

- `"conflict"` (défaut) : rapporter un diagnostic et ne pas appliquer tant que le lien symbolique n'est pas supprimé manuellement ou qu'une politique de remplacement n'est pas sélectionnée.
- `"replace"` : l'activation PEUT (MAY) supprimer le lien lui-même et matérialiser la sortie de projection de copie à ce chemin.

Dans les deux modes, les implémentations NE DOIVENT PAS (MUST NOT) suivre les liens symboliques cibles lors de la découverte, de la planification ou de l'application de la projection.

### Extensions

Les extensions sont déclarées sous des tables de premier niveau `[extensions.<id>]`. Les identifiants d'extension DOIVENT (MUST) utiliser des lettres minuscules, des chiffres, des soulignés ou des tirets, et DOIVENT (MUST) commencer par une lettre.

Chaque déclaration d'extension DOIT (MUST) contenir un entier positif `version`. C'est la propre version du schéma de configuration de l'extension, pas la version du standard Harness config.

Chaque déclaration d'extension PEUT (MAY) contenir `activation` avec l'une des deux valeurs :

- `"explicit"` (défaut) : l'extension ne s'exécute que lorsqu'un utilisateur ou un outil l'invoque explicitement.
- `"auto"` : l'extension PEUT (MAY) s'exécuter dans le cadre des flux d'activation routiniers proposés par un outil.

Lorsque omis, `activation` vaut `"explicit"` par défaut.

Les champs autres que `version` et `activation` appartiennent à l'extension. Le standard Harness config définit la *découverte* d'extension (comment un outil voit qu'une extension est déclarée) et la *politique d'activation* (si un outil peut l'exécuter sans action utilisateur explicite). Il ne définit pas le comportement d'extension, la forme de sortie, les commandes ni les règles de compatibilité. La compatibilité d'extension avec les versions Harness config appartient aux métadonnées d'implémentation de l'extension.

Un outil qui rencontre une table `[extensions.<id>]` pour une extension qu'il n'implémente pas NE DOIT PAS (MUST NOT) appliquer le comportement de cette extension, NE DOIT PAS (MUST NOT) faire échouer la validation du manifeste uniquement à cause de l'extension inconnue et DEVRAIT (SHOULD) rapporter l'extension inconnue comme information pour que les utilisateurs décident s'il faut installer le support.

Un outil qui implémente effectivement une extension DOIT (MUST) valider les champs possédés par l'extension avant d'appliquer le comportement de cette extension.

## Encodage, chemins et sensibilité à la casse

Ces règles s'appliquent à chaque fichier que le standard lit ou écrit (le manifeste sélectionné, `.harnessIgnore`, les fichiers projetés et les fichiers de surcharge) sauf si une extension définit explicitement les siennes.

- **Encodage de texte.** Les fichiers de configuration (le manifeste sélectionné, `.harnessIgnore`) DOIVENT (MUST) être en UTF-8. Un BOM UTF-8 initial PEUT (MAY) être présent et DOIT (MUST) être ignoré lors du parsing. Le contenu des fichiers de ressources est copié octet à octet ; le standard n'exige aucun encodage pour les payloads de ressources.
- **Fins de ligne.** Le standard ne normalise pas les fins de ligne. La projection copie les octets exactement, donc les fins de ligne d'un fichier cible correspondent à la source.
- **Séparateurs de chemin.** Les patrons de manifeste et d'ignore utilisent des barres obliques (`/`). Les implémentations sur les plateformes avec un séparateur natif différent DOIVENT (MUST) traduire à la limite du système de fichiers ; les diagnostics visibles par l'utilisateur DEVRAIENT (SHOULD) utiliser des barres obliques pour la portabilité.
- **Normalisation des chemins.** Avant la comparaison, les implémentations DOIVENT (MUST) réduire les séparateurs dupliqués, supprimer le `./` initial et rejeter les segments `..`. Les chemins DOIVENT (MUST) se résoudre à l'intérieur du dépôt.
- **Sensibilité à la casse.** Les comparaisons de chemins (égalité de cible, correspondance de surcharge, correspondance d'ignore) sont **sensibles à la casse**. Les dépôts qui peuvent être clonés sur des systèmes de fichiers insensibles à la casse (tels que les volumes macOS ou Windows par défaut) DEVRAIENT (SHOULD) éviter les noms qui ne diffèrent que par la casse, car le système de fichiers sous-jacent peut les fusionner. Les implémentations PEUVENT (MAY) avertir lorsqu'elles détectent de telles collisions.
- **Liens symboliques.** Un lien symbolique rencontré à l'intérieur des racines source configurées, `./.harness` ou un arbre cible déclaré est traité comme une entrée de système de fichiers feuille. Les implémentations v1 NE DOIVENT PAS (MUST NOT) suivre les liens symboliques lors de la découverte des arbres source, des arbres cible existants, des ignores, des profils ou des sorties dir. Lorsqu'un lien symbolique cible occupe un chemin que l'activation doit écrire, l'activation DOIT (MUST) rapporter un conflit sauf si une politique de remplacement de lien symbolique cible explicite est sélectionnée. Avec cette politique, le lien lui-même PEUT (MAY) être remplacé selon les mêmes règles de conflit fichier/chemin utilisées pour les autres entrées non-dossier. v1 n'exige pas de préserver les liens symboliques en tant que liens ni de projeter les liens symboliques source dans les cibles.
- **Fichiers cachés.** Les noms commençant par `.` ne sont pas implicitement ignorés. Ils participent à la projection comme tout autre fichier sauf s'ils sont exclus par `.harnessIgnore`. Cela ne fait pas des fichiers de déclaration Harness config des payloads cibles : `.harnessIgnore`, `.harnessMutable`, `.harnessProfile` et `.harnessProfileRoot` sont des contrôles de limite et NE DOIVENT PAS (MUST NOT) être projetés dans les cibles.

## Routage des ressources vers les cibles

Les cibles reçoivent les arbres source de ressources configurées. Un type de ressource, un fichier direct ou un sous-arbre est exclu d'une cible avec un fichier `.harnessIgnore` local à la sortie cible :

```text
# .claude/plugins/.harnessIgnore
*

# .cursor/prompts/.harnessIgnore
*

# .agents/checks/.harnessIgnore
local-only/
```

C'est la limite v1 :

- le manifeste sélectionné déclare les cibles.
- les sources de ressources configurées portent l'arbre de ressources cible.
- `.harnessIgnore` filtre les fichiers source et les sous-arbres de sortie cible.
- `.harnessMutable` marque les fichiers source qui devraient initialiser des fichiers cibles une seule fois puis devenir possédés par le runtime.

Les outils NE DEVRAIENT PAS (SHOULD NOT) introduire de mappings de ressources par cible dans le manifeste sélectionné pour v1. Garder les déclarations de cibles uniquement par chemin et les racines source ordonnées au niveau supérieur préserve un seul endroit pour le filtrage de projection et facilite le raisonnement sur la sortie en dry-run.

## Projection de copie

L'activation est une projection de copie répétable depuis les entrées source vers les cibles déclarées. Les entrées sont :

1. les fichiers, feuilles composables et dossiers participants sous les sources de ressources configurées, y compris leurs dossiers de surcharge,
2. le manifeste versionné sélectionné,
3. le `.harnessIgnore` racine,
4. le `.harnessMutable` racine,
5. la politique de nettoyage (préserver les entrées non gérées vs. les supprimer),
6. la politique de mutable (sauter les fichiers mutables vs. forcer la re-projection),
7. la politique de lien symbolique cible (conflit vs. remplacement).

**Idempotence (propriété testable).** Soit `T_n` l'arbre sur disque d'une cible déclarée après la `n`-ème activation contre un ensemble d'entrées inchangé (1)–(7). Pour chaque `n ≥ 2` :

- l'ensemble de fichiers dans `T_n` DOIT (MUST) égaler l'ensemble dans `T_1`,
- chaque fichier géré (non mutable) dans `T_n` DOIT (MUST) être identique octet pour octet à son homologue dans `T_1`,
- chaque fichier mutable présent dans `T_1` DOIT (MUST) rester présent dans `T_n` avec les mêmes octets qu'il avait à la fin de l'activation `n − 1` (c.-à-d. que le runtime le possède ; l'activation n'y écrit pas), et
- aucune écriture de fichier supplémentaire dans des fichiers gérés NE DEVRAIT (SHOULD) avoir lieu au-delà de ce qui est requis pour converger.

Cette propriété est ce qui rend l'activation révisable : une nouvelle exécution propre contre des entrées inchangées est observable comme un plan `keep`-seulement pour les fichiers gérés et un plan `mutable`-seulement pour les fichiers mutables.

Un outil conforme DEVRAIT (SHOULD) supporter un dry run qui rapporte les actions qu'il prendrait avant d'écrire :

- `create` : un fichier projeté n'existe pas dans la cible.
- `update` : un fichier projeté existe avec des octets différents de la projection calculée courante.
- `remove` : une entrée cible est sélectionnée pour suppression parce qu'elle n'est pas présente dans la projection calculée.
- `keep` : le fichier cible correspond déjà à la projection.
- `preserve` : une entrée existante à l'intérieur d'une cible déclarée n'est pas dans la projection calculée et restera intacte.
- `mutable` : un fichier déclaré mutable dans `.harnessMutable` existe déjà dans la cible, même si ses octets correspondent encore à la source. Le runtime le possède ; l'activation NE DOIT PAS (MUST NOT) l'écraser ni le supprimer sans une décision de forçage explicite.

Ces actions décrivent les fichiers et dossiers à l'intérieur des cibles déclarées. Les fichiers source sous les racines source configurées sont des entrées de projection ; l'activation ne les classe pas comme `keep`, `preserve` ou `remove`.

Toutes les projections cibles v1 sont matérialisées comme des copies. Les implémentations NE DOIVENT PAS (MUST NOT) exiger le support de liens symboliques pour la conformité. Une implémentation PEUT (MAY) utiliser des optimisations internes, mais l'arbre cible observable DOIT (MUST) se comporter comme une projection de copie pour la validation, la revue et l'activation répétée.

Après l'application de l'activation, exécuter la même activation à nouveau DEVRAIT (SHOULD) converger vers des actions `keep` pour les fichiers gérés et des actions `mutable` pour les fichiers déclarés mutables. Cette propriété garde les dossiers cibles vivants dérivés et reproductibles tout en permettant aux runtimes de posséder leur configuration par machine.

### Fichiers mutables

Les runtimes qui lisent les dossiers cibles vivants peuvent aussi y écrire — les cas courants incluent les autorisations de permission dans `.claude/settings.local.json`, les commandes autorisées listées ou les hooks appris. Les fichiers possédés par le runtime peuvent être déclarés mutables dans `.harnessMutable`. La projection les matérialise à la première activation (action `create`) et les rapporte comme `mutable` à chaque activation suivante, que les octets cibles correspondent encore ou non à la source. Les outils DEVRAIENT (SHOULD) offrir une décision de forçage explicite qui re-projette les octets source lorsque l'équipe a besoin de réinitialiser l'état possédé par le runtime.

Mutable est une déclaration de propriété, pas un synonyme d'ignore. Les fichiers ignorés n'entrent pas dans la projection. Les fichiers mutables entrent dans la projection lorsqu'ils sont absents, pour que l'arbre source puisse fournir une forme initiale et une intention révisable. Une fois que le fichier cible existe, le runtime possède ses octets et l'activation NE DOIT PAS (MUST NOT) l'écraser sauf si la politique de mutable force explicitement la re-projection.

Pendant la migration, un fichier mutable qui devrait exister pour les nouveaux utilisateurs DEVRAIT (SHOULD) être copié dans une racine source configurée avant que son chemin soit ajouté à `.harnessMutable`. Déclarer un fichier cible mutable sans graine source ne protège qu'un fichier local existant ; il ne donne pas aux nouveaux checkouts une version initiale.

Le standard ne classifie pas pourquoi un fichier cible non mutable diffère de la projection courante. Une implémentation de copie directe peut rapporter cette différence comme `update`. Les produits de niveau supérieur peuvent ajouter une revue consciente du contrôle de version, une capture cible-vers-source ou d'autres flux au-dessus de ce contrat de base.

### Entrées cibles non gérées

Les dossiers cibles peuvent déjà contenir des ressources qui ne viennent pas des sources configurées. Un outil conforme NE DOIT PAS (MUST NOT) silencieusement supprimer ces entrées. Il DOIT (MUST) soit les préserver, soit exiger un choix de nettoyage explicite avant suppression.

La politique de nettoyage par défaut DEVRAIT (SHOULD) être la préservation. Lorsqu'un outil offre la suppression, il DEVRAIT (SHOULD) résumer les entrées cibles non gérées à un niveau pour que le plan reste révisable :

- Pour un élément de ressource non géré, rapporter la racine de l'élément telle que `skills/local-only`.
- Pour une entrée non gérée à l'intérieur d'un élément de ressource projeté, rapporter un niveau à l'intérieur de cet élément tel que `skills/review/local.md` ou `skills/review/local-assets`.
- Ne pas développer chaque fichier descendant dans un dossier non géré sauf si l'utilisateur demande un audit plus profond.

Si le nettoyage est sélectionné, le plan DOIT (MUST) montrer ces entrées comme `remove` avant d'écrire. L'application d'un nettoyage explicite DEVRAIT (SHOULD) élaguer les dossiers parents vides à l'intérieur de la cible pour qu'une activation suivante avec des entrées inchangées converge sans actions de nettoyage supplémentaires. Si le nettoyage n'est pas sélectionné, le plan DOIT (MUST) montrer les entrées non gérées comme `preserve`.

Si une déclaration de cible est retirée du manifeste sélectionné, la projection v1 du noyau n'a plus cette cible dans son ensemble d'écriture autorisé et donc ne nettoie pas ce dossier lors de l'activation normale. Pour nettoyer une cible uniquement avec le contrat de projection de base, exécuter le nettoyage pendant que la cible est encore déclarée, puis retirer la déclaration. Les outils de niveau supérieur PEUVENT (MAY) garder l'état d'activation et offrir un flux de réconciliation de cible orpheline qui prévisualise suppression, ignore ou capture vers la source.

### Résumé de la sémantique du système de fichiers

Ces règles sont normatives pour l'activation v1 :

- Les liens symboliques ne sont jamais suivis lors de la découverte des racines source, des arbres cibles, des fichiers d'ignore, des sélecteurs de profil ou des sorties dir. Un lien symbolique est une entrée de système de fichiers feuille.
- Lorsqu'un lien symbolique cible occupe un chemin que l'activation doit écrire, l'activation DOIT (MUST) rapporter un conflit sauf si la politique de lien symbolique cible sélectionnée permet explicitement de remplacer le lien lui-même.
- Les fichiers cibles gérés sont écrasés depuis la projection source courante lorsque leurs octets diffèrent.
- Les fichiers cibles mutables sont créés depuis la source une seule fois puis deviennent possédés par le runtime jusqu'à une décision de forçage explicite qui les re-projette.
- Les entrées cibles non gérées sont préservées sauf si un nettoyage explicite est sélectionné.
- Les fichiers `.harnessIgnore` et `.harnessProfile` en sortie cible sont un état local protégé et NE DOIVENT PAS (MUST NOT) être surpassés ou supprimés par le nettoyage des non gérés.
- L'activation est déterministe pour des arbres source fixes, un manifeste sélectionné, des sélecteurs de profil, des règles d'ignore, des règles de mutables, une politique de nettoyage et une politique de mutable.
- Les cibles NE DOIVENT PAS (MUST NOT) pointer vers `./.harness`, chevaucher les racines source configurées ni se chevaucher entre elles.

Par exemple, `.harness/resources/hooks.json` peut mettre à jour `.agents/hooks.json` lorsque les octets source changent, tandis que `.agents/skills/review/settings.local.json` matché par `.harnessMutable` est initialisé une seule fois puis laissé intact comme état possédé par le runtime. Un fichier en sortie cible tel que `.claude/skills/review/.harnessIgnore` peut filtrer ce sous-arbre `.claude` et reste un état cible local.

## Surcharges

Un dossier préfixé par un point directement à l'intérieur d'une source de ressources configurée est une surcharge à la racine cible. Un dossier préfixé par un point directement à l'intérieur d'un élément de ressource conventionnel sous une source de ressources configurée est une surcharge cible au niveau élément. Pour la cible `./.claude`, le dossier de surcharge est `.claude` ; pour la cible `./runtime/agent`, le dossier de surcharge est `.runtime`.

La projection DOIT (MUST) traiter l'arbre de ressources dans cet ordre :

1. Copier les fichiers de ressources canoniques, en excluant les dossiers de surcharge à la racine cible et les dossiers de surcharge au niveau élément.
2. Fusionner le dossier de surcharge à la racine cible correspondant, s'il est présent.
3. Fusionner le dossier de surcharge cible au niveau élément correspondant, s'il est présent.
4. Retirer le segment de dossier de surcharge des chemins de sortie.
5. Appliquer les règles `.harnessIgnore` à chaque fichier source avant qu'il entre dans la projection.

Les surcharges sont fusionnées au niveau fichier, pas comme des remplacements de dossier entier. Les fichiers de surcharge remplacent les fichiers canoniques uniquement lorsqu'ils se projettent vers exactement le même chemin de fichier relatif. Les fichiers canoniques voisins continuent à se projeter normalement. Les fichiers de surcharge PEUVENT (MAY) ajouter de nouveaux fichiers. Les dossiers imbriqués préfixés par un point à l'intérieur d'une surcharge, tels que `.codex-plugin`, sont des dossiers de sortie ordinaires sauf s'ils sont le dossier de surcharge immédiat à la racine cible ou au niveau élément.

### Conflits de surcharge

La projection DOIT (MUST) rejeter les conflits fichier/dossier avant d'écrire. Un conflit existe lorsque deux fichiers source se projettent vers des chemins où un chemin exige que l'autre chemin soit un dossier.

Exemples :

```text
# Conflit : fichier canonique, dossier de surcharge.
# La source canonique dit que "hooks" est un fichier, mais la surcharge a besoin
# que "hooks" soit un dossier pour pouvoir contenir config.json.
.harness/resources/skills/review/hooks
.harness/resources/skills/review/.claude/hooks/config.json

# Conflit : dossier canonique, fichier de surcharge.
# La source canonique dit que "hooks" est un dossier, mais la surcharge dit
# que "hooks" lui-même est un fichier.
.harness/resources/skills/review/hooks/config.json
.harness/resources/skills/review/.claude/hooks

# Autorisé : remplacement de fichier exact
.harness/resources/skills/review/SKILL.md
.harness/resources/skills/review/.claude/SKILL.md

# Autorisé : remplacer un fichier imbriqué et garder le reste
.harness/resources/skills/review/hooks/config.json
.harness/resources/skills/review/hooks/notify.json
.harness/resources/skills/review/.claude/hooks/config.json
```

Un outil DOIT (MUST) rapporter un diagnostic pour les chemins source en conflit et NE DOIT PAS (MUST NOT) appliquer la projection tant que le conflit n'est pas résolu.

## Source dir

Chaque table `[[dir]]` de premier niveau déclare une **source dir** locale au dépôt dont le contenu se projette vers des chemins relatifs au dépôt. Contrairement aux sources de ressources, les sources dir ne sont pas copiées comme des arbres de ressources dans chaque cible. Elles portent des sorties durables par fichier qui ne sont pas modélisées comme des éléments de ressources : instructions d'agent de premier niveau (`AGENTS.md`, `CLAUDE.md`), configuration par cible (`.claude/settings.json`), fichiers à la racine du dépôt (`.gitignore`, `README.md`) et artefacts uniques similaires. Les sources dir sont ordonnées ; les sources ultérieures remplacent les sorties de copie antérieures au chemin exact relatif au dépôt, et les feuilles composables au même chemin logique fusionnent leurs parties.

```toml
[[dir]]
path = "./.harness/dir"

[[dir]]
path = "./.harness/local/dir"
```

Chaque table `[[dir]]` DOIT (MUST) contenir uniquement `path`. Un manifeste NE DOIT PAS (MUST NOT) contenir une seule table `[dir]`. Si aucune entrée `[[dir]]` n'est déclarée, aucune composition ou copie dir n'a lieu. Une source dir manquante est une couche vide valide.

### Feuilles composables

Un dossier à l'intérieur d'une source dir qui contient le fichier marqueur vide `.harnessComposable` est une **feuille composable dir**. Son nom (relatif à la racine de la source dir) est le chemin du fichier de sortie relatif au dépôt. Les fichiers à l'intérieur qui correspondent au patron à préfixe numérique `<order>_<name>` sont des **parties** : leurs octets se concatènent dans l'ordre `order` pour produire le fichier de sortie. Le même marqueur peut aussi exister sous une source de ressources, mais là il compose un fichier de ressource projeté plutôt qu'une sortie dir relative au dépôt.

```text
.harness/dir/AGENTS.md/
  .harnessComposable           # marqueur (vide)
  100_intro.md                 # partie, ordre 100
  200_rules.md                 # partie, ordre 200

# Sortie : ./AGENTS.md = 100_intro.md + 200_rules.md
```

Le préfixe d'ordre est un entier non négatif. Deux parties PEUVENT (MAY) partager le même ordre ; les ex æquo sont rompus par le chemin source. Une feuille composable PEUT (MAY) aussi contenir un fichier `.harnessRef` avec exactement un chemin relatif au dépôt pointant vers une autre feuille composable ; les parties développées de cette feuille sont importées avant les parties locales de cette feuille et retriées par `order`. Les cycles, les cibles `.harnessRef` manquantes, les cibles `.harnessRef` qui s'échappent de la racine de la source dir et les cibles `.harnessRef` absolues DOIVENT (MUST) être rapportés comme erreurs.

Une feuille composable NE DOIT PAS (MUST NOT) contenir de sous-dossiers. Un fichier non-partie, non-`.harnessRef` à l'intérieur d'une feuille composable DOIT (MUST) être rapporté comme erreur de partie invalide ; l'auteur renomme soit le fichier pour correspondre à `<order>_<name>`, soit retire le marqueur `.harnessComposable` pour passer en mode copie.

### Dossiers de copie et fichiers individuels

Tout dossier dans une source dir qui ne contient PAS le marqueur `.harnessComposable` est un **dossier de copie**. Ses fichiers et sous-dossiers sont projetés avec leurs chemins relatifs préservés. Les fichiers individuels à toute profondeur se projettent en copies directes.

```text
.harness/dir/
  README.md                    # -> ./README.md
  .claude/
    settings.json              # -> ./.claude/settings.json
    hooks/
      post-tool-use.sh         # -> ./.claude/hooks/post-tool-use.sh
  notes/
    01_dev_intro.md            # -> ./notes/01_dev_intro.md
```

Le fichier marqueur `.harnessComposable` lui-même NE DOIT PAS (MUST NOT) apparaître dans aucune sortie, dans aucun des deux modes.

### Chemins de sortie et chevauchement avec les cibles

Les sorties dir sont des chemins relatifs au dépôt. Elles DOIVENT (MUST) se résoudre à l'intérieur du dépôt et NE DOIVENT PAS (MUST NOT) écrire à l'intérieur de `./.harness`, d'une source de ressources configurée ou d'une source dir configurée. Un chemin de sortie dir qui tombe **sous** un chemin `[[targets]]` déclaré (par exemple `.claude/settings.json` lorsque `./.claude` est une cible déclarée) est fusionné dans la projection de cette cible pendant l'activation, de sorte que l'idempotence cible et le nettoyage des entrées non gérées respectent les fichiers possédés par dir. Une sortie dir qui **remplacerait ou contiendrait** la racine d'une cible déclarée elle-même (par exemple une sortie dir à `.claude` lorsque `./.claude` est une cible déclarée) DOIT (MUST) être rapportée comme `harness.dir_output_target_overlap`.

Un chemin de sortie dir qui ne chevauche aucune cible déclarée écrit directement à ce chemin relatif au dépôt.

### Conflits

Si deux sorties dir se projetaient vers des chemins relatifs au dépôt incompatibles où un chemin exige qu'un autre chemin soit à la fois un fichier et un dossier, la projection DOIT (MUST) rapporter un `harness.dir_path_conflict` et NE DOIT PAS (MUST NOT) appliquer tant que le conflit n'est pas résolu. Le remplacement exact de chemin de fichier à travers des racines dir ordonnées est autorisé, et les feuilles composables au même chemin fusionnent leurs parties.

Si une sortie dir et une projection de ressource (canonique ou par surcharge de ressource) atterriraient au même chemin à l'intérieur de la même cible, la projection DOIT (MUST) rapporter un `harness.projection_path_conflict` et NE DOIT PAS (MUST NOT) appliquer.

### Règles d'ignore

Les règles `.harnessIgnore` côté source s'appliquent aux fichiers à l'intérieur de chaque source dir de la même manière qu'aux fichiers de ressources, en utilisant le chemin source (par exemple `.harness/dir/AGENTS.md/200_skip.md` ou `resources/AGENTS.md/200_skip.md` lorsqu'un chemin `[[dir]]` est `"./resources"`). Les règles imbriquées côté source fonctionnent donc à l'intérieur des feuilles `.harnessComposable` même lorsque la source dir est en dehors de `./.harness`.

Les règles `.harnessIgnore` en sortie cible s'appliquent également aux sorties dir après que le chemin de sortie candidat est connu. Les implémentations PEUVENT (MAY) utiliser une passe de bootstrap pour calculer les sorties dir candidates, découvrir les fichiers `.harnessIgnore` dans les dossiers ancêtres de sortie existants, puis recalculer les sorties finales avec ces règles. Pendant la collecte dir, seules les règles d'ignore globales participent. `.harnessMutable` s'applique uniquement aux projections de ressources cibles ; les sorties dir ne sont pas des fichiers cibles mutables.

Les racines de profil actives participent aussi à la collecte dir. Les dossiers dir de profil superposent le chemin de source dir configurée correspondant, peuvent ajouter des fichiers de copie ou des parties composables, et peuvent porter des fichiers `.harnessIgnore` logiques qui suppriment les fichiers dir de base ou les parties composables de base.

## `.harnessIgnore`

`.harnessIgnore` définit les fichiers qui DOIVENT (MUST) être ignorés lors de la projection des ressources et des sorties dir. Le fichier racine du dépôt est la limite à l'échelle du dépôt ; les fichiers locaux peuvent affiner la limite pour un sous-arbre source ou un sous-arbre de sortie cible existant. Ignorer signifie complètement exclu de la projection.

```text
# .harnessIgnore
.harness/**/logs/
.harness/**/*.log
.harness/resources/skills/*/metadata.toml
!.harness/resources/skills/release-notes/metadata.toml

[*]
.harness/**/tmp/

# Les règles racine peuvent aussi matcher les chemins de sortie cible.
.agents/**/scratch.tmp
```

Les patrons dans le fichier racine sont relatifs au dépôt et peuvent matcher soit les chemins source soit les chemins de sortie cible. Les patrons dans les fichiers locaux sont interprétés relativement au dossier contenant ce fichier `.harnessIgnore`. Les outils DOIVENT (MUST) supporter les lignes blanches, les commentaires `#`, la négation `!`, les ancres `/` initiales, les patrons de dossiers se terminant par `/`, `*`, `**` et `?`.

L'évaluation des ignores est ordonnée :

1. Commencer par `included`.
2. Lire les règles de haut en bas.
3. Une règle non négative correspondante change l'état en `ignored` ; une règle négative correspondante change l'état en `included`.
4. La dernière règle correspondante participante gagne.

Les en-têtes de section affectent les règles suivantes :

- `[*]` ou `[global]` applique les règles d'ignore suivantes à chaque cible.
- `[ignore]` rebascule les règles suivantes en règles d'ignore.
- `[mutable]` n'est pas supporté dans `.harnessIgnore`. Les outils DOIVENT (MUST) rapporter `harness.ignore_mutable_section_unsupported` et NE DOIVENT PAS (MUST NOT) traiter les règles sous cet en-tête comme des déclarations mutables. Les déclarations mutables appartiennent à `.harnessMutable`.
- Les en-têtes spécifiques à la cible tels que `[.claude]`, `[!.cursor]` et `[mutable .claude]` ne sont pas supportés. Les outils DOIVENT (MUST) rapporter `harness.ignore_unsupported_scope` et NE DOIVENT PAS (MUST NOT) appliquer les règles sous cet en-tête non supporté jusqu'à ce qu'un autre en-tête de section supporté apparaisse.

Un patron se terminant par `/` est uniquement-dossier. Pour les règles d'ignore non négatives, il matche le dossier lui-même et les descendants de ce dossier. Pour les règles négatives, il ré-inclut uniquement l'entrée du dossier lui-même ; les descendants ont toujours besoin de leur propre règle négative telle que `!path/to/item/**`. Cela préserve le patron de style gitignore où les ignores larges peuvent fermer un sous-arbre pendant que les règles logiques plus profondes rouvrent sélectivement un enfant.

## `.harnessMutable`

`.harnessMutable` définit les fichiers source qui ne sont projetés que comme graines initiales. Mutable est différent d'ignore : les fichiers ignorés restent hors de la projection, tandis que les fichiers mutables entrent dans la projection lorsque le fichier cible est manquant. Une fois que le fichier cible existe, l'activation le rapporte comme `mutable` et NE DOIT PAS (MUST NOT) écraser ses octets sauf si la politique de mutable force explicitement la re-projection.

```text
# .harnessMutable
.harness/**/settings.local.json
.harness/resources/skills/*/permissions.json
```

Les patrons utilisent la même syntaxe, localité, négation, ancres, suffixe uniquement-dossier et précédence dernière-correspondance-gagne que `.harnessIgnore`. Le fichier racine est relatif au dépôt et peut matcher des chemins source ou des chemins de sortie cible. Les fichiers source-locaux et profil-locaux sont interprétés relativement à leur dossier source logique. Les fichiers `.harnessMutable` en sortie cible ne font pas partie de v1 ; les déclarations de mutables appartiennent à la source, pas aux cibles vivantes.

L'évaluation des mutables est ordonnée indépendamment de l'évaluation des ignores :

1. Commencer par `not mutable`.
2. Lire les règles `.harnessMutable` participantes de haut en bas.
3. Une règle non négative correspondante change l'état en `mutable` ; une règle négative correspondante change l'état en `not mutable`.
4. La dernière règle mutable correspondante participante gagne.

Les en-têtes de section sont optionnels dans `.harnessMutable` :

- `[*]`, `[global]` et `[mutable]` appliquent les règles mutables suivantes globalement.
- `[ignore]` n'est pas supporté dans `.harnessMutable` ; les règles d'ignore appartiennent à `.harnessIgnore`.
- Les en-têtes spécifiques à la cible ne sont pas supportés pour la même raison qu'ils ne sont pas supportés dans `.harnessIgnore`.

Les fichiers mutables DOIVENT (MUST) quand même passer par l'étape d'ignore de projection. Si un fichier est à la fois ignoré et marqué mutable, la décision d'ignore gagne parce que le fichier n'entre jamais dans la projection en premier lieu.

### Fichiers `.harnessIgnore` locaux

Des fichiers `.harnessIgnore` supplémentaires PEUVENT (MAY) apparaître à l'intérieur des emplacements source et à l'intérieur des emplacements de sortie cible existants. Ils permettent à un auteur ou consommateur de ressources de garder les règles d'ignore près des fichiers auxquels elles s'appliquent, sans gonfler le fichier racine.

Des fichiers `.harnessMutable` supplémentaires PEUVENT (MAY) apparaître à l'intérieur des emplacements source et des racines de profil. Ils permettent à un auteur de ressources de garder les règles de propriété sur initialisation près des fichiers de modèle source qu'elles affectent.

```text
.harnessIgnore                                  # fichier racine
.harnessMutable                                 # fichier mutable racine
.harness/resources/skills/review/.harnessIgnore           # règles de ressource source-locales
.harness/resources/skills/review/.harnessMutable          # règles mutables source-locales
.harness/resources/skills/review/.claude/.harnessIgnore   # règles de surcharge source-locales
.harness/resources/skills/review/.claude/.harnessMutable  # règles mutables de surcharge source-locales
resources/AGENTS.md/.harnessIgnore              # règles dir personnalisées source-locales
.agents/skills/review/.harnessIgnore            # règles locales en sortie cible
notes/.harnessIgnore                            # règles en sortie cible pour les sorties dir
```

Les règles suivantes s'appliquent :

- **Règles source-locales.** Un fichier `.harnessIgnore` sous `./.harness`, sous une source de ressources configurée ou sous une source dir configurée matche les chemins source. Un patron tel que `*.tmp` dans le fichier au chemin par défaut `.harness/resources/skills/review/.harnessIgnore` matche `.harness/resources/skills/review/scratch.tmp` et `.harness/resources/skills/review/nested/scratch.tmp` mais NE matche PAS `.harness/resources/skills/triage/scratch.tmp`.
- **Règles mutables source-locales.** Un fichier `.harnessMutable` sous `./.harness` ou sous une source de ressources configurée matche les chemins source avec la même localité. Il marque les fichiers de ressources projetés correspondants comme fichiers mutables sur initialisation uniquement. Les sorties dir ne sont pas des fichiers cibles mutables.
- **Règles locales en sortie cible.** Un fichier `.harnessIgnore` sous une racine cible déclarée existante matche les chemins de sortie cible. Un patron tel que `*.tmp` dans `.agents/skills/review/.harnessIgnore` matche un chemin de sortie tel que `.agents/skills/review/scratch.tmp`, indépendamment de si la source était `.harness/resources/skills/review/scratch.tmp` ou un fichier de surcharge. Pour les sorties dir, les implémentations découvrent aussi les fichiers `.harnessIgnore` dans les dossiers ancêtres existants des chemins de sortie candidats, tels que `notes/.harnessIgnore` pour une sortie `notes/release.md`.
- **Contrôles locaux aux cibles.** Les fichiers `.harnessIgnore` en sortie cible sont des contrôles locaux pour la surface de harness vivante, utiles pour des préférences de développement temporaires, des exclusions spécifiques à la machine ou des dossiers cibles gitignored où un développeur a besoin de garder les fichiers runtime locaux hors de la prochaine activation. Ils ajustent la limite de sortie sans transformer le dossier cible en racine source. Les règles partagées ou de première activation appartiennent aux fichiers `.harnessIgnore` racine ou source-locaux à la place.
- **Portée de l'effet.** Un fichier local ne participe que lorsque le chemin source candidat ou le chemin de sortie cible est à l'intérieur du dossier de ce fichier.
- **Ordre d'évaluation.** Les jeux de règles sont évalués par phases : le fichier racine en premier, puis les fichiers source-locaux et profil-locaux dans l'ordre de profondeur de dossier logique croissante, puis les fichiers locaux en sortie cible dans l'ordre de profondeur de dossier logique croissante. À l'intérieur de chaque jeu de règles, les règles sont lues de haut en bas. La dernière règle correspondante participante à travers tous les fichiers gagne. Un fichier source ou cible plus profond peut donc ré-inclure un chemin qu'un fichier moins profond dans la même phase a exclu, ou exclure un chemin qu'un fichier moins profond aurait inclus. Les règles locales en sortie cible forment la limite de sortie finale pour un sous-arbre cible et ne peuvent pas être annulées par des règles source profil-locales.
- **Emplacement logique.** Chaque fichier `.harnessIgnore` local participant a un emplacement logique. Les fichiers profil-locaux participent à l'emplacement de superposition logique de la racine de profil. Les fichiers de surcharge dérivés des cibles participent à leurs emplacements source et cible logiques, pas simplement au dossier point physique utilisé pour stocker la surcharge.
- **Même grammaire.** Les fichiers imbriqués supportent les mêmes commentaires, négation, ancres, syntaxe glob et en-têtes de section supportés que le fichier racine correspondant.
- **Placement spécifique à la cible.** Un `.harnessIgnore` imbriqué à l'intérieur d'un sous-arbre de sortie cible est le mécanisme spécifique à la cible. Les en-têtes de section spécifiques à la cible sont invalides même à l'intérieur des dossiers de surcharge.
- **Ignore synthétique.** Chaque fichier `.harnessIgnore`, `.harnessMutable`, `.harnessProfile` et `.harnessProfileRoot` est lui-même exclu de la projection, équivalent à des règles d'ignore globales pour les fichiers de déclaration. Les implémentations NE DOIVENT PAS (MUST NOT) copier ces fichiers de déclaration dans les cibles, même quand aucune règle explicite ne les exclut. Un fichier de déclaration en sortie cible peut toujours affecter la projection depuis son emplacement cible existant ; il est lu comme un contrôle local, pas projeté comme contenu cible géré.
- **Protection en sortie cible.** Un fichier `.harnessIgnore` qui existe déjà dans un emplacement de sortie cible NE DOIT PAS (MUST NOT) être écrasé par la projection et NE DOIT PAS (MUST NOT) être supprimé par le nettoyage des non gérés. Les dossiers ancêtres requis pour garder ce fichier en place DOIVENT (MUST) aussi être préservés. Les fichiers `.harnessProfile` existants en sortie cible ont la même protection.

Les fichiers locaux sont des entrées de limite optionnelles à portée ; un dépôt qui n'utilise que le fichier racine reste conforme. Les fichiers locaux en sortie cible ne participent qu'après leur existence sur disque ; les implémentations ne sont pas tenues d'inférer le contenu d'un fichier qui n'a pas encore été créé.

## Superpositions de profil

Les superpositions de profil sont des superpositions source optionnelles sélectionnées par des fichiers `.harnessProfile`. Un fichier `.harnessProfile` est du texte UTF-8. Après avoir coupé les espaces de chaque ligne et ignoré les lignes blanches, il DEVRAIT (SHOULD) contenir zéro ou un nom de profil. Zéro nom de profil sélectionne aucun profil pour ce sous-arbre de sortie. Plus d'une ligne non vide DEVRAIT (SHOULD) produire un avertissement, et les outils PEUVENT (MAY) utiliser le premier nom de profil pour la compatibilité. Le `.harnessProfile` racine s'applique globalement ; un `.harnessProfile` local en sortie cible s'applique à son dossier et descendants, et le sélecteur le plus proche gagne pour tout chemin de sortie.

Le contenu de profil est déclaré avec `.harnessProfileRoot`, qui DOIT (MUST) vivre sous `./.harness`, sous une source de ressources configurée ou sous une source dir configurée. Un fichier `.harnessProfileRoot` est du texte UTF-8. Après avoir coupé les espaces de chaque ligne et ignoré les lignes blanches, il DOIT (MUST) contenir exactement un nom de profil. Zéro nom de profil ou plus d'une ligne non vide DOIT (MUST) produire une erreur, et cette racine de profil NE DOIT PAS (MUST NOT) participer à la projection. Un `.harnessProfileRoot` NE DOIT PAS (MUST NOT) être imbriqué dans une autre racine de profil. Le dossier contenant `.harnessProfileRoot` est une racine de profil. C'est du stockage source, pas un élément de ressource, et NE DOIT PAS (MUST NOT) être projeté comme skill, règle, plugin, sortie dir ou fichier de déclaration copié.

Les racines de profil superposent les chemins source selon l'endroit où le marqueur est placé :

- Si le dossier marqueur est un enfant immédiat d'une source de ressources configurée ou d'une source dir configurée, ce dossier marqueur superpose cette racine source. Par exemple, sous un chemin de ressources conventionnel, `.harness/resources/deploy/.harnessProfileRoot` superpose `.harness/resources` ; les enfants de `deploy/` deviennent des sorties de ressources logiques.
- Si le dossier marqueur est imbriqué plus profondément dans une source de ressources configurée ou une source dir configurée, ce dossier marqueur superpose son dossier parent. Cela permet aux éléments de ressources de porter des profils locaux portables. Par exemple, sous un chemin de ressources conventionnel, `.harness/resources/skills/example/aggressiveProfile/.harnessProfileRoot` superpose `.harness/resources/skills/example`, de sorte que `.harness/resources/skills/example/aggressiveProfile/SKILL.md` remplace le `.harness/resources/skills/example/SKILL.md` logique lorsque ce profil est actif.
- Sinon, un dossier marqueur sous `./.harness` superpose `./.harness`. Cela supporte les layouts de kit tels que `.harness/kits/deploy-kit/.harnessProfileRoot` avec des enfants tels que `resources/` et `dir/`.

Pendant la projection, les fichiers source de base génériques sont considérés en premier à travers les sources de ressources dans l'ordre du manifeste, puis les fichiers de profil actifs génériques, puis les fichiers de surcharge dérivés des cibles à travers les sources de ressources dans l'ordre du manifeste, puis les fichiers de profil actifs à l'intérieur de la surcharge cible correspondante. Une superposition de profil générique ne peut donc pas remplacer une surcharge spécifique à la cible telle que `.codex` ; une surcharge `.codex` spécifique au profil le peut. Si plusieurs racines de profil actives projettent le même fichier logique, un outil DEVRAIT (SHOULD) avertir et PEUT (MAY) utiliser un ordre déterministe dernière-correspondance-gagne. Les fichiers `.harnessIgnore` et `.harnessMutable` profil-locaux matchent le chemin de superposition logique, pas le chemin de stockage. Par exemple, un fichier d'ignore à `.harness/profiles/personal/dir/AGENTS.md/.harnessIgnore` s'applique comme s'il était situé à `.harness/dir/AGENTS.md/.harnessIgnore`, donc il peut supprimer les parties composables de base avant d'ajouter les parties de profil.

Les fichiers `.harnessIgnore` source-locaux qui sont ancêtres physiques d'une racine de profil s'appliquent aussi avant que la racine de profil soit mappée sur son chemin de superposition logique. Par exemple, `.harness/kits/.harnessIgnore` peut exclure les métadonnées `.harness/kits/deploy/**/.harnex/` du profil `deploy` actif même lorsque les fichiers sous cette racine de profil superposent des chemins logiques tels que `.harness/resources` ou `.harness/dir`.

Pour les sources dir, les implémentations DOIVENT (MUST) utiliser un flux bootstrap/final : collecter les sorties candidates avec les règles côté source et tout sélecteur de profil connu, découvrir les fichiers `.harnessIgnore` et `.harnessProfile` en sortie cible dans les ancêtres de sortie candidats, puis recalculer les sorties finales. Les dossiers de profil actifs DOIVENT (MUST) aussi participer à la découverte des candidats, pour qu'un `.harnessProfile` en sortie cible puisse activer une sortie dir uniquement-profil même lorsque aucune source dir de base n'aurait produit cette sortie. Les dossiers de profil actifs peuvent contribuer à une feuille `.harnessComposable` existante même lorsque le dossier de profil ne répète pas le marqueur `.harnessComposable`.

## Révisabilité

La frontière source/projection rend les différences entre surfaces révisables :

- Une diff sous une source de ressources configurée affecte chaque cible qui projette ce chemin de ressource.
- Une diff sous `.agents`, `.claude`, `.cursor` ou un autre dossier de surcharge à l'intérieur d'un élément de ressource affecte uniquement les cibles qui utilisent cette surcharge.
- Une diff dans le `.harnessIgnore` racine change les limites d'exclusion de projection globalement ; une diff dans un `.harnessIgnore` imbriqué change la projection seulement à l'intérieur du dossier source ou de sortie cible de ce fichier.
- Une diff dans `.harnessMutable` change les fichiers source projetés qui deviennent des fichiers cibles mutables sur initialisation uniquement possédés par le runtime.
- Une diff dans un `.harnessIgnore` en sortie cible existant change ce qui sera copié dans ce sous-arbre de sortie, sans transformer le dossier cible en source de vérité.
- Une diff dans `.harnessProfile` change les superpositions de racine de profil qui s'appliquent à ce sous-arbre de sortie ; une diff sous un `.harnessProfileRoot` actif change uniquement les sorties où ce profil est sélectionné.
- Une diff dans le manifeste sélectionné change les chemins de source de ressources, les chemins cibles, les paramètres dir et les déclarations d'extension.

## Exigences de sécurité

- La validation DOIT (MUST) être en lecture seule.
- Les chemins DOIVENT (MUST) rester à l'intérieur du dépôt.
- Les commandes d'initialisation DOIVENT (MUST) expliquer les changements de système de fichiers planifiés avant la mutation.
- Les commandes d'activation DEVRAIENT (SHOULD) offrir un dry run et expliquer les créations, mises à jour, suppressions, conservations, entrées non gérées préservées et sauts de mutables avant la mutation.
- L'introspection de chemin en lecture seule, lorsqu'elle est fournie par un outil, DOIT (MUST) être dérivée du même manifeste sélectionné, des mêmes racines source configurées, sélecteurs de profil, règles d'ignore, règles de mutables, politique de mutables et modèle de projection que l'activation.
- Les surfaces de harness vivantes DOIVENT (MUST) être traitées comme des cibles de projection, pas comme des dépôts source.
- Les équipes PEUVENT (MAY) gitignored les surfaces de harness vivantes parce qu'elles sont des sorties générées ; le faire ne change pas la source de vérité ni le contrat de déclaration cible.
- Les dépôts qui gitignored les surfaces de harness vivantes DEVRAIENT (SHOULD) garder les instructions d'activation trackées et NE DEVRAIENT PAS (SHOULD NOT) gitignored les racines source configurées partagées requises pour régénérer ces surfaces. Les racines source locales au développeur PEUVENT (MAY) être gitignored lorsqu'elles sont intentionnellement en dehors de la source de vérité partagée.
- L'activation DOIT (MUST) être idempotente pour le même manifeste sélectionné, les racines source configurées, `.harnessIgnore`, `.harnessMutable`, les ressources participantes, la politique de nettoyage et la politique de mutables.
- La projection DOIT (MUST) honorer `.harnessIgnore` pour que les logs, métadonnées, caches et état d'implémentation restent hors des surfaces de harness vivantes.
- Les outils DOIVENT (MUST) fusionner les surcharges dérivées des cibles lorsqu'elles sont présentes et revenir aux fichiers canoniques lorsque aucune surcharge n'existe.
- Les types de ressources inconnus PEUVENT (MAY) être utilisés comme dossiers sous la source de ressources configurée.
- Les fichiers mutables DOIVENT (MUST) être créés à la première projection et DOIVENT (MUST) être sautés lors des projections suivantes sauf si l'utilisateur opte explicitement pour forcer une re-projection.

## Considérations de sécurité

Harness config décrit un système qui copie des fichiers depuis le contrôle de version dans des dossiers qu'un agent AI ou un autre outil lira par la suite. L'intégrité de ces copies a un effet direct sur ce que fait l'agent. Les implémentations DEVRAIENT (SHOULD) considérer les menaces suivantes explicitement :

- **Traversée de chemin.** Les chemins de manifeste, chemins cibles et patrons d'ignore sont contrôlés par l'utilisateur. Les implémentations DOIVENT (MUST) refuser les chemins qui se résolvent en dehors du dépôt après normalisation (voir [Encodage, chemins et sensibilité à la casse](#encodage-chemins-et-sensibilité-à-la-casse)).
- **Redirection de lien symbolique.** Les liens symboliques dans l'arbre source ou dans les arbres cibles déclarés peuvent rediriger les lectures ou écritures hors du dépôt s'ils sont suivis. Les implémentations v1 DOIVENT (MUST) traiter les liens symboliques comme des entrées feuilles et NE DOIVENT PAS (MUST NOT) les suivre silencieusement. Remplacer un lien symbolique cible qui occupe un chemin projeté DOIT (MUST) exiger une politique de lien symbolique cible explicite, soit depuis le manifeste sélectionné soit depuis une option d'activation équivalente sélectionnée par l'opérateur.
- **TOCTOU à l'application.** Une cible peut être modifiée entre la planification et l'application. Les implémentations DEVRAIENT (SHOULD) revérifier l'existence et la classification gérée/non gérée des fichiers au moment de l'application, pas seulement au moment du plan.
- **Suppression d'entrées non gérées.** Le nettoyage supprime les fichiers utilisateur. La politique par défaut DOIT (MUST) être la préservation, et toute suppression DOIT (MUST) être visible dans le plan avant qu'elle ne se produise.
- **Contournement de mutable.** Les règles `.harnessMutable` sont une déclaration explicite « le runtime possède ceci après la première projection ». Les implémentations NE DOIVENT PAS (MUST NOT) écraser un mutable cible sans une décision de forçage explicite et visible par l'utilisateur.
- **Surcharges non fiables.** Un dépôt peut importer des éléments de ressources de tiers. Comme les dossiers de surcharge peuvent réécrire des fichiers cibles arbitraires, les implémentations et les produits en aval DEVRAIENT (SHOULD) fournir un outillage pour comparer les dossiers de surcharge aux fichiers canoniques et pour limiter les cibles qu'une surcharge donnée peut affecter.
- **Activation qui lit sa sortie.** Les dossiers cibles vivants NE DOIVENT PAS (MUST NOT) être utilisés comme entrées de la projection suivante. Traiter une cible comme à la fois source et puits peut amplifier silencieusement les éditions runtime en changements de source de vérité.

Le standard ne prescrit pas d'authentification, de signature ou de vérification de chaîne d'approvisionnement pour les dossiers de ressources. Ce sont des préoccupations appropriées pour les couches produit et la politique organisationnelle.

## Compatibilité et évolution future

Dans v1, les types de changements suivants sont permis et n'exigent pas une nouvelle version de standard :

- Clarifications éditoriales qui ne changent pas la signification normative.
- Nouveaux champs optionnels avec des valeurs par défaut définies qui préservent la signification des documents v1 qui les omettent.
- Nouvelles déclarations d'extension (qui sont opt-in par définition).
- Diagnostics supplémentaires ou avertissements non bloquants.

Les changements suivants sont réservés à v2 :

- Tout changement au schéma du manifeste pour les cibles ou le champ `version` de premier niveau qui invaliderait un manifeste v1.
- Tout changement à la sémantique de projection (`create`, `update`, `remove`, `keep`, `preserve`, `mutable`) qui altérerait le résultat sur disque d'une entrée v1 inchangée.
- Tout changement à la grammaire ou à la précédence de `.harnessIgnore` qui altérerait quels fichiers un ensemble de règles v1 existant inclut, exclut ou marque mutables.
- Réservation de types de ressources ou de noms de cibles précédemment disponibles aux dépôts utilisateurs.

Les implémentations DEVRAIENT (SHOULD) traiter les manifestes dont le `version` est un entier positif supérieur au maximum qu'ils supportent comme un diagnostic « version non supportée », pas comme un manifeste malformé. Cela permet aux manifestes futurs non supportés d'échouer de façon informative contre des outils plus anciens.
