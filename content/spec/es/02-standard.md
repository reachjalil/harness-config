---
title: Especificación
seoTitle: Especificación Harness config
socialTitle: La especificación de configuración de repositorio Harness config
description: Definiciones normativas para el layout fuente .harness, la proyección de activación, los archivos mutables propiedad del runtime, los overrides derivados del objetivo, la precedencia de .harnessIgnore y .harnessMutable, las superposiciones de perfil y los límites de conformidad.
socialDescription: Definiciones normativas para recursos fuente, archivos mutables propiedad del runtime, objetivos, overrides, ignores, declaraciones de mutables, superposiciones de perfil, extensiones y comportamiento de activación.
canonicalPath: /specifications/v1/standard/
slug: standard
order: 2
locale: es
sectionCode: "02"
summary: Definiciones normativas de términos, forma del repositorio, TOML, proyección, archivos mutables propiedad del runtime, overrides, ignores, declaraciones de mutables, perfiles, extensiones y conformidad.
llmSummary: Define la forma del repositorio .harness, el contrato TOML, la proyección de activación, los archivos mutables propiedad del runtime, los overrides derivados del objetivo, la precedencia de ignores y mutables, las superposiciones de perfil, las declaraciones de extensión y los límites de conformidad.
audience: Autores de herramientas, revisores del estándar e implementadores técnicos.
contentKind: spec
status: draft
updated: 2026-05-28
---

# Estándar Harness config

**Estado:** propuesta de especificación Versión 1. La forma de los archivos, el esquema del manifiesto, el contrato de proyección y la gramática de ignores descritos aquí están diseñados para ser implementables sin consultar el código de referencia, pero el contrato público aún está en revisión de propuesta. Hasta que las releases públicas, las fixtures de conformidad, los repositorios adoptantes y la retroalimentación externa maduren, trate los paquetes TypeScript como una implementación de referencia alpha. Una vez aceptada v1, los cambios que invalidarían un repositorio v1 o una implementación v1 se reservan para v2.

Harness config es un estándar local al repositorio para declarar *recursos de harness* persistentes (los prompts, skills, reglas, plugins y archivos similares que condicionan el comportamiento de un agente de codificación AI) y proyectarlos en superficies de harness de manera revisable y reproducible.

El estándar separa tres categorías de propiedad: fuente canónica propiedad del repositorio, salidas de superficie de harness generadas y archivos objetivo mutables propiedad del runtime. Un archivo mutable aún se declara desde la fuente y puede ser inicializado por la proyección, pero después de la primera activación los bytes objetivo vivos pertenecen al runtime hasta que una decisión explícita de forzado vuelve a proyectar la plantilla fuente.

Un repositorio mantiene raíces fuente neutrales y las proyecta en carpetas objetivo declaradas. El manifiesto por defecto es `./.harness/harness.toml`; las herramientas MAY también usar otro archivo TOML local al repositorio cuando ese camino se seleccione explícitamente. Los recursos persistentes viven bajo raíces fuente `[[resources]]` ordenadas. Las salidas únicas relativas al repositorio viven bajo raíces fuente `[[dir]]` ordenadas. Por lo tanto el directorio `./.harness` es una convención para almacenamiento fuente, no la ubicación requerida del manifiesto. La proyección se filtra mediante archivos de reglas `.harnessIgnore`, mientras los archivos solo-inicialización propiedad del runtime se declaran separadamente en archivos de reglas `.harnessMutable`. El `./.harnessIgnore` raíz establece los límites de exclusión a nivel de repositorio, y el `./.harnessMutable` raíz establece los límites de inicialización mutable a nivel de repositorio. Los archivos locales MAY estar junto a subárboles fuente. Los archivos `.harnessIgnore` de salida objetivo MAY estar en subárboles de salida vivos como filtros locales de salida. Cada carpeta de salida objetivo que recibe una proyección es explícita; no hay objetivos implícitos ni nombres de carpeta objetivo reservados.

La proyección de recursos del núcleo intencionalmente no define un registro de habilitar/deshabilitar ni un formato de selección. La activación es una propiedad emergente de la proyección: un recurso está *activo* en un objetivo cuando sus archivos están presentes en el árbol objetivo calculado, e *inactivo* cuando están ausentes de la próxima proyección. La selección, agrupación, comportamiento de marketplace e intereses similares pertenecen a capas de producto sobre el estándar.

Las extensiones tienen una declaración mínima y política de activación a nivel del estándar; el comportamiento por extensión es propiedad de cada extensión.

## Lenguaje normativo

Las palabras clave `MUST`, `MUST NOT`, `REQUIRED`, `SHALL`, `SHALL NOT`, `SHOULD`, `SHOULD NOT`, `RECOMMENDED`, `MAY` y `OPTIONAL` en este documento deben interpretarse como se describen en [RFC 2119] y [RFC 8174] cuando, y solo cuando, aparezcan en mayúsculas como se muestra aquí. Las palabras clave normativas se conservan en inglés en mayúsculas según la definición RFC 2119.

[RFC 2119]: https://www.rfc-editor.org/rfc/rfc2119
[RFC 8174]: https://www.rfc-editor.org/rfc/rfc8174

## Terminología

Estos términos tienen significados específicos a lo largo de este documento. Cuando una sección posterior del documento da una definición más detallada, esa sección es autoritativa.

- **Harness** — el runtime de agente AI o herramienta orientada al desarrollador que consume instrucciones, contexto, herramientas y configuración del repositorio para operar sobre un proyecto.
- **Superficie de harness** — los archivos y carpetas locales al repositorio que un harness lee, como `AGENTS.md`, `.agents`, `.claude`, `.cursor` u otra salida objetivo declarada.
- **Raíz de convención** — el directorio `./.harness` en la raíz de un repositorio, usado comúnmente para recursos, archivos fuente dir, perfiles y otro almacenamiento fuente. No es la ubicación requerida del manifiesto.
- **Manifiesto** — el archivo TOML local al repositorio seleccionado, por defecto `./.harness/harness.toml`, que declara la versión del estándar, las fuentes de recursos ordenadas, las fuentes dir ordenadas, los objetivos y las extensiones.
- **Fuente de recursos** — un directorio local al repositorio declarado por un `path` `[[resources]]`, cuyos archivos, carpetas y hojas componibles de recursos se proyectan en cada objetivo declarado. Múltiples fuentes de recursos se superponen en orden del manifiesto.
- **Tipo de recurso** — una categoría de material fuente como `skills`, `rules`, `hooks` o `plugins` bajo una fuente de recursos. Los tipos son nombres de directorio, no conceptos reservados del esquema.
- **Elemento de recurso** — comúnmente una carpeta bajo `<resources>/<kind>/<name>`, como `./.harness/resources/skills/review`. Las carpetas de elemento son unidades convencionales de revisión, pero una fuente de recursos también puede contener archivos directos como `./.harness/resources/hooks.json`.
- **Objetivo** — un directorio local al repositorio declarado en el manifiesto seleccionado que recibe proyecciones de las fuentes de recursos configuradas.
- **Carpeta de override** — una subcarpeta inmediata con prefijo de punto dentro de un elemento de recurso (por ejemplo `.claude/` dentro de `./.harness/resources/skills/review/`) o directamente dentro de `./.harness/resources` cuyos archivos reemplazan o añaden a archivos canónicos al proyectarse al objetivo coincidente.
- **Fuente dir** — un directorio local al repositorio declarado por un `path` `[[dir]]`. Su contenido se proyecta a caminos de salida relativos al repositorio, ya sea por composición (un directorio marcado con `.harnessComposable` cuyas partes numeradas se concatenan en un archivo de salida) o por copia directa (cualquier otro directorio o archivo bajo una fuente dir se copia al camino relativo al repositorio coincidente). Múltiples fuentes dir se superponen en orden del manifiesto.
- **Marcador componible** — el archivo vacío `.harnessComposable` colocado dentro de un directorio bajo una fuente de recursos o una fuente dir para marcarlo como hoja componible. Bajo recursos, la hoja compone un archivo de recurso proyectado dentro de cada objetivo. Bajo fuentes dir, la hoja compone un archivo de salida relativo al repositorio. Sin el marcador, los directorios de recursos permanecen como carpetas de recursos normales y los directorios dir se tratan como carpetas de copia.
- **Proyección** — el mapeo calculado desde `(raíz fuente, manifiesto, fuentes configuradas, overrides, reglas de ignore, reglas de mutables)` a un árbol de archivos por objetivo.
- **Activación** — el acto de materializar una proyección en una o más carpetas objetivo en disco.
- **Archivo mutable** — un archivo objetivo proyectado declarado por `.harnessMutable`; la fuente proporciona la plantilla inicial, y el runtime posee los bytes objetivo después de la primera proyección.
- **Repositorio / herramienta conforme** — ver [Conformidad](/specifications/v1/conformance/).

## Versionado

