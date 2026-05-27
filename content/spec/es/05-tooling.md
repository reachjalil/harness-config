---
title: Herramientas
seoTitle: Herramientas .harness
socialTitle: Herramientas para validar y activar .harness config
description: Implementacion npx harnessc, validacion, planificacion, activacion y comandos de limpieza.
socialDescription: Capa de comandos para validar repositorios .harness y aplicar proyecciones.
canonicalPath: /specifications/v1/tooling/
slug: tooling
order: 5
locale: es
sectionCode: "05"
summary: "Implementacion npx harnessc: validacion, planificacion, activacion y limpieza."
llmSummary: Describe expectativas de herramientas para validacion, perfiles, dry-run, activacion, diagnosticos, limpieza y helpers alrededor de .harness.
audience: Autores de CLI y desarrolladores que operan repositorios .harness.
contentKind: spec
status: draft
updated: 2026-05-26
---

# Herramientas

`npx harnessc` es la implementacion estandar para validar, planificar y activar Harness config.

## Comandos

```bash
npx harnessc plan
npx harnessc init
npx harnessc validate
npx harnessc activate
npx harnessc extension activate
```

`npx harnessc activate` es dry-run por defecto. Muestra creaciones, actualizaciones, archivos mutables omitidos, eliminaciones solicitadas, archivos sin cambios y entradas no gestionadas preservadas antes de escribir.

El manifiesto por defecto es `./.harness/harness.toml`. `--config <path>` selecciona otro TOML repo-local.

## `[[dir]]`

Cuando `[[dir]]` esta declarado, las hojas `.harnessComposable` dentro de esas fuentes componen partes numeradas en salidas relativas al repositorio, y el resto de archivos se copia hacia rutas relativas al repositorio. Los `.harnessIgnore` de fuente filtran la recoleccion y los `.harnessIgnore` de salida filtran resultados finales.

El mismo marcador `.harnessComposable` puede usarse bajo una fuente de recursos configurada. Alli compone un archivo de recurso proyectado en cada destino declarado; no es una salida repo-relativa de `[[dir]]`.

## Helpers TypeScript

Las herramientas pueden usar `@harnessconfig/core` para parsear TOML, cargar reglas `.harnessIgnore`, validar un repositorio, calcular un plan y aplicar una activacion.
