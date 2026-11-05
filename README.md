# Desco Keyboard

Construí Desco Keyboard como un juego público de mecanografía en español. Cada letra correcta conserva su propio golpe, cada palabra terminada lanza un remate y cada error permite que el rival responda.

## Lo que incluye

- Ocho niveles progresivos, con 50 frases distintas por nivel y cinco secciones por partida.
- Niveles 1 al 4 sin acentos ni puntuación; niveles 5 y 6 con acentos; niveles 7 y 8 con acentos, comas, puntos y otros signos.
- Tiempo oculto de 6 a 2.4 segundos por palabra, según la dificultad.
- `Backspace` para corregir y `Espacio` o `Enter` para confirmar la palabra.
- Frases completas con salto de línea real: ninguna palabra se corta fuera del tablero.
- Curación por frases limpias. En niveles altos necesito completar más frases correctas para recuperar vida.
- Cinco golpes diferentes por letra: jab, cruzado, gancho, uppercut y rodillazo.
- Cola de animaciones: aunque escriba rápido, ninguna letra pierde su movimiento.
- Golpe fuerte o patada al terminar una palabra.
- Tablero global con nombre, nivel y mejor puntuación por jugador.
- Pausa manual y automática al cambiar de pestaña.
- Tema oscuro y claro, sonido Web Audio, PPM, precisión, rango, combo y salud.
- Interfaz adaptable a laptop, tableta y teléfono.

## Cómo organicé el código

- `public/index.html`: estructura visible, menú, ocho niveles, tablero y accesibilidad.
- `public/styles.css`: diseño adaptable, frases multilínea y estilos del tablero.
- `public/phrases.js`: reglas y generador de 400 frases.
- `public/game.js`: mecanografía, combate, curación, puntuación, audio y Canvas.
- `worker/handler.js`: API del tablero global y entrega de los archivos del juego.
- `db/schema.ts`: definición del tablero para D1.
- `drizzle/`: migración versionada de la base de datos.
- `scripts/build-site.mjs`: genera el Worker desplegable sin duplicar manualmente los archivos.
- `.github/workflows/pages.yml`: publica la versión estática en GitHub Pages.

Expliqué todo de forma breve y en primera persona en [Cómo construí Desco Keyboard](docs/GUIA_DEL_CODIGO.md). También dejé el flujo técnico en [Arquitectura](docs/ARQUITECTURA.md).

## Repositorios que estudié

Tomé patrones generales y escribí mi propia implementación:

- [chriscourses/fighting-game](https://github.com/chriscourses/fighting-game): bloquear un estado de ataque hasta que termine.
- [tweenjs/tween.js](https://github.com/tweenjs/tween.js): curvas suaves de aceleración y desaceleración.
- [straker/kontra](https://github.com/straker/kontra): avance de animaciones mediante tiempo acumulado.
- [ioNihal/Game2D](https://github.com/ioNihal/Game2D): bucle fijo, máquina de estados, impactos y renderizado separados.
- [gregm18/Street-Fighter-II-Web-Browser-Edition](https://github.com/gregm18/Street-Fighter-II-Web-Browser-Edition): transiciones válidas entre acciones de combate.
- [pasterpo/Roll-To-Infinity](https://github.com/pasterpo/Roll-To-Infinity): validación de nombres, puntuaciones y consultas de un tablero D1.
- [elithrar/http-api-d1-example](https://github.com/elithrar/http-api-d1-example): estructura sencilla de una API HTTP sobre D1.
- [lijoraj-p-r/TypeBlaster](https://github.com/lijoraj-p-r/TypeBlaster): dificultad, entrada de teclado y métricas de un juego de escritura.

No copié personajes, recursos ni código de esos proyectos o del sitio que sirvió como referencia visual.

## Desarrollo

La versión de GitHub Pages se sirve desde `public/`. El sitio con tablero global se construye como Worker:

```bash
npm install
npm run build
npm run validate
```

Para regenerar una migración después de cambiar `db/schema.ts`:

```bash
npm run db:generate
```

## Autor

Creado por Josué Villarruel · © 2026 JV.

Licencia MIT.
