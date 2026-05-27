---
title: Patrones
seoTitle: Patrones y ejemplos de Harness config
socialTitle: Patrones practicos .harness para equipos y desarrolladores
description: Ejemplos concretos para ignores de salida, instrucciones componibles, perfiles, kits de equipo, personalizacion y limpieza segura.
socialDescription: Ejemplos .harness para combinar ignores, perfiles, composicion dir y limpieza de destinos.
canonicalPath: /specifications/v1/patterns/
slug: patterns
order: 7
locale: es
sectionCode: "07"
summary: Ejemplos concretos para combinar ignores, perfiles, composicion dir y limpieza segura.
llmSummary: Muestra patrones practicos de Harness config para ignores de salida, instrucciones componibles, perfiles, kits de equipo, personalizacion, perfiles locales a destino, migracion y limpieza.
audience: Desarrolladores y equipos plataforma que adoptan Harness config en repositorios reales.
contentKind: spec
status: draft
updated: 2026-05-26
---

# Patrones Harness config

Esta pagina muestra como combinar las piezas sin perder la regla principal: `.harness/` es la fuente canonica y las carpetas destino son salidas generadas con algunos controles locales protegidos.

## Ignore de salida para una superficie

Usa un `.harnessIgnore` dentro de una salida cuando la regla pertenece a una superficie de harness especifica.

```text
.agents/skills/deploy-plan/.harnessIgnore
*.tmp
```

Esto filtra archivos finales bajo `.agents/skills/deploy-plan/` sin afectar `.claude/skills/deploy-plan/`.

## Instrucciones componibles

Usa `[dir]` para archivos del repositorio como `AGENTS.md`. Una hoja con `.harnessComposable` concatena partes numeradas en una salida relativa al repositorio:

```text
.harness/dir/AGENTS.md/
  .harnessComposable
  100_intro.md
  200_rules.md
```

El mismo marcador bajo la fuente de recursos compone un archivo de recurso proyectado en cada destino, por ejemplo `skills/review/SKILL.md`; ese caso sigue siendo un recurso, no una salida `[dir]`.

## Perfil de repositorio

Un `.harnessProfile` en la raiz selecciona una capa para toda la proyeccion. Una `.harnessProfileRoot` bajo recursos puede agregar o sobrescribir recursos logicos sin proyectar la carpeta del perfil.

## Kit de equipo

Un kit puede contribuir skills, reglas e instrucciones compartidas desde `.harness/kits/<name>`. El kit es fuente revisada; el selector decide donde esta activo.

## Personalizacion local

Los perfiles pueden agregar partes personales y excluir partes base por ruta logica. Versiona `.harnessProfile` cuando el equipo debe compartir la misma eleccion; ignoralos cuando cada desarrollador elige localmente.
