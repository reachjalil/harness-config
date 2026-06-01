---
title: Outillage
seoTitle: Outillage Harness config
socialTitle: Outillage pour valider et activer Harness config
description: L'implémentation de référence npx harnessc, la validation, l'introspection explain, le planning et les commandes d'activation.
socialDescription: La couche de commandes pour valider les dépôts Harness config et appliquer les projections d'activation.
canonicalPath: /specifications/v1/tooling/
slug: tooling
order: 5
locale: fr-fr
sectionCode: "05"
summary: "L'implémentation de référence npx harnessc : validation, introspection explain, dry-run et commandes d'activation."
llmSummary: Décrit les attentes d'outillage pour validation, introspection explain, dry-run, activation, diagnostics et helpers autour de Harness config.
audience: Auteurs de CLI et développeurs opérant des dépôts Harness config.
contentKind: spec
status: draft
updated: 2026-05-28
---

# Outillage Harness config

`harnessc` est l'implémentation standard de Harness config. Il existe pour que les dépôts puissent valider la forme des fichiers, prévisualiser l'activation et matérialiser les projections de copie sans écrire d'abord un outil personnalisé.

Toute autre implémentation qui satisfait la conformité d'outil est tout aussi valide. Le standard est défini par la forme du dépôt et le contrat d'activation, pas par un seul binaire.

## Confidentialité et télémétrie

Harness config ne collecte pas de télémétrie.

La CLI `harnessc` n'envoie pas d'analytique, d'événements d'utilisation, de chemins de fichiers, de noms de dépôts, d'historique de commandes, d'identifiants de machine ou de rapports d'erreurs.

L'activation, la validation et la planification s'exécutent localement contre les fichiers de votre dépôt. La CLI ne fait pas de requêtes réseau en fonctionnement normal.

## Commandes

```bash
harnessc
harnessc init
harnessc validate
harnessc explain <path>
harnessc activate
harnessc extension activate
```

- `harnessc` sans commande valide la configuration de dépôt la plus proche et imprime le chemin de manifeste détecté avec les étapes suggérées suivantes.
- `harnessc init` montre un plan d'adoption lorsqu'il est lancé sans `--yes`. Avec `--yes`, il crée le manifeste sélectionné (`./.harness/harness.toml` par défaut), les dossiers de ressources conventionnels ou personnalisés sous la racine source de ressources configurée, `.harnessIgnore` et `.harnessMutable`. Le manifeste de démarrage généré déclare `[[resources]] path = "./.harness/resources"` explicitement. Utiliser `--resources-path <path>` pour choisir cette racine source, `--resource <kind>` pour créer un ou plusieurs dossiers de type de ressource dessous, et `--target <path>` pour ajouter des entrées `[[targets]]` explicites.
- `harnessc validate` vérifie le support de version, les chemins locaux au dépôt, les mappings de cibles, la syntaxe d'ignore de projection, la syntaxe de déclaration de mutables, les feuilles composables de ressources, la gestion des liens symboliques feuilles et les problèmes de composition/copie dir.
- `harnessc explain <path>` explique comment un chemin source ou de sortie participe au plan de projection courant, y compris les chemins source gagnants, les racines source configurées, les sorties dir, les diagnostics bloquants et les décisions des mêmes entrées de projection que celles utilisées par l'activation. La sortie JSON inclut des traces d'ignore source et en sortie cible pour qu'un appelant puisse distinguer une exclusion racine, une ré-inclusion source-locale plus profonde, une ré-inclusion logique profil-locale et une limite finale en sortie cible.
- `harnessc activate` montre la prévisualisation de projection lorsqu'il est lancé sans `--yes` et rapporte créations, mises à jour, suppressions demandées, fichiers conservés, fichiers mutables sautés et entrées non gérées préservées. Par défaut, il rapporte les liens symboliques cibles qui occupent des chemins projetés comme des conflits ; passer `--replace-target-symlinks` ou définir `[activation].targetSymlinks = "replace"` pour remplacer le lien lui-même.
- `harnessc extension activate` exécute les extensions enregistrées. Utiliser `--extension <id>` pour exécuter une extension déclarée ou `--all` pour exécuter chaque extension supportée déclarée.

`init`, `activate` et `extension activate` sont des dry runs sauf si `--yes` est fourni. La forme dry-run d'`init` remplace la commande `harnessc plan` précédente, de sorte qu'un modèle mental unique — « sans drapeau prévisualise, `--yes` écrit » — s'applique à chaque commande mutante.

Exemples d'introspection courants :

```bash
harnessc explain .agents/skills/review/SKILL.md
harnessc explain AGENTS.md
harnessc explain .harness/local/resources/skills/review/SKILL.md
```

