# Arquitectura de Desco Keyboard

## Mi objetivo

Yo convertí una práctica de mecanografía en un combate visual. Mantengo la escritura y el dibujo en JavaScript nativo para que el juego siga siendo ligero, y uso un Worker con D1 únicamente para compartir puntuaciones.

## Flujo que programé

1. Guardo el nombre y el nivel que eligió el jugador.
2. Construyo una campaña de 10 fases en los niveles 1–4 y de 16 fases en los niveles 5–8, tomando frases distintas del banco de 50.
3. Comparo la entrada con la palabra activa después de cada cambio.
4. Encolo un golpe por cada letra correcta.
5. Confirmo la palabra con `Espacio` o `Enter`; `Backspace` permite corregir el prefijo escrito.
6. Si hay error o se agota el tiempo oculto, marco la frase como imperfecta y el rival ataca.
7. Al cerrar una frase, calculo derrota del rival, progreso de curación y cambio de fase.
8. Al finalizar guardo la mejor marca local y envío una puntuación validada al tablero global.

## Mis ocho niveles

Cada nivel conserva 50 frases, organizadas en cinco temas para poder alternarlas. En cada partida selecciono 10 fases en los primeros cuatro niveles y 16 en los cuatro avanzados. Los primeros cuatro no usan acentos ni signos. Los niveles 5 y 6 incorporan acentos. Los niveles 7 y 8 exigen signos completos. El tiempo baja de 6 a 2.4 segundos por palabra y la curación necesita entre una y cuatro frases limpias.

## Cola de combate

`playerActionQueue` conserva una acción por letra. `startNextPlayerAction()` inicia una sola acción y acelera ligeramente las pendientes cuando escribo rápido. Así evito sustituir un golpe antes de que llegue al rival.

Mis movimientos son `jab`, `cross`, `hook`, `uppercut`, `knee`, `heavy` y `kick`. Cada acción define duración, momento de impacto y altura de contacto. La reacción del rival empieza exactamente cuando la acción alcanza `impactAt`.

Las poses viven en `COMBAT_CLIPS`. Interpolo cadera, manos y pies y luego resuelvo los dos huesos de cada brazo o pierna. Así puedo cambiar la complexión, añadir casco o máscara más adelante sin reescribir cada fotograma. `enemyNextThinkAt` añade ataques autónomos espaciados y `block` protege al jugador mientras la palabra todavía está dentro de su límite.

## Renderizado

`drawStickman()` construye cada personaje con articulaciones, líneas y círculos. El escenario se guarda en un canvas auxiliar; en cada cuadro dibujo únicamente personajes, polvo y efectos. Reutilizo partículas y textos flotantes, limito el render a 60 FPS y dejo de dibujar cuando la pestaña está oculta. El daño se aplica en el mismo `impactAt` que la pose de contacto, no al comenzar la animación.

## Frases completas

La frase usa un contenedor flexible con salto de línea. Cada palabra es una unidad indivisible, por lo que el navegador mueve la palabra completa a la siguiente línea en lugar de recortarla. En pantallas pequeñas reduzco el tamaño de letra, pero no vuelvo a usar desplazamiento horizontal.

## Entrenador local

`recordTypingMistakes()` compara la palabra que esperaba con el texto que fallé. Acumulo las letras problemáticas en `localStorage`, sin enviarlas al servidor. En la siguiente partida `buildLessons()` prioriza frases que contienen mis tres letras con más errores; así practico un patrón concreto en lugar de recibir frases al azar. El panel del menú me muestra qué letras está usando el entrenador.

## Tablero global

El navegador envía nombre, nivel, PPM, precisión, vida restante, teclas correctas e incorrectas, duración, combo, avance y fases terminadas. El Worker vuelve a calcular PPM, precisión y puntuación a partir de esas métricas, exige que coincidan con la marca declarada, comprueba si la cantidad de fases corresponde al nivel y guarda solo la mejor marca independiente de cada jugador y nivel. El tablero se consulta con el nivel elegido, así que una pantalla de nivel 1 no mezcla resultados de nivel 4.

La puntuación usa bandas sin solapamiento: el nivel 1 llega a 650 y cada nivel siguiente tiene un límite mayor y comienza después del límite anterior. Dentro de la banda, peso velocidad, precisión, letras correctas, combo y vida. Una campaña completa conserva el 100% de ese resultado; una incompleta conserva el 10% de lo obtenido hasta el avance alcanzado. Una campaña perfecta sin errores recibe S+ y se guarda un punto por encima del líder actual del nivel. Las marcas históricas no se eliminan. Si el servicio no responde, conservo una tabla local temporal.

La tabla no usa contraseñas ni publica correos. El Worker además limita el origen, el tamaño del JSON y los envíos repetidos a 10 por minuto por cliente. El navegador genera un identificador estable por dispositivo; el Worker lo combina con el nombre y el nivel para conservar la marca del mismo equipo y añadir un sufijo cuando aparece otro equipo con el mismo nombre. Esta validación eleva la barrera contra puntuaciones falsas; una futura fase podría añadir identidad y una sesión firmada para una verificación todavía más fuerte.

## Publicación doble

GitHub Pages publica `public/`. El sitio principal empaqueta esos mismos archivos dentro de un Worker que también ofrece `/api/leaderboard` y `/api/scores`. De esta forma mantengo el código público y agrego persistencia global sin exponer una clave de base de datos en el navegador.
