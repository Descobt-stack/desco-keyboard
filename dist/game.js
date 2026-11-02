(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const canvas = $('arena');
  const ctx = canvas.getContext('2d');

  const LEVELS = window.DESCO_PHRASE_LEVELS;
  if (!LEVELS) throw new Error('No se pudo cargar el banco de frases.');

  const ENEMIES = [
    { name: 'CARMESÍ', color: '#ef3340', hp: 72 },
    { name: 'BRASA', color: '#ff7a28', hp: 82 },
    { name: 'ÁMBAR', color: '#f4b942', hp: 92 },
    { name: 'MAGENTA', color: '#dc3f8f', hp: 104 },
    { name: 'VÓRTICE', color: '#7a4de8', hp: 116 }
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
    state.playerAction = { type: 'jab', started: performance.now(), duration: 180 };
    createImpact(840, 403, '#f7f7f2', 4);
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
    state.playerAction = { type: state.combo % 4 === 0 ? 'kick' : 'heavy', started: now, duration: 420 };
    state.enemyAction = { type: 'hit', started: now, duration: 390 };
    state.shake = state.combo % 4 === 0 ? 12 : 7;
    state.flash = .32;
    createImpact(850, 398, state.combo % 4 === 0 ? '#ffd35a' : '#f7f7f2', 18);
    addFloat(`+${Math.round(damage)}`, 840, 350, '#ffd35a');
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
      addFloat('¡RIVAL VENCIDO!', 640, 250, '#ffd35a');
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
    state.playerAction = { type: 'hit', started: performance.now(), duration: 320 };
    state.enemyAction = { type: 'counter', started: performance.now(), duration: 360 };
    state.shake = 9;
    createImpact(430, 410, '#ff5368', 12);
    addFloat(`-${damage}`, 440, 350, '#ff5368');
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
    state.enemyAction = { type: 'attack', started: performance.now(), duration: 460 };
    state.playerAction = { type: 'hit', started: performance.now(), duration: 360 };
    state.shake = 11;
    createImpact(435, 405, currentEnemy().color, 15);
    addFloat(`-${damage}`, 440, 350, '#ff5368');
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
    g.addColorStop(0, '#0a0d1c');
    g.addColorStop(.58, '#11162a');
    g.addColorStop(1, '#080a12');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1280, 720);

    ctx.save();
    ctx.globalAlpha = .45;
    for (let i = 0; i < 17; i += 1) {
      const x = i * 92 - 30;
      const height = 110 + ((i * 71) % 240);
      ctx.fillStyle = i % 2 ? '#11182e' : '#0e1427';
      ctx.fillRect(x, 500 - height, 72, height);
      ctx.fillStyle = 'rgba(94,231,245,.16)';
      for (let w = 0; w < 3; w += 1) {
        for (let h = 0; h < Math.floor(height / 42); h += 1) {
          if ((w + h + i) % 3 === 0) ctx.fillRect(x + 10 + w * 20, 510 - height + h * 32, 7, 12);
        }
      }
    }
    ctx.restore();

    ctx.strokeStyle = 'rgba(94,231,245,.09)';
    ctx.lineWidth = 1;
    const gridOffset = (now * .018) % 48;
    for (let x = -48 + gridOffset; x < 1320; x += 48) {
      ctx.beginPath(); ctx.moveTo(640, 485); ctx.lineTo(x, 720); ctx.stroke();
    }
    for (let y = 495; y < 720; y += 38) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1280, y); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(94,231,245,.05)';
    ctx.fillRect(0, 486, 1280, 2);

    const glow = ctx.createRadialGradient(640, 455, 20, 640, 455, 340);
    glow.addColorStop(0, 'rgba(140,108,255,.15)');
    glow.addColorStop(1, 'rgba(140,108,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(250, 100, 780, 540);

    ctx.font = '900 18px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,.05)';
    ctx.fillText('DESCO // TRAINING GRID 07', 640, 155);
  }

  function drawStickman(x, groundY, scale, color, facing, action, now, isEnemy = false) {
    const p = actionProgress(action, now);
    const type = action?.type;
    let lean = Math.sin(state.sceneTime * .004 + (isEnemy ? 2 : 0)) * .025;
    let offsetX = 0;
    let offsetY = Math.sin(state.sceneTime * .005 + (isEnemy ? 1 : 0)) * 2;
    let punch = 0;
    let kick = 0;
    let hit = 0;
    const idleGuard = Math.sin(state.sceneTime * .006 + (isEnemy ? 1.8 : 0));
    const idleStep = Math.sin(state.sceneTime * .0032 + (isEnemy ? .8 : 0));

    if (type === 'jab' || type === 'heavy' || type === 'attack' || type === 'counter') {
      const power = type === 'jab' ? 28 : 68;
      punch = Math.sin(p * Math.PI) * power;
      offsetX = facing * Math.sin(p * Math.PI) * (type === 'jab' ? 8 : 22);
      lean = facing * .12 * Math.sin(p * Math.PI);
    }
    if (type === 'kick') {
      kick = Math.sin(p * Math.PI) * 85;
      offsetX = facing * Math.sin(p * Math.PI) * 28;
      lean = -facing * .18 * Math.sin(p * Math.PI);
    }
    if (type === 'hit') {
      hit = Math.sin(p * Math.PI) * 25;
      offsetX = -facing * hit;
      lean = -facing * .28 * Math.sin(p * Math.PI);
    }
    if (type === 'spawn') {
      offsetY -= (1 - easeOut(p)) * 120;
    }
    if (type === 'defeated') {
      lean = facing * p * 1.35;
      offsetY += p * 28;
      offsetX -= facing * p * 60;
    }

    ctx.save();
    ctx.translate(x + offsetX, groundY + offsetY);
    ctx.scale(scale * facing, scale);
    ctx.rotate(lean * facing);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowBlur = 18;
    ctx.shadowColor = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 9;

    ctx.globalAlpha = .18;
    ctx.beginPath(); ctx.ellipse(0, 5, 47, 10, 0, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
    ctx.globalAlpha = 1;

    const hip = { x: 0, y: -92 };
    const chest = { x: 2, y: -165 };
    const head = { x: 2, y: -210 };
    const frontFoot = { x: 42 + kick * .72 + idleStep * 3, y: -4 - kick * .34 };
    const backFoot = { x: -42 - idleStep * 3, y: -4 };
    const frontHand = { x: 45 + punch + idleGuard * 4, y: -151 - punch * .08 + idleGuard * 5 };
    const backHand = { x: -35 - idleGuard * 3, y: -132 - idleGuard * 6 };

    ctx.beginPath(); ctx.moveTo(hip.x, hip.y); ctx.lineTo(-18, -48); ctx.lineTo(backFoot.x, backFoot.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(hip.x, hip.y); ctx.lineTo(24 + kick * .25, -48 - kick * .18); ctx.lineTo(frontFoot.x, frontFoot.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(hip.x, hip.y); ctx.lineTo(chest.x, chest.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(chest.x, chest.y); ctx.lineTo(-20, -145); ctx.lineTo(backHand.x, backHand.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(chest.x, chest.y); ctx.lineTo(27 + punch * .28, -162); ctx.lineTo(frontHand.x, frontHand.y); ctx.stroke();

    ctx.fillStyle = '#080b14';
    ctx.beginPath(); ctx.arc(head.x, head.y, 28, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = color;
    ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(11, -214, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawEffects() {
    state.particles.forEach((particle) => {
      ctx.globalAlpha = particle.life;
      ctx.fillStyle = particle.color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = particle.color;
      ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
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
    const playerX = 405 + Math.sin(now * .0007) * 24;
    const enemyX = 875 + Math.sin(now * .00062 + Math.PI) * 30;
    drawStickman(playerX, 535, 1.08, '#f7f7f2', 1, state.playerAction, now, false);
    drawStickman(enemyX, 535, 1.08, currentEnemy().color, -1, state.enemyAction, now, true);
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
