---
title: Patterns
seoTitle: Patterns et exemples Harness config
socialTitle: Patterns Harness config pratiques pour équipes et développeurs
description: Exemples concrets pour fichiers mutables possédés par le runtime, ignores en sortie cible, instructions composables, superpositions de profil, kits d'équipe, personnalisation et nettoyage sûr.
socialDescription: Exemples Harness config pratiques pour combiner état runtime mutable, ignores, profils, composition dir et nettoyage des cibles de façon sûre.
canonicalPath: /specifications/v1/patterns/
slug: patterns
order: 7
locale: fr-fr
sectionCode: "07"
summary: Exemples concrets pour combiner fichiers mutables possédés par le runtime, ignores, profils, composition dir et nettoyage sûr.
llmSummary: Montre des patterns pratiques Harness config pour fichiers mutables possédés par le runtime, ignores en sortie cible, instructions composables, superpositions de profil, kits d'équipe, personnalisation, profils locaux aux cibles, migration et nettoyage.
audience: Développeurs et équipes plateforme adoptant Harness config dans des dépôts réels.
contentKind: spec
status: draft
updated: 2026-05-28
---

# Patterns Harness config

Cette page montre comment combiner les pièces du standard sans perdre la règle de propriété principale : `.harness/` est la source canonique, et les dossiers cibles vivants sont des sorties générées avec quelques contrôles locaux protégés.

Commencer avec un manifeste explicite à `./.harness/harness.toml` :

```toml
version = 1

[[resources]]
path = "./.harness/resources"

[[resources]]
path = "./.harness/local/resources"

[[targets]]
path = "./.agents"

[[targets]]
path = "./.claude"

[[targets]]
path = "./.gemini"

[[dir]]
path = "./.harness/dir"

[[dir]]
path = "./.harness/local/dir"
```

```text
.harness/
  harness.toml
  resources/
    README.md
    skills/
    rules/
  dir/
    AGENTS.md/
      .harnessComposable
  local/
    resources/
    dir/
.agents/
.claude/
.gemini/
```

Le manifeste nomme les racines source et les cibles. Le système de fichiers montre où vit la source révisée et quelles surfaces de harness vivantes l'activation peut générer.

## Groupes de ressources

Pour la plupart des migrations, démarrer avec une racine `.harness/resources` partagée et grouper à l'intérieur par le chemin cible qui devrait être généré. Cela garde le catalogue source facile à inspecter et évite d'inventer des racines source séparées avant que le dépôt en ait besoin.

```toml
[[resources]]
path = "./.harness/resources"

[[resources]]
path = "./.harness/local/resources"
```

```text
.harness/
  resources/
    README.md
    .claude/
      settings.json
      .harnessMutable
    skills/
      review/
      frontend/
    prompts/
    rules/
    plugins/
  local/
    resources/
```

Les fichiers à la racine cible appartiennent à leur chemin à la racine cible à l'intérieur de la racine de ressources : par exemple `.claude/settings.json` devient `.harness/resources/.claude/settings.json`. Si ce fichier est possédé par le runtime après la première initialisation, ajouter `.harness/resources/.claude/.harnessMutable` avec `settings.json` dedans.

Les racines de ressources supplémentaires sont utiles lorsqu'elles représentent une vraie frontière : catalogues de préoccupations indépendamment optionnels, frontières de propriété, spécialisations sélectionnées par profil ou superpositions locales privées. Par exemple, les préoccupations testing, déploiement et UI peuvent vivre dans des racines séparées lorsqu'une équipe les combine intentionnellement via l'ordre du manifeste, des superpositions de profil ou des instructions dir spécifiques au profil. La couche locale est utile pour les skills personnels, plugins, agents, prompts et expérimentations avant promotion dans la source trackée.

## Ignore en sortie cible pour une surface vivante

Utiliser un `.harnessIgnore` en sortie cible lorsque la règle appartient à un sous-arbre de sortie vivante, pas à la source canonique.

```text
.agents/skills/deploy-plan/.harnessIgnore
*.tmp
```

Ceci exclut les chemins de sortie finaux sous `.agents/skills/deploy-plan/` :

```text
.agents/skills/deploy-plan/scratch.tmp
.agents/skills/deploy-plan/logs/run.tmp
```

Cela n'affecte pas :

```text
.claude/skills/deploy-plan/scratch.tmp
```

Les ignores en sortie cible matchent les chemins de sortie, pas les chemins source. Ils participent aussi seulement après que le fichier `.harnessIgnore` existe sur disque. Placer les règles dans le `.harnessIgnore` racine ou un `.harnessIgnore` source-local lorsque la règle doit s'appliquer à la première activation.

