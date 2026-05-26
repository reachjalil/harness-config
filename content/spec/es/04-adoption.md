---
title: Adopcion
seoTitle: Adoptar .harness config
socialTitle: Como adoptar .harness en un repositorio
description: Flujos practicos para greenfield, migracion, perfiles, instrucciones componibles y limpieza segura.
socialDescription: Ruta practica para mover configuracion de agentes a un catalogo .harness durable.
canonicalPath: /specifications/v1/adoption/
slug: adoption
order: 4
locale: es
sectionCode: "04"
summary: Flujos practicos para greenfield, migracion, perfiles, instrucciones componibles y limpieza.
llmSummary: Cubre workflows para crear un catalogo .harness, declarar destinos, previsualizar activacion, migrar carpetas runtime, usar perfiles y mantener limpieza segura.
audience: Desarrolladores que introducen .harness en repositorios nuevos o existentes.
contentKind: spec
status: draft
updated: 2026-05-26
---

# Adopcion

Este guia cubre dos caminos: greenfield, sin carpetas runtime existentes, y migracion, cuando un repositorio ya contiene `.claude/`, `.cursor/`, `.agents/` u otra carpeta similar.

## Greenfield

1. Crea `./.harness/harness.toml` con `version = 1`.
2. Agrega recursos bajo `.harness/resources` o la fuente configurada.
3. Declara cada destino en `[[targets]]`.
4. Usa `.harnessIgnore` para excluir artefactos source-only y `[mutable]` para archivos propiedad del runtime.
5. Ejecuta un dry run antes de escribir.

```bash
npx harnessc init
npx harnessc validate
npx harnessc activate
npx harnessc activate --yes
```

## Migrar un repositorio existente

Primero conserva una fotografia de las carpetas runtime actuales. Luego mueve el contenido durable a la fuente de recursos, coloca diferencias por destino en carpetas como `.claude`, declara los destinos en el manifiesto y revisa el plan antes de aplicar.

Un segundo dry run sin cambios debe converger hacia `keep` para archivos gestionados y `mutable` para archivos propiedad del runtime.

## Errores comunes

- Tratar una carpeta viva como fuente y destino.
- Olvidar declarar un destino.
- Colocar caches o estado de producto bajo `.harness/`.
- Usar sobrescrituras para bifurcar recursos completos.
- Versionar archivos locales del runtime como si fueran fuente durable.
