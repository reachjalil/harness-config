---
title: Conformidad
seoTitle: Conformidad .harness
socialTitle: Claims de conformidad testables para herramientas .harness
description: Claims testables para repositorios, recursos, destinos, perfiles, proyecciones y herramientas.
socialDescription: Criterios de conformidad para repositorios y herramientas que implementan la especificacion .harness.
canonicalPath: /specifications/v1/conformance/
slug: conformance
order: 6
locale: es
sectionCode: "06"
summary: Claims testables para repositorios, recursos, destinos, perfiles, proyecciones y herramientas.
llmSummary: Lista expectativas de conformidad para forma del repositorio, rutas, proyeccion, sobrescrituras, ignores, perfiles, extensiones y salida de activacion.
audience: Autores de pruebas e implementadores que validan compatibilidad .harness.
contentKind: spec
status: draft
updated: 2026-05-26
---

# Conformidad

Un claim de soporte Harness config debe ser testable desde la forma de archivos y el contrato de activacion.

## Niveles

- Conformidad de repositorio: el manifiesto declara `version = 1`, fuentes repo-locales y destinos repo-locales.
- Conformidad de recurso: un recurso vive bajo la fuente configurada, puede ser archivo, carpeta u hoja `.harnessComposable`, y las sobrescrituras son carpetas dentro del recurso.
- Conformidad de destino: cada `[[targets]]` contiene solo una ruta repo-local y no apunta hacia `.harness`.
- Conformidad `[dir]`: `[dir]` compone sus hojas `.harnessComposable` y copia otros archivos hacia salidas relativas al repositorio, separadas de los recursos proyectados.
- Conformidad de proyeccion: activacion aplica `.harnessIgnore`, incluyendo raiz, fuente, salida y `[mutable]`.
- Conformidad de herramienta: la herramienta informa el plan antes de escribir y nunca trata una superficie de harness como fuente de verdad.

## Requisitos clave

Las implementaciones deben preservar los `.harnessIgnore` existentes dentro de salidas destino. No deben proyectarlos desde la fuente, sobrescribirlos ni eliminarlos durante limpieza.
