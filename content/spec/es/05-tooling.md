---
title: Herramientas
seoTitle: Herramientas Harness config
socialTitle: Herramientas para validar y activar Harness config
description: La implementación de referencia npx harnessc, la validación, la introspección explain, dry-run y los comandos de activación.
socialDescription: La capa de comandos para validar repositorios Harness config y aplicar proyecciones de activación.
canonicalPath: /specifications/v1/tooling/
slug: tooling
order: 5
locale: es
sectionCode: "05"
summary: "La implementación de referencia npx harnessc: validación, introspección explain, dry-run y comandos de activación."
llmSummary: Describe las expectativas de herramientas para validación, introspección explain, dry-run, activación, diagnósticos y ayudantes alrededor de Harness config.
audience: Autores de CLI y desarrolladores que operan repositorios Harness config.
contentKind: spec
status: draft
updated: 2026-05-28
---

# Herramientas Harness config

`harnessc` es la implementación estándar de Harness config. Existe para que los repositorios puedan validar la forma de los archivos, previsualizar la activación y materializar proyecciones de copia sin escribir primero una herramienta personalizada.

Cualquier otra implementación que cumpla con la conformidad de herramienta es igualmente válida. El estándar está definido por la forma del repositorio y el contrato de activación, no por un único binario.

## Privacidad y telemetría

Harness config no recopila telemetría.

El CLI `harnessc` no envía analítica, eventos de uso, caminos de archivos, nombres de repositorios, historial de comandos, identificadores de máquina o reportes de errores.

La activación, validación y planificación se ejecutan localmente contra archivos en tu repositorio. El CLI no hace peticiones de red durante operación normal.

## Comandos

```bash
harnessc
harnessc init
harnessc validate
harnessc explain <path>
harnessc activate
harnessc extension activate
```

- `harnessc` sin comando valida la configuración de repositorio más cercana e imprime el camino de manifiesto detectado con los siguientes pasos sugeridos.
- `harnessc init` muestra un plan de adopción cuando se ejecuta sin `--yes`. Con `--yes` crea el manifiesto seleccionado (por defecto `./.harness/harness.toml`), las carpetas de recursos convencionales o personalizadas bajo la raíz de fuente de recursos configurada, `.harnessIgnore` y `.harnessMutable`. El manifiesto de inicio generado declara explícitamente `[[resources]] path = "./.harness/resources"`.
- `harnessc validate` verifica el soporte de versión, los caminos locales al repositorio, los mapeos de objetivos, la sintaxis de ignore de proyección, la sintaxis de declaración de mutables, las hojas componibles de recursos, el manejo de hojas de enlace simbólico y los problemas de composición/copia dir.
- `harnessc explain <path>` explica cómo un camino fuente o de salida participa en el plan de proyección actual, incluidos los caminos fuente ganadores, las raíces fuente configuradas, las salidas dir, los diagnósticos bloqueantes, las decisiones de `.harnessIgnore` y las decisiones de propiedad de `.harnessMutable`. La salida JSON incluye trazas de ignore fuente y de salida objetivo para que un caller pueda distinguir una exclusión raíz, una re-inclusión fuente-local más profunda, una re-inclusión lógica perfil-local y un límite final de salida objetivo.
- `harnessc activate` muestra la previsualización de proyección cuando se ejecuta sin `--yes` y reporta creaciones, actualizaciones, eliminaciones solicitadas, archivos mantenidos, archivos mutables saltados y entradas no gestionadas preservadas. Por defecto, reporta los enlaces simbólicos objetivo que ocupan caminos proyectados como conflictos; pasar `--replace-target-symlinks` o establecer `[activation].targetSymlinks = "replace"` para reemplazar el enlace mismo.
- `harnessc extension activate` ejecuta extensiones registradas. Usar `--extension <id>` para ejecutar una extensión declarada o `--all` para ejecutar cada extensión soportada declarada.

`init`, `activate` y `extension activate` son dry runs a menos que se proporcione `--yes`. La forma dry-run de `init` reemplaza el comando `harnessc plan` anterior, por lo que un único modelo mental — "sin bandera previsualiza, `--yes` escribe" — se aplica a cada comando mutante.

Ejemplos comunes de introspección:

```bash
harnessc explain .agents/skills/review/SKILL.md
harnessc explain AGENTS.md
harnessc explain .harness/local/resources/skills/review/SKILL.md
```