La versión actual del estándar es `1`. Las versiones de especificación son versiones completas del estándar. Las versiones patch, minor, prerelease y de paquete pertenecen a releases de CLI, herramientas, extensiones e implementación, no al espacio de URL de la especificación ni al campo `version` del manifiesto.

Las implementaciones MUST rechazar los archivos de manifiesto seleccionados cuyo `version` de nivel superior no sea un entero soportado, con un diagnóstico que nombre tanto el valor encontrado como la(s) versión(es) soportada(s).

```toml
version = 1
```

La versión `1` estandariza:

- la raíz de convención `./.harness`,
- el esquema de manifiesto TOML seleccionado para objetivos con caminos locales al repositorio requeridos, raíces fuente `[[resources]]` ordenadas, raíces fuente `[[dir]]` ordenadas y declaraciones de extensión de nivel superior,
- los árboles de fuentes de recursos configuradas,
- las carpetas de override derivadas del objetivo,
- la proyección de copia (idempotente bajo entradas fijas),
- la composición dir (hojas `.harnessComposable`) y el contrato de copia para archivos que se proyectan a caminos relativos al repositorio,
- los archivos de ignore de proyección `.harnessIgnore`, incluidas las reglas raíz, fuente-locales, perfil-locales y locales a la salida objetivo,
- los archivos mutables de proyección `.harnessMutable`, incluidas las reglas raíz, fuente-locales y perfil-locales.

Dentro de v1, este documento MAY recibir clarificaciones editoriales y refinamientos normativos retro-compatibles (por ejemplo, campos opcionales con valores por defecto definidos). Los cambios que invalidarían un repositorio v1 o una implementación v1 se reservan para v2.

## Alcance

Harness config estandariza:

- el archivo de manifiesto seleccionado y su esquema,
- el layout de recursos bajo las fuentes de recursos configuradas,
- los overrides objetivo por recurso como carpetas inmediatas con prefijo de punto,
- las declaraciones de objetivos explícitas con caminos locales al repositorio requeridos,
- la política de activación de nivel superior con valores por defecto definidos,
- las raíces fuente dir ordenadas, con hojas componibles (`.harnessComposable`) y directorios en modo copia que se proyectan a caminos relativos al repositorio,
- las declaraciones de extensión de nivel superior (solo política de descubrimiento y activación),
- la proyección de copia desde las fuentes de recursos configuradas a los objetivos declarados,
- `.harnessIgnore` como filtro de exclusión de proyección, incluidas las exclusiones de salida objetivo,
- `.harnessMutable` como filtro de archivos mutables de proyección.

Los objetivos declarados son superficies de harness vivas, no repositorios fuente. Un repositorio MAY commitear las salidas objetivo generadas, gitignorearlas o mezclar archivos gestionados commiteados con controles locales, mientras la fuente de verdad revisada permanezca en el manifiesto seleccionado y las raíces fuente configuradas. Esto permite a los equipos experimentar en `.agents`, `.claude`, `.cursor` u otra superficie sin promover ediciones runtime de vuelta al layout fuente canónico.

Cuando un repositorio gitignorea las salidas objetivo generadas, SHOULD mantener instrucciones de activación rastreadas, como una nota de instrucciones raíz, paso README o script, para que un nuevo checkout pueda validar y regenerar esas salidas. Las raíces fuente configuradas compartidas que hacen los objetivos reproducibles SHOULD permanecer rastreadas; las raíces locales privadas o experimentales como `.harness/local/` MAY gitignorearse cuando el repositorio las trata intencionalmente como superposiciones locales al desarrollador.

El modelo `.harnessMutable` es la versión a nivel de archivo de ese límite. Permite a un repositorio publicar una plantilla inicial revisable para configuración o estado local al objetivo mientras mantiene las ediciones runtime posteriores fuera del árbol fuente canónico.

### Fuera de alcance

Harness config **no** estandariza:

- flujos de producto, superficies de comandos o UX de usuario final,
- servicios alojados, registros o marketplaces,
- distribución, resolución de dependencias o gestión de paquetes para recursos,
- el comportamiento del runtime de harness ni cómo los harnesses consumen archivos objetivo,
- esquemas de skill, prompt o regla más allá de "carpeta con archivos",
- selección, agrupación, sesiones, presets o kits,
- captura objetivo-a-fuente o proyección inversa,
- flujos de revisión de edición objetivo (ver [Archivos mutables](#archivos-mutables) para el contrato base),
- sincronización remota, telemetría o registro de auditoría.

Harness config es un contrato de archivos local. El estándar no requiere telemetría, analítica, identificadores de máquina, reporte de errores remoto, servicios alojados o acceso a red para validar, planificar o activar un repositorio.

Estos intereses pertenecen a herramientas, productos o políticas organizacionales que se construyen sobre el estándar. Mantenerlos fuera de v1 es lo que permite a múltiples implementaciones interoperar sobre los mismos árboles fuente configurados.

## Forma de los recursos

Cada fuente de recursos es un directorio local al repositorio seleccionado por una entrada `[[resources]]` en el manifiesto. Las fuentes de recursos están ordenadas; las fuentes posteriores sobrescriben las fuentes anteriores en el mismo camino lógico de archivo proyectado exacto. Una fuente de recursos faltante es una capa vacía válida. Los tipos de recursos como `skills`, `rules`, `hooks` y `plugins` son directorios ordinarios bajo cada fuente. Se permiten archivos directos, de modo que un repositorio puede llevar configuración de raíz objetivo como `hooks.json` sin inventar una carpeta de elemento de recurso.

```text
.harness/
  resources/
    hooks.json
    hooks/
      post-tool-use.sh
    skills/
      code-review/
        SKILL.md
        examples/
          checklist.md
        .claude/
          SKILL.md
    rules/
      release-policy/
        RULE.md
    plugins/
      browser-tools/
        PLUGIN.md
        .cursor/
          plugin.json
    .gemini/
      hooks.json
```

`skills`, `rules` y `plugins` son tipos de recursos convencionales. Sus nombres de archivo markdown comunes son convenciones, no requisitos del esquema. Otros tipos de recursos MAY existir bajo cualquier fuente de recursos sin declaración de manifiesto por tipo.

Cualquier directorio bajo una fuente de recursos MAY ser una fuente de archivo componible cuando contiene un marcador vacío `.harnessComposable`. El nombre del directorio es el camino del archivo proyectado, y sus partes con prefijo numérico se componen con la misma semántica `.harnessRef` y `.harnessIgnore` definida para las hojas componibles dir. Una regla `.harnessMutable` que coincide con el camino lógico de salida de una hoja componible marca el archivo compuesto de salida como propiedad del runtime; el marcador, las partes y el archivo `.harnessRef` nunca se proyectan individualmente. Por ejemplo, `./.harness/resources/skills/review/SKILL.md/.harnessComposable` proyecta un archivo objetivo en `skills/review/SKILL.md`; los archivos numerados dentro de ese directorio no se proyectan individualmente. Las hojas componibles de recursos siguen siendo recursos: se proyectan dentro de las carpetas objetivo declaradas y participan en los overrides de recursos, perfiles y reglas de ignore de recursos.

Un directorio inmediato con prefijo de punto directamente bajo una fuente de recursos es un override de raíz objetivo. Para el objetivo `./.gemini`, los archivos bajo el convencional `./.harness/resources/.gemini/` superponen esa fuente de recursos y el segmento `.gemini` se elimina del camino de salida. Así se representan los archivos específicos de la raíz objetivo como `.gemini/hooks.json`.

Un directorio inmediato con prefijo de punto dentro de un elemento de recurso convencional, como `./.harness/resources/skills/code-review/.claude/` bajo una fuente de recursos convencional, es un override objetivo a nivel de elemento. Sus archivos superponen ese elemento y el segmento de override se elimina del camino de salida.

## Manifiesto

```toml
version = 1

[activation]
targetSymlinks = "conflict"

[[resources]]
path = "./.harness/resources"

[[resources]]
path = "./.harness/local/resources"

[[targets]]
path = "./.claude"

[[targets]]
path = "./runtime/agent"

[[dir]]
path = "./.harness/dir"

[[dir]]
path = "./.harness/local/dir"

[extensions.example]
version = 1
activation = "explicit"
```

### Recursos

La proyección de recursos usa solo raíces fuente `[[resources]]` declaradas. Si no se declaran entradas `[[resources]]`, la proyección de recursos está deshabilitada.

Cada entrada `[[resources]]` MUST contener `path`. Las herramientas MUST NOT fallar la validación únicamente porque una entrada `[[resources]]` lleve una clave no reconocida reservada para futuras revisiones v1; SHOULD reportar las claves no reconocidas como informacionales. El camino MUST ser local al repositorio, MUST resolver dentro del repositorio y MUST NOT contener segmentos `..`. Un manifiesto MUST NOT contener una tabla `[resources]` única ni ninguna tabla `[resources.<kind>]`; los tipos de recursos permanecen como nombres del árbol fuente, no como entradas del esquema del manifiesto.

Los nombres de directorio de recursos de nivel superior SHOULD usar letras minúsculas, números, guiones bajos o guiones. Los nombres con prefijo de punto directamente bajo una fuente de recursos son overrides de raíz objetivo, no carpetas de salida canónicas compartidas. Los archivos y directorios de recursos MUST NOT depender de la traversal de caminos; todos los caminos de salida proyectados MUST permanecer dentro de su objetivo declarado.

### Objetivos

Cada objetivo es explícito. Harness config no reserva, prefiere ni implica ningún nombre de carpeta objetivo de runtime. Cada entrada `[[targets]]` en el manifiesto seleccionado declara un camino objetivo local al repositorio y MUST contener `path`. Las herramientas MUST NOT fallar la validación únicamente porque una entrada `[[targets]]` lleve una clave no reconocida reservada para futuras revisiones v1; SHOULD reportar las claves no reconocidas como informacionales.

Los caminos objetivo MUST resolver dentro del repositorio, MUST apuntar a una carpeta bajo la raíz del repositorio, MUST NOT contener segmentos `..` después de normalización, MUST NOT apuntar a `./.harness` mismo ni a ningún descendiente de este, y MUST NOT superponerse con raíces fuente configuradas como `[[resources]]` o `[[dir]]`.

La carpeta de override para un objetivo es el primer segmento de camino después del `./` inicial, normalizado a carpeta de override fuente con prefijo de punto. Esto mantiene los caminos objetivo sin restricciones mientras preserva la convención del árbol fuente de que las carpetas inmediatas con prefijo de punto dentro de un elemento de recurso son overrides. Después de la normalización de caminos (colapsar separadores duplicados y eliminar el `./` inicial):

- `./.agents` → carpeta de override `.agents`.
- `./.claude` → carpeta de override `.claude`.
- `./runtime/agent` → carpeta de override `.runtime`.
- `./.github/copilot/agents` → carpeta de override `.github`.

Dos entradas `[[targets]]` cuyos caminos normalizados son iguales son duplicados y MUST ser rechazadas con un diagnóstico.

Dos entradas `[[targets]]` cuyos caminos normalizados se superponen como ancestro y descendiente, como `./.agents` y `./.agents/skills`, MUST ser rechazadas con un diagnóstico. Los objetivos deben ser raíces de proyección independientes.

Los objetivos que comparten un primer segmento de camino comparten intencionalmente un único namespace de override derivado del objetivo en v1. Por ejemplo, `./runtime/agent` y `./runtime/tools` usan ambos overrides `.runtime`. Preferir primeros segmentos distintos cuando dos objetivos necesitan namespaces de override distintos.

Los objetivos son configuración, no mutación oculta. Las herramientas SHOULD mostrar el plan objetivo antes de crear, reemplazar, copiar o eliminar archivos.

### Política de activación

La tabla opcional de nivel superior `[activation]` contiene la política de activación del estándar. Cuando se omite, todos los campos usan sus valores por defecto. Las herramientas MUST NOT fallar la validación únicamente porque `[activation]` lleve una clave no reconocida reservada para futuras revisiones v1; SHOULD reportar las claves no reconocidas como informacionales.

`targetSymlinks` controla los enlaces simbólicos en árboles objetivo declarados que ocupan un camino requerido por la proyección:

- `"conflict"` (por defecto): reportar un diagnóstico y no aplicar hasta que el enlace simbólico sea eliminado manualmente o se seleccione una política de reemplazo.
- `"replace"`: la activación MAY eliminar el enlace mismo y materializar la salida de proyección de copia en ese camino.

En ambos modos, las implementaciones MUST NOT seguir los enlaces simbólicos objetivo al descubrir, planificar o aplicar la proyección.

### Extensiones

Las extensiones se declaran bajo tablas de nivel superior `[extensions.<id>]`. Los identificadores de extensión MUST usar letras minúsculas, números, guiones bajos o guiones, y MUST comenzar con una letra.

Cada declaración de extensión MUST contener un entero positivo `version`. Esta es la propia versión del esquema de configuración de la extensión, no la versión del estándar Harness config.

Cada declaración de extensión MAY contener `activation` con uno de dos valores:

- `"explicit"` (por defecto): la extensión solo se ejecuta cuando un usuario o herramienta la invoca explícitamente.
- `"auto"`: la extensión MAY ejecutarse como parte de los flujos de activación rutinarios ofrecidos por una herramienta.

Cuando se omite, `activation` por defecto es `"explicit"`.

Los campos distintos de `version` y `activation` son propiedad de la extensión. El estándar Harness config define el *descubrimiento* de extensiones (cómo una herramienta ve que una extensión está declarada) y la *política de activación* (si una herramienta puede ejecutarla sin acción explícita del usuario). No define el comportamiento de la extensión, la forma de salida, los comandos ni las reglas de compatibilidad. La compatibilidad de la extensión con las versiones de Harness config pertenece a los metadatos de implementación de la extensión.

Una herramienta que encuentra una tabla `[extensions.<id>]` para una extensión que no implementa MUST NOT aplicar el comportamiento de esa extensión, MUST NOT fallar la validación del manifiesto únicamente debido a la extensión desconocida, y SHOULD reportar la extensión desconocida como informacional para que los usuarios decidan si instalar soporte.

Una herramienta que sí implementa una extensión MUST validar los campos propios de la extensión antes de aplicar el comportamiento de esa extensión.

Una herramienta que encuentra una tabla o clave de nivel superior no reconocida bajo una `version` soportada MUST NOT fallar la validación únicamente por eso, y SHOULD reportarla como informacional para que los autores decidan si necesitan herramientas más nuevas. Esto no cambia las reglas de manifiesto que hacen inválidas en v1 las tablas singulares `[resources]`, `[resources.<kind>]` y `[dir]`.

## Codificación, caminos y sensibilidad a mayúsculas

Estas reglas se aplican a cada archivo que el estándar lee o escribe (el manifiesto seleccionado, `.harnessIgnore`, archivos proyectados y archivos de override) a menos que una extensión defina explícitamente las suyas.

- **Codificación de texto.** Los archivos de configuración (el manifiesto seleccionado, `.harnessIgnore`) MUST ser UTF-8. Un BOM UTF-8 inicial MAY estar presente y MUST ser ignorado al parsear. El contenido de archivos de recursos se copia byte por byte; el estándar no requiere ninguna codificación para payloads de recursos.
- **Finales de línea.** El estándar no normaliza los finales de línea. La proyección copia bytes exactamente, así que los finales de línea de un archivo objetivo coinciden con la fuente.
- **Separadores de camino.** Los patrones de manifiesto e ignore usan barras (`/`). Las implementaciones en plataformas con un separador nativo diferente MUST traducir en el límite del sistema de archivos; los diagnósticos visibles al usuario SHOULD usar barras para portabilidad.
- **Normalización de caminos.** Antes de la comparación, las implementaciones MUST colapsar separadores duplicados, eliminar el `./` inicial y rechazar segmentos `..`. Los caminos MUST resolver dentro del repositorio.
- **Sensibilidad a mayúsculas.** Las comparaciones de caminos (igualdad de objetivo, coincidencia de override, coincidencia de ignore) son **sensibles a mayúsculas**. Los repositorios que pueden ser clonados en sistemas de archivos insensibles a mayúsculas (como volúmenes macOS o Windows por defecto) SHOULD evitar nombres que difieran solo en mayúsculas, porque el sistema de archivos subyacente puede colapsarlos. Las implementaciones MAY advertir cuando detecten tales colisiones.
- **Enlaces simbólicos.** Un enlace simbólico encontrado dentro de raíces fuente configuradas, `./.harness` o un árbol objetivo declarado se trata como una entrada de sistema de archivos hoja. Las implementaciones v1 MUST NOT seguir enlaces simbólicos al descubrir árboles fuente, árboles objetivo existentes, ignores, perfiles o salidas dir. Cuando un enlace simbólico objetivo ocupa un camino que la activación necesita escribir, la activación MUST reportar un conflicto a menos que se seleccione una política explícita de reemplazo de enlace simbólico objetivo. Con esa política, el enlace mismo MAY ser reemplazado según las mismas reglas de conflicto archivo/camino usadas para otras entradas no-directorio. v1 no requiere preservar enlaces simbólicos como enlaces ni proyectar enlaces simbólicos fuente en objetivos.
- **Archivos ocultos.** Los nombres que comienzan con `.` no son ignorados implícitamente. Participan en la proyección como cualquier otro archivo a menos que sean excluidos por `.harnessIgnore`. Esto no hace de los archivos de declaración de Harness config payloads objetivo: `.harnessIgnore`, `.harnessMutable`, `.harnessProfile` y `.harnessProfileRoot` son controles de límite y MUST NOT ser proyectados en objetivos.

## Enrutamiento de recursos a objetivos

Los objetivos reciben los árboles de fuente de recursos configurados. Un tipo de recurso, archivo directo o subárbol se excluye de un objetivo con un archivo `.harnessIgnore` local a la salida objetivo:

```text
# .claude/plugins/.harnessIgnore
*

# .cursor/prompts/.harnessIgnore
*

# .agents/checks/.harnessIgnore
local-only/
```

Este es el límite v1:

- el manifiesto seleccionado declara los objetivos.
- las fuentes de recursos configuradas llevan el árbol de recursos del objetivo.
- `.harnessIgnore` filtra archivos fuente y subárboles de salida objetivo.
- `.harnessMutable` marca los archivos fuente que deberían inicializar los archivos objetivo una vez y luego volverse propiedad del runtime.

Las herramientas SHOULD NOT introducir mapeos de recursos por objetivo en el manifiesto seleccionado para v1. Mantener las declaraciones de objetivos limitadas a caminos locales al repositorio requeridos más campos futuro-compatibles ignorados, mientras las raíces fuente siguen ordenadas en el nivel superior, preserva un solo lugar para el filtrado de proyección y facilita razonar sobre la salida en dry-run.

## Proyección de copia

La activación es una proyección de copia repetible desde entradas fuente hasta objetivos declarados. Las entradas son:

1. los archivos, hojas componibles y carpetas participantes bajo las fuentes de recursos configuradas, incluidas sus carpetas de override,
2. el manifiesto versionado seleccionado,
3. selectores `.harnessProfile` y superposiciones `.harnessProfileRoot` activas,
4. todos los archivos `.harnessIgnore` participantes, incluidas reglas de raíz de repositorio, fuente-locales, perfil-locales y locales de salida objetivo,
5. todos los archivos `.harnessMutable` participantes, incluidas reglas de raíz de repositorio, fuente-locales y perfil-locales,
6. la política de limpieza (preservar entradas no gestionadas vs. eliminarlas),
7. la política de mutables (saltar archivos mutables vs. forzar reproyección),
8. la política de enlace simbólico objetivo (conflicto vs. reemplazo).

**Idempotencia (propiedad testable).** Sea `M_n` el subconjunto de proyección gestionada de un objetivo declarado después de la `n`-ésima activación contra las entradas sin cambios definidas arriba y estado objetivo sin cambios excepto por cambios de bytes en archivos mutables. Para cada `n ≥ 2`:

- el conjunto de archivos en `M_n` MUST igualar el conjunto en `M_1`,
- cada archivo gestionado (no mutable) en `M_n` MUST ser idéntico byte a byte a su contraparte en `M_1`,
- cada archivo mutable presente en `M_1` MUST permanecer presente en `M_n` con los mismos bytes que tenía al final de la activación `n − 1` (es decir, el runtime lo posee; la activación no le escribe), y
- no SHOULD ocurrir ninguna escritura de archivo adicional en archivos gestionados más allá de lo requerido para converger.

Esta propiedad es lo que hace que la activación sea revisable: una re-ejecución limpia contra entradas sin cambios es observable como un plan solo-`keep` para archivos gestionados y un plan solo-`mutable` para archivos mutables.

Una herramienta conforme SHOULD soportar una dry run que reporte las acciones que tomaría antes de escribir:

- `create`: un archivo proyectado no existe en el objetivo.
- `update`: un archivo proyectado existe con bytes diferentes de la proyección calculada actual.
- `remove`: una entrada objetivo es seleccionada para eliminación porque no está presente en la proyección calculada.
- `keep`: el archivo objetivo ya coincide con la proyección.
- `preserve`: una entrada existente dentro de un objetivo declarado no está en la proyección calculada y permanecerá intacta.
- `mutable`: un archivo declarado mutable en `.harnessMutable` ya existe en el objetivo, incluso si sus bytes aún coinciden con la fuente. El runtime lo posee; la activación MUST NOT sobrescribirlo ni eliminarlo sin una decisión explícita de forzado.

Estas acciones describen archivos y directorios dentro de los objetivos declarados. Los archivos fuente bajo las raíces fuente configuradas son entradas de proyección; la activación no los clasifica como `keep`, `preserve` o `remove`.

Todas las proyecciones de objetivo v1 se materializan como copias. Las implementaciones MUST NOT requerir soporte de enlaces simbólicos para conformidad. Una implementación MAY usar optimizaciones internas, pero el árbol objetivo observable MUST comportarse como una proyección de copia para validación, revisión y activación repetida.

Después de que la activación se aplique, ejecutar la misma activación de nuevo SHOULD converger a acciones `keep` para archivos gestionados y acciones `mutable` para archivos declarados mutables. Esa propiedad mantiene las carpetas objetivo vivas derivadas y reproducibles mientras aún permite a los runtimes poseer su configuración por máquina.

### Archivos mutables

Los runtimes que leen las carpetas objetivo vivas también pueden escribir en ellas — los casos comunes incluyen otorgamientos de permisos en `.claude/settings.local.json`, comandos permitidos en lista o hooks aprendidos. Los archivos propiedad del runtime pueden ser declarados mutables en `.harnessMutable`. La proyección los materializa en la primera activación (acción `create`) y los reporta como `mutable` en cada activación posterior, ya sea que los bytes objetivo aún coincidan con la fuente o no. Las herramientas SHOULD ofrecer una decisión explícita de forzado que vuelva a proyectar los bytes fuente cuando el equipo necesite reiniciar el estado propiedad del runtime.

Mutable es una declaración de propiedad, no un sinónimo de ignore. Los archivos ignorados no entran en la proyección. Los archivos mutables sí entran en la proyección cuando faltan, para que el árbol fuente pueda proporcionar una forma inicial e intención revisable. Una vez que el archivo objetivo existe, el runtime posee sus bytes y la activación MUST NOT sobrescribirlo a menos que la política de mutables fuerce explícitamente la reproyección.

Durante la migración, un archivo mutable que debería existir para usuarios nuevos SHOULD ser copiado en una raíz fuente configurada antes de que su camino se añada a `.harnessMutable`. Declarar un archivo objetivo mutable sin semilla fuente solo protege un archivo local existente; no da a los nuevos checkouts una versión inicial.

El estándar no clasifica por qué un archivo objetivo no mutable difiere de la proyección actual. Una implementación de copia directa puede reportar esa diferencia como `update`. Los productos de nivel superior pueden añadir revisión consciente del control de versión, captura objetivo-a-fuente u otros flujos sobre este contrato base.

### Entradas objetivo no gestionadas

Las carpetas objetivo pueden ya contener recursos que no provienen de fuentes configuradas. Una herramienta conforme MUST NOT eliminar silenciosamente esas entradas. MUST o preservarlas o requerir una elección explícita de limpieza antes de la eliminación.

La política de limpieza por defecto SHOULD ser preservar. Cuando una herramienta ofrece eliminación, SHOULD resumir las entradas objetivo no gestionadas a un nivel para que el plan permanezca revisable:

- Para un elemento de recurso no gestionado, reportar la raíz del elemento como `skills/local-only`.
- Para una entrada no gestionada dentro de un elemento de recurso proyectado, reportar un nivel dentro de ese elemento como `skills/review/local.md` o `skills/review/local-assets`.
- No expandir cada archivo descendiente en una carpeta no gestionada a menos que el usuario solicite una auditoría más profunda.

Si se selecciona la limpieza, el plan MUST mostrar esas entradas como `remove` antes de escribir. Aplicar la limpieza explícita SHOULD podar los directorios padres vacíos dentro del objetivo para que una activación posterior con entradas sin cambios converja sin acciones de limpieza adicionales. Si no se selecciona la limpieza, el plan MUST mostrar las entradas no gestionadas como `preserve`.

Si una declaración de objetivo se elimina del manifiesto seleccionado, la proyección v1 del núcleo ya no tiene ese objetivo en su conjunto autorizado de escritura y por lo tanto no limpia esa carpeta durante la activación normal. Para limpiar un objetivo solo con el contrato de proyección base, ejecutar la limpieza mientras el objetivo aún está declarado, luego eliminar la declaración. Las herramientas de nivel superior MAY mantener el estado de activación y ofrecer un flujo de reconciliación de objetivo huérfano que previsualice eliminación, ignore o captura de vuelta a la fuente.

### Resumen de la semántica del sistema de archivos

Estas reglas son normativas para la activación v1:

- Los enlaces simbólicos nunca se siguen al descubrir raíces fuente, árboles objetivo, archivos de ignore, selectores de perfil o salidas dir. Un enlace simbólico es una entrada de sistema de archivos hoja.
- Cuando un enlace simbólico objetivo ocupa un camino que la activación necesita escribir, la activación MUST reportar un conflicto a menos que la política seleccionada de enlace simbólico objetivo permita explícitamente reemplazar el enlace mismo.
- Los archivos objetivo gestionados se sobrescriben desde la proyección fuente actual cuando sus bytes difieren.
- Los archivos objetivo mutables se crean desde la fuente una vez y luego se vuelven propiedad del runtime hasta una decisión explícita de forzado que los vuelva a proyectar.
- Las entradas objetivo no gestionadas se preservan a menos que se seleccione una limpieza explícita.
- Los archivos `.harnessIgnore` y `.harnessProfile` de salida objetivo son estado local protegido y MUST NOT ser sobrescritos ni eliminados por la limpieza de no gestionados.
- La activación es determinista para las entradas definidas en [Proyección de copia](#proyección-de-copia).
- Los objetivos MUST NOT apuntar a `./.harness`, superponerse con raíces fuente configuradas ni superponerse entre sí.

Por ejemplo, `.harness/resources/hooks.json` puede actualizar `.agents/hooks.json` cuando los bytes fuente cambien, mientras `.agents/skills/review/settings.local.json` coincidido por `.harnessMutable` se inicializa una vez y luego se deja intacto como estado propiedad del runtime. Un archivo de salida objetivo como `.claude/skills/review/.harnessIgnore` puede filtrar ese subárbol `.claude` y permanece como estado objetivo local.

## Overrides

Una carpeta con prefijo de punto directamente dentro de una fuente de recursos configurada es un override de raíz objetivo. Una carpeta con prefijo de punto directamente dentro de un elemento de recurso convencional bajo una fuente de recursos configurada es un override objetivo a nivel de elemento. Para el objetivo `./.claude`, la carpeta de override es `.claude`; para el objetivo `./runtime/agent`, la carpeta de override es `.runtime`.

La proyección MUST procesar archivos de recursos en este orden de precedencia ascendente, donde archivos coincidentes posteriores reemplazan archivos anteriores en el mismo camino proyectado exacto:

1. Archivos de recursos base canónicos a través de las fuentes `[[resources]]` en orden de manifiesto, excluyendo carpetas de override de raíz objetivo y carpetas de override a nivel de elemento.
2. Archivos de superposición de perfil activo genérico.
3. Archivos de override derivados del objetivo a través de las fuentes `[[resources]]` en orden de manifiesto, incluidas carpetas de override de raíz objetivo coincidentes y carpetas de override a nivel de elemento coincidentes. El segmento de carpeta de override se elimina de los caminos de salida.
4. Archivos de override objetivo específicos de perfil dentro de raíces de perfil activas.

Las reglas de ignore se aplican a cada archivo fuente antes de que entre en la proyección y permanecen como filtro final ortogonal.

Cuando dos archivos en la misma fase de precedencia se proyectan al mismo camino de salida exacto, las fuentes de recursos configuradas posteriores ganan sobre las anteriores. Dentro de una fuente de recursos y fase, el orden lexicográfico de camino fuente proporciona el desempate determinista de última-gana. Los conflictos de forma archivo/directorio siguen siendo errores, como se describe abajo.

Los overrides se fusionan a nivel de archivo, no como reemplazos de directorio completos. Los archivos de override reemplazan archivos canónicos solo cuando se proyectan al mismo camino de archivo relativo exacto. Los archivos canónicos hermanos continúan proyectándose como de costumbre. Los archivos de override MAY añadir archivos nuevos. Las carpetas anidadas con prefijo de punto dentro de un override, como `.codex-plugin`, son carpetas de salida ordinarias a menos que sean la carpeta de override inmediata de raíz objetivo o a nivel de elemento.

### Conflictos de override

La proyección MUST rechazar conflictos archivo/directorio antes de escribir. Existe un conflicto cuando dos archivos fuente se proyectan a caminos donde un camino requiere que el otro camino sea un directorio.

Ejemplos:

```text
# Conflicto: archivo canónico, directorio de override.
# La fuente canónica dice que "hooks" es un archivo, pero el override necesita
# que "hooks" sea un directorio para poder contener config.json.
.harness/resources/skills/review/hooks
.harness/resources/skills/review/.claude/hooks/config.json

# Conflicto: directorio canónico, archivo de override.
# La fuente canónica dice que "hooks" es un directorio, pero el override dice
# que "hooks" mismo es un archivo.
.harness/resources/skills/review/hooks/config.json
.harness/resources/skills/review/.claude/hooks

# Permitido: reemplazo exacto de archivo
.harness/resources/skills/review/SKILL.md
.harness/resources/skills/review/.claude/SKILL.md

# Permitido: reemplazar un archivo anidado y mantener el resto
.harness/resources/skills/review/hooks/config.json
.harness/resources/skills/review/hooks/notify.json
.harness/resources/skills/review/.claude/hooks/config.json
```

Una herramienta MUST reportar un diagnóstico para los caminos fuente en conflicto y MUST NOT aplicar la proyección hasta que el conflicto se resuelva.

## Fuente dir

Cada tabla `[[dir]]` de nivel superior declara una **fuente dir** local al repositorio cuyo contenido se proyecta a caminos relativos al repositorio. A diferencia de las fuentes de recursos, las fuentes dir no se copian como árboles de recursos en cada objetivo. Llevan salidas persistentes por archivo que no se modelan como elementos de recursos: instrucciones de agente de nivel superior (`AGENTS.md`, `CLAUDE.md`), configuración por objetivo (`.claude/settings.json`), archivos de raíz del repositorio (`.gitignore`, `README.md`) y artefactos únicos similares. Las fuentes dir están ordenadas; las fuentes posteriores reemplazan las salidas de copia anteriores en el mismo camino relativo al repositorio exacto, y las hojas componibles en el mismo camino lógico fusionan sus partes.

```toml
[[dir]]
path = "./.harness/dir"

[[dir]]
path = "./.harness/local/dir"
```

Cada entrada `[[dir]]` MUST contener `path`. Las herramientas MUST NOT fallar la validación únicamente porque una entrada `[[dir]]` lleve una clave no reconocida reservada para futuras revisiones v1; SHOULD reportar las claves no reconocidas como informacionales. Un manifiesto MUST NOT contener una tabla `[dir]` única. Si no se declaran entradas `[[dir]]`, no ocurre composición o copia dir. Una fuente dir faltante es una capa vacía válida.

### Hojas componibles

Un directorio dentro de una fuente dir que contiene el archivo marcador vacío `.harnessComposable` es una **hoja componible dir**. Su nombre (relativo a la raíz de la fuente dir) es el camino del archivo de salida relativo al repositorio. Los archivos dentro de él que coinciden con el patrón de prefijo numérico `<order>_<name>` son **partes**: sus bytes se concatenan en orden `order` para producir el archivo de salida. El mismo marcador también puede existir bajo una fuente de recursos, pero allí compone un archivo de recurso proyectado en lugar de una salida dir relativa al repositorio.

```text
.harness/dir/AGENTS.md/
  .harnessComposable           # marcador (vacío)
  100_intro.md                 # parte, orden 100
  200_rules.md                 # parte, orden 200

# Salida: ./AGENTS.md = 100_intro.md + 200_rules.md
```

El prefijo de orden es un entero no negativo. Dos partes MAY compartir el mismo orden; los empates se rompen por camino fuente. Una hoja componible MAY también contener un archivo `.harnessRef` con exactamente un camino relativo al repositorio apuntando a otra hoja componible; las partes expandidas de esa hoja se importan antes de las partes locales de esta hoja y se reordenan por `order`. Los ciclos, objetivos `.harnessRef` faltantes, objetivos `.harnessRef` que escapan de la raíz de la fuente dir y objetivos `.harnessRef` absolutos MUST ser reportados como errores.

Una hoja componible MUST NOT contener subdirectorios. Un archivo no-parte, no-`.harnessRef` dentro de una hoja componible MUST ser reportado como error de parte inválida; el autor o renombra el archivo para coincidir con `<order>_<name>`, o elimina el marcador `.harnessComposable` para cambiar a modo copia.

### Carpetas de copia y archivos individuales

Cualquier directorio en una fuente dir que NO contiene el marcador `.harnessComposable` es una **carpeta de copia**. Sus archivos y subdirectorios se proyectan con sus caminos relativos preservados. Los archivos individuales a cualquier profundidad se proyectan como copias directas.

```text
.harness/dir/
  README.md                    # -> ./README.md
  .claude/
    settings.json              # -> ./.claude/settings.json
    hooks/
      post-tool-use.sh         # -> ./.claude/hooks/post-tool-use.sh
  notes/
    01_dev_intro.md            # -> ./notes/01_dev_intro.md
```

El archivo marcador `.harnessComposable` mismo MUST NOT aparecer en ninguna salida, en ninguno de los dos modos.

### Caminos de salida y superposición con objetivos

Las salidas dir son caminos relativos al repositorio. MUST resolver dentro del repositorio y MUST NOT escribir dentro de `./.harness`, ninguna fuente de recursos configurada o ninguna fuente dir configurada. Un camino de salida dir que cae **bajo** un camino `[[targets]]` declarado (por ejemplo `.claude/settings.json` cuando `./.claude` es un objetivo declarado) se fusiona en la proyección de ese objetivo durante la activación, de modo que la idempotencia del objetivo y la limpieza de entradas no gestionadas respetan los archivos propiedad de dir. Una salida dir que **reemplazaría o contendría** la raíz de un objetivo declarado mismo (por ejemplo una salida dir en `.claude` cuando `./.claude` es un objetivo declarado) MUST ser reportada como `harness.dir_output_target_overlap`.

Un camino de salida dir que no se superpone con ningún objetivo declarado escribe directamente a ese camino relativo al repositorio.

### Conflictos

Si dos salidas dir se proyectarían a caminos relativos al repositorio incompatibles donde un camino requiere que otro camino sea tanto archivo como directorio, la proyección MUST reportar un `harness.dir_path_conflict` y MUST NOT aplicar hasta que el conflicto se resuelva. Se permite el reemplazo exacto de camino de archivo entre raíces dir ordenadas, y las hojas componibles en el mismo camino fusionan sus partes.

Si una salida dir y una proyección de recurso (canónica o por override de recurso) aterrizarían en el mismo camino dentro del mismo objetivo, la proyección MUST reportar un `harness.projection_path_conflict` y MUST NOT aplicar.

### Reglas de ignore

Las reglas `.harnessIgnore` del lado fuente se aplican a archivos dentro de cada fuente dir de la misma manera que se aplican a archivos de recursos, usando el camino fuente (por ejemplo `.harness/dir/AGENTS.md/200_skip.md` o `resources/AGENTS.md/200_skip.md` cuando un camino `[[dir]]` es `"./resources"`). Las reglas anidadas del lado fuente por lo tanto funcionan dentro de hojas `.harnessComposable` incluso cuando la fuente dir está fuera de `./.harness`.

Las reglas `.harnessIgnore` de salida objetivo también se aplican a las salidas dir después de que el camino de salida candidato se conoce. Las implementaciones MAY usar una pasada de bootstrap para calcular las salidas dir candidatas, descubrir archivos `.harnessIgnore` en directorios ancestros de salida existentes, y luego recalcular las salidas finales con esas reglas. Durante la recolección dir solo las reglas de ignore globales participan. `.harnessMutable` se aplica solo a proyecciones de recursos objetivo; las salidas dir no son archivos objetivo mutables.

Las raíces de perfil activas también participan en la recolección dir. Las carpetas dir de perfil superponen el camino de fuente dir configurado coincidente, pueden añadir archivos de copia o partes componibles, y pueden llevar archivos `.harnessIgnore` lógicos que suprimen archivos dir base o partes componibles base.

## `.harnessIgnore`

`.harnessIgnore` define archivos que MUST ser ignorados al proyectar recursos y salidas dir. El archivo raíz del repositorio es el límite a nivel de repositorio; los archivos locales pueden refinar el límite para un subárbol fuente o un subárbol de salida objetivo existente. Ignorar significa excluido completamente de la proyección.

```text
# .harnessIgnore
.harness/**/logs/
.harness/**/*.log
.harness/resources/skills/*/metadata.toml
!.harness/resources/skills/release-notes/metadata.toml

[*]
.harness/**/tmp/

# Las reglas raíz también pueden coincidir con caminos de salida objetivo.
.agents/**/scratch.tmp
```

Los patrones en el archivo raíz son relativos al repositorio y pueden coincidir con caminos fuente o caminos de salida objetivo. Los patrones en archivos locales se interpretan relativos al directorio que contiene ese archivo `.harnessIgnore`. Las herramientas MUST soportar líneas en blanco, comentarios `#`, negación `!`, anclas iniciales `/`, patrones finales `/` de directorio, `*`, `**` y `?`.

La evaluación de ignore está ordenada:

1. Empezar con `included`.
2. Leer reglas de arriba a abajo.
3. Una regla no-negada coincidente cambia el estado a `ignored`; una regla negada coincidente cambia el estado de vuelta a `included`.
4. La última regla coincidente participante gana.

Los encabezados de sección afectan las reglas subsiguientes:

- `[*]` o `[global]` aplica las reglas de ignore subsiguientes a cada objetivo.
- `[ignore]` cambia las reglas subsiguientes de vuelta a reglas de ignore.
- `[mutable]` no está soportado en `.harnessIgnore`. Las herramientas MUST reportar `harness.ignore_mutable_section_unsupported` y MUST NOT tratar las reglas bajo ese encabezado como declaraciones de mutables. Las declaraciones de mutables pertenecen a `.harnessMutable`.
- Los encabezados específicos de objetivo como `[.claude]`, `[!.cursor]` y `[mutable .claude]` no están soportados. Las herramientas MUST reportar `harness.ignore_unsupported_scope` y MUST NOT aplicar las reglas bajo ese encabezado no soportado hasta que aparezca otro encabezado de sección soportado.

Un patrón final `/` es solo-directorio. Para reglas de ignore no-negadas, coincide con el directorio mismo y los descendientes de ese directorio. Para reglas negadas, vuelve a incluir solo la entrada del directorio mismo; los descendientes aún necesitan su propia regla negada como `!path/to/item/**`. Esto preserva el patrón estilo gitignore donde los ignores amplios pueden cerrar un subárbol mientras las reglas lógicas más profundas reabren selectivamente un hijo.

## `.harnessMutable`

`.harnessMutable` define los archivos fuente que se proyectan solo como semillas iniciales. Mutable es diferente de ignore: los archivos ignorados quedan fuera de la proyección, mientras los archivos mutables entran en la proyección cuando el archivo objetivo falta. Una vez que el archivo objetivo existe, la activación lo reporta como `mutable` y MUST NOT sobrescribir sus bytes a menos que la política de mutables fuerce explícitamente la reproyección.

```text
# .harnessMutable
.harness/**/settings.local.json
.harness/resources/skills/*/permissions.json
```

Los patrones usan la misma sintaxis, localidad, negación, anclas, sufijo solo-directorio y precedencia última-coincidencia-gana que `.harnessIgnore`. El archivo raíz es relativo al repositorio y coincide con caminos fuente. Los archivos fuente-locales y perfil-locales se interpretan relativos a su directorio fuente lógico. Los archivos `.harnessMutable` de salida objetivo no son parte de v1; las declaraciones de mutables pertenecen a la fuente, no a los objetivos vivos.

Una regla `.harnessMutable` que coincide con el camino lógico de salida de una hoja componible de recurso marca el archivo compuesto de salida como mutable. Las partes fuente aún componen la semilla inicial, y el marcador, archivos de partes y `.harnessRef` siguen siendo entradas de declaración, no payload proyectado.

La evaluación de mutables se ordena independientemente de la evaluación de ignore:

1. Empezar con `not mutable`.
2. Leer las reglas `.harnessMutable` participantes de arriba a abajo.
3. Una regla no-negada coincidente cambia el estado a `mutable`; una regla negada coincidente cambia el estado de vuelta a `not mutable`.
4. La última regla mutable coincidente participante gana.

Los encabezados de sección son opcionales en `.harnessMutable`:

- `[*]`, `[global]` y `[mutable]` aplican las reglas mutables subsiguientes globalmente.
- `[ignore]` no está soportado en `.harnessMutable`; las reglas de ignore pertenecen a `.harnessIgnore`. Las herramientas MUST reportar `harness.mutable_ignore_section_unsupported` y MUST NOT aplicar las reglas bajo ese encabezado no soportado hasta que aparezca otro encabezado de sección soportado.
- Los encabezados específicos de objetivo no están soportados por la misma razón por la que no están soportados en `.harnessIgnore`. Las herramientas MUST reportar `harness.ignore_unsupported_scope` y MUST NOT aplicar las reglas bajo ese encabezado no soportado hasta que aparezca otro encabezado de sección soportado.

Los archivos mutables MUST aún pasar por el paso de ignore de proyección. Si un archivo es tanto ignorado como marcado mutable, la decisión de ignore gana porque el archivo nunca entra en la proyección en primer lugar.

### Archivos `.harnessIgnore` locales

Archivos `.harnessIgnore` adicionales MAY aparecer dentro de ubicaciones fuente y dentro de ubicaciones de salida objetivo existentes. Permiten a un autor o consumidor de recursos mantener las reglas de ignore junto a los archivos a los que se aplican, sin inflar el archivo raíz.

Archivos `.harnessMutable` adicionales MAY aparecer dentro de ubicaciones fuente y raíces de perfil. Permiten a un autor de recursos mantener las reglas de propiedad solo-inicialización junto a los archivos de plantilla fuente que afectan.

```text
.harnessIgnore                                  # archivo raíz
.harnessMutable                                 # archivo mutable raíz
.harness/resources/skills/review/.harnessIgnore           # reglas de recurso fuente-locales
.harness/resources/skills/review/.harnessMutable          # reglas mutables fuente-locales
.harness/resources/skills/review/.claude/.harnessIgnore   # reglas de override fuente-locales
.harness/resources/skills/review/.claude/.harnessMutable  # reglas mutables de override fuente-locales
resources/AGENTS.md/.harnessIgnore              # reglas dir personalizadas fuente-locales
.agents/skills/review/.harnessIgnore            # reglas locales de salida objetivo
notes/.harnessIgnore                            # reglas de salida objetivo para salidas dir
```

Se aplican las siguientes reglas:

- **Reglas fuente-locales.** Un archivo `.harnessIgnore` bajo `./.harness`, bajo una fuente de recursos configurada o bajo una fuente dir configurada coincide con caminos fuente. Un patrón como `*.tmp` en el archivo de camino por defecto `.harness/resources/skills/review/.harnessIgnore` coincide con `.harness/resources/skills/review/scratch.tmp` y `.harness/resources/skills/review/nested/scratch.tmp` pero NO coincide con `.harness/resources/skills/triage/scratch.tmp`.
- **Reglas mutables fuente-locales.** Un archivo `.harnessMutable` bajo `./.harness` o bajo una fuente de recursos configurada coincide con caminos fuente con la misma localidad. Marca los archivos de recursos proyectados coincidentes como archivos mutables solo-inicialización. Las salidas dir no son archivos objetivo mutables.
- **Reglas locales de salida objetivo.** Un archivo `.harnessIgnore` bajo una raíz objetivo declarada existente coincide con caminos de salida objetivo. Un patrón como `*.tmp` en `.agents/skills/review/.harnessIgnore` coincide con un camino de salida como `.agents/skills/review/scratch.tmp`, independientemente de si la fuente fue `.harness/resources/skills/review/scratch.tmp` o un archivo de override. Para salidas dir, las implementaciones también descubren archivos `.harnessIgnore` en directorios ancestros existentes de caminos de salida candidatos, como `notes/.harnessIgnore` para una salida `notes/release.md`.
- **Controles locales al objetivo.** Los archivos `.harnessIgnore` de salida objetivo son controles locales para la superficie de harness viva, útiles para preferencias de desarrollo temporales, exclusiones específicas de máquina o carpetas objetivo gitignored donde un desarrollador necesita mantener archivos runtime locales fuera de la próxima activación. Ajustan el límite de salida sin convertir la carpeta objetivo en una raíz fuente. Las reglas compartidas o de primera activación pertenecen a los archivos `.harnessIgnore` raíz o fuente-locales en su lugar.
- **Alcance del efecto.** Un archivo local participa solo cuando el camino fuente candidato o el camino de salida objetivo está dentro del directorio de ese archivo.
- **Orden de evaluación.** Los conjuntos de reglas se evalúan en fases: el archivo raíz primero, luego los archivos fuente-locales y perfil-locales en orden de profundidad de directorio lógico creciente, luego los archivos locales de salida objetivo en orden de profundidad de directorio lógico creciente. Dentro de cada conjunto de reglas, las reglas se leen de arriba a abajo. La última regla coincidente participante a través de todos los archivos gana. Un archivo fuente u objetivo más profundo puede por lo tanto volver a incluir un camino que un archivo menos profundo en la misma fase excluyó, o excluir un camino que un archivo menos profundo habría incluido. Las reglas locales de salida objetivo forman el límite de salida final para un subárbol objetivo y no pueden ser deshechas por reglas fuente perfil-locales.
- **Ubicación lógica.** Cada archivo `.harnessIgnore` local participante tiene una ubicación lógica. Los archivos perfil-locales participan en la ubicación de superposición lógica de la raíz de perfil. Los archivos de override derivados del objetivo participan en sus ubicaciones lógicas fuente y objetivo, no simplemente en la carpeta de punto física usada para almacenar el override.
- **Misma gramática.** Los archivos anidados soportan los mismos comentarios, negación, anclas, sintaxis glob y encabezados de sección soportados que el archivo raíz correspondiente.
- **Colocación específica de objetivo.** Un `.harnessIgnore` anidado dentro de un subárbol de salida objetivo es el mecanismo específico de objetivo. Los encabezados de sección específicos de objetivo son inválidos incluso dentro de carpetas de override.
- **Ignore sintético.** Cada archivo `.harnessIgnore`, `.harnessMutable`, `.harnessProfile` y `.harnessProfileRoot` está él mismo excluido de la proyección, equivalente a reglas de ignore globales para archivos de declaración. Las implementaciones MUST NOT copiar esos archivos de declaración en objetivos, incluso cuando ninguna regla explícita los excluya. Un archivo de declaración de salida objetivo puede aún afectar la proyección desde su ubicación objetivo existente; se lee como un control local, no se proyecta como contenido objetivo gestionado.
- **Protección de salida objetivo.** Un archivo `.harnessIgnore` que ya existe en una ubicación de salida objetivo MUST NOT ser sobrescrito por la proyección y MUST NOT ser eliminado por la limpieza de no gestionados. Los directorios ancestros requeridos para mantener ese archivo en su lugar MUST también ser preservados. Los archivos `.harnessProfile` de salida objetivo existentes tienen la misma protección.

Los archivos locales son entradas de límite opcionales con alcance; un repositorio que usa solo el archivo raíz permanece conforme. Los archivos locales de salida objetivo participan solo después de que existen en disco; las implementaciones no están obligadas a inferir el contenido de un archivo que aún no ha sido creado.

## Superposiciones de perfil

Las superposiciones de perfil son superposiciones fuente opcionales seleccionadas por archivos `.harnessProfile`. Un archivo `.harnessProfile` es texto UTF-8. Después de recortar espacios de cada línea e ignorar las líneas en blanco, MUST contener cero o un nombre de perfil. Cero nombres de perfil selecciona ningún perfil para ese subárbol de salida. Más de una línea no vacía MUST producir un error, y ese selector MUST NOT participar en la proyección. El `.harnessProfile` raíz se aplica globalmente; un `.harnessProfile` local de salida objetivo se aplica a su directorio y descendientes, y el selector más cercano gana para cualquier camino de salida. Cada camino de salida tiene como máximo un perfil activo a la vez, aunque distintos subárboles de target o dir pueden seleccionar perfiles distintos con selectores objetivo/salida más cercanos.

El contenido del perfil se declara con `.harnessProfileRoot`, que MUST vivir bajo `./.harness`, bajo una fuente de recursos configurada o bajo una fuente dir configurada. Un archivo `.harnessProfileRoot` es texto UTF-8. Después de recortar espacios de cada línea e ignorar las líneas en blanco, MUST contener exactamente un nombre de perfil. Cero nombres de perfil o más de una línea no vacía MUST producir un error, y esa raíz de perfil MUST NOT participar en la proyección. Un `.harnessProfileRoot` MUST NOT anidarse dentro de otra raíz de perfil. El directorio que contiene `.harnessProfileRoot` es una raíz de perfil. Es almacenamiento fuente, no un elemento de recurso, y MUST NOT ser proyectado como skill, regla, plugin, salida dir o archivo de declaración copiado.

Las raíces de perfil superponen los caminos fuente según donde se coloca el marcador:

- Si el directorio marcador es un hijo inmediato de una fuente de recursos configurada o una fuente dir configurada, ese directorio marcador superpone esa raíz fuente. Por ejemplo, bajo un camino de recursos convencional, `.harness/resources/deploy/.harnessProfileRoot` superpone `.harness/resources`; los hijos de `deploy/` se convierten en salidas de recursos lógicas.
- Si el directorio marcador está anidado más profundo dentro de una fuente de recursos configurada o una fuente dir configurada, ese directorio marcador superpone su directorio padre. Esto permite a los elementos de recursos llevar perfiles locales portables. Por ejemplo, bajo un camino de recursos convencional, `.harness/resources/skills/example/aggressiveProfile/.harnessProfileRoot` superpone `.harness/resources/skills/example`, por lo que `.harness/resources/skills/example/aggressiveProfile/SKILL.md` reemplaza el lógico `.harness/resources/skills/example/SKILL.md` cuando ese perfil está activo.
- De lo contrario, un directorio marcador bajo `./.harness` superpone `./.harness`. Esto soporta layouts de kit como `.harness/kits/deploy-kit/.harnessProfileRoot` con hijos como `resources/` y `dir/`.

Durante la proyección, las superposiciones de perfil participan en el orden de precedencia de recursos definido en [Overrides](#overrides). Una superposición de perfil genérica por lo tanto no puede reemplazar un override específico de objetivo como `.codex`; un override `.codex` específico de perfil sí puede. Si múltiples raíces de perfil activas para el perfil seleccionado proyectan el mismo archivo lógico, las herramientas MUST usar un orden determinista de última-gana por camino de raíz de perfil y SHOULD reportar una advertencia. Los archivos `.harnessIgnore` y `.harnessMutable` perfil-locales coinciden con el camino de superposición lógica, no con el camino de almacenamiento. Por ejemplo, un archivo de ignore en `.harness/profiles/personal/dir/AGENTS.md/.harnessIgnore` se aplica como si estuviera ubicado en `.harness/dir/AGENTS.md/.harnessIgnore`, por lo que puede suprimir partes componibles base antes de añadir partes de perfil.

Los archivos `.harnessIgnore` fuente-locales que son ancestros físicos de una raíz de perfil también se aplican antes de que la raíz de perfil sea mapeada a su camino de superposición lógica. Por ejemplo, `.harness/kits/.harnessIgnore` puede excluir los metadatos `.harness/kits/deploy/**/.harness-cache/` del perfil `deploy` activo incluso cuando los archivos bajo esa raíz de perfil superponen caminos lógicos como `.harness/resources` o `.harness/dir`.

Para fuentes dir, las implementaciones MUST usar un flujo bootstrap/final: recolectar salidas candidatas con reglas del lado fuente y cualquier selector de perfil conocido, descubrir archivos `.harnessIgnore` y `.harnessProfile` de salida objetivo en ancestros de salida candidatos, luego recalcular las salidas finales. Los directorios de perfil activos MUST también participar en el descubrimiento de candidatos, para que un `.harnessProfile` de salida objetivo pueda activar una salida dir solo-perfil incluso cuando ninguna fuente dir base habría producido esa salida. Los directorios de perfil activos pueden contribuir a una hoja `.harnessComposable` existente incluso cuando el directorio de perfil no repite el marcador `.harnessComposable`.

## Revisabilidad

El límite fuente/proyección hace revisables las diferencias entre superficies:

- Una diferencia bajo una fuente de recursos configurada afecta cada objetivo que proyecta ese camino de recurso.
- Una diferencia bajo `.agents`, `.claude`, `.cursor` u otra carpeta de override dentro de un elemento de recurso afecta solo a los objetivos que usan ese override.
- Una diferencia en el `.harnessIgnore` raíz cambia los límites de exclusión de proyección globalmente; una diferencia en un `.harnessIgnore` anidado cambia la proyección solo dentro del directorio fuente o de salida objetivo de ese archivo.
- Una diferencia en `.harnessMutable` cambia qué archivos fuente proyectados se convierten en archivos objetivo mutables solo-inicialización propiedad del runtime.
- Una diferencia en un `.harnessIgnore` de salida objetivo existente cambia lo que se copiará en ese subárbol de salida, sin convertir la carpeta objetivo en fuente de verdad.
- Una diferencia en `.harnessProfile` cambia qué superposiciones de raíz de perfil se aplican a ese subárbol de salida; una diferencia bajo un `.harnessProfileRoot` activo cambia solo las salidas donde ese perfil es seleccionado.
- Una diferencia en el manifiesto seleccionado cambia los caminos de fuente de recursos, los caminos objetivo, la configuración dir y las declaraciones de extensión.

## Requisitos de seguridad

- La validación MUST ser de solo lectura.
- Los caminos MUST permanecer dentro del repositorio.
- Los comandos de inicialización MUST explicar los cambios planificados del sistema de archivos antes de la mutación.
- Los comandos de activación SHOULD ofrecer una dry run y explicar las creaciones, actualizaciones, eliminaciones, conservaciones, entradas no gestionadas preservadas y saltos de mutables antes de la mutación.
- La introspección de camino de solo lectura, cuando es proporcionada por una herramienta, MUST derivarse de las mismas entradas definidas en [Proyección de copia](#proyección-de-copia) que la activación.
- Las superficies de harness vivas MUST ser tratadas como objetivos de proyección, no como repositorios fuente.
- Los equipos MAY gitignorear las superficies de harness vivas porque son salidas generadas; hacerlo no cambia la fuente de verdad ni el contrato de declaración de objetivo.
- Los repositorios que gitignorean las superficies de harness vivas SHOULD mantener instrucciones de activación rastreadas y SHOULD NOT gitignorear las raíces fuente configuradas compartidas requeridas para regenerar esas superficies. Las raíces fuente locales al desarrollador MAY ser gitignored cuando están intencionalmente fuera de la fuente de verdad compartida.
- La activación MUST ser idempotente para las mismas entradas definidas en [Proyección de copia](#proyección-de-copia).
- La proyección MUST honrar `.harnessIgnore` para que los logs, metadatos, cachés y estado de implementación permanezcan fuera de las superficies de harness vivas.
- Las herramientas MUST fusionar los overrides derivados del objetivo cuando están presentes y volver a los archivos canónicos cuando no existe ningún override.
- Los tipos de recursos desconocidos MAY ser usados como directorios bajo la fuente de recursos configurada.
- Los archivos mutables MUST ser creados en la primera proyección y MUST ser saltados en proyecciones subsiguientes a menos que el usuario opte explícitamente por forzar una reproyección.

## Consideraciones de seguridad

Harness config describe un sistema que copia archivos del control de versión en carpetas que un agente AI u otra herramienta posteriormente leerá. La integridad de esas copias tiene un efecto directo en lo que el agente hace. Las implementaciones SHOULD considerar las siguientes amenazas explícitamente:

- **Traversal de caminos.** Los caminos de manifiesto, caminos objetivo y patrones de ignore son controlados por el usuario. Las implementaciones MUST rechazar caminos que resuelven fuera del repositorio después de la normalización (ver [Codificación, caminos y sensibilidad a mayúsculas](#codificación-caminos-y-sensibilidad-a-mayúsculas)).
- **Redirección de enlace simbólico.** Los enlaces simbólicos en el árbol fuente o en árboles objetivo declarados pueden redirigir lecturas o escrituras fuera del repositorio si se siguen. Las implementaciones v1 MUST tratar los enlaces simbólicos como entradas hoja y MUST NOT seguirlos silenciosamente. Reemplazar un enlace simbólico objetivo que ocupa un camino proyectado MUST requerir una política explícita de enlace simbólico objetivo, ya sea del manifiesto seleccionado o de una opción de activación equivalente seleccionada por el operador.
- **TOCTOU al aplicar.** Un objetivo puede modificarse entre la planificación y la aplicación. Las implementaciones SHOULD verificar de nuevo la existencia y la clasificación gestionado/no gestionado de los archivos en el momento de la aplicación, no solo en el momento del plan.
- **Eliminación de entradas no gestionadas.** La limpieza elimina archivos del usuario. La política por defecto MUST ser preservar, y cualquier eliminación MUST ser visible en el plan antes de que ocurra.
- **Bypass de mutable.** Las reglas `.harnessMutable` son una declaración explícita de "el runtime posee esto después de la primera proyección". Las implementaciones MUST NOT sobrescribir un mutable objetivo sin una decisión explícita y visible al usuario de forzado.
- **Overrides no confiables.** Un repositorio puede importar elementos de recursos de terceros. Como las carpetas de override pueden reescribir archivos objetivo arbitrarios, las implementaciones y los productos downstream SHOULD proporcionar herramientas para hacer diff de carpetas de override contra archivos canónicos y para limitar los objetivos que un override dado puede afectar.
- **Activación que lee su salida.** Las carpetas objetivo vivas MUST NOT ser usadas como entradas de la próxima proyección. Tratar un objetivo como tanto fuente como sumidero puede amplificar silenciosamente las ediciones runtime en cambios de fuente de verdad.

El estándar no prescribe autenticación, firma o verificación de cadena de suministro para carpetas de recursos. Esos son intereses apropiados para capas de producto y política organizacional.

## Compatibilidad y evolución futura

Dentro de v1, los siguientes tipos de cambio están permitidos y no requieren una nueva versión del estándar:

- Clarificaciones editoriales que no cambian el significado normativo.
- Nuevos campos opcionales con valores por defecto definidos que preservan el significado de documentos v1 que los omiten.
- Nuevas declaraciones de extensión (que son opt-in por definición).
- Nuevos campos opcionales en entradas `[[resources]]`, `[[targets]]` o `[[dir]]` bajo la regla de claves desconocidas.
- Nuevas tablas o claves de nivel superior no reconocidas bajo la regla de campos desconocidos cuando herramientas antiguas pueden ignorarlas de forma segura.
- Diagnósticos adicionales o advertencias no bloqueantes.

Los siguientes cambios están reservados para v2:

- Cualquier cambio al esquema del manifiesto para objetivos o al campo `version` de nivel superior que invalidaría un manifiesto v1.
- Cualquier cambio a la semántica de proyección (`create`, `update`, `remove`, `keep`, `preserve`, `mutable`) que alteraría el resultado en disco de una entrada v1 sin cambios.
- Cualquier cambio a la gramática o precedencia de `.harnessIgnore` que alteraría qué archivos un conjunto de reglas v1 existente incluye, excluye o marca como mutables.
- Reserva de tipos de recursos o nombres de objetivos previamente disponibles para repositorios de usuario.

Las implementaciones SHOULD tratar los manifiestos cuyo `version` es un entero positivo mayor que el máximo que soportan como un diagnóstico de "versión no soportada", no como un manifiesto malformado. Esto permite a los manifiestos futuros no soportados fallar informativamente contra herramientas más antiguas.