Les entrées cibles non gérées sont conservées par défaut. Utiliser `--remove-unmanaged` lorsqu'une cible doit être nettoyée pour correspondre aux sources configurées ; utiliser `--keep-unmanaged` pour rendre le défaut explicite.

Les surfaces de harness générées telles que `.agents`, `.claude`, `.cursor` et `.gemini` peuvent être gitignored lorsqu'elles sont reproductibles depuis `.harness`. Les projets qui font cela devraient garder les instructions d'activation trackées telles qu'une note d'instructions racine, une étape README ou un script de paquet qui dit aux utilisateurs et agents de lancer la validation et l'activation sur un nouveau checkout.

Les entrées `.gitignore` recommandées après une migration complète sont :

```gitignore
# Surfaces vivantes générées par Harness
.agents/
.claude/
.cursor/
.gemini/

# Superpositions Harness privées
.harness/local/
```

Garder la source Harness partagée trackée : `.harness/harness.toml`, le `.harness/resources/**` partagé, `.harness/dir/**` lorsqu'utilisé, `.harnessIgnore` et les déclarations `.harnessMutable`. Ne pas ajouter `.harness/` comme ignore large sauf si le dépôt opte intentionnellement pour ne pas partager le catalogue source.

Le nettoyage s'applique uniquement aux cibles encore déclarées dans le manifeste sélectionné. Après qu'une déclaration de cible soit retirée, `harnessc activate` de base n'inspecte plus ni ne nettoie ce dossier. Le nettoyer d'abord avec `--remove-unmanaged`, ou utiliser un workflow d'état d'activation de niveau supérieur capable de réconcilier les cibles orphelines.

Le chemin de manifeste par défaut est `./.harness/harness.toml`. Lorsque `--root` et `--config` sont omis, `harnessc` cherche vers le haut depuis le dossier courant ce manifeste. Passer `--config <path>` pour valider, initialiser, activer ou exécuter des extensions contre un autre fichier TOML local au dépôt. `harnessc init --resources-path <path>` écrit une entrée `[[resources]]` dans le manifeste et crée les dossiers de ressources sous cette racine source configurée. `harnessc init --resource <kind>` ajoute un dossier de type de ressource sous la racine de ressources configurée et valide le nom avec le patron d'id de ressource. `harnessc init --target <path>` ajoute une entrée `[[targets]]` pour un chemin cible local au dépôt. Les chemins de manifeste sont sélectionnés par l'invocation d'outil ; les chemins à l'intérieur du manifeste restent locaux au dépôt, pas relatifs au dossier du fichier manifeste.

Le plan d'activation est aussi la vue orientée opérateur de la propriété. Les fichiers gérés sont des sorties de projection possédées par le dépôt, les entrées non gérées sont un état cible existant hors de la projection, et les entrées mutables sont des fichiers cibles initialisés par la source mais maintenant possédés par le runtime.

Les fichiers gérés sont comparés directement avec la projection source courante : si la cible diffère, `harnessc activate` rapporte `update` et appliquer l'activation écrase la cible avec les octets source courants. Les fichiers mutables déclarés dans `.harnessMutable` sont créés une seule fois depuis la source et sautés lors des activations suivantes parce que les octets cibles vivants sont possédés par le runtime. Utiliser `--force-mutable` pour les re-projeter depuis la source.

Les liens symboliques cibles ne sont pas suivis. Si un lien symbolique cible occupe un chemin que la projection doit écrire, `harnessc activate` rapporte `harness.target_symlink_conflict` et refuse `--yes` par défaut. Sélectionner l'une des politiques de remplacement explicites lorsque remplacer le lien lui-même est intentionnel :

```toml
[activation]
targetSymlinks = "replace"
```

ou pour une seule exécution :

```bash
harnessc activate --yes --replace-target-symlinks
```

Le comportement du système de fichiers suit le gel de release v1 :

- les liens symboliques sont traités comme des entrées feuilles et ne sont pas suivis ;
- les liens symboliques cibles qui occupent des chemins projetés sont des conflits sauf si le remplacement est sélectionné par politique de manifeste ou `--replace-target-symlinks` ;
- les entrées cibles non gérées sont préservées sauf si `--remove-unmanaged` est sélectionné ;
- les fichiers `.harnessIgnore` et `.harnessProfile` en sortie cible sont préservés comme contrôles locaux ;
- l'activation répétée avec les mêmes entrées converge vers `keep` pour les fichiers gérés et `mutable` pour les fichiers possédés par le runtime ;
- les cibles qui se chevauchent ou les cibles qui entrent en collision avec les racines source configurées sont des diagnostics.

