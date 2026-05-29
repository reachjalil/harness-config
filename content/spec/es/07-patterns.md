---
title: Patrones
seoTitle: Patrones y ejemplos de Harness config
socialTitle: Patrones prácticos de Harness config para equipos y desarrolladores
description: Ejemplos concretos para archivos mutables propiedad del runtime, ignores de salida objetivo, instrucciones componibles, superposiciones de perfil, kits de equipo, personalización y limpieza segura.
socialDescription: Ejemplos prácticos de Harness config para combinar estado runtime mutable, ignores, perfiles, composición dir y limpieza de objetivos de manera segura.
canonicalPath: /specifications/v1/patterns/
slug: patterns
order: 7
locale: es
sectionCode: "07"
summary: Ejemplos concretos para combinar archivos mutables propiedad del runtime, ignores, perfiles, composición dir y limpieza segura.
llmSummary: Muestra patrones prácticos de Harness config para archivos mutables propiedad del runtime, ignores de salida objetivo, instrucciones componibles, superposiciones de perfil, kits de equipo, personalización, perfiles locales al objetivo, migración y limpieza.
audience: Desarrolladores y equipos de plataforma que adoptan Harness config en repositorios reales.
contentKind: spec
status: draft
updated: 2026-05-28
---

# Patrones Harness config

Esta página muestra cómo combinar las piezas del estándar sin perder la regla de propiedad principal: `.harness/` es fuente canónica, y las carpetas objetivo vivas son salidas generadas con algunos controles locales protegidos.

Comenzar con un manifiesto explícito en `./.harness/harness.toml`:

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

El manifiesto nombra las raíces fuente y los objetivos. El sistema de archivos muestra dónde vive la fuente revisada y qué superficies de harness vivas puede generar la activación.

## Grupos de recursos

Para la mayoría de las migraciones, comenzar con una raíz `.harness/resources` compartida y agrupar dentro de ella por el camino objetivo que debe ser generado. Esto mantiene el catálogo fuente fácil de inspeccionar y evita inventar raíces fuente separadas antes de que el repositorio las necesite.

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

Los archivos de raíz objetivo pertenecen a su camino de raíz objetivo dentro de la raíz de recursos: por ejemplo `.claude/settings.json` se convierte en `.harness/resources/.claude/settings.json`. Si ese archivo es propiedad del runtime después de la primera semilla, añadir `.harness/resources/.claude/.harnessMutable` con `settings.json` en él.

Las raíces de recursos adicionales son útiles cuando representan un límite real: catálogos de preocupación independientemente opcionales, límites de propiedad, especializaciones seleccionadas por perfil o superposiciones locales privadas. Por ejemplo, las preocupaciones de testing, despliegue y UI pueden vivir en raíces separadas cuando un equipo intencionalmente las combina mediante orden de manifiesto, superposiciones de perfil o instrucciones dir específicas de perfil. La capa local es útil para skills, plugins, agentes, prompts y experimentos personales antes de la promoción a fuente rastreada.

## Ignore de salida objetivo para una superficie viva

Usar un `.harnessIgnore` de salida objetivo cuando la regla pertenece a un subárbol de salida vivo, no a la fuente canónica.

```text
.agents/skills/deploy-plan/.harnessIgnore
*.tmp
```

Esto excluye los caminos de salida finales bajo `.agents/skills/deploy-plan/`:

```text
.agents/skills/deploy-plan/scratch.tmp
.agents/skills/deploy-plan/logs/run.tmp
```

No afecta:

```text
.claude/skills/deploy-plan/scratch.tmp
```

Los ignores de salida objetivo coinciden con caminos de salida, no caminos fuente. También participan solo después de que el archivo `.harnessIgnore` existe en disco. Poner las reglas en el `.harnessIgnore` raíz o un `.harnessIgnore` fuente-local cuando la regla debe aplicarse en la primera activación.

Este patrón es intencionalmente local al objetivo. Es más útil para superficies de harness vivas gitignored, experimentos de desarrollo local o archivos runtime específicos de máquina que no deberían convertirse en fuente compartida. El archivo se preserva y se lee desde la salida objetivo, pero no se copia allí por la proyección.

