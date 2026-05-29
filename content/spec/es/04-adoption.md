---
title: Adopción
seoTitle: Adoptar Harness config
socialTitle: Cómo adoptar Harness config en un repositorio
description: Flujos prácticos para arranque greenfield, migración, perfiles, instrucciones componibles y limpieza segura.
socialDescription: Un camino práctico para mover la configuración de agente a un catálogo fuente Harness config persistente con perfiles y limpieza segura.
canonicalPath: /specifications/v1/adoption/
slug: adoption
order: 4
locale: es
sectionCode: "04"
summary: Flujos prácticos para arranque greenfield, migración, perfiles, instrucciones componibles y limpieza segura.
llmSummary: Cubre los flujos de creación de un catálogo Harness config, declaración de objetivos, previsualización de activación, migración, perfiles y limpieza segura.
audience: Desarrolladores que introducen Harness config en repositorios nuevos o existentes.
contentKind: spec
status: draft
updated: 2026-05-29
---

# Adopción de Harness config

Esta guía describe dos caminos: greenfield (sin carpetas de agente vivas existentes) y migración (un repositorio que ya tiene `.claude/`, `.cursor/`, `.agents/` o similar).

## Greenfield

Harness config v1 comienza desde un pequeño contrato fuente:

1. Crear `./.harness/harness.toml` con `version = 1`, o elegir otro camino de manifiesto local al repositorio y pasarlo explícitamente a las herramientas.
2. Añadir carpetas de recursos y archivos bajo raíces fuente `[[resources]]` explícitas, comúnmente `.harness/resources`, como `.harness/resources/skills`, `.harness/resources/rules` o `.harness/resources/hooks.json`.
3. Declarar cada objetivo de proyección explícitamente en el manifiesto seleccionado.
4. Usar `.harnessIgnore` para mantener los archivos solo-fuente fuera de los objetivos vivos, y usar `.harnessMutable` para los archivos propiedad del runtime que deberían ser inicializados una vez. Un archivo mutable debería ser usualmente una plantilla fuente para estado objetivo local, no configuración compartida persistente.
5. Dry-run la activación antes de escribir las carpetas objetivo.

Para una primera configuración pequeña, mostrar tanto el manifiesto seleccionado como el árbol fuente:

```toml
version = 1

[[resources]]
path = "./.harness/resources"

[[targets]]
path = "./.agents"
```

```text
AGENTS.md                         # instrucciones de activación/raíz rastreadas
.harnessIgnore
.harnessMutable
.harness/
  harness.toml
  resources/
    README.md
    skills/
      review/
        SKILL.md
.agents/                          # generado después de la activación
```

Mantener `AGENTS.md`, `CLAUDE.md` u otros archivos de instrucciones raíz similares como archivos rastreados normales cuando son simples y ya coherentes. Moverlos a `[[dir]]` solo cuando la generación, composición, perfiles o superposiciones locales hagan el repositorio más fácil de entender.

`harnessc` es la implementación estándar para este flujo:

```bash
harnessc init
harnessc init --yes --resource skills --target ./runtime/agent
harnessc validate
harnessc explain .agents/skills/review/SKILL.md
harnessc activate
harnessc activate --yes
```

## Migrar un repositorio existente

Un repositorio que ya tiene superficies de harness como `.claude/` o `.cursor/` adopta Harness config incrementalmente. La forma de la migración importa: las raíces fuente configuradas deben convertirse en la entrada canónica, no en el objetivo.

Secuencia recomendada:

1. **Snapshot de objetivos existentes.** Commitear las carpetas vivas actuales, o copiarlas a una rama. La adopción es reversible, pero una línea base conocida-buena hace la revisión más fácil.
2. **Mover contenido persistente a un layout de recursos claro.** Para la primera migración completa, preferir una raíz `./.harness/resources` y agrupar dentro de ella por utilidad: workflow, estrategia, equipo, modo, conjunto de agentes, área de producto o kit. La mayoría del contenido `.claude/skills/foo/` se convierte en `./.harness/resources/skills/foo/`. Los archivos que difieren solo para un agente se mueven a la carpeta de override de elemento coincidente (por ejemplo `./.harness/resources/skills/foo/.claude/`). Los archivos de raíz objetivo como `.claude/settings.json` o `.claude/hooks.json` pertenecen al camino derivado del objetivo coincidente bajo la raíz de recursos, como `./.harness/resources/.claude/settings.json` o `./.harness/resources/.claude/hooks.json`. Añadir más raíces de recursos configuradas solo para catálogos de preocupación opcionales como testing, despliegue o trabajo de UI, límites de propiedad separados, especializaciones seleccionadas por perfil o superposiciones locales/privadas.

   ```toml
   [[resources]]
   path = "./.harness/resources"

   [[resources]]
   path = "./.harness/local/resources"

   [[targets]]
   path = "./.agents"

   [[targets]]
   path = "./.claude"
   ```

   ```text
   .harness/
     resources/
       README.md
       .claude/
         settings.json
         .harnessMutable
       skills/
       prompts/
       rules/
       plugins/
     local/
       resources/
   ```

   Este emparejamiento mantiene concreta la revisión de la migración: los revisores pueden ver qué raíz fuente compartida es proyectada, qué archivos a nivel de objetivo son inicializados y qué raíz fuente local es privada o experimental. A medida que Harness config madura, los equipos pueden dividir las preocupaciones en raíces adicionales como `./.harness/resources-testing`, `./.harness/resources-deployment` o `./.harness/resources-ui` y combinarlas con superposiciones de perfil o instrucciones dir específicas de perfil.
