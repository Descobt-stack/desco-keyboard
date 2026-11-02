# Desco Keyboard

Juego web de mecanografía en español con combates stickman. Cada letra correcta activa un ataque, cada palabra completada aumenta el combo y cada error permite que el rival contraataque.

## Funciones de la versión 1.0

- Tres dificultades: Novato, Intermedio y Experto.
- Frases en español organizadas por secciones, con `ñ` y acentos.
- Animación procedural en HTML5 Canvas a 60 FPS.
- PPM, precisión, combo, rango y barras de salud en tiempo real.
- Tres rivales por entrenamiento y ataques con ventana de bloqueo.
- Arena adaptable al alto visible de una laptop sin modificar el zoom.
- Botones de Inicio, Pausa, Ajustes y Ayuda dentro del juego.
- Pausa automática al cambiar de pestaña o minimizar el navegador.
- Sonido generado con Web Audio, sin archivos externos.
- Mejor marca guardada localmente en el navegador.
- Diseño adaptable para computadora, tableta y teléfono.

## Código

El proyecto no depende de frameworks ni de paquetes externos:

- `dist/index.html`: estructura y accesibilidad.
- `dist/styles.css`: interfaz adaptable y dirección visual.
- `dist/game.js`: motor del juego, animación Canvas, mecanografía, estadísticas y audio.

La explicación técnica completa está en [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).

Para probarlo localmente, abre `dist/index.html` o sirve la carpeta con cualquier servidor HTTP estático.

## Mecánica principal

1. El jugador elige una dificultad.
2. El motor selecciona una frase para cada sección del nivel.
3. Cada pulsación se compara con la palabra activa dentro de la frase.
4. Una letra correcta aumenta el conteo para PPM y activa un golpe ligero.
5. `Espacio` confirma una palabra completa, aplica daño fuerte y suma combo.
6. Un error reinicia el combo y resta salud.
7. Completar la frase vence al rival y abre la siguiente sección.
8. Los rivales anuncian sus ataques; completar una palabra durante el aviso bloquea el golpe.

## Autor

Creado por Josué Villarruel · © 2026 JV.

Este proyecto es una implementación original inspirada en el género de juegos de mecanografía y combate stickman. No contiene código ni recursos del sitio de referencia.

## Licencia

MIT