## Re-inclusiones de ignore lógicas

Usar reglas superficiales para límites amplios y reglas lógicas más profundas para excepciones seleccionadas. Los archivos de ignore perfil-locales se evalúan en la ubicación de superposición lógica de la raíz de perfil, no en la carpeta de perfil física.

```toml
[[resources]]
path = "./.harness/resources-tooling"

[[targets]]
path = "./.agents"
```

```text
.harnessIgnore
.harnessProfile                  # contiene: cloudflare-react
.harness/
  resources-tooling/
    skills/
      vite-worker-imports-config-skill/SKILL.md
      codex-agent-management/SKILL.md
    cloudflare-react/
      .harnessProfileRoot         # contiene: cloudflare-react
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

Con `cloudflare-react` activo, solo `vite-worker-imports-config-skill` cruza el límite de proyección. `codex-agent-management` permanece ignorado porque el archivo perfil-local participa en `.harness/resources-tooling/` y su re-inclusión descendiente solo nombra el skill de Vite worker.

## Archivos mutables propiedad del runtime

Usar `.harnessMutable` cuando el repositorio debe inicializar un archivo una vez y el runtime debe poseerlo después.

```text
.harnessMutable
.harness/resources/**/settings.local.json
```

```text
.harness/resources/skills/review/settings.local.json
.agents/skills/review/settings.local.json
.claude/skills/review/settings.local.json
```

En la primera activación, la plantilla fuente crea el archivo objetivo. Después de eso, la activación reporta el objetivo como `mutable` y deja sus bytes en paz, incluso si el runtime los ha cambiado. Esta es la forma correcta para otorgamientos de permisos, configuración local, comandos aprendidos y otro estado que debe ser visible en el plan sin convertirse en fuente canónica.

Usar reglas de ignore para archivos que nunca deberían cruzar el límite de proyección. Usar `.harnessMutable` para archivos que deberían cruzar una vez como plantilla y luego pertenecer a la superficie de harness viva.

## Instrucciones componibles

Usar fuentes `[[dir]]` para archivos persistentes de raíz del repositorio y archivos propiedad del objetivo que no son elementos de recursos. Una hoja componible es un directorio con un marcador `.harnessComposable` vacío. Sus partes numeradas se concatenan en un archivo de salida. Cuando el mismo marcador se usa bajo una fuente de recursos configurada, compone un archivo de recurso proyectado dentro de cada objetivo en lugar de una salida dir de raíz del repositorio o propiedad del objetivo.

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

Proyecta:

```text
AGENTS.md
CLAUDE.md
```

`AGENTS.md` se compone de partes compartidas más cualquier parte local posterior. `CLAUDE.md` importa la hoja `AGENTS.md` primero, luego añade la cola específica de Claude. Usar este patrón cuando la generación elimina duplicación real o habilita superposiciones de perfil/locales; mantener los archivos raíz simples como archivos rastreados normales cuando la composición no ayuda.

Los archivos `.harnessIgnore` fuente-locales pueden eliminar partes individuales:

```text
.harness/dir/AGENTS.md/.harnessIgnore
200_rules.md
```

Los archivos `.harnessIgnore` de salida objetivo pueden suprimir una salida completa después de que el camino de salida final se conoce:

```text
notes/.harnessIgnore
release.md
```

## Perfil a nivel de repositorio

Un `.harnessProfile` de raíz del repositorio selecciona un perfil para toda la proyección. Cuando un `.harnessProfileRoot` se encuentra directamente bajo la fuente de recursos configurada, sus hijos superponen esa fuente de recursos.

```toml
[[resources]]
path = "./.harness/resources"

[[dir]]
path = "./.harness/dir"

[[targets]]
path = "./.agents"
```

```text
.harnessProfile          # contiene: deploy

.harness/
  resources/
    skills/
      review/
        SKILL.md
    deploy/
      .harnessProfileRoot  # contiene: deploy
      skills/
        deploy-plan/
          SKILL.md