3. **Declarar objetivos en el manifiesto seleccionado.** Añadir una entrada `[[targets]]` para cada superficie de harness que se quiera regenerar. Un objetivo solo recibe proyecciones cuando aparece aquí. Declarar cada fuente compartida con una entrada `[[resources]]` explícita.
4. **Escribir `.harnessIgnore` y `.harnessMutable` deliberadamente.** Los logs, archivos scratch, metadatos por herramienta y `metadata.toml` de skills típicamente pertenecen a las reglas de ignore porque no deberían cruzar el límite de proyección. Los archivos que el runtime escribe de vuelta (permisos, configuración local, comandos aprendidos) pertenecen a `.harnessMutable` cuando el catálogo fuente debería inicializarlos una vez y el runtime objetivo debería poseerlos después de eso. Copiar esos archivos de semilla a `.harness` antes de declararlos mutables, para que los nuevos checkouts reciban una versión inicial. Las reglas a nivel de repositorio normalmente viven en `./.harnessIgnore`; las reglas específicas de recursos o dir pueden vivir en archivos `.harnessIgnore` fuente-locales, y las preferencias de salida usuario/locales pueden vivir en archivos de salida objetivo como `runtime/agent/skills/foo/.harnessIgnore`. Los archivos de salida objetivo son útiles cuando la superficie de harness viva está gitignored y un desarrollador necesita un límite local temporal; las reglas compartidas deberían vivir en la fuente. La precedencia sigue la profundidad de directorio lógico, por lo que las reglas fuente/perfil más profundas pueden volver a incluir caminos seleccionados mientras las reglas de salida objetivo permanecen como el límite final.
5. **Añadir overrides de perfil solo donde clarifican la propiedad.** Poner `.harnessProfileRoot` bajo `.harness`, una fuente de recursos configurada o una fuente dir configurada para kits opcionales o superposiciones personales, y seleccionarlos con archivos `.harnessProfile` raíz o de salida objetivo. Los archivos `.harnessIgnore` perfil-locales pueden ocultar archivos base o partes componibles para ese perfil y se evalúan en la ubicación de superposición del perfil. Usar perfiles como modos conmutables a través de grupos de recursos primero, y como superposiciones de archivo solo cuando genuinamente añaden o reemplazan contenido.
6. **Dry run, explain, revisar, luego aplicar.** `harnessc activate` imprime el plan sin escribir. Usar `harnessc explain <path>` para una fuente o salida específica que necesite inspección, luego revisar las acciones `create` / `update` / `remove` contra el snapshot y volver a ejecutar con `--yes`.
7. **Volver a ejecutar la activación.** Un segundo dry run sobre entradas sin cambios debería converger a `keep` para archivos gestionados y `mutable` para archivos propiedad del runtime. Si no lo hace, el árbol fuente aún está derivando del objetivo; reconciliar antes de depender del estándar.

Después de la migración, las carpetas vivas son derivadas: pueden ser eliminadas y regeneradas desde las raíces fuente configuradas más el manifiesto en cualquier momento. Los equipos también pueden gitignorear esas superficies de harness vivas cuando quieren más espacio para experimentos locales, estado runtime o archivos scratch específicos de herramienta. El trade-off es deliberado: la revisión ocurre en `.harness` y el manifiesto seleccionado, los archivos objetivo gestionados permanecen reproducibles, y los archivos objetivo `.harnessMutable` mantienen el estado propiedad del runtime fuera del árbol fuente canónico.

## Recomendaciones de gitignore

Usar `.gitignore` solo después de que la fuente de verdad esté clara:

- **Rastrear la fuente Harness compartida.** Commitear `.harness/harness.toml`, `.harness/resources/**` compartido, `.harness/dir/**` cuando se use, `.harnessIgnore` y las declaraciones `.harnessMutable` necesarias para reproducir las salidas generadas.
- **Gitignorear las superficies de harness generadas después de la convergencia.** Una vez que la activación converge y cada recurso persistente está representado en `.harness`, las carpetas como `.agents/`, `.claude/`, `.cursor/` y `.gemini/` pueden ser ignoradas. Mantener instrucciones de activación rastreadas, como una nota de instrucciones raíz, paso README o script de paquete que ejecute validación y activación.
- **Gitignorear las superposiciones locales del desarrollador si se desea.** Usar `.harness/local/` para skills, prompts, experimentos y superposiciones dir locales privados, luego añadirlo a `.gitignore` cuando esos archivos no deberían compartirse.
- **No depender de controles de salida objetivo gitignored para la primera activación.** Un `.harnessIgnore` o `.harnessProfile` de salida objetivo participa solo después de que existe en la salida generada. Poner los límites compartidos de primera activación en archivos `.harnessIgnore` fuente-locales o el `.harnessIgnore` raíz.

Ejemplo después de una migración completa:

```gitignore
# Superficies vivas generadas por Harness
.agents/
.claude/
.cursor/
.gemini/

# Superposiciones Harness privadas
.harness/local/
```

No ignorar todo `.harness/`; eso ocultaría el manifiesto y la fuente revisada requeridos para regenerar las superficies de harness vivas.

## Trampas comunes

- **Tratar una carpeta viva como tanto fuente como objetivo.** No apuntar una entrada `[[targets]]` a una carpeta que también edites directamente. La próxima activación reportará deriva o sobrescribirá las ediciones vivas. Si una carpeta debe permanecer como la fuente por ahora, dejarla fuera de `[[targets]]`.
- **Olvidar declarar un objetivo.** Los recursos solo se proyectan a objetivos declarados. Un repositorio puede tener `./.harness/resources/skills/foo/` y `.claude/` en disco y aún ver "ninguna creación" — porque `./.claude` no está en `[[targets]]`.
- **Poner estado de producto o runtime bajo `.harness/`.** `./.harness/` es para fuente persistente y revisable. Los registros de activación, hashes de deriva y cachés de producto pertenecen a carpetas propiedad de producto como `.harnex/` y a `.harnessIgnore`.
- **Poner archivos de raíz objetivo en un kit por accidente.** Un archivo de raíz objetivo como `.claude/settings.json` debería ser representado en `.harness/resources/.claude/settings.json`, no dentro de una carpeta de skill o un grupo de recursos no relacionado. Marcarlo mutable cuando debería ser inicializado una vez y luego volverse propiedad del runtime.
- **Usar overrides para hacer fork de contenido ampliamente.** Las carpetas de override reemplazan caminos relativos exactos o añaden archivos nuevos. Son intencionalmente un martillo pequeño; si un objetivo necesita una versión muy diferente de un skill, preferir un elemento de recurso separado sobre un árbol de override profundo.
- **Commitear archivos escritos por el runtime como si fueran fuente.** Los archivos como `.claude/settings.local.json` deberían típicamente ser copiados a `.harness` como una semilla y declarados en `.harnessMutable` para que la proyección los inicialice una vez y luego los deje en paz. Si el archivo luego se convierte en política compartida, promover los bytes deseados de vuelta a la raíz fuente configurada y forzar la reproyección mutable deliberadamente.
- **Esperar un archivo de ignore de salida objetivo antes de que exista.** Un `.harnessIgnore` de salida objetivo solo participa después de que ya está en disco. Usar el archivo raíz para reglas que deben aplicarse en la primera activación.
- **Proyectar controles de Harness config como payload.** Los archivos de declaración como `.harnessIgnore`, `.harnessMutable`, `.harnessProfile` y `.harnessProfileRoot` se leen como controles y no se copian en objetivos como archivos gestionados.
- **Enlaces simbólicos hacia objetivos.** Harness config v1 no sigue enlaces simbólicos. Si un enlace simbólico ocupa un camino que la activación necesita escribir, la activación reporta un conflicto por defecto. Reemplazar el enlace manualmente, establecer `[activation].targetSymlinks = "replace"` o usar `--replace-target-symlinks` solo cuando reemplazar el enlace mismo es intencional.

## Recordatorio de alcance

El estándar mismo permanece limitado al layout fuente, las declaraciones de objetivo, los overrides, los ignores de proyección, los archivos mutables y la proyección de copia determinista. La selección específica de producto, marketplace, revisión de edición objetivo, registros de activación, captura y sincronización remota pertenecen sobre el estándar base.