Les workflows de sélection, le comportement de place de marché, la revue d'édition cible, la capture et autres opinions produit appartiennent au-dessus de `harnessc`.

## Composition et copie dir

Déclarer une ou plusieurs entrées `[[dir]]` dans le manifeste sélectionné active des racines source dir ordonnées. Lancer `harnessc activate` planifie et applique les sorties dir aux côtés de la projection cible :

```toml
[[dir]]
path = "./.harness/dir"

[[dir]]
path = "./.harness/local/dir"
```

```text
.harness/dir/
  AGENTS.md/
    .harnessComposable
    100_intro.md
    200_rules.md
  CLAUDE.md/
    .harnessComposable
    .harnessRef                       # ../AGENTS.md
    150_claude.md
  .github/
    copilot-instructions.md/
      .harnessComposable
      100_intro.md
  .claude/
    settings.json              # mode copie (pas de marqueur)
  notes/
    01_dev_intro.md            # mode copie (pas de marqueur)
```

À l'intérieur de chaque source `[[dir]]`, les dossiers qui contiennent un fichier marqueur vide `.harnessComposable` sont des feuilles composables : leurs parties à préfixe numérique (par exemple `100_intro.md`, `200_rules.md`) se concatènent dans l'ordre pour produire un fichier de sortie relatif au dépôt. Les dossiers sans le marqueur sont des dossiers de copie : leurs fichiers et fichiers imbriqués copient vers le chemin relatif au dépôt correspondant. Les fichiers individuels à toute profondeur copient aussi.

Le même marqueur `.harnessComposable` peut aussi être utilisé sous une source de ressources configurée. À cet emplacement, il compose un fichier de ressource projeté à l'intérieur de chaque cible déclarée ; ce n'est pas une sortie relative au dépôt `[[dir]]`.

Les fichiers `.harnessRef` à l'intérieur d'une feuille composable importent les parties d'une autre feuille. Les parties importées et locales sont triées ensemble, les numéros dupliqués gardent toutes les parties correspondantes, et les cycles ou cibles `.harnessRef` manquantes sont rapportés comme erreurs.

Les règles `.harnessIgnore` côté source s'appliquent pendant la collecte dir, y compris les règles à l'intérieur d'une feuille `.harnessComposable` et les règles à l'intérieur d'une source `[[dir]]` personnalisée en dehors de `./.harness`. Ignorer un conteneur saute toutes les sorties dir en dessous, ignorer une feuille saute cette sortie, et ignorer une partie exclut cette partie de la composition. Les fichiers `.harnessIgnore` en sortie cible peuvent aussi filtrer les sorties dir par chemin de sortie final après que la structure de sortie candidate est connue ; les règles en sortie cible sont évaluées après les règles source et profil-locales, donc elles forment la limite finale pour ce sous-arbre de sortie. Les en-têtes ciblés à portée sont ignorés dans ce mode. Le marqueur `.harnessComposable` lui-même n'est jamais copié dans aucune sortie.

