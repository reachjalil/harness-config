---
title: Extensiones
seoTitle: Extensiones Harness config
socialTitle: Declaraciones de extensión para la especificación Harness config
description: Cómo las extensiones declaradas añaden comportamiento registrado sin ampliar el esquema central de proyección de recursos.
socialDescription: Cómo las extensiones de Harness config declaran comportamiento opcional manteniendo pequeño el esquema central de proyección.
canonicalPath: /specifications/v1/extensions/
slug: extensions
order: 3
locale: es
sectionCode: "03"
summary: Cómo las extensiones declaradas añaden comportamiento registrado sin ampliar el esquema central de proyección de recursos.
llmSummary: Describe cómo las extensiones son declaradas, versionadas, activadas, descubiertas y mantenidas separadas del modelo central de proyección Harness config.
audience: Implementadores que añaden comportamiento opcional a herramientas compatibles con Harness config.
contentKind: spec
status: draft
updated: 2026-05-26
---

# Extensiones

Las extensiones permiten a las herramientas añadir comportamiento registrado sin ampliar el esquema central de proyección de recursos y objetivos. El estándar base define cómo se descubren las declaraciones de extensión y cuándo una implementación puede ejecutarlas; cada extensión posee su propio esquema, compatibilidad, diagnósticos, planificación y escrituras.

## Declaración

Las declaraciones de extensión viven en el nivel superior del manifiesto seleccionado (por defecto `./.harness/harness.toml`), bajo `[extensions.<id>]`.

```toml
[extensions.example]
version = 1
activation = "explicit"
```

El núcleo posee solo dos campos:

- `version`: un entero positivo requerido para el esquema de configuración propio de la extensión.
- `activation`: opcional; `"explicit"` por defecto, o `"auto"` cuando la extensión puede ejecutarse en los flujos de activación rutinarios ofrecidos por una herramienta.

Cada otro campo pertenece a la implementación de la extensión. Las declaraciones de extensión desconocidas deberían validarse como forma del repositorio, pero el comportamiento no soportado seleccionado debe fallar claramente en lugar de ser aplicado en silencio.

## Límite con el núcleo

Una extensión puede añadir comportamiento, pero no debe redefinir las fuentes de recursos, los mappings de objetivos, los overrides derivados del objetivo, la semántica de `.harnessIgnore`, la semántica de `.harnessMutable`, la semántica de superposición de `.harnessProfile`, el comportamiento de archivos mutables, la limpieza de no gestionados o el contrato del plan de activación.

Las fuentes `[[dir]]` configuradas son parte de la activación v1 del núcleo, no una extensión. Están documentadas en las páginas de Estándar y Herramientas porque sus salidas interactúan directamente con los objetivos declarados, la limpieza y los archivos `.harnessIgnore` locales a la salida objetivo.

## Expectativas de implementación

- Resolver las extensiones seleccionadas mediante un registro soportado por la implementación.
- Validar los campos propios de la extensión antes de planificar escrituras.
- Mantener las escrituras de la extensión locales al repositorio.
- Ejecutar primero en dry-run y mostrar acciones create, update, keep, remove o preserve antes de aplicar.
- Rechazar las extensiones seleccionadas desconocidas, no declaradas, no soportadas, incompatibles o con versión no soportada con diagnósticos claros.
