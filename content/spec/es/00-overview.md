---
title: Visión general
seoTitle: Visión general de Harness config
socialTitle: Una capa fuente neutral para superficies de harness
description: Un layout fuente local y un modelo de activación para configuración avanzada y predecible de superficies de harness entre runtimes, equipos, perfiles, controles locales y archivos mutables propiedad del runtime.
socialDescription: Visión general de cómo .harness usa activación local en dry-run, límites de proyección, superposiciones de perfil, controles locales al objetivo, archivos mutables propiedad del runtime, herramientas sin telemetría y objetivos explícitos para hacer la configuración de agentes más potente sin volverla implícita.
canonicalPath: /specifications/v1/
slug: overview
order: 0
locale: es
sectionCode: "00"
summary: El layout fuente, el modelo de activación local, los controles de proyección, los archivos mutables propiedad del runtime, las superposiciones de perfil, los controles locales al objetivo, las herramientas sin telemetría y los beneficios operativos en una lectura.
llmSummary: Presenta .harness como un catálogo fuente propiedad del repositorio para configuración de agentes, con activación local en dry-run, herramientas sin telemetría, archivos de instrucciones componibles, superposiciones de perfil, archivos mutables propiedad del runtime, controles locales al objetivo y proyecciones runtime explícitas que hacen la configuración avanzada predecible, revisable y reutilizable.
audience: Lectores técnicos e implementadores que evalúan configuración de agentes local al repositorio.
contentKind: spec
status: draft
updated: 2026-05-26
---

# Una capa fuente neutral para superficies de harness

Los harnesses exponen archivos y carpetas vivos como `AGENTS.md`, `.agents`, `.claude`, `.gemini` y `.cursor`. Esos archivos y carpetas son superficies de harness útiles, pero son una fuente de verdad débil cuando varias herramientas necesitan los mismos skills, reglas, plugins y archivos de instrucciones.

Harness config mantiene los recursos reutilizables de agente en raíces fuente propiedad del repositorio, por convención bajo `.harness`, declara cada salida de superficie de harness como un objetivo explícito, y materializa cada objetivo mediante una proyección de copia con dry-run previo. Las raíces fuente ordenadas permiten a un proyecto superponer configuración compartida con personalización local opcional mientras mantiene estable la fuente revisada.

La idea central es un límite de propiedad. Los prompts, skills, reglas, hooks y partes de instrucciones canónicos son fuente propiedad del repositorio. Las superficies de harness vivas son salidas generadas. Los archivos declarados en `.harnessMutable` se inicializan desde la fuente una vez y luego se convierten en estado objetivo propiedad del runtime para configuraciones, permisos, comandos aprendidos y otros datos locales que deben sobrevivir a la siguiente activación.

El modelo de privacidad se deriva del mismo contrato de archivos. Validación, planificación y activación operan sobre los archivos del repositorio localmente; el estándar no requiere telemetría, analítica, servicios alojados ni acceso a red.

## Por qué importa la activación

La activación es el beneficio operacional del estándar. Convierte la configuración de agente, dispersa en varias carpetas vivas, en un paso de proyección repetible: leer el catálogo fuente, aplicar perfiles y diferencias específicas del objetivo, filtrar el límite, previsualizar el plan y luego escribir archivos ordinarios solo después de la revisión.

Ese límite proporciona un comportamiento secundario útil sin convertir `.harness` en una plataforma de producto completa. CI puede validar el mismo manifiesto que un desarrollador usa localmente. Los editores pueden previsualizar lo que un harness recibirá. Las herramientas de revisión pueden mostrar qué archivos objetivo son creados, actualizados, preservados o intencionalmente dejados como mutables. Múltiples harnesses pueden consumir el mismo recurso fuente sin tratar ninguna superficie de harness como formato canónico, mientras cada runtime puede mantener su propio estado mutable.

El resultado no es más ceremonia alrededor de la configuración de agente. Es menos estado oculto: un estándar pequeño que hace la activación explicable, repetible y suficientemente segura para automatizar.

## Configuración avanzada, forma predecible

El estándar soporta configuración expresiva sin hacer la activación opaca. Los perfiles permiten a un equipo, desarrollador o subárbol objetivo seleccionar una capa de configuración. La composición `[[dir]]` permite ensamblar archivos de instrucciones compartidos a partir de partes revisadas. Los archivos `.harnessIgnore` y `.harnessProfile` de salida objetivo permiten que una superficie de harness viva mantenga controles locales sin promover esos controles de vuelta a la fuente canónica.

Estas funcionalidades son intencionalmente indirectas. No piden a cada herramienta inventar una nueva UI de configuración, un registro o un servicio de sincronización. Le dan a las herramientas un contrato de archivos estable que pueden inspeccionar: qué fuente existe, qué perfil está activo, qué objetivo recibe qué proyección, qué se filtra y qué se preservará durante la limpieza.

Ese es el valor central del estándar: configurabilidad avanzada con un plan de activación predecible. Un equipo de plataforma puede entregar un kit de seguridad o despliegue. Un proyecto puede componer `AGENTS.md` a partir de secciones compartidas. Un desarrollador puede mantener una preferencia local de objetivo. Un job de CI aún puede explicar el mismo resultado desde los archivos del repositorio antes de que se escriba algo.

## Qué hace

Harness config responde cuatro preguntas prácticas:

- **¿Dónde vive la configuración de agente persistente?** En raíces fuente configuradas, bajo `.harness/` por defecto, no en una superficie de harness en la que una herramienta también pueda escribir.
- **¿Qué carpetas vivas reciben archivos generados?** Solo los caminos declarados como `[[targets]]` en el manifiesto seleccionado, que por defecto es `./.harness/harness.toml`.
- **¿Qué se permite cruzar el límite de proyección?** Los archivos `.harnessIgnore` pueden filtrar por camino fuente y por camino de salida final.
- **¿Qué archivos objetivo puede poseer el runtime?** Las reglas `.harnessMutable` inicializan archivos una vez y luego preservan los bytes objetivo vivos como estado propiedad del runtime.
- **¿Cómo varían los equipos la salida de manera segura?** Los overrides derivados del objetivo manejan diferencias de runtime; las superposiciones de perfil manejan kits de equipo, personalizaciones individuales y variantes locales al objetivo.
- **¿Cómo se mantiene responsable la variación local?** Los perfiles e ignores de salida objetivo se preservan como controles vivos, mientras la activación aún reporta el plan calculado antes de escribir.

## Qué define el estándar

- El manifiesto seleccionado, por defecto `./.harness/harness.toml`, declara la versión del estándar, las fuentes `[[resources]]` ordenadas, las fuentes `[[dir]]` ordenadas y los `[[targets]]` explícitos.
- Las carpetas de recursos viven bajo las fuentes de recursos configuradas, con caminos comunes como `.harness/resources/skills/<name>` o cualquier directorio personalizado que el repositorio porte allí. Una hoja `.harnessComposable` en una fuente de recursos compone un archivo de recurso proyectado para cada objetivo declarado.
- Las carpetas de override derivadas del objetivo como `.claude` o `.agents` viven dentro de un recurso y se fusionan solo cuando el objetivo correspondiente es proyectado.
- Los archivos `.harnessIgnore` definen el límite de proyección. El archivo raíz del repositorio puede coincidir con caminos fuente y caminos de salida. Los archivos fuente-locales siguen caminos fuente. Los archivos locales a la salida objetivo siguen caminos de salida finales y se preservan durante la limpieza.
- Las fuentes `[[dir]]` son separadas de los recursos; componen hojas `.harnessComposable` en salidas relativas al repositorio como `AGENTS.md`, o copian archivos a caminos de salida relativos al repositorio.
- `.harnessProfile` selecciona un perfil activo. `.harnessProfileRoot` declara una raíz de superposición de perfil bajo `.harness` o una raíz fuente configurada. Las superposiciones activas pueden añadir o reescribir recursos y partes componibles de dir sin convertir la carpeta de perfil en un elemento proyectado ordinario.

## Por qué ayuda

El catálogo completo permanece revisable en un solo lugar. Las superficies de harness siguen siendo archivos y carpetas vivas ordinarios que pueden ser regenerados, limpiados o ignorados por Git cuando un equipo lo elija. Esa flexibilidad es útil para experimentos: un desarrollador puede probar configuraciones de harness locales, archivos scratch o estado runtime sin convertir esas ediciones en fuente compartida. El modelo de archivos mutables hace esa distinción explícita en lugar de depender de convención o estado de producto oculto.

Los controles de ignore y perfil importan porque los repositorios reales tienen variación local. Un equipo puede querer que `.claude` excluya un archivo scratch generado mientras `.agents` lo mantiene. Un desarrollador puede querer un prefacio personal de `AGENTS.md` sin cambiar las instrucciones del equipo. Un grupo de plataforma puede entregar un kit de despliegue que aporte skills y partes de instrucciones solo cuando se seleccione. Estos flujos necesitan control preciso de salida, no otro árbol fuente oculto dentro de una superficie de harness.

## Flujo de activación

1. Parsear el manifiesto seleccionado y las raíces fuente configuradas.
2. Descubrir los selectores `.harnessProfile` y las superposiciones `.harnessProfileRoot` activas.
3. Construir la proyección del objetivo desde los recursos fuente, las superposiciones de perfil y los overrides objetivo coincidentes.
4. Aplicar las reglas `.harnessIgnore` raíz, fuente-locales, perfil-locales y de salida objetivo usando el camino fuente o de salida correcto para cada conjunto de reglas.
5. Componer o copiar las salidas dir y fusionar las salidas que caen bajo objetivos declarados.
6. Previsualizar creaciones, actualizaciones, saltos de mutables, eliminaciones, mantenimientos y entradas no gestionadas preservadas antes de escribir.

La restricción importante es la propiedad unidireccional: `.harness/` es canónico, los objetivos vivos son salidas generadas, los archivos de declaración de salida objetivo como `.harnessIgnore` y `.harnessProfile` son controles locales protegidos en lugar de archivos fuente proyectados, y los archivos `.harnessMutable` son propiedad del runtime después de su primera proyección.

## Propuesta abierta

Harness config se desarrolla como una propuesta de especificación abierta. La retroalimentación de repositorios reales, autores de runtime y constructores de herramientas es especialmente útil mientras el límite siga siendo lo suficientemente pequeño para razonar sobre él.

Use el repositorio [`reachjalil/harness-config`](https://github.com/reachjalil/harness-config) para preguntas, issues, notas de compatibilidad, ejemplos y pull requests.
