# Desco Keyboard

Juego web de mecanografía en español con combates stickman. Cada letra correcta activa un ataque, cada palabra completada aumenta el combo y cada error permite que el rival contraataque.

## Funciones principales

- Tres dificultades: Principiante, Intermedio y Experto.
- 150 frases revisadas en español: 50 diferentes por dificultad y cinco secciones por partida.
- El nivel Principiante no exige signos; Intermedio y Experto sí practican acentos y puntuación.
- Animación procedural en HTML5 Canvas a 60 FPS con stickman clásicos, contornos sólidos y colores mate.
- Escenario precalculado, partículas reutilizables y bucle limitado a 60 FPS para reducir consumo de CPU y pausas por recolección de memoria.
- PPM, precisión, combo, rango y barras de salud en tiempo real.
- Cinco rivales por entrenamiento, con colores, salud y secciones diferentes.
- Tiempo oculto por palabra: 5 s en Principiante, 3.5 s en Intermedio y 2.4 s en Experto.
- El rival solo ataca por una equivocación o al agotarse el tiempo de la palabra, sin avisos intrusivos.
- Arena adaptable al alto visible de una laptop sin modificar el zoom.
- Botones de Inicio, Pausa, Ajustes y Ayuda dentro del juego.
- Pausa automática al cambiar de pestaña o minimizar el navegador.
- Tema oscuro y claro seleccionable desde Ajustes.
- Movimiento autónomo de guardia, desplazamiento y respiración para ambos stickman.
- Escenario de montaña y campo de entrenamiento sin efectos de neón.
- Sonido generado con Web Audio, sin archivos externos.
- Mejor marca guardada localmente en el navegador.
- Diseño adaptable para computadora, tableta y teléfono.

## Código

El proyecto no depende de frameworks ni de paquetes externos:

- `dist/index.html`: estructura y accesibilidad.
- `dist/styles.css`: interfaz adaptable y dirección visual.
- `dist/phrases.js`: banco de 150 frases y parámetros de dificultad.
- `dist/game.js`: motor del juego, animación Canvas, mecanografía, estadísticas y audio.

La explicación técnica completa está en [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).

## Optimización aplicada

La versión actual conserva JavaScript y Canvas nativos. Se estudiaron patrones públicos de
[`canvas-arcade`](https://github.com/FabianoArthur/canvas-arcade),
[`Salvo`](https://github.com/Qinging-wu/Salvo),
[`Minesweeper`](https://github.com/YaelRoman/Minesweeper) y la
[guía de optimización de Canvas de MDN](https://github.com/mdn/content/blob/main/files/en-us/web/api/canvas_api/tutorial/optimizing_canvas/index.md).

- El escenario estático se dibuja una vez en un canvas auxiliar y después se copia en una sola operación.
- Las partículas y los textos de daño usan grupos de objetos reutilizables con límites fijos.
- Los efectos avanzan con pasos estables de 60 Hz y el renderizado no supera ese objetivo en pantallas de alta frecuencia.
- La pestaña oculta deja de dibujar la arena y el HUD cronometrado ya no reconstruye toda la frase.

La implementación es propia y adapta las ideas generales al motor de Desco Keyboard; no copia código de esos proyectos.

Para probarlo localmente, abre `dist/index.html` o sirve la carpeta con cualquier servidor HTTP estático.

## Mecánica principal

1. El jugador elige una dificultad.
2. El motor selecciona una frase para cada sección del nivel.
3. Cada pulsación se compara con la palabra activa dentro de la frase.
4. Una letra correcta aumenta el conteo para PPM y activa un golpe ligero.
5. `Espacio` confirma una palabra completa, aplica daño fuerte y suma combo.
6. Un error o agotar el tiempo oculto de la palabra hace que el rival ataque.
7. Completar la frase vence al rival y abre la siguiente sección.
8. La campaña termina después de superar las cinco secciones del nivel.

## Autor

Creado por Josué Villarruel · © 2026 JV.

Este proyecto es una implementación original inspirada en el género de juegos de mecanografía y combate stickman. No contiene código ni recursos del sitio de referencia.

## Licencia

MIT