Las entradas objetivo no gestionadas se mantienen por defecto. Usar `--remove-unmanaged` cuando un objetivo debe ser limpiado para coincidir con las fuentes configuradas; usar `--keep-unmanaged` para hacer el default explícito.

Las superficies de harness generadas como `.agents`, `.claude`, `.cursor` y `.gemini` pueden ser gitignored cuando son reproducibles desde `.harness`. Los proyectos que hacen esto deben mantener las instrucciones de activación rastreadas como una nota de instrucciones raíz, paso README o script de paquete que diga a usuarios y agentes ejecutar validación y activación en un nuevo checkout.

Las entradas `.gitignore` recomendadas después de una migración completa son:

```gitignore
# Superficies vivas generadas por Harness
.agents/
.claude/
.cursor/
.gemini/

# Superposiciones Harness privadas
.harness/local/
```

Mantener rastreada la fuente Harness compartida: `.harness/harness.toml`, `.harness/resources/**` compartido, `.harness/dir/**` cuando se use, `.harnessIgnore` y las declaraciones `.harnessMutable`. No añadir `.harness/` como ignore amplio a menos que el repositorio opte intencionalmente por no compartir el catálogo fuente.

La limpieza se aplica solo a objetivos aún declarados en el manifiesto seleccionado. Después de que una declaración de objetivo se elimine, `harnessc activate` base ya no inspecciona ni limpia esa carpeta. Limpiarla primero con `--remove-unmanaged`, o usar un flujo de estado de activación de nivel superior que pueda reconciliar objetivos huérfanos.

El camino de manifiesto por defecto es `./.harness/harness.toml`. Cuando `--root` y `--config` se omiten, `harnessc` busca hacia arriba desde el directorio actual ese manifiesto. Pasar `--config <path>` para validar, inicializar, activar o ejecutar extensiones contra otro archivo TOML local al repositorio. `harnessc init --resources-path <path>` escribe una entrada `[[resources]]` en el manifiesto y crea las carpetas de recursos bajo esa raíz fuente configurada. `harnessc init --resource <kind>` añade una carpeta de tipo de recurso bajo la raíz de recursos configurada y valida el nombre con el patrón de id de recurso. `harnessc init --target <path>` añade una entrada `[[targets]]` para un camino target local al repositorio. Los caminos de manifiesto se seleccionan por la invocación de la herramienta; los caminos dentro del manifiesto permanecen locales al repositorio, no relativos al directorio del archivo de manifiesto.

El plan de activación es también la vista orientada al operador de la propiedad. Los archivos gestionados son salidas de proyección propiedad del repositorio, las entradas no gestionadas son estado objetivo existente fuera de la proyección, y las entradas mutables son archivos objetivo inicializados por la fuente pero ahora propiedad del runtime.

Los archivos gestionados se comparan directamente con la proyección fuente actual: si el objetivo difiere, `harnessc activate` reporta `update` y aplicar la activación sobrescribe el objetivo con los bytes fuente actuales. Los archivos mutables declarados en `.harnessMutable` se crean una vez desde la fuente y se saltan en activaciones subsiguientes porque los bytes objetivo vivos son propiedad del runtime. Usar `--force-mutable` para volver a proyectarlos desde la fuente.

Los enlaces simbólicos objetivo no se siguen. Si un enlace simbólico objetivo ocupa un camino que la proyección necesita escribir, `harnessc activate` reporta `harness.target_symlink_conflict` y rechaza `--yes` por defecto. Seleccionar una de las políticas de reemplazo explícitas cuando reemplazar el enlace mismo es intencional:

```toml
[activation]
targetSymlinks = "replace"
```

o para una sola ejecución:

```bash
harnessc activate --yes --replace-target-symlinks
```

El comportamiento del sistema de archivos sigue el congelamiento de release v1:

- los enlaces simbólicos se tratan como entradas hoja y no se siguen;
- los enlaces simbólicos objetivo que ocupan caminos proyectados son conflictos a menos que el reemplazo se seleccione por política de manifiesto o `--replace-target-symlinks`;
- las entradas objetivo no gestionadas se preservan a menos que se seleccione `--remove-unmanaged`;
- los archivos `.harnessIgnore` y `.harnessProfile` de salida objetivo se preservan como controles locales;
- la activación repetida con las mismas entradas converge a `keep` para archivos gestionados y `mutable` para archivos propiedad del runtime;
- los objetivos superpuestos o los objetivos que colisionan con raíces fuente configuradas son diagnósticos.

