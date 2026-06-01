---
title: Conformidad
seoTitle: Conformidad Harness config
socialTitle: Afirmaciones de conformidad testables para herramientas Harness config
description: Afirmaciones testables para repositorios, recursos, objetivos, proyecciones, introspección de caminos y herramientas.
socialDescription: Criterios de conformidad para repositorios y herramientas que implementan la especificación Harness config.
canonicalPath: /specifications/v1/conformance/
slug: conformance
order: 6
locale: es
sectionCode: "06"
summary: Afirmaciones testables para repositorios, recursos, objetivos, proyecciones, introspección de caminos y herramientas.
llmSummary: Lista las expectativas de conformidad testables para forma del repositorio, caminos de recursos, proyección, overrides, ignores, extensiones, activación e introspección de caminos.
audience: Autores de pruebas e implementadores que validan compatibilidad con Harness config.
contentKind: spec
status: draft
updated: 2026-05-28
---

# Conformidad Harness config

Una afirmación de soporte de Harness config debería ser testable a partir de la forma de los archivos y el contrato de activación únicamente. Un repositorio, herramienta o política de organización puede afirmar soporte cuando las verificaciones relevantes a continuación pueden reproducirse sin depender de un runtime, CLI o servicio alojado específico.

## Niveles de conformidad

- Conformidad de repositorio: un repositorio declara `version = 1` en el manifiesto local seleccionado, mantiene cada camino declarado local al repositorio y almacena recursos objetivo persistentes bajo fuentes de recursos configuradas.
- Conformidad de recurso: un recurso es un archivo o carpeta bajo una fuente de recursos configurada. Los elementos de recursos convencionales son carpetas bajo `<resources>/<kind>/<name>`. Un override de raíz objetivo aparece como una carpeta con prefijo de punto directamente bajo una fuente de recursos; un override de elemento aparece como una carpeta con prefijo de punto directamente dentro de un elemento convencional. Los archivos de recursos también pueden ser compuestos desde directorios marcados con `.harnessComposable`.
- Conformidad de objetivo: una entrada `[[targets]]` contiene un camino local al repositorio requerido y puede llevar campos futuro-compatibles no reconocidos que las herramientas tratan como informacionales. La carpeta de override coincidente se infiere del primer segmento de camino. Ningún objetivo puede apuntar a `.harness`, superponerse con una raíz fuente configurada o re-declarar mapeos de recursos.
- Conformidad dir: cada tabla `[[dir]]` declara una raíz fuente dir local al repositorio ordenada. Los directorios dentro de esa fuente marcados con un archivo `.harnessComposable` vacío son hojas componibles cuyas partes con prefijo numérico se concatenan en un archivo de salida; todos los demás directorios y archivos se copian tal cual a sus caminos relativos al repositorio coincidentes. Estas salidas son separadas de los elementos de recursos proyectados en cada objetivo.
- Conformidad de declaración de extensión: una tabla `[extensions.<id>]` contiene un entero positivo `version`, puede establecer `activation` a `explicit` o `auto` y deja todos los demás campos a la implementación de la extensión.
- Conformidad de proyección: la activación aplica exclusiones `.harnessIgnore` y reglas de propiedad solo-inicialización `.harnessMutable`, incluidos archivos de ignore fuente-locales, perfil-locales y locales de salida objetivo donde corresponda, distingue archivos ignorados de archivos mutables propiedad del runtime, trata cada objetivo declarado como una proyección de copia y produce el mismo árbol objetivo para las mismas entradas, política de limpieza y política de mutables.
- Conformidad de herramienta: una implementación reporta el plan de activación antes de escribir, lista creaciones, actualizaciones, eliminaciones solicitadas, archivos mantenidos, entradas no gestionadas preservadas y archivos mutables saltados, y nunca lee una carpeta objetivo viva como fuente de verdad. Cuando una herramienta ofrece introspección de caminos, esa explicación es de solo lectura y se deriva del mismo manifiesto seleccionado, raíces fuente configuradas, selectores de perfil, reglas de ignore, reglas de mutables, política de mutables y modelo de proyección que la activación.

## Lista de verificación del repositorio