Les surcharges de profil utilisent des sélecteurs `.harnessProfile` et des superpositions source `.harnessProfileRoot`. Un `.harnessProfile` racine s'applique globalement ; les sélecteurs cible/sortie tels que `.agents/skills/.harnessProfile` ne s'appliquent qu'à ce sous-arbre de sortie. `.harnessProfileRoot` doit vivre sous `.harness`, une source de ressources configurée ou une source dir configurée ; lorsqu'active, son contenu superpose soit la racine source parente (pour les marqueurs directement à l'intérieur de la source de ressources ou de la racine dir), soit le dossier parent (pour les racines de profil portables imbriquées dans un élément de ressource ou sous-arbre dir), soit `.harness` (pour les dossiers de style kit). Les racines de profil ne peuvent pas être imbriquées dans d'autres racines de profil. Les fichiers `.harnessIgnore` profil-locaux matchent ces chemins de superposition logiques, y compris les feuilles `.harnessComposable`. La planification dir découvre les sélecteurs de profil cible/sortie depuis les sorties candidates de base et de profil-uniquement avant de calculer le jeu de sortie dir final.

## Personnalisation pour développeur unique

Pour les développeurs solo ou les équipes qui veulent une expérimentation locale sans changer les sources partagées révisées, `harnessc` fonctionne avec des racines source ordonnées supplémentaires. Un patron pratique est :

```toml
[[resources]]
path = "./.harness/resources"

[[resources]]
path = "./.harness/local/resources"

[[dir]]
path = "./.harness/dir"

[[dir]]
path = "./.harness/local/dir"
```

La CLI n'exige pas que ces chemins existent. Les projets peuvent choisir d'ignorer `.harness/local/` dans le contrôle de version, de le commiter, de le générer ou d'utiliser des chemins différents. Les racines ultérieures surchargent les sorties de ressources ou dir exactes antérieures ; utiliser `harnessc explain <path>` pour inspecter pourquoi un chemin source ou de sortie spécifique est présent, ignoré, surchargé ou composé.

Lorsque `.harness/local/` est gitignored, les manifestes partagés peuvent quand même le déclarer comme racine ultérieure optionnelle. Les racines locales manquantes ne contribuent simplement à aucun fichier local ; les racines locales présentes peuvent surcharger les sorties de ressources ou dir exactes pour ce développeur.

Les chemins de sortie dir qui tombent sous un chemin `[[targets]]` déclaré fusionnent dans la projection de cette cible — lancer l'activation une deuxième fois converge vers des actions `keep` pour ces fichiers, y compris le nettoyage des entrées non gérées de cible. Une sortie dir qui remplacerait ou contiendrait une racine de cible elle-même (par exemple une sortie dir à `.claude` lorsque `./.claude` est déclarée comme cible) est rapportée comme `harness.dir_output_target_overlap`.

## Extensions

`harnessc` est livré avec un registre d'extensions pour la compatibilité ascendante. Cette release ne livre aucune implémentation d'extension intégrée ; les outils qui déclarent `[extensions.<id>]` pour des identifiants non supportés voient un diagnostic informationnel au lieu d'un comportement. La surface de composition et copie dir ci-dessus fait partie de l'activation du noyau, pas d'une extension.

```toml
[extensions.example]
version = 1
activation = "explicit"
```

Le standard du noyau possède `version` et `activation`. Les champs spécifiques à l'extension appartiennent à l'implémentation d'extension enregistrée. `harnessc extension activate` simple n'exécute que les extensions configurées avec `activation = "auto"`.

## Helpers TypeScript

Les éditeurs, scripts CI et outils internes peuvent intégrer le même comportement via `@harnessconfig/core` :

```ts
import {
  applyHarnessActivation,
  loadHarnessIgnoreMatcher,
  parseHarnessConfigToml,
  planHarnessActivation,
  resolveHarnessPaths,
  validateHarnessConfig,
} from "@harnessconfig/core";

const paths = resolveHarnessPaths(process.cwd());
const config = parseHarnessConfigToml(rawToml);
const ignore = await loadHarnessIgnoreMatcher(paths.root);
const validation = await validateHarnessConfig(paths.root);
const activationPlan = await planHarnessActivation(paths.root);
const dryRun = await applyHarnessActivation(paths.root);
```

## Vérifications du validateur

Un validateur conforme devrait :

- Utiliser le chemin `--root` fourni, ou le dossier courant lorsque aucune racine n'est fournie, comme racine du dépôt. Les invocations imbriquées devraient passer `--root`.
- Parser le manifeste sélectionné, par défaut `./.harness/harness.toml`, et rejeter une entrée malformée avec des diagnostics clairs.
- Refuser les versions de standard futures non supportées.
- Valider les chemins de sources de ressources configurées et rejeter les déclarations de ressources par type dans le manifeste.
- Vérifier que chaque entrée `[[targets]]` contient un chemin local au dépôt requis, pointe sous la racine du dépôt et ne chevauche pas les racines source configurées ; les clés non reconnues sont rapportées comme informationnelles.
- Parser `.harnessIgnore` avec des règles racine, source-locales, profil-locales et locales en sortie cible en utilisant les phases de précédence standard. Parser `.harnessMutable` séparément pour les fichiers possédés par le runtime à création unique.
- Résoudre les sélecteurs `.harnessProfile` et les superpositions `.harnessProfileRoot` avant la projection, y compris la passe bootstrap/finale dir pour les sélecteurs de sortie.
- Montrer les actions create, update, remove, keep, preserve et mutable avant toute écriture.
- Vérifier que l'activation répétée contre des entrées inchangées converge vers le même arbre cible pour les fichiers gérés et laisse les fichiers mutables intacts.
- Rapporter les cibles déclarées séparément des dossiers source durables.

## Sortie

La sortie par défaut est un rapport terminal concis avec chemins, sévérité et corrections suggérées. La sortie terminal humaine peut utiliser des couleurs ANSI pour les en-têtes, la sévérité des diagnostics et les types d'action lorsque le flux de sortie supporte les couleurs. Les implémentations devraient éviter les couleurs dans la sortie redirigée, honorer `NO_COLOR` et garder la sortie `--json` libre d'échappements ANSI pour l'automatisation et la CI.