Los flujos de selección, comportamiento de marketplace, revisión de edición objetivo, captura y otras opiniones de producto pertenecen sobre `harnessc`.

## Composición y copia dir

Declarar una o más entradas `[[dir]]` en el manifiesto seleccionado activa raíces fuente dir ordenadas. Ejecutar `harnessc activate` planifica y aplica las salidas dir junto con la proyección objetivo:

```toml
[[dir]]
path = "./.harness/dir"

[[dir]]
path = "./.harness/local/dir"
```

```text
.harness/dir/
  AGENTS.md/
    .harnessComposable
    100_intro.md
    200_rules.md
  CLAUDE.md/
    .harnessComposable
    .harnessRef                       # ../AGENTS.md
    150_claude.md
  .github/
    copilot-instructions.md/
      .harnessComposable
      100_intro.md
  .claude/
    settings.json              # modo copia (sin marcador)
  notes/
    01_dev_intro.md            # modo copia (sin marcador)
```

Dentro de cada fuente `[[dir]]`, los directorios que contienen un archivo marcador vacío `.harnessComposable` son hojas componibles: sus partes con prefijo numérico (por ejemplo `100_intro.md`, `200_rules.md`) se concatenan en orden para producir un archivo de salida relativo al repositorio. Los directorios sin el marcador son carpetas de copia: sus archivos y archivos anidados se copian al camino relativo al repositorio coincidente. Los archivos individuales a cualquier profundidad también se copian.

El mismo marcador `.harnessComposable` también puede usarse bajo una fuente de recursos configurada. En esa ubicación compone un archivo de recurso proyectado dentro de cada objetivo declarado; no es una salida relativa al repositorio `[[dir]]`.

Los archivos `.harnessRef` dentro de una hoja componible importan partes de otra hoja. Las partes importadas y locales se ordenan juntas, los números duplicados mantienen todas las partes coincidentes, y los ciclos u objetivos `.harnessRef` faltantes se reportan como errores.

Las reglas `.harnessIgnore` del lado fuente se aplican durante la recolección dir, incluidas las reglas dentro de una hoja `.harnessComposable` y las reglas dentro de una fuente `[[dir]]` personalizada fuera de `./.harness`. Ignorar un contenedor salta todas las salidas dir bajo él, ignorar una hoja salta esa salida, e ignorar una parte excluye esa parte de la composición. Los archivos `.harnessIgnore` de salida objetivo también pueden filtrar las salidas dir por camino de salida final después de que se conoce la estructura de salida candidata; las reglas de salida objetivo se evalúan después de las reglas fuente y perfil-locales, por lo que forman el límite final para ese subárbol de salida. Los encabezados objetivo con alcance se ignoran en este modo. El marcador `.harnessComposable` mismo nunca se copia a ninguna salida.

Las superposiciones de perfil usan selectores `.harnessProfile` y superposiciones fuente `.harnessProfileRoot`. Un `.harnessProfile` raíz se aplica globalmente; los selectores objetivo/salida como `.agents/skills/.harnessProfile` se aplican solo a ese subárbol de salida. `.harnessProfileRoot` debe vivir bajo `.harness`, una fuente de recursos configurada o una fuente dir configurada; cuando está activa, su contenido superpone la raíz fuente padre (para marcadores directamente dentro de la fuente de recursos o raíz dir), el directorio padre (para raíces de perfil portables anidadas dentro de un elemento de recurso o subárbol dir) o `.harness` (para carpetas estilo kit). Las raíces de perfil no pueden anidarse dentro de otras raíces de perfil. Los archivos `.harnessIgnore` perfil-locales coinciden con esos caminos de superposición lógicos, incluidas las hojas `.harnessComposable`. La planificación dir descubre selectores de perfil objetivo/salida de salidas candidatas base y solo-perfil antes de calcular el conjunto final de salidas dir.

## Personalización para desarrollador único

Para desarrolladores en solitario o equipos que quieren experimentación local sin cambiar las fuentes compartidas revisadas, `harnessc` trabaja con raíces fuente ordenadas adicionales. Un patrón práctico es:

```toml
[[resources]]
path = "./.harness/resources"

[[resources]]
path = "./.harness/local/resources"

[[dir]]
path = "./.harness/dir"

[[dir]]
path = "./.harness/local/dir"
```

