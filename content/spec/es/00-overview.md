---
title: Vision general
seoTitle: Vision general de .harness config
socialTitle: Una capa fuente neutral para configuracion de harness de agentes
description: Un layout fuente y un modelo de activacion para configuracion de agentes avanzada, predecible y portable.
socialDescription: Vision general de .harness, activacion dry-run, limites de proyeccion, perfiles, controles locales y destinos explicitos.
canonicalPath: /specifications/v1/
slug: overview
order: 0
locale: es
sectionCode: "00"
summary: Layout fuente, modelo de activacion, controles de proyeccion, perfiles y beneficios operativos.
llmSummary: Presenta .harness como catalogo fuente del repositorio para configuracion de agentes con activacion dry-run, instrucciones componibles, perfiles y proyecciones runtime explicitas.
audience: Lectores tecnicos e implementadores que evaluan configuracion agentica local al repositorio.
contentKind: spec
status: draft
updated: 2026-05-26
---

# Una capa fuente neutral para superficies de harness

Los harnesses exponen archivos y carpetas vivas como `AGENTS.md`, `.agents`, `.claude`, `.gemini` y `.cursor`. Esas superficies de harness son utiles, pero no son una buena fuente de verdad cuando varias herramientas necesitan las mismas skills, reglas, plugins e instrucciones.

Harness config mantiene los recursos reutilizables en fuentes configuradas, por convencion bajo `.harness`, declara cada salida de superficie de harness como un destino explicito y materializa cada destino mediante una proyeccion de copia revisable antes de escribir.

## Por que importa la activacion

La activacion convierte carpetas vivas dispersas en un paso repetible: leer el catalogo fuente, aplicar perfiles y diferencias por destino, filtrar el limite, previsualizar el plan y escribir archivos ordinarios solo despues de la revision.

Esa frontera permite que CI valide el mismo manifiesto que usa un desarrollador localmente. Los editores pueden mostrar que recibira cada harness. Las herramientas de revision pueden explicar que archivos se crean, actualizan, preservan o quedan mutables.

## Forma predecible

El estandar soporta configuracion avanzada sin hacer opaca la activacion. Los perfiles seleccionan capas de configuracion. `[dir]` compone instrucciones compartidas desde partes revisadas. Los archivos `.harnessIgnore` y `.harnessProfile` en una salida de superficie de harness conservan controles locales sin convertirlos en fuente canonica.

## Que define

- El manifiesto seleccionado, por defecto `./.harness/harness.toml`, declara version, fuente de recursos, fuente `[dir]` opcional y `[[targets]]`.
- Los recursos viven bajo la fuente configurada, por defecto `.harness/resources`. Una hoja `.harnessComposable` en la fuente de recursos compone un archivo de recurso proyectado para cada destino declarado.
- Las sobrescrituras derivadas del destino, como `.claude` o `.agents`, viven dentro de un recurso y solo se fusionan para el destino correspondiente.
- `.harnessIgnore` define el limite de proyeccion.
- `[dir]` esta separado de recursos; compone hojas `.harnessComposable` en salidas relativas al repositorio o copia archivos a rutas relativas al repositorio.
- La activacion informa el plan calculado antes de escribir.

## Propuesta abierta

Harness config se desarrolla como una propuesta de especificacion abierta. La retroalimentacion de repositorios reales, autores de runtimes y creadores de herramientas es especialmente util mientras el limite sigue siendo pequeno y facil de razonar.

Usa el repositorio [`reachjalil/harness-config`](https://github.com/reachjalil/harness-config) para preguntas, issues, notas de compatibilidad, ejemplos y pull requests.