Ce pattern est volontairement local à la cible. Il est plus utile pour les surfaces de harness vivantes gitignored, les expérimentations de développement local ou les fichiers runtime spécifiques à la machine qui ne devraient pas devenir source partagée. Le fichier est préservé et lu depuis la sortie cible, mais il n'y est pas copié par la projection.

## Ré-inclusions logiques d'ignore

Utiliser des règles peu profondes pour les larges limites et des règles logiques plus profondes pour des exceptions sélectionnées. Les fichiers d'ignore profil-locaux sont évalués à l'emplacement de superposition logique de la racine de profil, pas au dossier de profil physique.

```toml
[[resources]]
path = "./.harness/resources-tooling"

[[targets]]
path = "./.agents"
```

```text
.harnessIgnore
.harnessProfile                  # contient : cloudflare-react
.harness/
  resources-tooling/
    skills/
      vite-worker-imports-config-skill/SKILL.md
      codex-agent-management/SKILL.md
    cloudflare-react/
      .harnessProfileRoot         # contient : cloudflare-react
      .harnessIgnore
```

```gitignore
# .harnessIgnore
.harness/resources-tooling/skills/**
```

```gitignore
# .harness/resources-tooling/cloudflare-react/.harnessIgnore
!skills/
!skills/vite-worker-imports-config-skill/
!skills/vite-worker-imports-config-skill/**
```

Avec `cloudflare-react` actif, seul `vite-worker-imports-config-skill` traverse la limite de projection. `codex-agent-management` reste ignoré parce que le fichier profil-local participe à `.harness/resources-tooling/` et que sa ré-inclusion descendante ne nomme que le skill Vite worker.

## Fichiers mutables possédés par le runtime

Utiliser `.harnessMutable` lorsque le dépôt devrait initialiser un fichier une fois et que le runtime devrait le posséder ensuite.

```text
.harnessMutable
.harness/resources/**/settings.local.json
```

```text
.harness/resources/skills/review/settings.local.json
.agents/skills/review/settings.local.json
.claude/skills/review/settings.local.json
```

À la première activation, le modèle source crée le fichier cible. Après cela, l'activation rapporte la cible comme `mutable` et laisse ses octets tranquilles, même si le runtime les a changés. C'est la bonne forme pour les autorisations de permission, réglages locaux, commandes apprises et autre état qui doit être visible dans le plan sans devenir source canonique.

Utiliser les règles d'ignore pour les fichiers qui ne devraient jamais traverser la limite de projection. Utiliser `.harnessMutable` pour les fichiers qui devraient traverser une fois comme modèle et appartenir ensuite à la surface de harness vivante.

## Instructions composables

Utiliser les sources `[[dir]]` pour les fichiers durables à la racine du dépôt et les fichiers possédés par les cibles qui ne sont pas des éléments de ressources. Une feuille composable est un dossier avec un marqueur `.harnessComposable` vide. Ses parties numérotées se concatènent en un seul fichier de sortie. Lorsque le même marqueur est utilisé sous une source de ressources configurée, il compose un fichier de ressource projeté à l'intérieur de chaque cible plutôt qu'une sortie dir à la racine ou possédée par la cible.

```toml
[[dir]]
path = "./.harness/dir"

[[dir]]
path = "./.harness/local/dir"
```

```text
.harness/
  dir/
    AGENTS.md/
      .harnessComposable
      100_intro.md
      200_rules.md
    CLAUDE.md/
      .harnessComposable
      .harnessRef          # ../AGENTS.md
      300_claude.md
  local/
    dir/
      AGENTS.md/
        900_local.md
```

Projette :

```text
AGENTS.md
CLAUDE.md
```

`AGENTS.md` est composé depuis les parties partagées plus les parties locales ultérieures. `CLAUDE.md` importe la feuille `AGENTS.md` d'abord, puis ajoute la queue spécifique à Claude. Utiliser ce pattern lorsque la génération élimine une vraie duplication ou permet des superpositions profils/locales ; garder les fichiers racine simples comme fichiers trackés normaux lorsque la composition n'aide pas.

Les fichiers `.harnessIgnore` source-locaux peuvent retirer des parties individuelles :

```text
.harness/dir/AGENTS.md/.harnessIgnore
200_rules.md
```

Les fichiers `.harnessIgnore` en sortie cible peuvent supprimer une sortie complète après que le chemin de sortie final est connu :

```text
notes/.harnessIgnore
release.md
```

## Profil à l'échelle du dépôt

