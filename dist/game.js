(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const canvas = $('arena');
  const ctx = canvas.getContext('2d');
  const PLAYER_X = 405;
  const ENEMY_X = 875;

  const LEVELS = window.DESCO_PHRASE_LEVELS;
  if (!LEVELS) throw new Error('No se pudo cargar el banco de frases.');

  const ENEMIES = [
    { name: 'CARMESÍ', color: '#c84545', hp: 72 },
    { name: 'BRASA', color: '#d66b36', hp: 82 },
    { name: 'ÁMBAR', color: '#c49a38', hp: 92 },
    { name: 'MAGENTA', color: '#9d4c70', hp: 104 },
    { name: 'VÓRTICE', color: '#6f5b9f', hp: 116 }
  ];

  const state = {
    mode: 'menu',
    level: 'novato',
    lessons: [],
    wordIndex: 0,
    typed: '',
    wave: 0,
    playerHp: 100,
    enemyHp: 100,
    enemyMaxHp: 100,
    combo: 0,
    bestCombo: 0,
    correctKeys: 0,
    wrongKeys: 0,
    startAt: 0,
    lastFrame: 0,
    wordDeadline: 0,
    roundStartedAt: 0,
    pausedAt: 0,
    sound: localStorage.getItem('desco-keyboard-sound') !== 'off',
    theme: localStorage.getItem('desco-keyboard-theme') === 'light' ? 'light' : 'dark',
    shake: 0,
    flash: 0,
    playerAction: null,
    enemyAction: null,
    particles: [],
    floatingText: [],
    audio: null,
    sceneTime: 0
  };

  function currentLevel() { return LEVELS[state.level]; }
  function currentEnemy() { return ENEMIES[state.wave]; }
  function currentLesson() { return state.lessons[state.wave]; }
  function sentenceWords() { return currentLesson()?.words || []; }
  function currentWord() { return sentenceWords()[state.wordIndex] || ''; }
  function currentTypingWord() {
    const word = state.level === 'novato'
      ? currentWord().replace(/[.,;:!?¿¡"()]/gu, '')
      : currentWord();
    return word.toLocaleLowerCase('es');
  }

  function initAudio() {
    if (!state.sound || state.audio) return;
    state.audio = new (window.AudioContext || window.webkitAudioContext)();
  }

  function tone(freq, duration = 0.05, type = 'sine', volume = 0.035) {
    if (!state.sound) return;
    initAudio();
    if (!state.audio) return;
    const osc = state.audio.createOscillator();
    const gain = state.audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, state.audio.currentTime);
    gain.gain.setValueAtTime(volume, state.audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, state.audio.currentTime + duration);
    osc.connect(gain).connect(state.audio.destination);
    osc.start();
    osc.stop(state.audio.currentTime + duration);
  }

  function selectPhrase(section, sectionIndex) {
    const storageKey = `desco-keyboard-last-${state.level}-${sectionIndex}`;
    const previous = localStorage.getItem(storageKey);
    const available = section.phrases.filter((phrase) => phrase !== previous);
    const text = available[Math.floor(Math.random() * available.length)] || section.phrases[0];
    localStorage.setItem(storageKey, text);
    return text;
  }

  function resetWordDeadline(now = performance.now()) {
    state.wordDeadline = now + currentLevel().secondsPerWord * 1000;
  }

  function beginGame() {
    initAudio();
    state.mode = 'playing';
    state.lessons = currentLevel().sections.map((section, sectionIndex) => {
      const text = selectPhrase(section, sectionIndex);
      return { section: section.title, text, words: text.split(' ') };
    });
    state.wordIndex = 0;
    state.typed = '';
    state.wave = 0;
    state.playerHp = 100;
    state.combo = 0;
    state.bestCombo = 0;
    state.correctKeys = 0;
    state.wrongKeys = 0;
    state.startAt = performance.now();
    state.roundStartedAt = state.startAt;
    state.particles.length = 0;
    state.floatingText.length = 0;
    state.playerAction = null;
    state.enemyAction = null;
    document.body.classList.add('game-active');
    window.scrollTo(0, 0);
    loadEnemy();
    resetWordDeadline();
    $('startPanel').classList.add('hidden');
    $('pausePanel').classList.add('hidden');
    $('resultPanel').classList.add('hidden');
    $('hud').setAttribute('aria-hidden', 'false');
    $('typingInput').disabled = false;
    $('typingInput').placeholder = 'Escribe…';
    $('typingInput').value = '';
    $('typingInput').focus({ preventScroll: true });
    updateUi();
    tone(420, .09, 'triangle', .05);
  }

  function loadEnemy() {
    const enemy = currentEnemy();
    state.enemyMaxHp = enemy.hp;
    state.enemyHp = enemy.hp;
    state.enemyAction = { type: 'spawn', started: performance.now(), duration: 620 };
    $('enemyName').textContent = enemy.name;
    state.roundStartedAt = performance.now();
    $('waveText').textContent = `OLEADA ${state.wave + 1}/${ENEMIES.length}`;
  }

  function pauseGame() {
    if (state.mode !== 'playing') return;
    state.mode = 'paused';
    state.pausedAt = performance.now();
    $('pausePanel').classList.remove('hidden');
    $('typingInput').disabled = true;
    $('pauseGameButton').textContent = 'Continuar';
  }

  function resumeGame() {
    if (state.mode !== 'paused') return;
    const pausedFor = performance.now() - state.pausedAt;
    state.startAt += pausedFor;
    state.wordDeadline += pausedFor;
    state.roundStartedAt += pausedFor;
    state.mode = 'playing';
    $('pausePanel').classList.add('hidden');
    $('typingInput').disabled = false;
    $('typingInput').focus({ preventScroll: true });
    $('pauseGameButton').textContent = 'Pausa';
  }

  function returnToMenu() {
    state.mode = 'menu';
    state.typed = '';
    document.body.classList.remove('game-active');
    $('startPanel').classList.remove('hidden');
    $('pausePanel').classList.add('hidden');
    $('resultPanel').classList.add('hidden');
    $('hud').setAttribute('aria-hidden', 'true');
    $('typingInput').disabled = true;
    $('typingInput').value = '';
    $('lessonLabel').textContent = 'Selecciona un nivel para comenzar';
    $('sentenceCount').textContent = 'RONDA 1/5';
    $('streakLabel').textContent = 'RACHA PERFECTA 0';
    $('sentenceLine').replaceChildren();
    const ready = document.createElement('span');
    ready.className = 'sentence-current';
    ready.textContent = 'preparado';
    const prompt = document.createElement('span');
    prompt.textContent = 'para escribir una frase';
    $('sentenceLine').append(ready, prompt);
    $('lessonProgress').style.width = '0%';
    $('pauseGameButton').textContent = 'Pausa';
  }

  function elapsedMinutes() {
    if (!state.startAt) return 0;
    const now = state.mode === 'paused' ? state.pausedAt : performance.now();
    return Math.max((now - state.startAt) / 60000, 0.001);
  }

  function getWpm() { return Math.round((state.correctKeys / 5) / elapsedMinutes()); }
  function getAccuracy() {
    const total = state.correctKeys + state.wrongKeys;
    return total ? Math.round((state.correctKeys / total) * 100) : 100;
  }
  function getRank() {
    if (state.combo >= 18) return 'SS';
    if (state.combo >= 12) return 'S';
    if (state.combo >= 8) return 'A';
    if (state.combo >= 5) return 'B';
    if (state.combo >= 2) return 'C';
    return 'D';
  }

  function createImpact(x, y, color, amount = 12) {
    for (let i = 0; i < amount; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.8 + Math.random() * 6;
      state.particles.push({
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: 1, decay: .02 + Math.random() * .035, size: 2 + Math.random() * 6, color
      });
    }
  }

  function addFloat(text, x, y, color) {
    state.floatingText.push({ text, x, y, color, life: 1 });
  }

  function lightAttack() {
    const now = performance.now();
    if (state.playerAction && ['jab', 'heavy', 'kick'].includes(state.playerAction.type)
      && actionProgress(state.playerAction, now) < .8) return;
    state.playerAction = { type: 'jab', started: now, duration: 340, alternate: state.correctKeys % 2,
      impactAt: .38, impact: { x: ENEMY_X, y: 365, color: '#f7f7f2', amount: 4 } };
    state.enemyAction = { type: 'hit', started: now, duration: 370 };
    tone(190 + (state.correctKeys % 5) * 18, .025, 'square', .012);
  }

  function completeWord() {
    const now = performance.now();
    const words = sentenceWords();
    const sentenceComplete = state.wordIndex === words.length - 1;
    const damage = sentenceComplete
      ? state.enemyHp
      : Math.min((state.enemyMaxHp / words.length) + state.combo * .45, state.enemyHp);
    state.combo += 1;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    state.enemyHp = Math.max(0, state.enemyHp - damage);
    state.playerAction = {
      type: state.combo % 4 === 0 ? 'kick' : 'heavy', started: now, duration: 620,
      impact: { x: ENEMY_X, y: state.combo % 4 === 0 ? 445 : 360,
        color: state.combo % 4 === 0 ? '#d8b45a' : '#f7f7f2', amount: 12,
        label: `+${Math.round(damage)}`, labelX: 832, labelY: 332, labelColor: '#ffd35a' }
    };
    state.enemyAction = { type: 'hit', started: now, duration: 570 };
    tone(state.combo % 4 === 0 ? 95 : 130, .09, 'sawtooth', .06);

    if (!sentenceComplete) {
      state.wordIndex += 1;
      resetWordDeadline(now);
    }
    state.typed = '';
    $('typingInput').value = '';

    if (sentenceComplete) state.enemyHp = 0;

    if (state.enemyHp <= 0) {
      state.enemyAction = { type: 'defeated', started: now, duration: 900 };
      setTimeout(() => {
        if (state.mode !== 'playing') return;
        if (state.wave === ENEMIES.length - 1) finishGame(true);
        else {
          state.wave += 1;
          state.wordIndex = 0;
          state.typed = '';
          state.playerHp = Math.min(100, state.playerHp + 15);
          loadEnemy();
          resetWordDeadline();
          updateUi();
        }
      }, 900);
    }
    updateUi();
  }

  function typo() {
    const damage = currentLevel().typoDamage;
    state.wrongKeys += 1;
    state.combo = 0;
    state.playerHp = Math.max(0, state.playerHp - damage);
    state.playerAction = { type: 'hit', started: performance.now(), duration: 520 };
    state.enemyAction = { type: 'counter', started: performance.now(), duration: 560,
      impact: { x: PLAYER_X, y: 360, color: '#ff5368', amount: 12,
        label: `-${damage}`, labelX: 440, labelY: 340, labelColor: '#ff5368' } };
    $('typingInput').closest('.input-shell').classList.remove('error');
    void $('typingInput').offsetWidth;
    $('typingInput').closest('.input-shell').classList.add('error');
    tone(72, .14, 'sawtooth', .055);
    resetWordDeadline();
    if (state.playerHp <= 0) finishGame(false);
    updateUi();
  }

  function enemyAttack(reason = 'timeout') {
    if (state.mode !== 'playing') return;
    const damage = reason === 'timeout' ? currentLevel().timeoutDamage : currentLevel().typoDamage;
    state.playerHp = Math.max(0, state.playerHp - damage);
    state.combo = 0;
    state.enemyAction = { type: 'attack', started: performance.now(), duration: 560,
      impact: { x: PLAYER_X, y: 360, color: currentEnemy().color, amount: 15,
        label: `-${damage}`, labelX: 440, labelY: 340, labelColor: '#ff5368' } };
    state.playerAction = { type: 'hit', started: performance.now(), duration: 520 };
    tone(65, .16, 'square', .06);
    if (state.playerHp <= 0) finishGame(false);
    updateUi();
  }

  function finishGame(won) {
    state.mode = won ? 'won' : 'lost';
    $('typingInput').disabled = true;
    $('resultPanel').classList.remove('hidden');
    $('resultEyebrow').textContent = won ? 'ENTRENAMIENTO COMPLETADO' : 'FIN DEL COMBATE';
    $('resultTitle').textContent = won ? '¡Dominaste la arena!' : 'Vuelve a intentarlo';
    $('resultWpm').textContent = getWpm();
    $('resultAccuracy').textContent = getAccuracy();
    $('resultCombo').textContent = state.bestCombo;
    const best = Number(localStorage.getItem('desco-keyboard-best') || 0);
    if (getWpm() > best) localStorage.setItem('desco-keyboard-best', String(getWpm()));
    updateBest();
    tone(won ? 540 : 110, .3, won ? 'triangle' : 'sawtooth', .06);
  }

  function updateBest() {
    $('bestWpm').textContent = `${localStorage.getItem('desco-keyboard-best') || 0} PPM`;
  }

  function renderSentence() {
    const line = $('sentenceLine');
    const words = sentenceWords();
    line.replaceChildren();

    words.forEach((word, index) => {
      const span = document.createElement('span');
      if (index < state.wordIndex) {
        span.className = 'sentence-done';
        span.textContent = word;
      } else if (index === state.wordIndex) {
        span.className = 'sentence-current';
        const typed = document.createElement('span');
        typed.className = 'typed-letter';
        typed.textContent = word.slice(0, state.typed.length);
        span.append(typed, document.createTextNode(word.slice(state.typed.length)));
      } else {
        span.textContent = word;
      }
      line.append(span);
    });
  }

  function updateUi() {
    const word = currentTypingWord();
    const words = sentenceWords();
    renderSentence();
    $('sentenceCount').textContent = `RONDA ${state.wave + 1}/${state.lessons.length}`;
    $('lessonLabel').textContent = `${currentLevel().label} · ${currentLesson().section}`;
    $('streakLabel').textContent = `RACHA PERFECTA ${state.combo}`;
    const phraseProgress = (state.wordIndex + (state.typed.length / Math.max(word.length, 1))) / Math.max(words.length, 1);
    $('lessonProgress').style.width = `${phraseProgress * 100}%`;
    $('playerHealth').style.width = `${state.playerHp}%`;
    $('enemyHealth').style.width = `${(state.enemyHp / state.enemyMaxHp) * 100}%`;
    $('playerHpText').textContent = Math.ceil(state.playerHp);
    $('enemyHpText').textContent = Math.ceil(state.enemyHp);
    $('comboText').textContent = `x${state.combo}`;
    $('wpmValue').textContent = getWpm();
    $('accuracyValue').textContent = `${getAccuracy()}%`;
    $('rankValue').textContent = getRank();
  }

  function handleInput(event) {
    if (state.mode !== 'playing') return;
    const input = event.target.value;
    const target = currentTypingWord();
    const comparableInput = input.toLocaleLowerCase('es');

    if (input.endsWith(' ')) {
      if (input.trim().toLocaleLowerCase('es') === target && state.typed === target) completeWord();
      else {
        typo();
        event.target.value = state.typed;
      }
      return;
    }

    if (target.startsWith(comparableInput)) {
      const added = Math.max(0, comparableInput.length - state.typed.length);
      state.correctKeys += added;
      state.typed = comparableInput;
      if (added) lightAttack();
      updateUi();
    } else {
      typo();
      event.target.value = state.typed;
    }
  }

  function easeOut(t) { return 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3); }
  function actionProgress(action, now) {
    if (!action) return 0;
    return Math.min((now - action.started) / action.duration, 1);
  }

  function drawBackground(now) {
    const g = ctx.createLinearGradient(0, 0, 0, 720);
    g.addColorStop(0, '#172332');
    g.addColorStop(.55, '#26394a');
    g.addColorStop(1, '#111820');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1280, 720);

    // Luna suave y montañas planas: una escena clásica, sin luces de neón.
    ctx.save();
    ctx.globalAlpha = .18;
    const moon = ctx.createRadialGradient(1005, 145, 8, 1025, 170, 72);
    moon.addColorStop(0, '#f4efe2');
    moon.addColorStop(.72, '#d8d8ce');
    moon.addColorStop(1, '#aeb7b4');
    ctx.fillStyle = moon;
    ctx.beginPath(); ctx.arc(1025, 170, 72, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = .07;
    ctx.fillStyle = '#52616a';
    ctx.beginPath(); ctx.arc(1000, 145, 13, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(1052, 188, 9, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#1b2a37';
    ctx.beginPath();
    ctx.moveTo(0, 440); ctx.lineTo(185, 245); ctx.lineTo(330, 420);
    ctx.lineTo(515, 210); ctx.lineTo(710, 430); ctx.lineTo(900, 265);
    ctx.lineTo(1080, 420); ctx.lineTo(1200, 300); ctx.lineTo(1280, 390);
    ctx.lineTo(1280, 535); ctx.lineTo(0, 535); ctx.closePath(); ctx.fill();

    ctx.fillStyle = '#223341';
    ctx.beginPath();
    ctx.moveTo(0, 480); ctx.lineTo(120, 350); ctx.lineTo(250, 470);
    ctx.lineTo(410, 330); ctx.lineTo(565, 475); ctx.lineTo(755, 335);
    ctx.lineTo(930, 468); ctx.lineTo(1080, 350); ctx.lineTo(1280, 470);
    ctx.lineTo(1280, 560); ctx.lineTo(0, 560); ctx.closePath(); ctx.fill();

    // Estructura de entrenamiento al fondo.
    ctx.fillStyle = '#151e26';
    ctx.fillRect(555, 298, 18, 242);
    ctx.fillRect(710, 298, 18, 242);
    ctx.fillRect(515, 292, 255, 18);
    ctx.fillRect(542, 325, 200, 12);

    const floor = ctx.createLinearGradient(0, 500, 0, 720);
    floor.addColorStop(0, '#26343d');
    floor.addColorStop(1, '#11181e');
    ctx.fillStyle = floor;
    ctx.fillRect(0, 520, 1280, 200);
    ctx.strokeStyle = 'rgba(225,232,226,.12)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 522); ctx.lineTo(1280, 522); ctx.stroke();
    for (let y = 570; y < 721; y += 48) {
      ctx.strokeStyle = 'rgba(225,232,226,.045)';
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1280, y); ctx.stroke();
    }

    // Polvo ambiental en movimiento lento.
    ctx.fillStyle = '#d9e0da';
    for (let i = 0; i < 30; i += 1) {
      const x = (i * 83 + now * (.006 + (i % 3) * .003)) % 1320 - 20;
      const y = 105 + ((i * 67) % 385) + Math.sin(now * .0005 + i) * 8;
      ctx.globalAlpha = .08 + (i % 4) * .025;
      ctx.beginPath(); ctx.arc(x, y, 1 + (i % 2), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.font = '800 16px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(238,239,232,.16)';
    ctx.fillText('CAMPO DE ENTRENAMIENTO · DESCO', 640, 168);
  }

  function drawStickman(x, groundY, scale, color, facing, action, now, isEnemy = false) {
    const p = actionProgress(action, now);
    const type = action?.type;
    const smooth = (t) => { const v = Math.min(1, Math.max(0, t)); return v * v * (3 - 2 * v); };
    const windowed = (start, peak, end) => p < peak
      ? smooth((p - start) / (peak - start))
      : 1 - smooth((p - peak) / (end - peak));
    const idle = Math.sin(state.sceneTime * .005 + (isEnemy ? 1.5 : 0));
    const step = Math.sin(state.sceneTime * .003 + (isEnemy ? 2 : 0));
    const striking = ['jab', 'heavy', 'kick', 'attack', 'counter'].includes(type);
    const isKick = type === 'kick';
    const strike = striking ? windowed(0, type === 'jab' ? .38 : .47, .84) : 0;
    const dash = striking ? windowed(.05, type === 'jab' ? .38 : .47, .94) : 0;
    const recoil = type === 'hit' ? windowed(.48, .68, 1) : 0;
    const fall = type === 'defeated' ? smooth((p - .36) / .54) : 0;
    const spawn = type === 'spawn' ? 1 - easeOut(p) : 0;
    const reach = type === 'jab' ? 41 : isKick ? 40 : 92;
    // Cada golpe llega al torso rival antes de que empiece la reacción.
    const travel = type === 'jab' ? 350 : isKick ? 305 : 295;
    const offsetX = facing * (dash * travel - recoil * 52 - fall * 72);
    const offsetY = -spawn * 120 - (isKick ? Math.sin(p * Math.PI) * 13 : 0) + recoil * 10 + fall * 76 + idle * (striking ? .4 : 1.8);
    const lean = strike * (isKick ? -.18 : .17) - recoil * .42 - fall * 1.15 + idle * .018;
    const crouch = striking ? windowed(0, .19, .43) * 13 : 0;

    ctx.save();
    ctx.translate(x + offsetX, groundY + offsetY);
    ctx.scale(scale * facing, scale);
    ctx.rotate(lean);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowBlur = 0;

    ctx.globalAlpha = .22;
    ctx.beginPath(); ctx.ellipse(0, 5, 50, 10, 0, 0, Math.PI * 2); ctx.fillStyle = '#05080a'; ctx.fill();
    ctx.globalAlpha = 1;

    const hip = { x: -crouch * .3, y: -92 + crouch };
    const chest = { x: 2 + strike * 8, y: -165 + crouch * .55 };
    const head = { x: 2 + strike * 7, y: -210 + crouch * .4 };
    const frontFoot = { x: 43 + (isKick ? strike * 116 : 0) + step * 3, y: -4 - (isKick ? strike * 67 : 0) };
    const backFoot = { x: -43 - dash * 16 - step * 3, y: -4 };
    const alternating = type === 'jab' && action.alternate;
    const frontHand = { x: 46 + (alternating ? strike * 8 : strike * reach) + idle * 4, y: -146 - strike * 10 + idle * 4 };
    const backHand = { x: -29 + (alternating ? strike * 112 : strike * 18), y: -142 - (alternating ? strike * 14 : 0) - idle * 4 };

    const drawLimb = (...points) => {
      ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
      points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
      ctx.strokeStyle = '#11171c'; ctx.lineWidth = 13; ctx.stroke();
      ctx.strokeStyle = color; ctx.lineWidth = 8; ctx.stroke();
    };

    drawLimb(hip, { x: -20 - dash * 7, y: -49 + crouch * .6 }, backFoot);
    drawLimb(hip, { x: 26 + (isKick ? strike * 36 : 0), y: -50 - (isKick ? strike * 41 : 0) }, frontFoot);
    drawLimb(hip, chest);
    drawLimb(chest, { x: -22 + (alternating ? strike * 23 : 0), y: -151 + crouch * .3 }, backHand);
    drawLimb(chest, { x: 28 + strike * reach * .42, y: -159 + crouch * .3 }, frontHand);
    if (striking && !isKick && strike > .2) {
      const fist = alternating ? backHand : frontHand;
      ctx.beginPath(); ctx.arc(fist.x, fist.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
    }

    ctx.fillStyle = color;
    ctx.strokeStyle = '#11171c';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(head.x, head.y, 29, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // La cinta cruza la frente; el nudo y las dos puntas salen detrás de la cabeza.
    const bandColor = isEnemy ? '#e2b44a' : '#b53d3d';
    ctx.strokeStyle = '#11171c'; ctx.lineWidth = 11;
    ctx.beginPath(); ctx.moveTo(head.x - 27, head.y - 10); ctx.lineTo(head.x + 26, head.y - 9); ctx.stroke();
    ctx.strokeStyle = bandColor; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(head.x - 28, head.y - 10); ctx.lineTo(head.x + 27, head.y - 9); ctx.stroke();
    ctx.beginPath(); ctx.arc(head.x - 27, head.y - 10, 4, 0, Math.PI * 2); ctx.fillStyle = bandColor; ctx.fill();
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(head.x - 29, head.y - 10); ctx.lineTo(head.x - 48, head.y - 7 + idle * 3 - dash * 9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(head.x - 29, head.y - 10); ctx.lineTo(head.x - 45, head.y + 1 + idle * 5 - dash * 6); ctx.stroke();
    ctx.fillStyle = '#11171c';
    ctx.beginPath(); ctx.arc(head.x + 12, head.y + 4, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawEffects() {
    state.particles.forEach((particle) => {
      ctx.globalAlpha = particle.life;
      ctx.fillStyle = particle.color;
      ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.size * .55, 0, Math.PI * 2); ctx.fill();
    });
    ctx.shadowBlur = 0;
    state.floatingText.forEach((item) => {
      ctx.globalAlpha = item.life;
      ctx.fillStyle = item.color;
      ctx.font = '900 23px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(item.text, item.x, item.y);
    });
    ctx.globalAlpha = 1;
  }

  function tickEffects(delta) {
    state.particles.forEach((p) => {
      p.x += p.vx * delta * .07;
      p.y += p.vy * delta * .07;
      p.vy += .016 * delta;
      p.life -= p.decay * delta * .06;
    });
    state.particles = state.particles.filter((p) => p.life > 0);
    state.floatingText.forEach((f) => { f.y -= delta * .04; f.life -= delta * .0013; });
    state.floatingText = state.floatingText.filter((f) => f.life > 0);
  }

  function updateCombat(now) {
    if (state.mode !== 'playing') return;
    for (const action of [state.playerAction, state.enemyAction]) {
      if (!action?.impact || action.impactDone || actionProgress(action, now) < (action.impactAt ?? .46)) continue;
      const hit = action.impact;
      createImpact(hit.x, hit.y, hit.color, hit.amount);
      if (hit.label) addFloat(hit.label, hit.labelX, hit.labelY, hit.labelColor);
      state.shake = action.type === 'jab' ? 1.6 : action.type === 'kick' ? 12 : 8;
      state.flash = action.type === 'jab' ? .04 : .32;
      action.impactDone = true;
      if (state.enemyHp <= 0 && action === state.playerAction) addFloat('¡RIVAL VENCIDO!', 640, 250, '#ffd35a');
    }
    if (now >= state.wordDeadline && state.enemyHp > 0) {
      enemyAttack('timeout');
      resetWordDeadline(now);
    }
    if (state.playerAction && actionProgress(state.playerAction, now) >= 1) state.playerAction = null;
    if (state.enemyAction && actionProgress(state.enemyAction, now) >= 1 && state.enemyAction.type !== 'defeated') state.enemyAction = null;
    if (Math.floor(now / 250) !== Math.floor((now - 16) / 250)) updateUi();
  }

  function render(now) {
    const delta = Math.min(now - (state.lastFrame || now), 40);
    state.lastFrame = now;
    state.sceneTime += delta;
    updateCombat(now);
    tickEffects(delta);
    state.shake *= .83;
    state.flash *= .88;

    ctx.save();
    if (state.shake > .2) ctx.translate((Math.random() - .5) * state.shake, (Math.random() - .5) * state.shake);
    drawBackground(now);
    const playerAttacking = ['jab', 'heavy', 'kick'].includes(state.playerAction?.type);
    if (playerAttacking) drawStickman(ENEMY_X, 535, 1.08, currentEnemy().color, -1, state.enemyAction, now, true);
    drawStickman(PLAYER_X, 535, 1.08, '#f7f7f2', 1, state.playerAction, now, false);
    if (!playerAttacking) drawStickman(ENEMY_X, 535, 1.08, currentEnemy().color, -1, state.enemyAction, now, true);
    drawEffects();
    if (state.flash > .01) {
      ctx.fillStyle = `rgba(255,255,255,${state.flash * .2})`;
      ctx.fillRect(0, 0, 1280, 720);
    }
    ctx.restore();
    requestAnimationFrame(render);
  }

  document.querySelectorAll('.difficulty').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.difficulty').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      state.level = button.dataset.level;
      tone(260, .05, 'triangle', .025);
    });
  });

  $('startButton').addEventListener('click', beginGame);
  $('retryButton').addEventListener('click', beginGame);
  $('menuButton').addEventListener('click', returnToMenu);
  $('resumeButton').addEventListener('click', resumeGame);
  $('exitButton').addEventListener('click', returnToMenu);
  $('homeGameButton').addEventListener('click', returnToMenu);
  $('pauseGameButton').addEventListener('click', () => {
    if (state.mode === 'playing') pauseGame();
    else if (state.mode === 'paused') resumeGame();
  });
  $('typingInput').addEventListener('input', handleInput);
  $('typingInput').addEventListener('paste', (event) => event.preventDefault());
  $('arenaWrap').addEventListener('click', () => {
    if (state.mode === 'playing') $('typingInput').focus({ preventScroll: true });
  });

  function updateSoundLabels() {
    $('soundButton').textContent = `Sonido: ${state.sound ? 'sí' : 'no'}`;
    $('soundButton').setAttribute('aria-pressed', String(state.sound));
    $('settingsSoundButton').textContent = `Sonido: ${state.sound ? 'activado' : 'desactivado'}`;
  }

  function toggleSound() {
    state.sound = !state.sound;
    localStorage.setItem('desco-keyboard-sound', state.sound ? 'on' : 'off');
    updateSoundLabels();
    if (state.sound) tone(320, .07, 'triangle', .035);
  }

  function applyTheme() {
    const isLight = state.theme === 'light';
    document.body.classList.toggle('light-theme', isLight);
    $('themeToggleButton').textContent = `Tema: ${isLight ? 'claro' : 'oscuro'}`;
    $('themeToggleButton').setAttribute('aria-pressed', String(isLight));
  }

  function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('desco-keyboard-theme', state.theme);
    applyTheme();
  }

  async function toggleFullscreen() {
    if (!document.fullscreenElement) await $('arenaWrap').requestFullscreen?.();
    else await document.exitFullscreen?.();
  }

  function openGameDialog(dialog) {
    if (state.mode === 'playing') pauseGame();
    dialog.showModal();
  }

  $('helpButton').addEventListener('click', () => $('helpDialog').showModal());
  $('helpGameButton').addEventListener('click', () => openGameDialog($('helpDialog')));
  $('settingsGameButton').addEventListener('click', () => openGameDialog($('settingsDialog')));
  $('soundButton').addEventListener('click', toggleSound);
  $('settingsSoundButton').addEventListener('click', toggleSound);
  $('themeToggleButton').addEventListener('click', toggleTheme);
  $('fullscreenButton').addEventListener('click', toggleFullscreen);
  $('settingsFullscreenButton').addEventListener('click', toggleFullscreen);

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.mode === 'playing') {
      event.preventDefault();
      pauseGame();
    } else if (event.key === 'Escape' && state.mode === 'paused') {
      event.preventDefault();
      resumeGame();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.mode === 'playing') pauseGame();
  });

  updateSoundLabels();
  applyTheme();
  updateBest();
  requestAnimationFrame(render);
})();
