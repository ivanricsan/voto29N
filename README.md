# Voto Informado 29N

Aplicación web estática en español para ordenar preferencias electorales y consultar fuentes. La interfaz no asigna afinidad, no ordena partidos y no recomienda el voto.

## Estado del contenido

**Corte documental: 8 de octubre de 2026.** La convocatoria está confirmada en el BOE. Las candidaturas de 2026 aún no estaban proclamadas según el calendario de la Junta Electoral. Esta versión incluye un banco de 42 preguntas y cuatro registros institucionales de contexto; no incluye una revisión partidista completa de 2018–2026, una evaluación de compromisos ni comparaciones entre organizaciones. La interfaz muestra estas lagunas de forma visible.

## Funciones

- 43 preguntas en 14 ámbitos, con alternativas de política y escalas de acuerdo.
- Importancia configurable y marca personal de asuntos innegociables.
- Respuestas “No lo sé”, “No tengo una posición definida” y “Prefiero omitir”.
- Progreso local en el navegador, edición posterior y borrado de datos.
- Perfil descriptivo sin porcentajes ni puntuación partidista.
- Explorador filtrable de registros, fuentes y compromisos (sin compromisos evaluados aún).
- Enlace de herramienta y enlace opcional de perfil, generado tras confirmación explícita.
- Las respuestas compartidas se codifican en `#perfil=…`; los fragmentos URL no se envían en la petición HTTP.
- Sin cuenta, API, analítica, cookies de seguimiento ni dependencias externas.

## Ejecución local

No se requieren dependencias ni compilación. Desde la carpeta del proyecto:

```sh
python3 -m http.server 4173 --directory dist
```

Abre `http://localhost:4173`. La carga desde `file://` no está soportada porque la aplicación obtiene sus ficheros JSON mediante `fetch`.

## Comprobación de datos y sintaxis

```sh
node --check dist/app.js
node scripts/check-data.mjs
```

## Publicación estática

El directorio publicable es `dist/`. Se puede desplegar como sitio estático en Sites, Cloudflare Pages, GitHub Pages o Vercel. No hay proceso de build ni variables de entorno. El manifest de Sites está en `.openai/hosting.json`.

Los pasos detallados para Cloudflare Pages, Vercel y GitHub Pages están en `DEPLOY.md`; el informe de verificaciones y límites está en `AUDIT.md`.

## Estructura

- `dist/index.html`: documento principal.
- `dist/app.js`: navegación, cuestionario, persistencia local, perfil y filtros.
- `dist/styles.css`: interfaz adaptable y accesible.
- `dist/data/questions.json`: preguntas y opciones, sin posiciones de partidos.
- `dist/data/evidence.json`: fuentes, registros, estado de cobertura y taxonomía de compromisos.
- `RESEARCH.md`: registro de cobertura y fuentes iniciales.
- `METHODOLOGY.md`: reglas de investigación, comparación y neutralidad.

## Privacidad y límites

El almacenamiento local depende del navegador y dispositivo usados. El enlace compartido revela el perfil a quien lo reciba; la confirmación antes de generarlo explica ese efecto. La aplicación no afirma que el anonimato del portapapeles o del canal donde se comparta esté garantizado.

La base de datos política debe revisarse antes de utilizarse para una decisión electoral. Los partidos, coaliciones y grupos parlamentarios no son categorías intercambiables. Las organizaciones del índice son referencias iniciales, no candidaturas confirmadas para cada circunscripción.
