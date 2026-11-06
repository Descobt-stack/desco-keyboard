# Cómo construí Desco Keyboard

Esta es mi guía corta para recordar qué hace cada parte del proyecto y dónde debo cambiarla.

## Archivos principales

### `public/index.html`

Aquí armé la pantalla. Definí el menú, el campo de nombre, los ocho botones de nivel, el tablero global, la arena, el HUD, el área de escritura y los cuadros de ayuda. No contiene la lógica del combate.

### `public/styles.css`

Aquí controlo colores, tamaños, márgenes y adaptación a cada pantalla. La regla `.sentence-line` usa `flex-wrap: wrap`; así una palabra que ya no cabe baja completa a la siguiente línea. También diseñé el tablero y el menú de ocho niveles.

### `public/phrases.js`

Aquí configuré los ocho niveles. Cada nivel define:

- segundos por palabra;
- daño por error y por tiempo agotado;
- cuántas frases limpias necesito para curarme;
- vida que recupero;
- uso de acentos y puntuación;
- cinco secciones con diez frases cada una.

Uso `buildSection()` para combinar partes gramaticales compatibles. Al cargar el archivo verifico que cada nivel tenga exactamente 50 frases.

### `public/game.js`

Este es mi motor principal. `state` guarda toda la partida: nivel, nombre, frase, palabra, vida, combo, errores, tiempos, curación y animaciones.

`handleInput()` compara el texto con la palabra actual. Si agrego varias letras en un solo evento, encolo un golpe por cada una. Si borro, simplemente reduzco el prefijo correcto. `Espacio` y `Enter` llaman a `completeWord()` cuando la palabra está lista.

`resetWordDeadline()` prepara el límite oculto. No dibujo un cronómetro porque quiero que el jugador se concentre en escribir.

`typo()` y `enemyAttack()` son las únicas rutas normales que permiten golpear al jugador. Las dos marcan la frase como imperfecta, por lo que esa frase ya no cuenta para curación.

## Cómo hice las animaciones

`LETTER_ATTACKS` rota cinco movimientos por letra:

| Orden | Acción | Contacto |
|---:|---|---|
| 1 | Jab | torso |
| 2 | Cruzado | pecho |
| 3 | Gancho | cabeza y costado |
| 4 | Uppercut | parte alta |
| 5 | Rodillazo | zona media |

`queuePlayerAction()` guarda todas las acciones. `startNextPlayerAction()` inicia la siguiente únicamente cuando termina la actual. Si escribo muy rápido, reduzco un poco la duración mínima, pero nunca elimino la animación.

En esta fase dejé de mover cada parte con coordenadas independientes. `COMBAT_CLIPS` describe poses de preparación, contacto y recuperación; `sampleCombatClip()` interpola esas poses; `solveCombatTwoBone()` calcula el codo o la rodilla entre dos puntos. `drawStickman()` arma cadera, hombros, cuello, cabeza, brazos y piernas con ese rig. Por eso el puño, la rodilla y el rival terminan en el mismo punto visual donde el juego registra el impacto. La bandana se dibuja como accesorio clásico, sin luces LED ni sombras de neón.

El enemigo también tiene un pequeño pensamiento autónomo: `enemyNextThinkAt` programa ataques espaciados. `enemyAttack('ai')` decide en el momento del ataque si todavía queda tiempo para la palabra. Si queda, `block` muestra la cobertura y no descuenta vida; si no queda, `hit` sincroniza el retroceso y el daño. El reloj de escritura sigue siendo independiente del reloj de animación.

## Cómo hice la curación

`phraseHadError` comienza en `false`. Un error o un tiempo agotado lo cambia a `true`. Cuando termino una frase limpia, aumento `healProgress`. Si alcanzo `healEvery`, recupero `healAmount` y reinicio el progreso. En niveles altos necesito más frases limpias.

## Cómo calculo la puntuación

Uso nivel, PPM, precisión y vida restante:

```js
nivel * 10000 + ppm * 100 + precision * 10 + vida
```

El Worker repite este cálculo; no confía en el número enviado por el navegador.

## `worker/handler.js`

Aquí serví el juego y creé dos rutas:

- `GET /api/leaderboard`: devuelve las 50 mejores marcas.
- `POST /api/scores`: valida los datos y guarda una marca si supera la anterior.

Normalizo el nombre para evitar duplicados por mayúsculas. Solo permito letras, números, espacios, punto, guion y guion bajo, con un máximo de 20 caracteres.

También exijo un origen permitido para enviar marcas, acepto únicamente JSON, corto el cuerpo a 2 KB, aplico un límite básico de 30 envíos por minuto y añado CSP, `nosniff`, `SAMEORIGIN`, `referrer-policy` y `permissions-policy`. El límite en memoria es una barrera adicional; la verificación fuerte contra trampas sigue siendo una fase futura con sesión o firma.

## Base de datos

En `db/schema.ts` describí la tabla `scores`. La combinación `normalized_name + level` es única. En `drizzle/` guardo la migración generada y su historial; no creo tablas dentro de una visita del jugador.

## Construcción y publicación

`scripts/build-site.mjs` lee los cuatro archivos públicos y los incrusta en `dist/server/index.js`. `scripts/validate-site.mjs` confirma que el artefacto exporte un Worker válido y tenga el binding `DB`.

GitHub Pages publica la carpeta `public`. El sitio con base de datos publica el Worker. Ambos parten del mismo repositorio.

## Dónde cambio cada cosa

- Quiero nuevas frases: `public/phrases.js`.
- Quiero ajustar tiempos, daño o curación: configuración de cada nivel en `public/phrases.js`.
- Quiero otro golpe: `LETTER_ATTACKS` y una pose dentro de `COMBAT_CLIPS` en `public/game.js`.
- Quiero cambiar la postura o el punto de contacto: la pose correspondiente en `COMBAT_CLIPS`; `drawStickman()` solo dibuja el rig.
- Quiero ajustar la defensa autónoma: `enemyNextThinkAt`, `enemyAttack()` y `updateCombat()`.
- Quiero mover el HUD o mejorar el salto de línea: `public/styles.css`.
- Quiero cambiar la puntuación: `scoreFor()` en `public/game.js` y `worker/handler.js`.
- Quiero otra columna global: `db/schema.ts`, una nueva migración y las consultas del Worker.

## Verificaciones que debo ejecutar

```bash
node --check public/game.js
node --check public/phrases.js
npm run build
npm run validate
```

Con esta división puedo leer primero la interfaz, después las frases, luego el motor y finalmente el servidor, sin mezclar responsabilidades.