- El manifiesto seleccionado existe y declara `version = 1`.
- Los recursos objetivo persistentes viven bajo fuentes de recursos configuradas.
- Los elementos de recursos convencionales viven bajo `<resources>/<kind>/<name>`; los archivos de recursos directos como `.harness/resources/hooks.json` están permitidos bajo cualquier fuente de recursos configurada.
- Las hojas componibles de recursos usan un directorio con el nombre del archivo proyectado, un marcador `.harnessComposable` vacío y partes con prefijo numérico.
- Los overrides derivados del objetivo aparecen solo como carpetas con prefijo de punto directamente bajo una fuente de recursos o directamente dentro de un elemento de recurso convencional.
- Las entradas `[[targets]]` contienen caminos locales al repositorio requeridos; las claves no reconocidas son informacionales, no errores.
- Ningún objetivo redefine recursos, modos o nombres de override.
- Ningún objetivo apunta a `./.harness`.
- Los ids de extensión y los campos centrales de extensión validan cuando se declaran extensiones.
- Los patrones `.harnessIgnore` son relativos al repositorio y se parsean limpiamente.
- Las secciones de ignore globales como `[*]` y `[global]` se reconocen.
- Los patrones `.harnessMutable` se reconocen e identifican archivos que la proyección fuente puede inicializar una vez antes de que el runtime posea los bytes objetivo.
- Si se declaran entradas `[[dir]]`, cada raíz fuente dir se resuelve localmente al repositorio y cada hoja componible lleva un marcador `.harnessComposable`. Las carpetas de copia y archivos individuales bajo fuentes dir no llevan marcador.

## Requisitos de implementación

