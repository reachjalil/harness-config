---
title: Extensiones
seoTitle: Extensiones .harness
socialTitle: Declaraciones de extension para la especificacion .harness
description: Como las extensiones declaradas agregan comportamiento registrado sin ampliar el esquema central.
socialDescription: Como las extensiones .harness agregan comportamiento opcional manteniendo pequeno el nucleo.
canonicalPath: /specifications/v1/extensions/
slug: extensions
order: 3
locale: es
sectionCode: "03"
summary: Como las extensiones declaradas agregan comportamiento registrado sin ampliar el esquema central de proyeccion.
llmSummary: Describe declaracion, version, activacion, descubrimiento y separacion de extensiones frente al modelo central .harness.
audience: Implementadores que agregan comportamiento opcional a herramientas compatibles con .harness.
contentKind: spec
status: draft
updated: 2026-05-26
---

# Extensiones

Las extensiones permiten que herramientas agreguen comportamiento registrado sin ampliar el esquema central de proyeccion de recursos y destinos.

## Declaracion

Las declaraciones viven bajo `[extensions.<id>]` en el manifiesto seleccionado.

```toml
[extensions.example]
version = 1
activation = "explicit"
```

El nucleo posee solo `version` y `activation`. Todos los demas campos pertenecen a la extension. Una extension desconocida puede aparecer en la configuracion, pero una extension seleccionada y no soportada debe fallar con un diagnostico claro.

## Limite con el nucleo

Una extension no debe redefinir la fuente de recursos, destinos, sobrescrituras, `.harnessIgnore`, archivos mutables ni el contrato de planificacion. `[dir]` es superficie del nucleo v1, no una extension.
