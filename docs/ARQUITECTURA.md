# Arquitectura de Desco Keyboard

## Objetivo

Desco Keyboard convierte una sesión de mecanografía en un combate visual. La aplicación no copia el código del juego de referencia: implementa desde cero la misma categoría de interacción usando HTML, CSS, JavaScript, Canvas y Web Audio.

## Flujo del juego

1. El jugador selecciona `Novato`, `Intermedio` o `Experto`.
2. `beginGame()` reinicia las estadísticas y selecciona una frase para cada sección del nivel.
3. El evento `input` llama a `handleInput()` después de cada pulsación.
4. Si el texto sigue siendo un prefijo válido de la palabra objetivo, la letra cuenta como correcta y `lightAttack()` activa un golpe rápido.
5. Al escribir la palabra completa y presionar espacio, `completeWord()` calcula daño, combo y avance dentro de la frase.
6. Si la entrada no coincide con la palabra, `typo()` resta salud, reinicia el combo y activa el contraataque.
7. Al terminar una frase se completa la sección, cae el rival y comienza la siguiente de cinco oleadas.
8. `requestAnimationFrame(render)` mantiene el dibujo y las animaciones sincronizados con la pantalla.

## Estado central

El objeto `state` contiene toda la sesión activa:

- modo actual (`menu`, `playing`, `paused`, `won`, `lost`);
- dificultad, secciones, frases y palabra activa;
- salud del jugador y del rival;
- combo, mejor combo, teclas correctas y errores;
- tiempos de inicio, pausa y límite oculto de la palabra activa;
- preferencia de tema oscuro o claro;
- animación activa, partículas, texto flotante y audio.

Mantener el estado en un solo objeto hace que la primera versión sea fácil de leer y modificar. Si el proyecto crece, puede separarse en módulos (`engine`, `typing`, `renderer`, `audio` y `storage`).

## Medición de mecanografía

Las PPM se calculan con la fórmula habitual:

```js
(caracteresCorrectos / 5) / minutosTranscurridos
```

La precisión se obtiene dividiendo las pulsaciones correctas entre el total de pulsaciones evaluadas. Los acentos y la `ñ` forman parte de la palabra y deben escribirse correctamente.

## Combate y dificultad

`phrases.js` contiene 50 frases por dificultad, repartidas en cinco secciones. La selección evita repetir inmediatamente la frase utilizada en la partida anterior. Cada dificultad define:

- banco de frases;
- daño recibido por error;
- segundos disponibles por palabra;
- daño recibido al agotarse ese tiempo.

Los enemigos tienen distinta salud y color. Cada rival corresponde a una sección y recibe daño conforme se completa su frase. No existen ataques periódicos ni avisos previos: el enemigo solo contraataca si el jugador pulsa una tecla incorrecta o supera el tiempo oculto de la palabra. El límite es de 5 segundos por palabra en Principiante, 3.5 en Intermedio y 2.4 en Experto.

Principiante muestra frases sin signos de puntuación. Intermedio y Experto conservan acentos, comas, punto y otros signos como parte de la escritura evaluada.

## Ajuste de pantalla y pausa

Durante el combate, la clase `game-active` convierte la arena en una superficie de `100dvh`. Los encabezados y bloques informativos externos se ocultan temporalmente, mientras el HUD, la frase y los controles permanecen dentro del mismo alto visible. Esto evita tener que reducir el zoom en pantallas de laptop.

Los botones de la arena permiten volver al inicio, pausar, abrir ajustes y consultar la ayuda. El evento `visibilitychange` llama a `pauseGame()` cuando el usuario cambia de pestaña o minimiza el navegador.

## Animación Canvas

Los personajes no son imágenes. `drawStickman()` construye cada figura con líneas, círculos y articulaciones. La dirección visual utiliza rellenos mate, contornos oscuros y cintas de combate, sin resplandores LED. Incluso en reposo, ambos personajes cambian de guardia, postura y posición de forma autónoma. Las acciones cambian las coordenadas de brazos, piernas y cuerpo mediante interpolación temporal:

- `jab`: golpe ligero por letra;
- `heavy`: golpe fuerte por palabra;
- `kick`: remate periódico del combo;
- `hit`: reacción al daño;
- `spawn`: entrada del rival;
- `defeated`: caída del rival.

Las partículas, el destello y el movimiento de cámara se calculan en cada cuadro y se eliminan cuando termina su vida útil.

## Audio y almacenamiento

Los efectos se generan con osciladores de Web Audio; no se descargan archivos de sonido. La preferencia de sonido, el tema, la última frase de cada sección y la mejor marca se guardan con `localStorage`, por lo que los datos permanecen únicamente en el navegador del jugador.

## Próximas mejoras propuestas

- Lecciones por filas del teclado y por dedos.
- Campaña con más escenarios y jefes.
- Perfil local con historial de PPM y precisión.
- Modo sin límite de tiempo y modo contrarreloj.
- Soporte PWA para jugar sin conexión.
- Pruebas automatizadas del motor de escritura.