```

Cuando el perfil `deploy` está activo, `deploy-plan` se proyecta como un skill. La carpeta `deploy` misma no se proyecta como un recurso porque es almacenamiento de superposición.

Usar esta forma cuando la superposición pertenece a un tipo de recurso.

## Kit de perfil proporcionado por el equipo

Un perfil kit puede superponer `.harness` mismo y contribuir varias raíces fuente lógicas a la vez.

```toml
[[resources]]
path = "./.harness/resources"

[[dir]]
path = "./.harness/dir"

[[targets]]
path = "./.agents"
```

```text
.harnessProfile          # contiene: deploy-kit

.harness/
  kits/
    deploy-kit/
      .harnessProfileRoot # contiene: deploy-kit
      resources/
        skills/
          deploy-plan/
            SKILL.md
      dir/
        AGENTS.md/
          .harnessComposable
          100_deploy.md
```

Este kit se superpone en `.harness/resources/skills` y `.harness/dir`. Puede añadir un skill y añadir una parte de instrucción específica de despliegue sin convertirse en una carpeta `.agents/kits/deploy-kit/` proyectada.

Este es el modelo correcto para kits de despliegue, seguridad, frontend, backend o onboarding proporcionados por la empresa. El kit es fuente revisada. El selector decide dónde está activo.

## Superficies generadas con instrucciones de activación

Las superficies de harness generadas pueden gitignored cuando el repositorio mantiene un camino de activación rastreado. El manifiesto y el catálogo fuente permanecen en control de versión; las carpetas vivas pueden ser regeneradas después del checkout.

```toml
[[resources]]
path = "./.harness/resources"

[[targets]]
path = "./.agents"

[[targets]]
path = "./.claude"
```

```text
AGENTS.md                         # nota de activación para humanos y agentes
package.json                      # script setup:harness opcional
.gitignore
.harness/
  harness.toml
  resources/
    README.md
    skills/
      harness-config/
        SKILL.md
      review/
.agents/                          # generado, gitignored
.claude/                          # generado, gitignored
```

```gitignore
# Superficies vivas generadas por Harness
.agents/
.claude/

# Superposiciones Harness privadas
.harness/local/
```

Las instrucciones de activación deben decir a usuarios y agentes ejecutar `npx harnessc validate` y dry-run la activación antes de aplicar. No gitignored superficies generadas cuando un nuevo checkout dejaría a los usuarios con carpetas de harness vacías y sin camino claro de activación. No gitignored todo `.harness/`; mantener el manifiesto, recursos compartidos, fuentes dir, `.harnessIgnore` y declaraciones `.harnessMutable` rastreadas para que las superficies vivas permanezcan reproducibles.

## Sobrescritura personal de AGENTS.md

Los perfiles pueden añadir partes de instrucciones personales y eliminar partes base por camino fuente lógico.

```text
.harnessProfile          # contiene: my-profile

.harness/
  profiles/
    my-profile/
      .harnessProfileRoot # contiene: my-profile
      dir/
        AGENTS.md/
          .harnessIgnore  # contiene: 100_intro.md
          100_my_intro.md
```

Si `AGENTS.md` base tiene `100_intro.md` y `300_rules.md`, el perfil activo puede reemplazar el intro mientras mantiene las reglas compartidas. El `.harnessIgnore` perfil-local se evalúa contra el camino lógico `.harness/dir/AGENTS.md/100_intro.md`, no contra el camino de almacenamiento físico bajo `.harness/profiles/my-profile`.

Rastrear `.harnessProfile` cuando el equipo debe compartir la misma elección. Gitignorearlo cuando cada desarrollador debe elegir su propio perfil localmente.

## Perfiles locales al objetivo

Los archivos `.harnessProfile` de salida objetivo permiten que diferentes subárboles vivos seleccionen diferentes superposiciones de perfil.

```text
.agents/
  skills/
    .harnessProfile      # contiene: deploy
  rules/
    .harnessProfile      # contiene: no-rules
