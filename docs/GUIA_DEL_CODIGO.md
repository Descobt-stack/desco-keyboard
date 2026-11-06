# Cómo construí Desco Keyboard

Esta es mi explicación breve de cómo construí cada parte del proyecto y dónde la puedo cambiar.

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
- cinco temas con diez frases cada uno;
- diez fases jugables en los niveles 1–4 y dieciséis en los niveles 5–8.

Uso `buildSection()` para combinar partes gramaticales compatibles. Al cargar el archivo verifico que cada nivel tenga exactamente 50 frases.

### `public/game.js`

Este es mi motor principal. `state` guarda toda la partida: nivel, nombre, frase, palabra, vida, combo, errores, tiempos, curación y animaciones.

`buildLessons()` aplana los cinco temas, evita repetir las frases más recientes y selecciona 10 o 16 fases según el nivel. Si ya tengo letras falladas, prioriza las frases que contienen esas letras.

`handleInput()` compara el texto con la palabra actual. Si agrego varias letras en un solo evento, encolo un golpe por cada una. Si borro, simplemente reduzco el prefijo correcto. `Espacio` y `Enter` llaman a `completeWord()` cuando la palabra está lista.

`resetWordDeadline()` prepara el límite de cada palabra. `updateTimerUi()` muestra el tiempo restante con décimas, cambia de color cuando queda poco y actualiza la barra de progreso de la fase. El límite continúa sincronizado con la pausa y con el ataque autónomo del rival.

`recordTypingMistakes()` compara la palabra esperada con lo que escribí y guarda contadores de letras en `localStorage`. `trainerFocusLetters()` obtiene las tres letras con más fallos y `updateTrainerUi()` me lo explica sin mandar datos fuera del navegador. `typo()` y `enemyAttack()` son las únicas rutas normales que permiten golpear al jugador. Las dos marcan la frase como imperfecta, por lo que esa frase ya no cuenta para curación.

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

Yo separé la puntuación por nivel para que el tablero solo compare a quienes jugaron la misma dificultad. Cada nivel tiene un límite corto y creciente: el nivel 1 llega a 650 puntos y los siguientes llegan a 725, 800, 875, 950, 1025, 1100 y 1175.

La marca combina cinco señales: 25% de velocidad (PPM), 25% de precisión, 20% de letras correctas, 15% del mejor combo y 15% de vida restante. Cada señal se compara con la meta propia del nivel y queda limitada al 100%, así que escribir más rápido no genera cifras gigantes.

Para que una campaña completada de mayor dificultad siempre tenga más valor que una campaña inferior, cada nivel ocupa una banda sin solaparse. El nivel 1 ocupa de 0 a 650; el nivel 2 empieza en 651; el nivel 3 en 726, y así sucesivamente. Dentro de su banda, la calificación depende de mis métricas: D, C, B, A, S o SS. Una marca perfecta alcanza el límite de su nivel.

Si completo todas las fases guardo el resultado de esa banda. Si pierdo o abandono, calculo lo que llevaba según el avance de la fase y conservo solo el 10%. El navegador y el Worker repiten la misma fórmula; el servidor no confía en la puntuación enviada por el navegador.

## `worker/handler.js`

Aquí serví el juego y creé dos rutas:

- `GET /api/leaderboard?level=3`: devuelve las 50 mejores marcas del nivel solicitado. Si no indico nivel, mantiene la consulta general para compatibilidad.
- `POST /api/scores`: valida los datos y guarda una marca si supera la anterior.

Normalizo el nombre para evitar duplicados por mayúsculas. Solo permito letras, números, espacios, punto, guion y guion bajo, con un máximo de 20 caracteres. La combinación de jugador y nivel es independiente: una marca del nivel 1 no ocupa el lugar de una marca del nivel 4. La temporada nueva ignora las marcas anteriores para que el tablero empiece limpio.

También exijo un origen permitido para enviar marcas, acepto únicamente JSON, corto el cuerpo a 2 KB, aplico un límite básico de 10 envíos por minuto y vuelvo a calcular PPM, precisión y fases terminadas a partir de las métricas enviadas. Añado CSP, `nosniff`, `SAMEORIGIN`, `referrer-policy` y `permissions-policy`. El límite en memoria y la validación cruzada son barreras adicionales; la verificación fuerte contra trampas sigue siendo una fase futura con sesión o firma.

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
