(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const canvas = $('arena');
  const ctx = canvas.getContext('2d');
  const PLAYER_X = 405;
  const ENEMY_X = 875;
  const TARGET_FRAME_MS = 1000 / 60;
  const MAX_FRAME_DELTA = 40;
  const MAX_PARTICLES = 96;
  const MAX_FLOATING_TEXT = 12;
  const API_BASE = location.hostname.endsWith('github.io')
    ? 'https://desco-keyboard.josuepmvf.chatgpt.site'
    : '';
  const LETTER_ATTACKS = [
    { type: 'jab', duration: 180, impactAt: .38, y: 365, amount: 4 },
    { type: 'cross', duration: 190, impactAt: .42, y: 350, amount: 5 },
    { type: 'hook', duration: 205, impactAt: .48, y: 338, amount: 6 },
    { type: 'uppercut', duration: 220, impactAt: .52, y: 318, amount: 7 },
    { type: 'knee', duration: 215, impactAt: .50, y: 410, amount: 7 }
  ];
  const PLAYER_ATTACK_TYPES = new Set([
    'jab', 'cross', 'hook', 'uppercut', 'knee', 'heavy', 'kick'
  ]);
  const backgroundCanvas = document.createElement('canvas');
  backgroundCanvas.width = canvas.width;
  backgroundCanvas.height = canvas.height;

  const particlePool = Array.from({ length: MAX_PARTICLES }, () => ({
    active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, decay: 0, size: 0, color: '#fff'
  }));
  const floatingTextPool = Array.from({ length: MAX_FLOATING_TEXT }, () => ({
    active: false, text: '', x: 0, y: 0, color: '#fff', life: 0
  }));

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
    level: 'nivel1',
    playerName: localStorage.getItem('desco-keyboard-player-name') || '',
    lessons: [],
    wordIndex: 0,
    typed: '',
    wave: 0,
    playerHp: 100,
    enemyHp: 100,
    enemyMaxHp: 100,
    combo: 0,
    bestCombo: 0,
    cleanPhrases: 0,
    healProgress: 0,
    phraseHadError: false,
    correctKeys: 0,
    wrongKeys: 0,
    startAt: 0,
    lastFrame: 0,
    wordDeadline: 0,
    roundStartedAt: 0,
    pausedAt: 0,
    lastRender: 0,
    nextRenderAt: 0,
    lastHudUpdate: 0,
    effectAccumulator: 0,
    pendingWaveAdvanceAt: 0,
    sound: localStorage.getItem('desco-keyboard-sound') !== 'off',
    theme: localStorage.getItem('desco-keyboard-theme') === 'light' ? 'light' : 'dark',
    shake: 0,
    flash: 0,
    playerAction: null,
    playerActionQueue: [],
    enemyAction: null,
    particles: particlePool,
    floatingText: floatingTextPool,
    particleCursor: 0,
    floatingTextCursor: 0,
    audio: null,
    sceneTime: 0,
    scoreSubmitted: false
  };

  function currentLevel() { return LEVELS[state.level]; }
  function currentEnemy() { return ENEMIES[state.wave]; }
  function currentLesson() { return state.lessons[state.wave]; }
  function sentenceWords() { return currentLesson()?.words || []; }
  function currentWord() { return sentenceWords()[state.wordIndex] || ''; }
  function currentTypingWord() {
    return currentWord().toLocaleLowerCase('es');
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
    const requestedName = $('playerName').value.trim().replace(/\s+/g, ' ');
    if (!/^[\p{L}\p{N} _.-]{2,20}$/u.test(requestedName)) {
      $('nameError').textContent = 'Escribe un nombre de 2 a 20 caracteres.';
      $('playerName').focus();
      return;
    }
    state.playerName = requestedName;
    localStorage.setItem('desco-keyboard-player-name', requestedName);
    $('nameError').textContent = '';
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
    state.cleanPhrases = 0;
    state.healProgress = 0;
    state.phraseHadError = false;
    state.correctKeys = 0;
    state.wrongKeys = 0;
    state.startAt = performance.now();
    state.roundStartedAt = state.startAt;
    state.particles.forEach((particle) => { particle.active = false; });
    state.floatingText.forEach((item) => { item.active = false; });
    state.particleCursor = 0;
    state.floatingTextCursor = 0;
    state.effectAccumulator = 0;
    state.playerAction = null;
    state.playerActionQueue.length = 0;
    state.enemyAction = null;
    state.pendingWaveAdvanceAt = 0;
    state.scoreSubmitted = false;
    document.body.classList.add('game-active');
    window.scrollTo(0, 0);
    loadEnemy();
    resetWordDeadline();
    $('startPanel').classList.add('hidden');
    $('pausePanel').classList.add('hidden');
    $('resultPanel').classList.add('hidden');
    $('scoreSubmitStatus').textContent = '';
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
    if (state.playerAction) state.playerAction.started += pausedFor;
    if (state.enemyAction) state.enemyAction.started += pausedFor;
    if (state.pendingWaveAdvanceAt) state.pendingWaveAdvanceAt += pausedFor;
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
    loadLeaderboard();
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
      const particle = state.particles[state.particleCursor];
      state.particleCursor = (state.particleCursor + 1) % state.particles.length;
      particle.active = true;
      particle.x = x;
      particle.y = y;
      particle.vx = Math.cos(angle) * speed;
      particle.vy = Math.sin(angle) * speed;
      particle.life = 1;
      particle.decay = .02 + Math.random() * .035;
      particle.size = 2 + Math.random() * 6;
      particle.color = color;
    }
  }

  function addFloat(text, x, y, color) {
    const item = state.floatingText[state.floatingTextCursor];
    state.floatingTextCursor = (state.floatingTextCursor + 1) % state.floatingText.length;
    item.active = true;
    item.text = text;
    item.x = x;
    item.y = y;
    item.color = color;
    item.life = 1;
  }

  function startNextPlayerAction(now = performance.now()) {
    if (state.playerAction || !state.playerActionQueue.length) return;
    const next = state.playerActionQueue.shift();
    const backlog = state.playerActionQueue.length;
    const minimum = next.finisher ? 360 : 125;
    next.duration = Math.max(minimum, next.duration - Math.min(backlog, 7) * 10);
    next.started = now;
    state.playerAction = next;
  }

  function queuePlayerAction(action, now = performance.now()) {
    state.playerActionQueue.push(action);
    startNextPlayerAction(now);
  }

  function lightAttack(keyNumber = state.correctKeys) {
    const attack = LETTER_ATTACKS[(keyNumber - 1) % LETTER_ATTACKS.length];
    queuePlayerAction({
      type: attack.type,
      duration: attack.duration,
      alternate: keyNumber % 2,
      impactAt: attack.impactAt,
      reaction: 'hit',
      impact: { x: ENEMY_X, y: attack.y, color: '#f7f7f2', amount: attack.amount }
    });
    tone(190 + (keyNumber % 5) * 18, .025, 'square', .012);
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
    const finisherType = state.combo % 4 === 0 ? 'kick' : 'heavy';
    queuePlayerAction({
      type: finisherType,
      duration: 620,
      finisher: true,
      impactAt: .47,
      reaction: sentenceComplete ? 'defeated' : 'hit',
      sentenceComplete,
      impact: { x: ENEMY_X, y: finisherType === 'kick' ? 445 : 360,
        color: finisherType === 'kick' ? '#d8b45a' : '#f7f7f2', amount: 12,
        label: `+${Math.round(damage)}`, labelX: 832, labelY: 332, labelColor: '#ffd35a' }
    }, now);
    tone(state.combo % 4 === 0 ? 95 : 130, .09, 'sawtooth', .06);

    if (!sentenceComplete) {
      state.wordIndex += 1;
      resetWordDeadline(now);
    }
    state.typed = '';
    $('typingInput').value = '';

    if (sentenceComplete) {
      state.enemyHp = 0;
      $('typingInput').disabled = true;
      if (!state.phraseHadError) {
        state.cleanPhrases += 1;
        state.healProgress += 1;
      } else {
        state.healProgress = 0;
      }
    }
    updateUi();
  }

  function typo() {
    const damage = currentLevel().typoDamage;
    state.wrongKeys += 1;
    state.combo = 0;
    state.phraseHadError = true;
    state.playerActionQueue.length = 0;
    state.playerHp = Math.max(0, state.playerHp - damage);
    state.playerAction = { type: 'hit', started: performance.now(), duration: 520, delay: .42 };
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
    state.phraseHadError = true;
    state.playerActionQueue.length = 0;
    state.enemyAction = { type: 'attack', started: performance.now(), duration: 560,
      impact: { x: PLAYER_X, y: 360, color: currentEnemy().color, amount: 15,
        label: `-${damage}`, labelX: 440, labelY: 340, labelColor: '#ff5368' } };
    state.playerAction = { type: 'hit', started: performance.now(), duration: 520, delay: .42 };
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
    submitScore(won);
    tone(won ? 540 : 110, .3, won ? 'triangle' : 'sawtooth', .06);
  }

  function updateBest() {
    $('bestWpm').textContent = `${localStorage.getItem('desco-keyboard-best') || 0} PPM`;
  }

  function scoreFor(level, wpm, accuracy, hp) {
    return level * 10000 + wpm * 100 + accuracy * 10 + Math.max(0, Math.round(hp));
  }

  function localLeaderboard() {
    try { return JSON.parse(localStorage.getItem('desco-keyboard-local-board') || '[]'); }
    catch { return []; }
  }

  function saveLocalScore(entry) {
    const board = localLeaderboard();
    const same = board.find((item) => item.name.toLocaleLowerCase('es') === entry.name.toLocaleLowerCase('es')
      && item.level === entry.level);
    if (same && same.score >= entry.score) return board;
    const next = board.filter((item) => !(item.name.toLocaleLowerCase('es') === entry.name.toLocaleLowerCase('es')
      && item.level === entry.level));
    next.push(entry);
    next.sort((a, b) => b.score - a.score);
    localStorage.setItem('desco-keyboard-local-board', JSON.stringify(next.slice(0, 20)));
    return next.slice(0, 20);
  }

  function renderLeaderboard(entries, localOnly = false) {
    const list = $('leaderboardList');
    list.replaceChildren();
    $('leaderboardStatus').textContent = localOnly
      ? 'Sin conexión global: se muestran las marcas guardadas en este dispositivo.'
      : 'Tablero compartido · mejor marca de cada jugador y nivel.';
    if (!entries.length) {
      const empty = document.createElement('li');
      empty.className = 'leaderboard-empty';
      empty.textContent = 'Aún no hay puntuaciones. Sé el primero.';
      list.append(empty);
      return;
    }
    entries.slice(0, 10).forEach((entry) => {
      const item = document.createElement('li');
      const name = document.createElement('span');
      const level = document.createElement('span');
      const score = document.createElement('strong');
      name.className = 'leaderboard-name';
      level.className = 'leaderboard-level';
      score.className = 'leaderboard-score';
      name.textContent = entry.name;
      level.textContent = `N${entry.level}`;
      score.textContent = Number(entry.score).toLocaleString('es-MX');
      item.append(name, level, score);
      list.append(item);
    });
  }

  async function loadLeaderboard() {
    $('leaderboardStatus').textContent = 'Actualizando tablero global…';
    try {
      const response = await fetch(`${API_BASE}/api/leaderboard`, { headers: { accept: 'application/json' } });
      if (!response.ok) throw new Error('Tablero no disponible');
      const data = await response.json();
      renderLeaderboard(Array.isArray(data) ? data : data.entries || []);
    } catch {
      renderLeaderboard(localLeaderboard(), true);
    }
  }

  async function submitScore(won) {
    if (state.scoreSubmitted) return;
    state.scoreSubmitted = true;
    const level = currentLevel().number;
    const entry = {
      name: state.playerName,
      level,
      wpm: getWpm(),
      accuracy: getAccuracy(),
      hp: Math.round(state.playerHp)
    };
    entry.score = scoreFor(entry.level, entry.wpm, entry.accuracy, entry.hp);
    saveLocalScore(entry);
    $('scoreSubmitStatus').textContent = `Puntuación: ${entry.score.toLocaleString('es-MX')} · guardando en el tablero global…`;
    try {
      const response = await fetch(`${API_BASE}/api/scores`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(entry)
      });
      if (!response.ok) throw new Error('No se pudo guardar');
      const result = await response.json();
      $('scoreSubmitStatus').textContent = `${won ? 'Combate completado' : 'Intento registrado'} · ${result.saved ? 'nueva marca global' : 'conservamos tu mejor marca'}.`;
      await loadLeaderboard();
    } catch {
      $('scoreSubmitStatus').textContent = 'La marca quedó guardada en este dispositivo; el tablero global no respondió.';
    }
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
    $('streakLabel').textContent = `RECUPERACIÓN ${state.healProgress}/${currentLevel().healEvery} · RACHA ${state.combo}`;
    const phraseProgress = (state.wordIndex + (state.typed.length / Math.max(word.length, 1))) / Math.max(words.length, 1);
    $('lessonProgress').style.width = `${phraseProgress * 100}%`;
    $('playerHealth').style.width = `${state.playerHp}%`;
    $('enemyHealth').style.width = `${(state.enemyHp / state.enemyMaxHp) * 100}%`;
    $('playerHpText').textContent = Math.ceil(state.playerHp);
    $('enemyHpText').textContent = Math.ceil(state.enemyHp);
    $('comboText').textContent = `x${state.combo}`;
    updateLiveStats();
  }

  function updateLiveStats() {
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
      if (input.slice(0, -1).toLocaleLowerCase('es') === target && state.typed === target) completeWord();
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
      for (let i = 0; i < added; i += 1) lightAttack(state.correctKeys - added + i + 1);
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

  function buildBackgroundCache() {
    const bg = backgroundCanvas.getContext('2d', { alpha: false });
    const g = bg.createLinearGradient(0, 0, 0, 720);
    g.addColorStop(0, '#172332');
    g.addColorStop(.55, '#26394a');
    g.addColorStop(1, '#111820');
    bg.fillStyle = g;
    bg.fillRect(0, 0, 1280, 720);

    // Luna suave y montañas planas: una escena clásica, sin luces de neón.
    bg.save();
    bg.globalAlpha = .18;
    const moon = bg.createRadialGradient(1005, 145, 8, 1025, 170, 72);
    moon.addColorStop(0, '#f4efe2');
    moon.addColorStop(.72, '#d8d8ce');
    moon.addColorStop(1, '#aeb7b4');
    bg.fillStyle = moon;
    bg.beginPath(); bg.arc(1025, 170, 72, 0, Math.PI * 2); bg.fill();
    bg.globalAlpha = .07;
    bg.fillStyle = '#52616a';
    bg.beginPath(); bg.arc(1000, 145, 13, 0, Math.PI * 2); bg.fill();
    bg.beginPath(); bg.arc(1052, 188, 9, 0, Math.PI * 2); bg.fill();
    bg.restore();

    bg.fillStyle = '#1b2a37';
    bg.beginPath();
    bg.moveTo(0, 440); bg.lineTo(185, 245); bg.lineTo(330, 420);
    bg.lineTo(515, 210); bg.lineTo(710, 430); bg.lineTo(900, 265);
    bg.lineTo(1080, 420); bg.lineTo(1200, 300); bg.lineTo(1280, 390);
    bg.lineTo(1280, 535); bg.lineTo(0, 535); bg.closePath(); bg.fill();

    bg.fillStyle = '#223341';
    bg.beginPath();
    bg.moveTo(0, 480); bg.lineTo(120, 350); bg.lineTo(250, 470);
    bg.lineTo(410, 330); bg.lineTo(565, 475); bg.lineTo(755, 335);
    bg.lineTo(930, 468); bg.lineTo(1080, 350); bg.lineTo(1280, 470);
    bg.lineTo(1280, 560); bg.lineTo(0, 560); bg.closePath(); bg.fill();

    // Estructura de entrenamiento al fondo.
    bg.fillStyle = '#151e26';
    bg.fillRect(555, 298, 18, 242);
    bg.fillRect(710, 298, 18, 242);
    bg.fillRect(515, 292, 255, 18);
    bg.fillRect(542, 325, 200, 12);

    const floor = bg.createLinearGradient(0, 500, 0, 720);
    floor.addColorStop(0, '#26343d');
    floor.addColorStop(1, '#11181e');
    bg.fillStyle = floor;
    bg.fillRect(0, 520, 1280, 200);
    bg.strokeStyle = 'rgba(225,232,226,.12)';
    bg.lineWidth = 2;
    bg.beginPath(); bg.moveTo(0, 522); bg.lineTo(1280, 522); bg.stroke();
    for (let y = 570; y < 721; y += 48) {
      bg.strokeStyle = 'rgba(225,232,226,.045)';
      bg.beginPath(); bg.moveTo(0, y); bg.lineTo(1280, y); bg.stroke();
    }

    bg.font = '800 16px ui-monospace, monospace';
    bg.textAlign = 'center';
    bg.fillStyle = 'rgba(238,239,232,.16)';
    bg.fillText('CAMPO DE ENTRENAMIENTO · DESCO', 640, 168);
  }

  function drawBackground(now) {
    ctx.drawImage(backgroundCanvas, 0, 0);
    // Solo el polvo se calcula en cada cuadro; el resto del escenario está precalculado.
    ctx.fillStyle = '#d9e0da';
    for (let i = 0; i < 24; i += 1) {
      const x = (i * 83 + now * (.006 + (i % 3) * .003)) % 1320 - 20;
      const y = 105 + ((i * 67) % 385) + Math.sin(now * .0005 + i) * 8;
      ctx.globalAlpha = .08 + (i % 4) * .025;
      ctx.beginPath(); ctx.arc(x, y, 1 + (i % 2), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
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
    const striking = PLAYER_ATTACK_TYPES.has(type) || ['attack', 'counter'].includes(type);
    const isKick = type === 'kick';
    const isKnee = type === 'knee';
    const peaks = { jab: .38, cross: .42, hook: .48, uppercut: .52, knee: .50, heavy: .47, kick: .47, attack: .46, counter: .46 };
    const peak = peaks[type] ?? .47;
    const strike = striking ? windowed(0, peak, .86) : 0;
    const dash = striking ? windowed(.05, peak, .94) : 0;
    const reactionDelay = action?.delay ?? 0;
    const recoil = type === 'hit' ? windowed(reactionDelay, Math.min(reactionDelay + .22, .76), 1) : 0;
    const fall = type === 'defeated' ? smooth((p - .08) / .72) : 0;
    const spawn = type === 'spawn' ? 1 - easeOut(p) : 0;
    const reach = type === 'jab' ? 50 : type === 'heavy' ? 95 : isKick ? 42 : 62;
    const travelByType = {
      jab: 370, cross: 370, hook: 360, uppercut: 360, knee: 350,
      heavy: 335, kick: 330, attack: 335, counter: 335
    };
    // El desplazamiento y el brazo o pierna terminan en el cuerpo rival.
    const travel = travelByType[type] ?? 0;
    const offsetX = facing * (dash * travel - recoil * 52 - fall * 72);
    const offsetY = -spawn * 120 - ((isKick || isKnee) ? Math.sin(p * Math.PI) * 13 : 0) + recoil * 10 + fall * 76 + idle * (striking ? .4 : 1.8);
    const lean = strike * ((isKick || isKnee) ? -.18 : .17) - recoil * .42 - fall * 1.15 + idle * .018;
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
    const frontFoot = {
      x: 43 + (isKick ? strike * 116 : 0) + (isKnee ? strike * 70 : 0) + step * 3,
      y: -4 - (isKick ? strike * 67 : 0) - (isKnee ? strike * 82 : 0)
    };
    const backFoot = { x: -43 - dash * 16 - step * 3, y: -4 };
    const alternating = type === 'jab' && action.alternate;
    let frontElbow = { x: 28 + strike * reach * .42, y: -159 + crouch * .3 };
    let backElbow = { x: -22 + (alternating ? strike * 23 : 0), y: -151 + crouch * .3 };
    let frontHand = { x: 46 + (alternating ? strike * 8 : strike * reach) + idle * 4, y: -146 - strike * 10 + idle * 4 };
    let backHand = { x: -29 + (alternating ? strike * 112 : strike * 18), y: -142 - (alternating ? strike * 14 : 0) - idle * 4 };

    if (type === 'cross') {
      frontElbow = { x: 12, y: -146 };
      frontHand = { x: 30, y: -132 };
      backElbow = { x: 24 + strike * 42, y: -160 };
      backHand = { x: -18 + strike * 142, y: -156 };
    } else if (type === 'hook') {
      frontElbow = { x: 33 + strike * 42, y: -176 };
      frontHand = { x: 48 + strike * 80, y: -150 + strike * 24 };
    } else if (type === 'uppercut') {
      frontElbow = { x: 34 + strike * 34, y: -138 - strike * 34 };
      frontHand = { x: 44 + strike * 72, y: -130 - strike * 92 };
    } else if (isKnee) {
      frontElbow = { x: 36, y: -164 };
      frontHand = { x: 58, y: -150 };
    }

    const drawLimb = (...points) => {
      ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
      points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
      ctx.strokeStyle = '#11171c'; ctx.lineWidth = 13; ctx.stroke();
      ctx.strokeStyle = color; ctx.lineWidth = 8; ctx.stroke();
    };

    drawLimb(hip, { x: -20 - dash * 7, y: -49 + crouch * .6 }, backFoot);
    drawLimb(hip, {
      x: 26 + (isKick ? strike * 36 : 0) + (isKnee ? strike * 58 : 0),
      y: -50 - (isKick ? strike * 41 : 0) - (isKnee ? strike * 68 : 0)
    }, frontFoot);
    drawLimb(hip, chest);
    drawLimb(chest, backElbow, backHand);
    drawLimb(chest, frontElbow, frontHand);
    if (striking && !isKick && strike > .2) {
      const fist = type === 'cross' || alternating ? backHand : frontHand;
      ctx.beginPath(); ctx.arc(fist.x, fist.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
    }

    if (striking && strike > .45) {
      const endpoint = isKick || isKnee ? frontFoot : (type === 'cross' ? backHand : frontHand);
      ctx.save();
      ctx.globalAlpha = Math.min(.2, strike * .2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(endpoint.x - 34, endpoint.y + 3);
      ctx.lineTo(endpoint.x - 8, endpoint.y);
      ctx.stroke();
      ctx.restore();
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
      if (!particle.active) return;
      ctx.globalAlpha = particle.life;
      ctx.fillStyle = particle.color;
      ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.size * .55, 0, Math.PI * 2); ctx.fill();
    });
    ctx.shadowBlur = 0;
    state.floatingText.forEach((item) => {
      if (!item.active) return;
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
      if (!p.active) return;
      p.x += p.vx * delta * .07;
      p.y += p.vy * delta * .07;
      p.vy += .016 * delta;
      p.life -= p.decay * delta * .06;
      if (p.life <= 0) p.active = false;
    });
    state.floatingText.forEach((f) => {
      if (!f.active) return;
      f.y -= delta * .04;
      f.life -= delta * .0013;
      if (f.life <= 0) f.active = false;
    });
  }

  function updateCombat(now) {
    if (state.mode !== 'playing') return;
    for (const action of [state.playerAction, state.enemyAction]) {
      if (!action?.impact || action.impactDone || actionProgress(action, now) < (action.impactAt ?? .46)) continue;
      const hit = action.impact;
      createImpact(hit.x, hit.y, hit.color, hit.amount);
      if (hit.label) addFloat(hit.label, hit.labelX, hit.labelY, hit.labelColor);
      const lightStrike = LETTER_ATTACKS.some((attack) => attack.type === action.type);
      state.shake = lightStrike ? 2.2 : action.type === 'kick' ? 12 : 8;
      state.flash = lightStrike ? .055 : .32;
      action.impactDone = true;
      if (action === state.playerAction) {
        state.enemyAction = {
          type: action.reaction || 'hit',
          started: now,
          duration: action.sentenceComplete ? 900 : 360,
          delay: action.sentenceComplete ? .08 : 0
        };
        if (action.sentenceComplete) {
          addFloat('¡FRASE COMPLETA!', 640, 250, '#ffd35a');
          if (state.healProgress >= currentLevel().healEvery) {
            const before = state.playerHp;
            state.playerHp = Math.min(100, state.playerHp + currentLevel().healAmount);
            const healed = Math.round(state.playerHp - before);
            state.healProgress = 0;
            if (healed > 0) addFloat(`+${healed} VIDA`, PLAYER_X, 315, '#78c6c2');
          }
          state.pendingWaveAdvanceAt = now + 900;
        }
      }
    }
    if (now >= state.wordDeadline && state.enemyHp > 0) {
      enemyAttack('timeout');
      resetWordDeadline(now);
    }
    if (state.pendingWaveAdvanceAt && now >= state.pendingWaveAdvanceAt) {
      state.pendingWaveAdvanceAt = 0;
      if (state.wave === ENEMIES.length - 1) finishGame(true);
      else {
        state.wave += 1;
        state.wordIndex = 0;
        state.typed = '';
        state.phraseHadError = false;
        loadEnemy();
        resetWordDeadline(now);
        $('typingInput').disabled = false;
        $('typingInput').value = '';
        $('typingInput').focus({ preventScroll: true });
        updateUi();
      }
    }
    if (state.playerAction && actionProgress(state.playerAction, now) >= 1) {
      state.playerAction = null;
      startNextPlayerAction(now);
    }
    if (state.enemyAction && actionProgress(state.enemyAction, now) >= 1 && state.enemyAction.type !== 'defeated') state.enemyAction = null;
    if (now - state.lastHudUpdate >= 250) {
      state.lastHudUpdate = now;
      updateLiveStats();
    }
  }

  function render(now) {
    if (document.hidden) {
      state.lastFrame = now;
      state.lastRender = now;
      state.nextRenderAt = 0;
      requestAnimationFrame(render);
      return;
    }
    if (state.mode === 'paused') {
      state.lastFrame = now;
      state.nextRenderAt = 0;
      requestAnimationFrame(render);
      return;
    }
    if (state.nextRenderAt && now < state.nextRenderAt) {
      requestAnimationFrame(render);
      return;
    }
    if (!state.nextRenderAt || now - state.nextRenderAt > 250) state.nextRenderAt = now + TARGET_FRAME_MS;
    else while (state.nextRenderAt <= now) state.nextRenderAt += TARGET_FRAME_MS;
    state.lastRender = now;
    const delta = Math.min(now - (state.lastFrame || now), MAX_FRAME_DELTA);
    state.lastFrame = now;
    state.sceneTime += delta;
    updateCombat(now);
    state.effectAccumulator = Math.min(state.effectAccumulator + delta, MAX_FRAME_DELTA * 2);
    while (state.effectAccumulator >= TARGET_FRAME_MS) {
      tickEffects(TARGET_FRAME_MS);
      state.effectAccumulator -= TARGET_FRAME_MS;
    }
    state.shake *= .83;
    state.flash *= .88;

    ctx.save();
    if (state.shake > .2) ctx.translate((Math.random() - .5) * state.shake, (Math.random() - .5) * state.shake);
    drawBackground(now);
    const playerAttacking = PLAYER_ATTACK_TYPES.has(state.playerAction?.type);
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

  function updateLevelRules() {
    const level = currentLevel();
    const writing = level.punctuation
      ? 'incluye acentos, comas, puntos y otros signos'
      : level.accents ? 'incluye palabras con acentos' : 'usa frases sin acentos ni signos';
    $('levelRules').textContent = `Nivel ${level.number}: ${writing}. Recuperas ${level.healAmount} de vida cada ${level.healEvery} ${level.healEvery === 1 ? 'frase limpia' : 'frases limpias'}. Puedes usar borrar, espacio y Enter.`;
  }

  document.querySelectorAll('.difficulty').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.difficulty').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      state.level = button.dataset.level;
      updateLevelRules();
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
  $('typingInput').addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || state.mode !== 'playing') return;
    event.preventDefault();
    if (state.typed === currentTypingWord()) completeWord();
    else typo();
  });
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
  $('refreshLeaderboard').addEventListener('click', loadLeaderboard);

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
  $('playerName').value = state.playerName;
  updateLevelRules();
  loadLeaderboard();
  buildBackgroundCache();
  requestAnimationFrame(render);
})();