Un `.harnessProfile` racine sélectionne un profil pour toute la projection. Lorsqu'un `.harnessProfileRoot` se trouve directement sous la source de ressources configurée, ses enfants superposent cette source de ressources.

```toml
[[resources]]
path = "./.harness/resources"

[[dir]]
path = "./.harness/dir"

[[targets]]
path = "./.agents"
```

```text
.harnessProfile          # contient : deploy

.harness/
  resources/
    skills/
      review/
        SKILL.md
    deploy/
      .harnessProfileRoot  # contient : deploy
      skills/
        deploy-plan/
          SKILL.md
```

Lorsque le profil `deploy` est actif, `deploy-plan` est projeté comme un skill. Le dossier `deploy` lui-même n'est pas projeté comme une ressource parce que c'est du stockage de superposition.

Utiliser cette forme lorsque la superposition appartient à un type de ressource.

## Kit de profil fourni par l'équipe

Un profil kit peut superposer `.harness` lui-même et contribuer plusieurs racines source logiques à la fois.

```toml
[[resources]]
path = "./.harness/resources"

[[dir]]
path = "./.harness/dir"

[[targets]]
path = "./.agents"
```

```text
.harnessProfile          # contient : deploy-kit

.harness/
  kits/
    deploy-kit/
      .harnessProfileRoot # contient : deploy-kit
      resources/
        skills/
          deploy-plan/
            SKILL.md
      dir/
        AGENTS.md/
          .harnessComposable
          100_deploy.md
```

Ce kit se superpose dans `.harness/resources/skills` et `.harness/dir`. Il peut ajouter un skill et ajouter une partie d'instruction spécifique au déploiement sans devenir un dossier `.agents/kits/deploy-kit/` projeté.

C'est le bon modèle pour les kits de déploiement, sécurité, frontend, backend ou onboarding fournis par l'entreprise. Le kit est de la source révisée. Le sélecteur décide où il est actif.

## Surfaces générées avec instructions d'activation

Les surfaces de harness générées peuvent être gitignored lorsque le dépôt garde un chemin d'activation tracké. Le manifeste et le catalogue source restent dans le contrôle de version ; les dossiers vivants peuvent être régénérés après checkout.

```toml
[[resources]]
path = "./.harness/resources"

[[targets]]
path = "./.agents"

[[targets]]
path = "./.claude"
```

```text
AGENTS.md                         # note d'activation pour humains et agents
package.json                      # script setup:harness optionnel
.gitignore
.harness/
  harness.toml
  resources/
    README.md
    skills/
      harness-config/
        SKILL.md
      review/
.agents/                          # généré, gitignored
.claude/                          # généré, gitignored
```

```gitignore
# Surfaces vivantes générées par Harness
.agents/
.claude/

# Superpositions Harness privées
.harness/local/
```

Les instructions d'activation devraient dire aux utilisateurs et agents de lancer `npx harnessc validate` et le dry-run d'activation avant d'appliquer. Ne pas gitignored les surfaces générées lorsqu'un nouveau checkout laisserait les utilisateurs avec des dossiers de harness vides et sans chemin d'activation clair. Ne pas gitignored tout `.harness/` ; garder le manifeste, les ressources partagées, les sources dir, `.harnessIgnore` et les déclarations `.harnessMutable` trackés pour que les surfaces vivantes restent reproductibles.

## Surcharge AGENTS.md personnelle

Les profils peuvent ajouter des parties d'instructions personnelles et retirer des parties de base par chemin source logique.

```text
.harnessProfile          # contient : my-profile

.harness/
  profiles/
    my-profile/
      .harnessProfileRoot # contient : my-profile
      dir/
        AGENTS.md/
          .harnessIgnore  # contient : 100_intro.md
          100_my_intro.md
```

Si `AGENTS.md` de base a `100_intro.md` et `300_rules.md`, le profil actif peut remplacer l'intro tout en gardant les règles partagées. Le `.harnessIgnore` profil-local est évalué contre le chemin logique `.harness/dir/AGENTS.md/100_intro.md`, pas le chemin de stockage physique sous `.harness/profiles/my-profile`.

Tracker `.harnessProfile` lorsque l'équipe devrait partager le même choix. Le gitignored lorsque chaque développeur devrait choisir son propre profil localement.

## Profils locaux aux cibles

Les fichiers `.harnessProfile` en sortie cible permettent à différents sous-arbres vivants de sélectionner différentes superpositions de profil.

```text
.agents/
  skills/
    .harnessProfile      # contient : deploy
  rules/
    .harnessProfile      # contient : no-rules
```