- `./.harness` MUST ser tratado como una capa fuente convencional del repositorio, no como un workspace de aplicación o ubicación de manifiesto requerida.
- Las categorías de recursos MUST ser tratadas como nombres del árbol fuente. `skills`, `rules`, `hooks` y `plugins` son convenciones comunes, no categorías requeridas del esquema.
- Los tipos de recursos fuera de las convenciones comunes MAY usarse cuando viven bajo fuentes de recursos configuradas y siguen el mismo contrato de override.
- Las hojas componibles de recursos MUST proyectarse como un archivo en el camino de la hoja y MUST NOT proyectar su marcador, `.harnessRef`, `.harnessIgnore`, `.harnessMutable` o archivos de partes numeradas individualmente.
- Los overrides MUST derivarse del camino objetivo.
- El manifiesto seleccionado MUST mantener `path` requerido en las entradas de objetivo y tolerar claves futuro-compatibles no reconocidas como informacionales. Los objetivos MUST NOT redefinir recursos, modos o nombres de override. Las tablas `[[resources]]` y `[[dir]]` de nivel superior declaran raíces fuente ordenadas.
- La activación SHOULD derivarse de la proyección.
- La activación MUST ser idempotente para las entradas canónicas definidas en [Standard](/specifications/v1/standard/#proyección-de-copia).
- Las implementaciones MUST NOT seguir enlaces simbólicos al descubrir raíces fuente configuradas, árboles objetivo declarados, archivos de ignore, selectores de perfil o salidas dir.
- Las implementaciones MUST reportar conflictos de enlace simbólico objetivo cuando un enlace simbólico ocupa un camino proyectado y la política de enlace simbólico objetivo seleccionada es `conflict`. Las implementaciones MAY reemplazar el enlace mismo solo cuando la política seleccionada es `replace`.
- Las implementaciones MUST reportar los archivos objetivo gestionados como actualizaciones cuando los bytes objetivo difieren de la proyección fuente calculada, y aplicar la activación MUST escribir la proyección fuente actual.
- Las implementaciones MUST preservar las entradas objetivo no gestionadas por defecto y MUST requerir una elección de limpieza explícita antes de la eliminación.
- Las implementaciones MUST soportar `.harnessIgnore` para archivos raíz, fuente-locales, perfil-locales, de override derivados del objetivo y locales de salida objetivo que permanezcan fuera de las proyecciones vivas. La precedencia MUST usar la ubicación lógica y la profundidad de directorio lógico con la última regla coincidente participante gana. Los archivos perfil-locales MUST evaluarse en la ubicación de superposición del perfil, los archivos de override derivados del objetivo MUST evaluarse en sus ubicaciones lógicas fuente y objetivo, y los archivos `.harnessIgnore` de salida objetivo que ya existen MUST permanecer como el límite final y ser preservados durante la activación y la limpieza de no gestionados.
- Las implementaciones MUST soportar los selectores `.harnessProfile` y las superposiciones `.harnessProfileRoot`. Las raíces de perfil MUST vivir bajo `./.harness`, una fuente de recursos configurada o una fuente dir configurada, MUST ser saltadas como elementos de recursos normales y MUST fusionarse por camino fuente lógico tanto para recursos como para salidas dir.
- Las implementaciones MUST soportar `.harnessMutable` y tratar los archivos coincidentes como archivos objetivo de creación-única propiedad del runtime incluso cuando los bytes objetivo aún coinciden con la plantilla fuente. Una regla `.harnessMutable` que coincide con el camino lógico de salida de una hoja componible de recurso MUST marcar el archivo compuesto de salida como mutable. Este comportamiento es separado del comportamiento de ignore: los archivos ignorados quedan fuera de la proyección, mientras los archivos mutables pueden ser proyectados cuando faltan y preservados después de la creación.
- Las carpetas objetivo declaradas MUST ser tratadas como salidas de proyección, no como repositorios fuente.
- Las carpetas objetivo declaradas MUST NOT apuntar a `./.harness`, superponerse con raíces fuente configuradas o superponerse entre sí.
- Cuando se declaran entradas `[[dir]]`, la activación MUST componer cada directorio con un marcador `.harnessComposable` desde sus partes con prefijo numérico y MUST copiar cada otro directorio y archivo bajo cada fuente dir a su camino relativo al repositorio coincidente. Los caminos de salida dir que caen bajo un objetivo declarado MUST fusionarse en la proyección de ese objetivo; los caminos de salida dir que reemplazarían o contendrían una raíz de objetivo declarada MUST ser rechazados. Los archivos `.harnessIgnore` fuente-locales dentro de fuentes dir, incluida una fuente dir personalizada fuera de `.harness`, MUST filtrar los archivos de la fuente dir. Los archivos `.harnessIgnore` de salida objetivo MAY filtrar las salidas dir por camino de salida final una vez conocidas las salidas candidatas. Los archivos `.harnessProfile` de salida objetivo MAY seleccionar superposiciones de perfil para salidas dir una vez conocidas las salidas candidatas.

## Evidencia

La evidencia del repositorio es un manifiesto versionado, árboles fuente configurados compartidos, `.harnessIgnore` y `.harnessMutable` visibles en control de versión cuando se declaran archivos mutables. Cuando las superficies de harness vivas generadas están gitignored, la evidencia del repositorio también debe incluir instrucciones de activación rastreadas que expliquen cómo validar y regenerar esas superficies. La evidencia de perfil, cuando se usa, es el archivo `.harnessProfile` seleccionado y las carpetas `.harnessProfileRoot` coincidentes bajo las raíces fuente configuradas.

La evidencia de herramienta es un reporte de dry-run que lista creaciones, actualizaciones, eliminaciones solicitadas, archivos mantenidos, archivos mutables saltados y entradas no gestionadas preservadas antes de cualquier escritura.

La evidencia de proyección son dos activaciones consecutivas contra entradas sin cambios que producen árboles objetivo idénticos byte por byte para archivos gestionados y dejan los archivos mutables intactos después de la primera aplicación.

La evidencia de mutables debe mostrar la transición de propiedad: la primera aplicación crea el archivo mutable declarado desde la fuente, una edición runtime cambia los bytes objetivo, y una activación posterior reporta el archivo como mutable sin sobrescribirlo.

La evidencia de política es un paso de CI que ejecuta la validación contra las mismas reglas que un contribuidor usa localmente.

La evidencia de privacidad es simple: la validación, planificación y activación pueden demostrarse desde archivos del repositorio sin telemetría, analítica, reporte remoto de errores o acceso a red.

## Códigos de diagnóstico

Las herramientas conformes SHOULD reportar códigos de diagnóstico legibles por máquina junto con los mensajes humanos. El catálogo de códigos v1 se mantiene en [`docs/DIAGNOSTICS.md`](https://github.com/reachjalil/harness-config/blob/main/docs/DIAGNOSTICS.md). Las herramientas que emiten un código `harness.*` MUST usar un código de ese catálogo. Las herramientas MAY emitir códigos en su propio espacio de nombres (por ejemplo `my-tool.*`) para condiciones fuera del estándar.