```

El perfil `deploy` se aplica bajo `.agents/skills/`. El perfil `no-rules` se aplica bajo `.agents/rules/`. Ningún selector cambia `.claude/`, las salidas de raíz del repositorio o los subárboles `.agents` hermanos.

Los archivos `.harnessProfile` de salida objetivo se preservan durante la limpieza por la misma razón que los archivos `.harnessIgnore` de salida objetivo se preservan: son controles de subárbol vivos, no payload proyectado.

## Migrar carpetas de agente manuales

Para un repositorio existente, mover primero el contenido compartido persistente a `.harness` y mantener los controles vivos locales donde ya tienen sentido.

```text
# antes
.claude/skills/review/SKILL.md
.agents/skills/review/SKILL.md
.agents/skills/review/.harnessIgnore

# después
.harness/resources/skills/review/SKILL.md
.harness/resources/skills/review/.claude/SKILL.md
.agents/skills/review/.harnessIgnore
```

El archivo de ignore `.agents` puede permanecer en la superficie de harness viva para controlar solo ese subárbol de salida. La fuente persistente del skill se mueve a `.harness`, y la diferencia `.claude` se convierte en un override derivado del objetivo dentro del recurso.

## Recomendaciones de propiedad

Mantener los roles de fuente y objetivo separados:

- No apuntar una entrada `[[targets]]` a una carpeta que permanezca como la fuente persistente.
- Mover el contenido autoreado compartido a fuentes de recursos configuradas.
- Gitignored las superficies de harness vivas cuando la experimentación local o el estado runtime importan más que commitear la salida generada.
- Mantener el estado runtime o de producto fuera de `.harness/`; poner los cachés de producto y registros de activación en carpetas propiedad de producto e ignorarlos.
- Usar overrides derivados del objetivo para diferencias exactas de archivo. Si un objetivo necesita un skill muy diferente, preferir un elemento de recurso separado sobre un árbol de override profundo.
- Declarar archivos propiedad del runtime en `.harnessMutable` para que la proyección los inicialice una vez y luego los deje en paz.
- No depender de que los enlaces simbólicos fuente o objetivo sean seguidos. Tratarlos como entradas hoja y revisar cualquier acción de reemplazo o eliminación antes de la activación.

Estas recomendaciones mantienen la activación unidireccional: las raíces fuente configuradas producen salidas objetivo, y las superficies de harness vivas nunca se convierten en la próxima fuente de verdad.

## Lista de verificación de limpieza

Antes de ejecutar la limpieza con `--remove-unmanaged`, verificar el plan:

- Los archivos gestionados deberían ser `keep`, `create` o `update`.
- Los archivos propiedad del runtime declarados en `.harnessMutable` deberían ser `mutable` después de la primera activación.
- Los archivos no gestionados solo deberían ser eliminados cuando el plan muestra explícitamente `remove`.
- Los archivos `.harnessIgnore` y `.harnessProfile` de salida objetivo deberían permanecer preservados.
- La limpieza solo se aplica a objetivos aún declarados. Limpiar un objetivo antes de eliminar su entrada `[[targets]]`, o usar un flujo de estado de activación de nivel superior que pueda reconciliar objetivos huérfanos.

La limpieza es útil después de la migración, pero es intencionalmente explícita. Si un archivo aún tiene valor, moverlo a `.harness`, declararlo mutable o mantenerlo como un control de salida objetivo antes de aplicar la eliminación.

## Verificaciones de seguridad

Usar estas verificaciones antes de confiar en una implementación de repositorio o herramienta:

- `validate` debería ser de solo lectura y debería rechazar caminos fuera del repositorio.
- Una primera dry run debería explicar cada entrada `create`, `update`, `remove`, `keep`, `mutable` y no gestionada preservada antes de escribir.
- Una segunda activación contra entradas sin cambios debería converger a `keep` para archivos gestionados y `mutable` para archivos propiedad del runtime.
- La limpieza debería preservar las entradas no gestionadas por defecto y eliminarlas solo cuando la eliminación es explícita.
- Los archivos `.harnessIgnore` y `.harnessProfile` de salida objetivo deberían ser preservados incluso durante la limpieza de no gestionados.
- Los archivos mutables nunca deberían ser sobrescritos a menos que el usuario elija explícitamente una reproyección forzada.
- Las salidas dir que reemplazarían o contendrían una raíz de objetivo declarada deberían ser rechazadas antes de aplicar.
