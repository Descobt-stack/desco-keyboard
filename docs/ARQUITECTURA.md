# Arquitectura de Desco Keyboard

## Mi objetivo

Yo convertí una práctica de mecanografía en un combate visual. Mantengo la escritura y el dibujo en JavaScript nativo para que el juego siga siendo ligero, y uso un Worker con D1 únicamente para compartir puntuaciones.

## Flujo que programé

1. Guardo el nombre y el nivel que eligió el jugador.
2. Selecciono una frase diferente para cada una de las cinco secciones.
3. Comparo la entrada con la palabra activa después de cada cambio.
4. Encolo un golpe por cada letra correcta.
5. Confirmo la palabra con `Espacio` o `Enter`; `Backspace` permite corregir el prefijo escrito.
6. Si hay error o se agota el tiempo oculto, marco la frase como imperfecta y el rival ataca.
7. Al cerrar una frase, calculo derrota del rival, progreso de curación y cambio de sección.
8. Al finalizar guardo la mejor marca local y envío una puntuación validada al tablero global.

## Mis ocho niveles

Cada nivel tiene cinco secciones de diez frases. Los primeros cuatro no usan acentos ni signos. Los niveles 5 y 6 incorporan acentos. Los niveles 7 y 8 exigen signos completos. El tiempo baja de 6 a 2.4 segundos por palabra y la curación necesita entre una y cuatro frases limpias.

## Cola de combate

`playerActionQueue` conserva una acción por letra. `startNextPlayerAction()` inicia una sola acción y acelera ligeramente las pendientes cuando escribo rápido. Así evito sustituir un golpe antes de que llegue al rival.

Mis movimientos son `jab`, `cross`, `hook`, `uppercut`, `knee`, `heavy` y `kick`. Cada acción define duración, momento de impacto y altura de contacto. La reacción del rival empieza exactamente cuando la acción alcanza `impactAt`.

Las poses viven en `COMBAT_CLIPS`. Interpolo cadera, manos y pies y luego resuelvo los dos huesos de cada brazo o pierna. Así puedo cambiar la complexión, añadir casco o máscara más adelante sin reescribir cada fotograma. `enemyNextThinkAt` añade ataques autónomos espaciados y `block` protege al jugador mientras la palabra todavía está dentro de su límite.

## Renderizado

`drawStickman()` construye cada personaje con articulaciones, líneas y círculos. El escenario se guarda en un canvas auxiliar; en cada cuadro dibujo únicamente personajes, polvo y efectos. Reutilizo partículas y textos flotantes, limito el render a 60 FPS y dejo de dibujar cuando la pestaña está oculta. El daño se aplica en el mismo `impactAt` que la pose de contacto, no al comenzar la animación.

## Frases completas

La frase usa un contenedor flexible con salto de línea. Cada palabra es una unidad indivisible, por lo que el navegador mueve la palabra completa a la siguiente línea en lugar de recortarla. En pantallas pequeñas reduzco el tamaño de letra, pero no vuelvo a usar desplazamiento horizontal.

## Tablero global

El navegador envía nombre, nivel, PPM, precisión y vida restante. El Worker valida rangos, vuelve a calcular la puntuación y guarda solo la mejor marca de cada nombre por nivel. D1 usa una restricción única sobre nombre normalizado y nivel. Si el servicio no responde, conservo una tabla local temporal.

La tabla no usa contraseñas ni publica correos. El Worker además limita el origen, el tamaño del JSON y los envíos repetidos. Es un tablero casual; una futura fase puede añadir identidad y verificación más fuerte contra puntuaciones manipuladas.

## Publicación doble

GitHub Pages publica `public/`. El sitio principal empaqueta esos mismos archivos dentro de un Worker que también ofrece `/api/leaderboard` y `/api/scores`. De esta forma mantengo el código público y agrego persistencia global sin exponer una clave de base de datos en el navegador.
