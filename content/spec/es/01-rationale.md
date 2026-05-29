---
title: Justificación
seoTitle: Justificación de Harness config
socialTitle: Por qué un estándar de configuración de agentes local al repositorio
description: El problema concreto de varias superficies de harness en paralelo y los conceptos coordinados que el estándar introduce.
socialDescription: El problema de la deriva multi-harness y el contrato pequeño, revisable y reproducible que Harness config propone.
canonicalPath: /specifications/v1/rationale/
slug: rationale
order: 1
locale: es
sectionCode: "01"
summary: Por qué un estándar local al repositorio ayuda a equipos que usan múltiples agentes de codificación, y qué conceptos coordinados introduce.
llmSummary: Explica el problema concreto de las superficies de harness múltiples, divergentes y propiedad de runtimes, y presenta los conceptos coordinados (manifiesto, fuentes de recursos y dir, objetivos declarados, overrides derivados del objetivo, perfiles, ignores, mutables, proyección de activación).
audience: Autores de herramientas, equipos de plataforma y revisores de especificación que evalúan compromisos.
contentKind: spec
status: draft
updated: 2026-05-26
---

# Justificación de Harness config

Los harnesses necesitan superficies vivas del repositorio. Los equipos necesitan una capa fuente estable y revisable para los recursos que esos harnesses consumen. Harness config separa esas responsabilidades sin prescribir un modelo de aplicación para ninguna.

El catálogo fuente vive bajo raíces fuente configuradas, con `./.harness` como convención por defecto. Las superficies de harness como `./.agents`, `./.claude` o `./.cursor` siguen siendo archivos y carpetas vivos que sus harnesses leen. La activación proyecta la vista del catálogo revisada en esas superficies como archivos ordinarios.

La separación importante es la propiedad, no solo el almacenamiento. Los archivos fuente persistentes son propiedad del repositorio y revisables. Los archivos objetivo vivos son salidas generadas. Un archivo declarado en `.harnessMutable` se inicializa desde la fuente una vez y luego se trata como estado propiedad del runtime, de modo que un harness puede escribir configuración local de forma segura sin convertir esas escrituras en fuente canónica.

## El problema concreto

A partir de 2026, los repositorios que trabajan con varios agentes de codificación AI suelen llevar varias carpetas de nivel superior específicas de agente lado a lado: `.claude/`, `.cursor/`, `.agents/`, `.codeium/`, `.continue/`, `.github/copilot-*`, además de archivos de instrucciones mantenidos a mano como `AGENTS.md`, `CLAUDE.md` o `.github/copilot-instructions.md`. Cada runtime lee uno de ellos y a veces escribe de vuelta en la misma carpeta (permisos, listas de permitidos, hooks aprendidos).

Esto produce dolor recurrente y predecible en repositorios reales:

1. **Deriva entre carpetas casi duplicadas.** El mismo skill o prompt se copia y pega en `.claude/skills/foo/`, `.cursor/skills/foo/` y así sucesivamente. Las ediciones en un runtime divergen de las otras hasta que un humano las reconcilia.
2. **Las carpetas vivas mezclan fuente redactada y estado runtime.** Un archivo escrito por el runtime (`settings.local.json`, comandos aprendidos) acaba siendo commiteado y revisado como si fuera contenido redactado, o se ignora con `.gitignore` y diverge silenciosamente entre contribuidores.
3. **No hay forma limpia de "desactivar" un skill para un solo agente.** Eliminar archivos de una carpeta viva elimina trabajo o requiere ramificación por runtime en los scripts de CI.
4. **Los archivos de instrucciones duplican prosa.** `AGENTS.md`, `CLAUDE.md` y `copilot-instructions.md` repiten los mismos párrafos, derivando de nuevo.
5. **Sin contrato portable.** Un nuevo agente publicado mañana no tiene un camino que le permita consumir el mismo material fuente que un repositorio ya mantiene.

Harness config aborda estos puntos haciendo canónicas y revisables las capas fuente configuradas, y cada superficie de harness un objetivo de proyección explícito derivado de esas fuentes.

## Conceptos centrales

Harness config define un pequeño conjunto de conceptos coordinados en lugar de un modelo de objetos de producto:

- Manifiesto seleccionado: un archivo TOML local al repositorio, por defecto `./.harness/harness.toml`, que declara la versión del estándar, las raíces fuente configuradas, los objetivos explícitos, las raíces `[[dir]]` ordenadas y las declaraciones de extensión.
- Catálogo fuente: recursos persistentes bajo las raíces fuente `[[resources]]` configuradas, más las salidas relativas al repositorio bajo las raíces fuente `[[dir]]` configuradas.
- Objetivo declarado: una superficie de harness, como `./.agents` o `./.claude`, que recibe proyección solo cuando está listada en el manifiesto.
- Override derivado del objetivo: una carpeta con prefijo de punto dentro de un recurso, como `.claude`, que ajusta archivos para el objetivo correspondiente.
- Superposición de perfil: contenido fuente opcional seleccionado por `.harnessProfile` y declarado con `.harnessProfileRoot`, fusionado por camino fuente lógico sin convertir la carpeta de perfil en un elemento proyectado ordinario.
- Límites de proyección: `.harnessIgnore` para exclusiones y `.harnessMutable` para la propiedad runtime-solo-en-inicialización, incluyendo reglas de ignore raíz, fuente-locales, perfil-locales y locales a la salida objetivo cuando aplique.
- Archivo mutable propiedad del runtime: un archivo objetivo proyectado que comienza desde una plantilla fuente propiedad del repositorio, y luego se convierte en estado runtime local después de la primera activación.
- Proyección de activación: el plan calculado en dry-run-primero desde las entradas seleccionadas hacia los archivos objetivo, incluyendo las acciones create/update/remove/keep/preserve/mutable y las políticas explícitas de limpieza y de archivos mutables.

## Por qué un estándar compartido

- Los equipos pueden inspeccionar un contrato local al repositorio a través de varios harnesses en lugar de tratar cada superficie de harness como formato fuente.
- Un repositorio puede contener el catálogo completo de recursos mientras cada harness recibe solo la proyección revisada para ese contexto.
- El contrato es neutral respecto a la implementación: carpetas, TOML, reglas de ignore, overrides e intención de proyección.
- Los tipos de recursos nuevos y los archivos directos a la raíz del objetivo pueden usar la fuente de recursos configurada antes de que cada runtime soporte un formato nativo.
- Cada proyección de objetivo declarado es explícita, revisable y reproducible desde la fuente, los ignores, los overrides y la política de limpieza.
- Los archivos mutables propiedad del runtime dan a los harnesses vivos un lugar estable para estado local sin convertir las carpetas objetivo en la próxima fuente de verdad.
- Las herramientas pueden mostrar creaciones, actualizaciones, eliminaciones solicitadas, archivos proyectados sin cambios y entradas no gestionadas preservadas antes de cambiar una carpeta viva.

## Núcleo y extensiones

El comportamiento que cambia el plan de proyección base es parte del estándar del núcleo: recursos, objetivos declarados, overrides derivados del objetivo, superposiciones de perfil, `.harnessIgnore`, `.harnessMutable`, limpieza y composición/copia dir. Estas funcionalidades interactúan directamente con la idempotencia, la limpieza de no gestionados y la preservación del objetivo, por lo que necesitan un contrato compartido.

Las extensiones se reservan para comportamiento registrado adyacente a ese contrato. El estándar base define los campos de descubrimiento de extensión y política de activación, mientras cada extensión posee su esquema, compatibilidad, diagnósticos, planificación y escrituras. Una extensión no debe redefinir las fuentes de recursos, los objetivos, los overrides, los perfiles, `.harnessIgnore`, los archivos mutables, la limpieza o el plan de activación del núcleo.

## Partes interesadas

Los equipos de plataforma pueden definir una política local al repositorio para almacenar recursos de harness, revisar cambios y validar caminos en CI.

Los constructores de herramientas pueden consumir un modelo estable de recursos en lugar de extraer datos de las superficies de harness vivas o inventar otro layout.

Los equipos de seguridad pueden revisar recursos fuente canónicos, intención de activación y archivos ignorados o mutables antes de que algo alcance una superficie de ejecución.

Los proyectos de código abierto pueden publicar instrucciones de agente reutilizables sin elegir un runtime de agente único como formato canónico.

## Archivos propiedad del runtime

Los harnesses escriben frecuentemente en las superficies que leen. Los permisos concedidos, los comandos permitidos y los hooks aprendidos aterrizan en archivos como `.claude/settings.local.json`. Harness config mantiene la activación unidireccional a propósito — la proyección siempre fluye de la fuente al objetivo. El estándar base reconoce los archivos mutables declarados por el repositorio pero no intenta inferir por qué los bytes objetivo cambiaron:

- Los archivos gestionados se comparan directamente con la proyección actual. Si los bytes objetivo difieren, la activación puede reportar `update`.
- Los archivos mutables se declaran explícitamente en `.harnessMutable`. El runtime los posee después de la primera proyección. La proyección los crea una vez y luego los deja en paz, incluso cuando sus bytes aún coinciden con la plantilla fuente.

Esto es diferente de ignorar un archivo. Los archivos ignorados no cruzan el límite de proyección. Los archivos mutables sí lo cruzan: el catálogo fuente proporciona la forma inicial, la revisión puede ver que el archivo es esperado, y la activación posterior preserva los bytes objetivo porque el runtime es ahora el propietario. Esto hace los archivos de permisos, configuración local y estado aprendido auditables sin convertirlos en configuración controlada por fuente.

La revisión de edición objetivo, la proyección inversa y la captura objetivo-a-fuente son flujos seguros legítimos, pero dependen fuertemente de prácticas de control de versión y UX de producto. Pertenecen a las capas de producto sobre v1.

## No-objetivos

Harness config no estandariza flujos de producto, servicios alojados, mercados, sistemas de distribución, estado de recuperación, comportamiento de runtime, agrupación, política de selección, revisión de edición objetivo, captura o sincronización remota. Eso pertenece a productos que construyen sobre el estándar base.

## Relación con enfoques existentes

Harness config se inspira en patrones que funcionan en sistemas ampliamente desplegados. No es una generalización de ninguno de ellos; toma prestadas las partes que encajan en un problema de proyección fuente-a-runtime local al repositorio y deja el resto.

- Los **archivos de patrón estilo `.gitignore`** inspiran la sintaxis y la precedencia ordenada de última coincidencia gana de `.harnessIgnore` y `.harnessMutable`. Diferencias: `.harnessIgnore` excluye archivos, mientras `.harnessMutable` declara archivos de inicialización única, porque la proyección tiene más dimensiones que "rastreado vs no rastreado": un archivo puede ser inicializado desde la fuente mientras permanece propiedad del runtime después de la activación.
- Las **superposiciones Helm / Kustomize** (Kubernetes) inspiran la idea de un árbol fuente base compuesto con overrides por objetivo. Harness config mantiene el alcance del override más estrecho: una carpeta con prefijo de punto *dentro del elemento de recurso* cuyo primer segmento coincide con el primer segmento de camino del objetivo, sin lenguaje de patches ni templating. Los archivos de override o reemplazan caminos exactos o añaden nuevos; nada más.
- Las **superposiciones de dotfiles específicas de perfil** inspiran `.harnessProfile` y `.harnessProfileRoot`: los equipos pueden mantener kits opcionales o superposiciones personales bajo `.harness`, seleccionarlos por repositorio o subárbol de salida objetivo y aún revisar la proyección final como creaciones y reemplazos a nivel de archivo.
- **EditorConfig** inspiró la elección de un solo archivo en la raíz del repositorio con una pequeña gramática declarativa que cualquier herramienta puede implementar sin acoplamiento de runtime.
- Los **gestores de dotfiles (chezmoi, GNU Stow, yadm)** abordan un problema relacionado — proyectar un árbol fuente curado en ubicaciones del sistema vivas — para `$HOME` personal en lugar de superficies de agente por repositorio. La distinción fuente-de-verdad / objetivo-como-proyección, incluida la necesidad de un filtro "ignore para proyección", viene de ese linaje.
- **Conventional commits / SemVer / RFC 2119** inspiraron el lenguaje normativo explícito y la política de compatibilidad hacia adelante en [STANDARD.md](./STANDARD.md). Una especificación que los futuros implementadores pueden leer de forma aislada tiene más probabilidades de sobrevivir un cambio de mantenedor.
- **`AGENTS.md`, `CLAUDE.md` y `copilot-instructions.md`** son el arte previo inmediato de *qué* se proyecta. Harness config no define su contenido; les da una ubicación fuente compartida y una forma coherente de componerlos mediante raíces fuente `[[dir]]` configuradas en lugar de sincronizar manualmente prosa duplicada.

Lo que Harness config no intenta deliberadamente ser: un gestor de paquetes, un runtime de plugins, un service mesh, un sistema de permisos, un motor de templating o un SDK de agente. Estos son problemas valiosos pero separables.
