# Arquitectura de Desco Keyboard

## Objetivo

Desco Keyboard convierte una sesión de mecanografía en un combate visual. La aplicación no copia el código del juego de referencia: implementa desde cero la misma categoría de interacción usando HTML, CSS, JavaScript, Canvas y Web Audio.

## Flujo del juego

1. El jugador selecciona `Novato`, `Intermedio` o `Experto`.
2. `beginGame()` reinicia las estadísticas y mezcla el banco de palabras con `shuffled()`.
3. El evento `input` llama a `handleInput()` después de cada pulsación.
4. Si el texto sigue siendo un prefijo válido de la palabra objetivo, la letra cuenta como correcta y `lightAttack()` activa un golpe rápido.
5. Al escribir la palabra completa y presionar espacio, `completeWord()` calcula daño, combo, rango y cambio de rival.
6. Si la entrada no coincide con la palabra, `typo()` resta salud, reinicia el combo y activa el contraataque.
7. `requestAnimationFrame(render)` mantiene el dibujo y las animaciones sincronizados con la pantalla.

## Estado central

El objeto `state` contiene toda la sesión activa:

- modo actual (`menu`, `playing`, `paused`, `won`, `lost`);
- dificultad y cola de palabras;
- salud del jugador y del rival;
- combo, mejor combo, teclas correctas y errores;
- tiempos de inicio y del próximo ataque rival;
- animación activa, partículas, texto flotante y audio.

Mantener el estado en un solo objeto hace que la primera versión sea fácil de leer y modificar. Si el proyecto crece, puede separarse en módulos (`engine`, `typing`, `renderer`, `audio` y `storage`).

## Medición de mecanografía

Las PPM se calculan con la fórmula habitual:

```js
(caracteresCorrectos / 5) / minutosTranscurridos
```

La precisión se obtiene dividiendo las pulsaciones correctas entre el total de pulsaciones evaluadas. Los acentos y la `ñ` forman parte de la palabra y deben escribirse correctamente.

## Combate y dificultad

Cada dificultad define:

- banco de palabras;
- daño recibido por error;
- intervalo de ataque del enemigo.

Los enemigos tienen diferente salud y velocidad. Antes de atacar aparece un aviso. Si el jugador termina una palabra durante esa ventana, bloquea el golpe. De esta forma la velocidad ayuda, pero la precisión sigue siendo la prioridad.

## Animación Canvas

Los personajes no son imágenes. `drawStickman()` construye cada figura con líneas, círculos y articulaciones. Las acciones cambian las coordenadas de brazos, piernas y cuerpo mediante interpolación temporal:

- `jab`: golpe ligero por letra;
- `heavy`: golpe fuerte por palabra;
- `kick`: remate periódico del combo;
- `hit`: reacción al daño;
- `spawn`: entrada del rival;
- `defeated`: caída del rival.

Las partículas, el destello y el movimiento de cámara se calculan en cada cuadro y se eliminan cuando termina su vida útil.

## Audio y almacenamiento

Los efectos se generan con osciladores de Web Audio; no se descargan archivos de sonido. La preferencia de sonido y la mejor marca se guardan con `localStorage`, por lo que los datos permanecen únicamente en el navegador del jugador.

## Próximas mejoras propuestas

- Lecciones por filas del teclado y por dedos.
- Frases completas con signos de puntuación.
- Campaña con más escenarios y jefes.
- Perfil local con historial de PPM y precisión.
- Modo sin límite de tiempo y modo contrarreloj.
- Soporte PWA para jugar sin conexión.
- Pruebas automatizadas del motor de escritura.
