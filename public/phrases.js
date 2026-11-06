(() => {
  'use strict';

  function buildSection(title, subjects, actions, endings, punctuation = '') {
    const phrases = [];
    for (const subject of subjects) {
      for (const action of actions) {
        for (const ending of endings) {
          phrases.push(`${subject} ${action} ${ending}${punctuation}`.replace(/\s+/g, ' ').trim());
        }
      }
    }
    return { title, phrases: phrases.slice(0, 10) };
  }

  function buildLevel(settings, sections) {
    const builtSections = sections.map((item) => buildSection(...item));
    const total = builtSections.reduce((sum, item) => sum + item.phrases.length, 0);
    if (total !== 50) throw new Error(`El nivel ${settings.label} debe contener 50 frases.`);
    return { ...settings, sections: builtSections };
  }

  window.DESCO_PHRASE_LEVELS = {
    nivel1: buildLevel({
      number: 1, label: 'Primeros pasos', phaseCount: 10, secondsPerWord: 6,
      typoDamage: 4, timeoutDamage: 5, healEvery: 1, healAmount: 12,
      punctuation: false, accents: false, scoreMultiplier: 1
    }, [
      ['Fila central', ['Mis dedos', 'Las manos'], ['buscan', 'tocan'], ['la fila central con calma', 'cada tecla sin mirar abajo', 'su lugar despues de escribir']],
      ['Postura', ['Mi espalda', 'La postura'], ['mantiene', 'busca'], ['una forma recta al practicar', 'los hombros sueltos al escribir', 'el cuerpo comodo frente al teclado']],
      ['Mano izquierda', ['La mano izquierda', 'Cada dedo izquierdo'], ['practica', 'repite'], ['movimientos cortos y seguros', 'las teclas de su zona', 'un ritmo lento sin saltos']],
      ['Mano derecha', ['La mano derecha', 'Cada dedo derecho'], ['mantiene', 'aprende'], ['un ritmo parejo y simple', 'su camino sobre las teclas', 'movimientos suaves al volver']],
      ['Voces cercanas', ['Mi compa', 'El parce'], ['practica', 'escribe'], ['con calma cada dia', 'junto al teclado', 'con un mate al lado']]
    ]),

    nivel2: buildLevel({
      number: 2, label: 'Base firme', phaseCount: 10, secondsPerWord: 5.5,
      typoDamage: 5, timeoutDamage: 6, healEvery: 1, healAmount: 11,
      punctuation: false, accents: false, scoreMultiplier: 1.2
    }, [
      ['Control de dedos', ['Cada movimiento', 'El control de mis dedos'], ['reduce', 'evita'], ['los golpes fuertes sobre las teclas', 'los saltos fuera de la fila base', 'la tension durante la practica']],
      ['Lectura simple', ['Mi vista', 'La lectura de la frase'], ['sigue', 'anticipa'], ['la palabra que debo escribir', 'el siguiente grupo de letras', 'el orden correcto sin mirar mis manos']],
      ['Espacio y retorno', ['Mi pulgar', 'La barra de espacio'], ['marca', 'separa'], ['cada palabra de forma clara', 'el final de cada intento', 'las ideas dentro de la frase']],
      ['Ritmo estable', ['Un ritmo estable', 'La velocidad constante'], ['me permite', 'ayuda a'], ['conservar la precision', 'terminar sin perder el control', 'reducir pausas entre palabras']],
      ['Rutas del idioma', ['La chamba', 'El ordenador'], ['me ayuda a', 'permite'], ['ganar ritmo sin prisa', 'mantener la mano firme', 'seguir el texto completo']]
    ]),

    nivel3: buildLevel({
      number: 3, label: 'Ritmo constante', phaseCount: 10, secondsPerWord: 5,
      typoDamage: 6, timeoutDamage: 7, healEvery: 2, healAmount: 10,
      punctuation: false, accents: false, scoreMultiplier: 1.45
    }, [
      ['Palabras largas', ['Las palabras largas', 'Cada palabra nueva'], ['necesitan', 'requiere'], ['un movimiento continuo de los dedos', 'atencion desde el inicio', 'calma para llegar hasta el final']],
      ['Lectura previa', ['La lectura previa', 'Mirar hacia adelante'], ['prepara', 'ordena'], ['mis dedos para la siguiente palabra', 'el ritmo antes de escribir', 'la ruta que sigue la frase']],
      ['Trabajo diario', ['El mensaje de trabajo', 'Un reporte sencillo'], ['debe mostrar', 'puede explicar'], ['datos claros para el equipo', 'el problema sin rodeos', 'una idea completa y ordenada']],
      ['Tecnologia', ['La computadora', 'Cada programa'], ['procesa', 'guarda'], ['la informacion de forma segura', 'los cambios antes de cerrar', 'el trabajo que hago durante el dia']],
      ['Vocabulario regional', ['Un pibe', 'Un parcero'], ['escribe', 'revisa'], ['cada frase con cuidado', 'un mensaje de trabajo', 'las teclas de su zona']]
    ]),

    nivel4: buildLevel({
      number: 4, label: 'Fluidez', phaseCount: 10, secondsPerWord: 4.5,
      typoDamage: 7, timeoutDamage: 8, healEvery: 2, healAmount: 9,
      punctuation: false, accents: false, scoreMultiplier: 1.75
    }, [
      ['Frases extensas', ['Una frase extensa', 'El texto completo'], ['pone a prueba', 'me ayuda a mejorar'], ['la continuidad de cada movimiento', 'el control entre palabras diferentes', 'la lectura sin pausas innecesarias']],
      ['Concentracion', ['La mente tranquila', 'Mi atencion constante'], ['mantiene', 'protege'], ['el ritmo aun con palabras nuevas', 'la precision durante toda la frase', 'el orden de los movimientos']],
      ['Memoria muscular', ['La memoria muscular', 'La practica repetida'], ['fortalece', 'convierte'], ['cada ruta sobre el teclado', 'los movimientos lentos en reflejos', 'la posicion correcta de los dedos']],
      ['Resolucion', ['Un problema complejo', 'Cada tarea pendiente'], ['se resuelve con', 'necesita'], ['pasos claros y verificables', 'paciencia antes de actuar', 'un plan simple para avanzar']],
      ['Mezcla hispana', ['El teclado', 'La computadora'], ['recibe', 'procesa'], ['palabras de Mexico y Colombia', 'voces de Argentina y Espana', 'un texto claro para todos']]
    ]),

    nivel5: buildLevel({
      number: 5, label: 'Acentos iniciales', phaseCount: 16, secondsPerWord: 4,
      typoDamage: 8, timeoutDamage: 9, healEvery: 2, healAmount: 8,
      punctuation: false, accents: true, scoreMultiplier: 2.1
    }, [
      ['Vocales con acento', ['La práctica diaria', 'Mi sesión de hoy'], ['incluye', 'refuerza'], ['palabras con acentos correctos', 'la atención sobre cada vocal', 'el hábito de escribir con precisión']],
      ['Ortografía', ['La ortografía clara', 'Cada término difícil'], ['me obliga a', 'ayuda a'], ['recordar dónde va el acento', 'revisar la palabra antes de seguir', 'mantener el significado correcto']],
      ['Comunicación', ['La comunicación escrita', 'Un mensaje útil'], ['necesita', 'mantiene'], ['claridad desde la primera línea', 'un tono amable y directo', 'información fácil de comprender']],
      ['Tecnología', ['La tecnología moderna', 'Una aplicación rápida'], ['permite', 'requiere'], ['resolver tareas con precisión', 'una configuración lógica y segura', 'atención durante cada actualización']],
      ['Vocabulario de América', ['La práctica del parce', 'El mate argentino'], ['me recuerda', 'acompaña'], ['que la precisión une distintas regiones', 'a escribir con calma y atención', 'a reconocer cada expresión']]
    ]),

    nivel6: buildLevel({
      number: 6, label: 'Acentos avanzados', phaseCount: 16, secondsPerWord: 3.5,
      typoDamage: 9, timeoutDamage: 10, healEvery: 3, healAmount: 8,
      punctuation: false, accents: true, scoreMultiplier: 2.5
    }, [
      ['Precisión técnica', ['La precisión técnica', 'Un análisis confiable'], ['exige', 'combina'], ['evidencia útil con decisiones claras', 'atención y método durante el proceso', 'información válida para el diagnóstico']],
      ['Ingeniería', ['La ingeniería de software', 'Cada solución robusta'], ['organiza', 'equilibra'], ['módulos fáciles de mantener', 'rendimiento seguridad y claridad', 'responsabilidades dentro del sistema']],
      ['Registros hispanos', ['Un mensaje colombiano', 'Una nota argentina'], ['combina', 'conserva'], ['palabras locales con claridad técnica', 'el tono de cada región', 'la intención sin perder precisión']],
      ['Diagnóstico', ['El diagnóstico correcto', 'Una revisión metódica'], ['reduce', 'permite'], ['el tiempo necesario de reparación', 'detectar fallas difíciles de reproducir', 'encontrar la causa antes de cambiar algo']],
      ['Dominio de acentos', ['El dominio ortográfico', 'Mi práctica avanzada'], ['mantiene', 'demuestra'], ['los acentos incluso al acelerar', 'calidad en palabras poco comunes', 'coordinación bajo mayor presión']]
    ]),

    nivel7: buildLevel({
      number: 7, label: 'Puntuación', phaseCount: 16, secondsPerWord: 3,
      typoDamage: 10, timeoutDamage: 12, healEvery: 3, healAmount: 7,
      punctuation: true, accents: true, scoreMultiplier: 3
    }, [
      ['Comas y puntos', ['Antes de comenzar,', 'Al terminar cada idea,'], ['reviso', 'confirmo'], ['la frase completa y sigo', 'los signos, los acentos y el ritmo', 'que todo sea claro para el lector'], '.'],
      ['Listas breves', ['El sistema incluye', 'La práctica combina'], ['tres elementos:', 'varias habilidades:'], ['precisión, ritmo y memoria', 'lectura, control y velocidad', 'acentos, signos y correcciones'], '.'],
      ['Decisiones', ['Si aparece un error,', 'Cuando una palabra es difícil,'], ['respiro y', 'corrijo con calma y'], ['continúo sin perder el orden', 'recupero el ritmo de la frase', 'vuelvo a la posición correcta'], '.'],
      ['Preguntas', ['¿Puedo mantener el ritmo si', '¿Qué sucede cuando'], ['aumenta', 'cambia'], ['la dificultad de la sesión?', 'la longitud de la frase?', 'el tipo de puntuación?'], ''],
      ['Variedades del español', ['En Colombia,', 'En Argentina,'], ['aparecen', 'se escuchan'], ['parce, arepa y palabras locales', 'mate, che y expresiones propias', 'voces distintas en una misma frase'], '.']
    ]),

    nivel8: buildLevel({
      number: 8, label: 'Dominio total', phaseCount: 16, secondsPerWord: 2.4,
      typoDamage: 12, timeoutDamage: 14, healEvery: 4, healAmount: 6,
      punctuation: true, accents: true, scoreMultiplier: 3.6
    }, [
      ['Arquitectura', ['Aunque el cambio parezca pequeño,', 'Cuando el sistema crece,'], ['conviene evaluar', 'debemos comprobar'], ['su impacto, sus riesgos y su mantenimiento', 'las dependencias, las pruebas y la reversión', 'el rendimiento, la seguridad y la claridad'], '.'],
      ['Producción', ['Antes del despliegue,', 'Después de publicar,'], ['el equipo verifica', 'la revisión confirma'], ['métricas, registros y rutas críticas', 'que la versión responda como se esperaba', 'los resultados; luego documenta lo aprendido'], '.'],
      ['Comunicación técnica', ['Una conclusión sólida', 'La documentación útil'], ['distingue con precisión', 'explica sin ambigüedad'], ['hechos, hipótesis y recomendaciones', 'qué cambió, por qué y para quién', 'el problema; después propone una solución'], '.'],
      ['Reto de lectura', ['¿Mantendrás la precisión cuando', '¿Podrás corregir sin detenerte si'], ['aparezcan', 'se mezclan'], ['acentos, comas y palabras extensas?', 'preguntas, pausas y signos distintos?', 'términos técnicos y frases complejas?'], ''],
      ['Mezcla final', ['La práctica colombiana,', 'El ritmo argentino,'], ['combina', 'reúne'], ['parce, arepa y precisión técnica', 'mate, che y velocidad constante', 'vocabulario de México, España y todo el idioma'], '.']
    ])
  };
})();
