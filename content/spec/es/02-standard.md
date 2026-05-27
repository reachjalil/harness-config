---
title: Especificacion
seoTitle: Especificacion .harness config
socialTitle: La especificacion de configuracion de repositorio .harness
description: Definiciones normativas para layout .harness, manifiesto TOML, activacion, sobrescrituras, ignores, perfiles y conformidad.
socialDescription: Definiciones normativas para recursos, destinos, sobrescrituras, ignores, perfiles, extensiones y activacion.
canonicalPath: /specifications/v1/standard/
slug: standard
order: 2
locale: es
sectionCode: "02"
summary: Definiciones normativas de terminos, forma de repositorio, TOML, proyeccion, sobrescrituras, ignores, perfiles, extensiones y conformidad.
llmSummary: Define la forma de repositorio .harness, contrato TOML, proyeccion de activacion, sobrescrituras derivadas, precedencia de ignores, perfiles, extensiones y limites de conformidad.
audience: Autores de herramientas, revisores del estandar e implementadores tecnicos.
contentKind: spec
status: draft
updated: 2026-05-27
---

# Especificacion Harness config

**Estado:** propuesta de especificacion Version 1. La forma de archivos, el
schema del manifiesto, el contrato de proyeccion y la gramatica de ignores
estan pensados para implementarse sin consultar el codigo de referencia, pero
el contrato publico sigue en revision. Hasta que haya releases publicas,
fixtures de conformidad, repositorios adoptantes y feedback externo suficiente,
los paquetes TypeScript deben tratarse como una implementacion de referencia
alpha. Una vez aceptada v1, los cambios que invalidarian un repositorio v1 o
una implementacion v1 quedan reservados para v2.

Las versiones de especificacion son versiones completas. Las versiones patch,
minor, prerelease y package pertenecen a la CLI, al tooling, a las extensiones y
a las implementaciones, no al espacio de URL de la especificacion ni al campo
`version` del manifiesto.

Un harness es el runtime de agente o herramienta para desarrolladores que consume instrucciones, contexto, herramientas y configuracion del repositorio. Una superficie de harness es el conjunto de archivos o carpetas repo-locales que ese harness lee, por ejemplo `AGENTS.md`, `.agents`, `.claude` o `.cursor`.

Un repositorio conforme contiene un manifiesto seleccionado, por defecto `./.harness/harness.toml`, una fuente de recursos configurada, destinos explicitos, un posible `.harnessIgnore` en la raiz y una fuente `[dir]` opcional para salidas compuestas o copiadas.

## Forma del repositorio

```text
.harness/
  harness.toml
  resources/
    skills/
      review/
        SKILL.md
        .claude/
          SKILL.md
.harnessIgnore
.agents/
  skills/
    review/
      .harnessIgnore
```

Los recursos viven bajo la fuente `[resources]` configurada. Tipos como `skills`, `rules` o `plugins` son carpetas, no tablas TOML por tipo. Las superficies de harness solo son salidas cuando aparecen en `[[targets]]`.

Una carpeta de recurso tambien puede contener el marcador vacio `.harnessComposable`. En ese caso compone un unico archivo de recurso proyectado en cada destino declarado, por ejemplo `skills/review/SKILL.md`. La hoja sigue siendo un recurso: participa en sobrescrituras de destino, perfiles y reglas `.harnessIgnore` de recursos.

## Destinos

Cada destino es una ruta relativa al repositorio y solo contiene `path`.

```toml
[[targets]]
path = "./.agents"

[[targets]]
path = "./.claude"
```

El primer segmento de la ruta selecciona la sobrescritura correspondiente dentro de cada recurso. Un destino `./.claude` selecciona carpetas `.claude`.

## `[dir]` y `.harnessComposable`

`[dir]` declara una fuente repo-local, por defecto `./.harness/dir`. Dentro de `[dir]`, una carpeta con el marcador vacio `.harnessComposable` es una hoja componible de dir: sus partes numeradas se concatenan para producir un archivo de salida relativo al repositorio. A diferencia de recursos, `[dir]` no se proyecta como arbol de recursos en cada destino; sirve para salidas repo-relativas como `AGENTS.md`, `CLAUDE.md` o archivos propios de un destino.

## `.harnessIgnore`

`.harnessIgnore` define que no cruza la frontera de proyeccion. Puede vivir en la raiz, en fuentes declaradas o dentro de salidas de destino existentes. Los archivos `.harnessIgnore` ya presentes en una salida se preservan: la proyeccion no los copia, sobrescribe ni elimina durante limpieza.

Las reglas se evalúan desde archivos menos profundos hacia mas profundos. La ultima regla participante gana. Las secciones objetivo como `[.claude]` no son validas; las reglas especificas de un destino deben vivir en un `.harnessIgnore` dentro de esa salida.

## Activacion

La activacion calcula la proyeccion desde recursos, sobrescrituras, perfiles, ignores, `[dir]`, politica de limpieza y politica mutable. El mismo conjunto de entradas debe producir el mismo arbol destino.

## Symlinks

Harness config v1 trata los symlinks como entradas hoja y no los sigue al descubrir fuentes, destinos, ignores, perfiles o salidas `[dir]`. Si un symlink ocupa un camino que la activacion debe escribir, la activacion puede reemplazar el enlace mismo segun las mismas reglas de conflicto usadas para otros archivos o entradas que no son directorios.