Le profil `deploy` s'applique sous `.agents/skills/`. Le profil `no-rules` s'applique sous `.agents/rules/`. Aucun sélecteur ne change `.claude/`, les sorties à la racine du dépôt ou les sous-arbres `.agents` frères.

Les fichiers `.harnessProfile` en sortie cible sont préservés pendant le nettoyage pour la même raison que les fichiers `.harnessIgnore` en sortie cible sont préservés : ce sont des contrôles de sous-arbre vivants, pas un payload projeté.

## Migration de dossiers d'agent manuels

Pour un dépôt existant, déplacer le contenu partagé durable dans `.harness` d'abord et garder les contrôles vivants locaux là où ils ont déjà du sens.

```text
# avant
.claude/skills/review/SKILL.md
.agents/skills/review/SKILL.md
.agents/skills/review/.harnessIgnore

# après
.harness/resources/skills/review/SKILL.md
.harness/resources/skills/review/.claude/SKILL.md
.agents/skills/review/.harnessIgnore
```

Le fichier d'ignore `.agents` peut rester dans la surface de harness vivante pour ne contrôler que ce sous-arbre de sortie. La source de skill durable se déplace vers `.harness`, et la différence `.claude` devient une surcharge dérivée de la cible à l'intérieur de la ressource.

## Recommandations de propriété

Garder les rôles source et cible séparés :

- Ne pas pointer une entrée `[[targets]]` vers un dossier qui reste la source durable.
- Déplacer le contenu rédigé partagé dans les sources de ressources configurées.
- Gitignored les surfaces de harness vivantes lorsque l'expérimentation locale ou l'état runtime compte plus que commiter la sortie générée.
- Garder l'état runtime ou produit hors de `.harness/` ; placer les caches produit et enregistrements d'activation dans des dossiers possédés par le produit et les ignorer.
- Utiliser les surcharges dérivées des cibles pour des différences de fichier exactes. Si une cible a besoin d'un skill très différent, préférer un élément de ressource séparé plutôt qu'un arbre de surcharge profond.
- Déclarer les fichiers possédés par le runtime dans `.harnessMutable` pour que la projection les initialise une fois puis les laisse tranquilles.
- Ne pas s'appuyer sur le fait que les liens symboliques source ou cible soient suivis. Les traiter comme des entrées feuilles et réviser toute action de remplacement ou de suppression avant l'activation.

Ces recommandations gardent l'activation unidirectionnelle : les racines source configurées produisent des sorties cibles, et les surfaces de harness vivantes ne deviennent jamais la prochaine source de vérité.

## Liste de vérification de nettoyage

Avant de lancer le nettoyage avec `--remove-unmanaged`, vérifier le plan :

- Les fichiers gérés devraient être `keep`, `create` ou `update`.
- Les fichiers possédés par le runtime déclarés dans `.harnessMutable` devraient être `mutable` après la première activation.
- Les fichiers non gérés ne devraient être supprimés que lorsque le plan montre explicitement `remove`.
- Les fichiers `.harnessIgnore` et `.harnessProfile` en sortie cible devraient rester préservés.
- Le nettoyage ne s'applique qu'aux cibles encore déclarées. Nettoyer une cible avant de retirer son entrée `[[targets]]`, ou utiliser un workflow d'état d'activation de niveau supérieur capable de réconcilier les cibles orphelines.

Le nettoyage est utile après la migration, mais il est volontairement explicite. Si un fichier a encore de la valeur, le déplacer dans `.harness`, le déclarer mutable ou le garder comme contrôle en sortie cible avant d'appliquer la suppression.

## Vérifications de sécurité

Utiliser ces vérifications avant de faire confiance à une implémentation de dépôt ou d'outil :

- `validate` devrait être en lecture seule et devrait rejeter les chemins en dehors du dépôt.
- Un premier dry run devrait expliquer chaque entrée `create`, `update`, `remove`, `keep`, `mutable` et non gérée préservée avant d'écrire.
- Une deuxième activation contre des entrées inchangées devrait converger vers `keep` pour les fichiers gérés et `mutable` pour les fichiers possédés par le runtime.
- Le nettoyage devrait préserver les entrées non gérées par défaut et les supprimer seulement lorsque la suppression est explicite.
- Les fichiers `.harnessIgnore` et `.harnessProfile` en sortie cible devraient être préservés même pendant le nettoyage des non gérés.
- Les fichiers mutables ne devraient jamais être écrasés sauf si l'utilisateur choisit explicitement une re-projection forcée.
- Les sorties dir qui remplaceraient ou contiendraient une racine de cible déclarée devraient être rejetées avant l'application.
