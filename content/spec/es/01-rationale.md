---
title: Justificacion
seoTitle: Justificacion de .harness config
socialTitle: Por que .harness separa fuentes y superficies de harness
description: Por que la especificacion separa un catalogo fuente durable de superficies de harness vivas.
socialDescription: La razon de tratar superficies de harness como proyecciones generadas en lugar de fuente canonica.
canonicalPath: /specifications/v1/rationale/
slug: rationale
order: 1
locale: es
sectionCode: "01"
summary: Por que el estandar separa un catalogo fuente durable de superficies de harness vivas.
llmSummary: Explica por que las superficies de harness deben ser salidas derivadas mientras .harness sigue siendo la fuente revisable.
audience: Implementadores que organizan configuracion multi-runtime de agentes.
contentKind: spec
status: draft
updated: 2026-05-26
---

# Justificacion

Los harnesses necesitan superficies vivas en el repositorio. Los equipos necesitan una fuente estable y revisable para los recursos que esos harnesses consumen. Harness config separa esas responsabilidades sin imponer un modelo de producto.

El catalogo fuente vive bajo raices configuradas, con `./.harness` como convencion por defecto. Superficies de harness como `./.agents`, `./.claude` o `./.cursor` siguen siendo archivos y carpetas activos que leen sus harnesses. La activacion proyecta la vista revisada del catalogo hacia esas superficies.

## Problemas resueltos

- Las copias casi iguales en varias superficies de harness se desincronizan facilmente.
- Los archivos escritos por un harness son dificiles de revisar como fuente durable.
- Desactivar un recurso para un agente se convierte en regla de proyeccion, no en borrado manual.
- `AGENTS.md`, `CLAUDE.md` y otras instrucciones pueden componerse desde fuentes `[[dir]]` revisables.
- Un nuevo agente puede consumir el mismo catalogo cuando se declara su destino.

## Conceptos Del Nucleo

- Manifiesto seleccionado: TOML repo-local, por defecto `./.harness/harness.toml`, que declara version, fuentes configuradas, destinos explicitos, `[[dir]]` y extensiones.
- Catalogo fuente: recursos durables bajo fuentes `[[resources]]` configuradas y salidas repo-relativas bajo fuentes `[[dir]]` configuradas.
- Destino declarado: superficie de harness como `./.agents` o `./.claude` que recibe proyeccion solo cuando esta en el manifiesto.
- Sobrescritura derivada del destino: carpeta como `.claude` dentro de un recurso para ajustar archivos del destino correspondiente.
- Perfil: overlay seleccionado por `.harnessProfile` y declarado con `.harnessProfileRoot`, fusionado por ruta fuente logica sin proyectar el directorio de perfil.
- Limite de proyeccion: `.harnessIgnore`, incluyendo reglas de raiz, fuente-locales, profile-locales, target-output-locales y `[mutable]`.
- Proyeccion de activacion: plan dry-run-first con acciones `create`, `update`, `remove`, `keep`, `preserve` y `mutable`, mas politicas explicitas de limpieza y archivos mutables.

## No objetivos

`[[dir]]` es parte del nucleo v1, no una extension: sus salidas participan en la proyeccion, la limpieza y las reglas target-output. Las extensiones quedan para comportamiento registrado que no redefine fuentes, destinos, perfiles, ignores, mutables, limpieza ni el plan de activacion.

El estandar no define marketplaces, servicios alojados, captura inversa, revision de cambios hechos por runtimes, politica de seleccion ni comportamiento interno de agentes.