El CLI no requiere que estos caminos existan. Los proyectos pueden elegir ignorar `.harness/local/` en control de versión, commitearlo, generarlo o usar caminos diferentes. Las raíces posteriores sobrescriben las salidas exactas previas de recursos o dir; usar `harnessc explain <path>` para inspeccionar por qué un camino fuente o de salida específico está presente, ignorado, sobrescrito o compuesto.

Cuando `.harness/local/` está gitignored, los manifiestos compartidos pueden aún declararlo como una raíz posterior opcional. Las raíces locales faltantes simplemente no contribuyen archivos locales; las raíces locales presentes pueden sobrescribir salidas exactas de recursos o dir para ese desarrollador.

Los caminos de salida dir que caen bajo un camino `[[targets]]` declarado se fusionan en la proyección de ese objetivo — ejecutar la activación una segunda vez converge a acciones `keep` para esos archivos, incluida la limpieza de entradas no gestionadas del objetivo. Una salida dir que reemplazaría o contendría la raíz de un objetivo mismo (por ejemplo una salida dir en `.claude` cuando `./.claude` está declarado como objetivo) se reporta como `harness.dir_output_target_overlap`.

## Extensiones

`harnessc` viene con un registro de extensiones para compatibilidad hacia adelante. Esta release no incluye implementaciones de extensión integradas; las herramientas que declaran `[extensions.<id>]` para ids no soportados ven un diagnóstico informativo en lugar de comportamiento. La superficie de composición y copia dir arriba es parte de la activación del núcleo, no una extensión.

```toml
[extensions.example]
version = 1
activation = "explicit"
```

El estándar del núcleo posee `version` y `activation`. Los campos específicos de extensión pertenecen a la implementación de extensión registrada. `harnessc extension activate` simple ejecuta solo las extensiones configuradas con `activation = "auto"`.

## Ayudantes TypeScript

Los editores, scripts CI y herramientas internas pueden embeber el mismo comportamiento a través de `@harnessconfig/core`:

```ts
import {
  applyHarnessActivation,
  loadHarnessIgnoreMatcher,
  parseHarnessConfigToml,
  planHarnessActivation,
  resolveHarnessPaths,
  validateHarnessConfig,
} from "@harnessconfig/core";

const paths = resolveHarnessPaths(process.cwd());
const config = parseHarnessConfigToml(rawToml);
const ignore = await loadHarnessIgnoreMatcher(paths.root);
const validation = await validateHarnessConfig(paths.root);
const activationPlan = await planHarnessActivation(paths.root);
const dryRun = await applyHarnessActivation(paths.root);
```

## Verificaciones del validador

Un validador conforme debe:

- Usar el camino `--root` suministrado, o el directorio de trabajo actual cuando no se suministra raíz, como raíz del repositorio. Las invocaciones anidadas deben pasar `--root`.
- Parsear el manifiesto seleccionado, por defecto `./.harness/harness.toml`, y rechazar entrada malformada con diagnósticos claros.
- Rechazar versiones futuras no soportadas del estándar.
- Validar los caminos de fuentes de recursos configuradas y rechazar las declaraciones de recursos por tipo en el manifiesto.
- Verificar que cada entrada `[[targets]]` contiene un camino local al repositorio requerido, apunta debajo de la raíz del repositorio y no se superpone con raíces fuente configuradas; las claves no reconocidas se reportan como información.
- Parsear `.harnessIgnore` con reglas raíz, fuente-locales, perfil-locales y locales de salida objetivo usando las fases de precedencia estándar. Parsear `.harnessMutable` separadamente para archivos propiedad del runtime de creación-única.
- Resolver los selectores `.harnessProfile` y las superposiciones `.harnessProfileRoot` antes de la proyección, incluido el paso bootstrap/final dir para selectores de salida.
- Mostrar las acciones create, update, remove, keep, preserve y mutable antes de cualquier escritura.
- Verificar que la activación repetida contra entradas sin cambios converge al mismo árbol objetivo para archivos gestionados y deja los archivos mutables intactos.
- Reportar los objetivos declarados separadamente de las carpetas fuente persistentes.

## Salida

La salida por defecto es un reporte de terminal conciso con caminos, severidad y correcciones sugeridas. La salida de terminal humana puede usar color ANSI para encabezados, severidad de diagnósticos y tipos de acción cuando el flujo de salida soporta color. Las implementaciones deben evitar el color en salida redirigida, honrar `NO_COLOR` y mantener la salida `--json` libre de escapes ANSI para automatización y CI.
