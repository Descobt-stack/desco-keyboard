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
  const SCOREBOARD_VERSION = '2026-11-score-v2';
  const TRAINER_STORAGE_KEY = 'desco-keyboard-letter-misses-v1';
  const PHRASE_HISTORY_PREFIX = 'desco-keyboard-phrase-history-v1-';
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
  // Fase de combate articulado: cada clip interpola una pose de cadera,
  // hombros, manos y pies. El personaje se dibuja con IK de dos huesos para
  // que el puño o la pierna siempre terminen donde se espera el impacto.
  const COMBAT_POSE_BASE = {
    crouch: 0, lean: 0, bob: 0, rootShift: 0, headTilt: 0,
    frontHand: { x: 45, y: 8 }, rearHand: { x: 24, y: -3 },
    frontFoot: { x: 38, y: 92 }, rearFoot: { x: -38, y: 92 },
    frontBend: 1, rearBend: -1, frontKnee: 1, rearKnee: 1
  };

  const combatPose = (overrides = {}) => ({ ...COMBAT_POSE_BASE, ...overrides });
  const combatPoint = (x, y) => ({ x, y });
  const mixCombatPoint = (a, b, amount) => combatPoint(
    a.x + (b.x - a.x) * amount,
    a.y + (b.y - a.y) * amount
  );
  const smoothCombat = (value) => {
    const t = Math.min(1, Math.max(0, value));
    return t * t * (3 - 2 * t);
  };
  const COMBAT_CLIPS = {
    jab: { frames: [[0, combatPose()], [.18, combatPose({ crouch: 8, rootShift: -14, frontHand: combatPoint(26, 4), rearHand: combatPoint(18, -8) })], [.38, combatPose({ lean: 7, rootShift: 320, frontHand: combatPoint(124, -2), rearHand: combatPoint(18, -8) })], [.68, combatPose({ rootShift: 208, frontHand: combatPoint(72, 2) })], [1, combatPose()]] },
    cross: { frames: [[0, combatPose()], [.2, combatPose({ crouch: 7, rootShift: -16, frontHand: combatPoint(33, -10), rearHand: combatPoint(-8, 4) })], [.42, combatPose({ lean: 11, rootShift: 322, frontHand: combatPoint(30, -8), rearHand: combatPoint(126, -4), rearBend: 1 })], [.72, combatPose({ rootShift: 210, rearHand: combatPoint(65, 2), rearBend: 1 })], [1, combatPose()]] },
    hook: { frames: [[0, combatPose()], [.22, combatPose({ crouch: 12, lean: -6, rootShift: -12, frontHand: combatPoint(18, -25), frontBend: -1 })], [.48, combatPose({ lean: 13, rootShift: 318, frontHand: combatPoint(104, -22), frontBend: -1, rearHand: combatPoint(14, -10) })], [.74, combatPose({ rootShift: 202, frontHand: combatPoint(60, -10), frontBend: -1 })], [1, combatPose()]] },
    uppercut: { frames: [[0, combatPose()], [.25, combatPose({ crouch: 24, lean: -9, rootShift: 2, frontHand: combatPoint(24, 30), rearHand: combatPoint(10, -8) })], [.52, combatPose({ crouch: 5, lean: 12, rootShift: 320, frontHand: combatPoint(78, -68), frontBend: -1 })], [.76, combatPose({ rootShift: 205, frontHand: combatPoint(55, -25), frontBend: -1 })], [1, combatPose()]] },
    knee: { frames: [[0, combatPose()], [.2, combatPose({ crouch: 12, lean: -10, rootShift: -8, frontFoot: combatPoint(20, 54), frontKnee: -1, frontHand: combatPoint(28, -12) })], [.5, combatPose({ lean: -15, rootShift: 314, frontFoot: combatPoint(112, 18), frontKnee: -1, frontHand: combatPoint(18, -14), rearHand: combatPoint(-2, -5) })], [.78, combatPose({ lean: -7, rootShift: 198, frontFoot: combatPoint(65, 66), frontKnee: -1 })], [1, combatPose()]] },
    heavy: { frames: [[0, combatPose()], [.22, combatPose({ crouch: 15, lean: -5, rootShift: -10, frontHand: combatPoint(16, -18), frontBend: -1 })], [.47, combatPose({ lean: 15, rootShift: 306, frontHand: combatPoint(112, -5), frontBend: -1, rearHand: combatPoint(6, -12) })], [.74, combatPose({ rootShift: 190, frontHand: combatPoint(64, -2), frontBend: -1 })], [1, combatPose()]] },
    kick: { frames: [[0, combatPose()], [.2, combatPose({ crouch: 12, lean: -12, rootShift: -10, frontFoot: combatPoint(20, 54), frontKnee: -1, frontHand: combatPoint(28, -12) })], [.5, combatPose({ lean: -17, rootShift: 306, frontFoot: combatPoint(142, 20), frontKnee: -1, frontHand: combatPoint(18, -14), rearHand: combatPoint(-2, -5) })], [.78, combatPose({ lean: -7, rootShift: 194, frontFoot: combatPoint(65, 66), frontKnee: -1 })], [1, combatPose()]] },
    attack: { frames: [[0, combatPose()], [.25, combatPose({ crouch: 14, rootShift: -10, frontHand: combatPoint(18, -12) })], [.46, combatPose({ lean: 12, rootShift: 312, frontHand: combatPoint(130, -5), rearHand: combatPoint(16, -12) })], [.78, combatPose({ rootShift: 196, frontHand: combatPoint(70, 0) })], [1, combatPose()]] },
    counter: { frames: [[0, combatPose()], [.24, combatPose({ crouch: 13, lean: -4, rootShift: -12, frontHand: combatPoint(16, -14) })], [.46, combatPose({ lean: 10, rootShift: 306, frontHand: combatPoint(122, -4), rearHand: combatPoint(8, -12) })], [.76, combatPose({ rootShift: 190, frontHand: combatPoint(68, 0) })], [1, combatPose()]] },
    block: { frames: [[0, combatPose()], [.2, combatPose({ crouch: 8, lean: -4, frontHand: combatPoint(30, -28), rearHand: combatPoint(15, -35), frontBend: -1 })], [.56, combatPose({ crouch: 13, lean: -10, rootShift: -14, frontHand: combatPoint(30, -38), rearHand: combatPoint(12, -48), frontBend: -1 })], [.82, combatPose({ crouch: 6, frontHand: combatPoint(32, -20), rearHand: combatPoint(18, -25), frontBend: -1 })], [1, combatPose()]] },
    hit: { frames: [[0, combatPose()], [.28, combatPose({ lean: -24, rootShift: -52, headTilt: -18, frontHand: combatPoint(-2, 25), rearHand: combatPoint(-18, 12) })], [.66, combatPose({ crouch: 20, lean: -14, rootShift: -24, headTilt: -8 })], [1, combatPose()]] },
    defeated: { frames: [[0, combatPose()], [.35, combatPose({ crouch: 18, lean: -15, rootShift: -24, headTilt: -14 })], [.82, combatPose({ crouch: 42, lean: -44, rootShift: -76, headTilt: -34, frontFoot: combatPoint(58, 92), rearFoot: combatPoint(-18, 92) })], [1, combatPose({ crouch: 48, lean: -48, rootShift: -86, headTilt: -42 })]] },
    spawn: { frames: [[0, combatPose({ crouch: 32, rootShift: -26 })], [.58, combatPose({ crouch: 4, rootShift: 0 })], [1, combatPose()]] }
  };

  function solveCombatTwoBone(root, target, firstLength, secondLength, bend = 1) {
    const dx = target.x - root.x;
    const dy = target.y - root.y;
    const distance = Math.min(firstLength + secondLength - .01,
      Math.max(Math.abs(firstLength - secondLength) + .01, Math.hypot(dx, dy)));
    const baseAngle = Math.atan2(dy, dx);
    const elbowAngle = Math.acos(Math.min(1, Math.max(-1,
      (firstLength * firstLength + distance * distance - secondLength * secondLength)
      / (2 * firstLength * distance))));
    return {
      mid: combatPoint(root.x + Math.cos(baseAngle + bend * elbowAngle) * firstLength,
        root.y + Math.sin(baseAngle + bend * elbowAngle) * firstLength),
      end: target
    };
  }

  function sampleCombatClip(clip, progress) {
    const frames = clip.frames;
    let from = frames[0];
    let to = frames[frames.length - 1];
    for (let i = 0; i < frames.length - 1; i += 1) {
      if (progress >= frames[i][0] && progress <= frames[i + 1][0]) {
        from = frames[i];
        to = frames[i + 1];
        break;
      }
    }
    const amount = smoothCombat((progress - from[0]) / Math.max(.0001, to[0] - from[0]));
    const pose = {};
    Object.keys(COMBAT_POSE_BASE).forEach((key) => {
      const a = from[1][key];
      const b = to[1][key];
      pose[key] = typeof a === 'number'
        ? a + (b - a) * amount
        : mixCombatPoint(a, b, amount);
    });
    return pose;
  }
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
    letterMistakes: loadLetterMistakes(),
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
    enemyNextThinkAt: 0,
    particles: particlePool,
    floatingText: floatingTextPool,
    particleCursor: 0,
    floatingTextCursor: 0,
    audio: null,
    sceneTime: 0,
    scoreSubmitted: false
  };

  function currentLevel() { return LEVELS[state.level]; }
  function phaseCount(level = currentLevel()) {
    return level.phaseCount || (level.number <= 4 ? 10 : 16);
  }
  function currentEnemy() { return ENEMIES[state.wave % ENEMIES.length]; }
  function currentLesson() { return state.lessons[state.wave]; }
  function sentenceWords() { return currentLesson()?.words || []; }
  function currentWord() { return sentenceWords()[state.wordIndex] || ''; }
  function currentTypingWord() {
    return currentWord().toLocaleLowerCase('es');
  }

  function loadLetterMistakes() {
    try {
      const parsed = JSON.parse(localStorage.getItem(TRAINER_STORAGE_KEY) || '{}');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      return Object.fromEntries(Object.entries(parsed)
        .filter(([key, value]) => typeof key === 'string' && key.length <= 3 && Number.isFinite(value) && value > 0)
        .map(([key, value]) => [key, Math.min(999, Math.round(value))]));
    } catch {
      return {};
    }
  }

  function saveLetterMistakes() {
    localStorage.setItem(TRAINER_STORAGE_KEY, JSON.stringify(state.letterMistakes));
  }

  function trainerChar(value) {
    return String(value || '').toLocaleLowerCase('es').normalize('NFC');
  }

  function trainerFocusLetters(limit = 3) {
    return Object.entries(state.letterMistakes)
      .filter(([key, count]) => key.trim() && Number.isFinite(count) && count > 0)
      .sort(([keyA, countA], [keyB, countB]) => countB - countA || keyA.localeCompare(keyB, 'es'))
      .slice(0, limit)
      .map(([key]) => key);
  }

  function updateTrainerUi() {
    const status = $('trainerStatus');
    if (!status) return;
    const focus = trainerFocusLetters();
    status.textContent = focus.length
      ? `Entrenador local: dirigiré nuevas frases a ${focus.map((letter) => `“${letter}”`).join(', ')}. Tus datos no salen de este dispositivo.`
      : 'Entrenador local: todavía estoy aprendiendo tus errores. Tus datos no salen de este dispositivo.';
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

  function phraseHistory(levelNumber) {
    try {
      const parsed = JSON.parse(localStorage.getItem(`${PHRASE_HISTORY_PREFIX}${levelNumber}`) || '[]');
      return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
    } catch {
      return [];
    }
  }

  function shuffle(items) {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }
    return copy;
  }

  function buildLessons(level) {
    const requested = phaseCount(level);
    const pool = level.sections.flatMap((section) => section.phrases.map((text) => ({
      section: section.title,
      text,
      words: text.split(' ')
    })));
    const history = phraseHistory(level.number);
    const focus = trainerFocusLetters();
    const scorePhrase = (item) => focus.reduce((score, letter) => {
      const matches = item.text.toLocaleLowerCase('es').split(letter).length - 1;
      return score + matches;
    }, 0);
    const fresh = pool.filter((item) => !history.includes(item.text));
    const source = fresh.length >= requested ? fresh : pool;
    const focused = shuffle(source.filter((item) => scorePhrase(item) > 0))
      .sort((a, b) => scorePhrase(b) - scorePhrase(a));
    const general = shuffle(source.filter((item) => scorePhrase(item) === 0));
    const ordered = [...focused, ...general, ...shuffle(source.filter((item) => !focused.includes(item) && !general.includes(item)))];
    const selected = [];
    const seen = new Set();
    ordered.forEach((item) => {
      if (selected.length >= requested || seen.has(item.text)) return;
      seen.add(item.text);
      selected.push(item);
    });
    const nextHistory = [...history, ...selected.map((item) => item.text)].slice(-40);
    localStorage.setItem(`${PHRASE_HISTORY_PREFIX}${level.number}`, JSON.stringify(nextHistory));
    return selected;
  }

  function recordTypingMistakes(observed = state.typed) {
    const expected = currentTypingWord();
    const typed = String(observed || '').toLocaleLowerCase('es');
    let recorded = 0;
    const length = Math.max(expected.length, typed.length);
    for (let index = 0; index < length && recorded < 3; index += 1) {
      const expectedChar = trainerChar(expected[index]);
      const typedChar = trainerChar(typed[index]);
      if (expectedChar === typedChar) continue;
      const key = typedChar || expectedChar;
      if (!key || !key.trim()) continue;
      state.letterMistakes[key] = Math.min(999, (state.letterMistakes[key] || 0) + 1);
      recorded += 1;
    }
    if (recorded) {
      saveLetterMistakes();
      updateTrainerUi();
    }
  }

  function resetWordDeadline(now = performance.now()) {
    state.wordDeadline = now + currentLevel().secondsPerWord * 1000;
  }

  function updateTimerUi(now = performance.now()) {
    const level = currentLevel();
    const totalSeconds = Math.max(.1, Number(level.secondsPerWord) || 1);
    const totalPhases = state.lessons.length || phaseCount(level);
    const currentPhase = state.lessons.length ? Math.min(totalPhases, state.wave + 1) : 1;
    const reference = state.mode === 'paused' ? state.pausedAt : now;
    const remaining = state.startAt && state.wordDeadline
      ? Math.max(0, Math.min(totalSeconds, (state.wordDeadline - reference) / 1000))
      : totalSeconds;
    const phaseText = $('phaseText');
    const phaseProgress = $('phaseProgress');
    const wordTimerText = $('wordTimerText');
    const wordTimerProgress = $('wordTimerProgress');
    const roundBadge = document.querySelector('.round-badge');
    if (phaseText) phaseText.textContent = `FASE ${currentPhase}/${totalPhases}`;
    if (phaseProgress) phaseProgress.style.width = `${(currentPhase / totalPhases) * 100}%`;
    if (wordTimerText) wordTimerText.textContent = state.mode === 'paused'
      ? `PAUSADO · ${remaining.toFixed(1)} s`
      : `TIEMPO ${remaining.toFixed(1)} s`;
    if (wordTimerProgress) wordTimerProgress.style.width = `${(remaining / totalSeconds) * 100}%`;
    if (roundBadge) {
      roundBadge.classList.toggle('timer-warning', remaining <= totalSeconds * .35 && remaining > totalSeconds * .12);
      roundBadge.classList.toggle('timer-danger', remaining <= totalSeconds * .12);
    }
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
    state.lessons = buildLessons(currentLevel());
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
    state.enemyNextThinkAt = 0;
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
    updateTrainerUi();
    updateUi();
    tone(420, .09, 'triangle', .05);
  }

  function loadEnemy() {
    const enemy = currentEnemy();
    state.enemyMaxHp = enemy.hp;
    state.enemyHp = enemy.hp;
    state.enemyAction = { type: 'spawn', started: performance.now(), duration: 620 };
    state.enemyNextThinkAt = performance.now() + 1800 + Math.random() * 1600;
    $('enemyName').textContent = enemy.name;
    state.roundStartedAt = performance.now();
    updateTimerUi();
  }

  function pauseGame() {
    if (state.mode !== 'playing') return;
    state.mode = 'paused';
    state.pausedAt = performance.now();
    $('pausePanel').classList.remove('hidden');
    $('typingInput').disabled = true;
    $('pauseGameButton').textContent = 'Continuar';
    updateTimerUi();
  }

  function resumeGame() {
    if (state.mode !== 'paused') return;
    const pausedFor = performance.now() - state.pausedAt;
    state.startAt += pausedFor;
    state.wordDeadline += pausedFor;
    state.roundStartedAt += pausedFor;
    if (state.playerAction) state.playerAction.started += pausedFor;
    if (state.enemyAction) state.enemyAction.started += pausedFor;
    if (state.enemyNextThinkAt) state.enemyNextThinkAt += pausedFor;
    if (state.pendingWaveAdvanceAt) state.pendingWaveAdvanceAt += pausedFor;
    state.mode = 'playing';
    $('pausePanel').classList.add('hidden');
    $('typingInput').disabled = false;
    $('typingInput').focus({ preventScroll: true });
    $('pauseGameButton').textContent = 'Pausa';
    updateTimerUi();
  }

  function returnToMenu() {
    state.mode = 'menu';
    state.typed = '';
    state.enemyNextThinkAt = 0;
    document.body.classList.remove('game-active');
    $('startPanel').classList.remove('hidden');
    $('pausePanel').classList.add('hidden');
    $('resultPanel').classList.add('hidden');
    $('hud').setAttribute('aria-hidden', 'true');
    $('typingInput').disabled = true;
    $('typingInput').value = '';
    $('lessonLabel').textContent = 'Selecciona un nivel para comenzar';
    $('sentenceCount').textContent = `FASE 1/${phaseCount()}`;
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
    updateTimerUi();
    updateTrainerUi();
    loadLeaderboard();
  }

  function elapsedMinutes() {
    if (!state.startAt) return 0;
    const now = state.mode === 'paused' ? state.pausedAt : performance.now();
    return Math.max((now - state.startAt) / 60000, 0.001);
  }

  function elapsedMilliseconds() {
    if (!state.startAt) return 0;
    const now = state.mode === 'paused' ? state.pausedAt : performance.now();
    return Math.max(1000, Math.round(now - state.startAt));
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

  function typo(observed = state.typed) {
    const damage = currentLevel().typoDamage;
    recordTypingMistakes(observed);
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
    const now = performance.now();
    const damage = reason === 'timeout' ? currentLevel().timeoutDamage : currentLevel().typoDamage;
    const canBlock = reason === 'ai' && now < state.wordDeadline;
    state.playerActionQueue.length = 0;
    state.enemyAction = {
      type: 'attack',
      started: now,
      duration: 560,
      impactAt: .46,
      willBlock: canBlock,
      impact: {
        x: PLAYER_X,
        y: 360,
        color: canBlock ? '#78c6c2' : currentEnemy().color,
        amount: canBlock ? 8 : 15,
        label: canBlock ? 'BLOQUEO' : `-${damage}`,
        labelX: 440,
        labelY: 340,
        labelColor: canBlock ? '#78c6c2' : '#ff5368'
      }
    };
    state.playerAction = {
      type: canBlock ? 'block' : 'hit',
      started: now,
      duration: 520,
      delay: .42
    };
    if (!canBlock) {
      state.combo = 0;
      state.phraseHadError = true;
    }
    tone(canBlock ? 150 : 65, canBlock ? .08 : .16, canBlock ? 'triangle' : 'square', .06);
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

  function scoreFor(wpm, accuracy, hp, completed) {
    const cappedWpm = Math.min(200, Math.max(0, Math.round(wpm)));
    const raw = Math.round(cappedWpm * 10 + accuracy * 2 + Math.max(0, Math.round(hp)) * 2);
    return completed ? raw : Math.round(raw * .1);
  }

  function localLeaderboard() {
    if (localStorage.getItem('desco-keyboard-score-version') !== SCOREBOARD_VERSION) {
      localStorage.removeItem('desco-keyboard-local-board');
      localStorage.setItem('desco-keyboard-score-version', SCOREBOARD_VERSION);
    }
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
      wpm: Math.min(200, getWpm()),
      accuracy: getAccuracy(),
      hp: Math.round(state.playerHp),
      completed: Boolean(won),
      correctKeys: state.correctKeys,
      wrongKeys: state.wrongKeys,
      durationMs: elapsedMilliseconds(),
      phasesCompleted: won ? state.lessons.length : Math.max(0, state.wave)
    };
    entry.score = scoreFor(entry.wpm, entry.accuracy, entry.hp, entry.completed);
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
    $('sentenceCount').textContent = `FASE ${state.wave + 1}/${state.lessons.length}`;
    $('lessonLabel').textContent = `${currentLevel().label} · ${currentLesson().section}`;
    $('streakLabel').textContent = `RECUPERACIÓN ${state.healProgress}/${currentLevel().healEvery} · RACHA ${state.combo}`;
    const phraseProgress = (state.wordIndex + (state.typed.length / Math.max(word.length, 1))) / Math.max(words.length, 1);
    $('lessonProgress').style.width = `${phraseProgress * 100}%`;
    $('playerHealth').style.width = `${state.playerHp}%`;
    $('enemyHealth').style.width = `${(state.enemyHp / state.enemyMaxHp) * 100}%`;
    $('playerHpText').textContent = Math.ceil(state.playerHp);
    $('enemyHpText').textContent = Math.ceil(state.enemyHp);
    $('comboText').textContent = `x${state.combo}`;
    updateTimerUi();
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
        typo(input.slice(0, -1));
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
      typo(comparableInput);
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

  function combatPoseAt(action, now, isEnemy) {
    const idle = Math.sin(state.sceneTime * .004 + (isEnemy ? 1.5 : 0));
    const breath = Math.sin(state.sceneTime * .0027 + (isEnemy ? 2.2 : 0));
    const relaxed = combatPose({
      bob: idle * 2.2,
      crouch: Math.max(0, -idle) * 2,
      lean: breath * 1.2,
      frontHand: combatPoint(45 + idle * 3, 8 - breath * 2),
      rearHand: combatPoint(24 - idle * 2, -3 + breath * 2),
      frontFoot: combatPoint(38 + idle * 2, 92),
      rearFoot: combatPoint(-38 - idle * 2, 92)
    });
    if (!action) return relaxed;
    const clip = COMBAT_CLIPS[action.type] || COMBAT_CLIPS.jab;
    const sampled = sampleCombatClip(clip, actionProgress(action, now));
    sampled.bob += idle * .45;
    sampled.lean += breath * .35;
    return sampled;
  }

  function drawCombatLimb(points, color, width, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#11171c';
    ctx.lineWidth = width + 5;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.restore();
  }

  function drawCombatHeadgear(head, scale, facing, isEnemy) {
    const bandColor = isEnemy ? '#d2aa45' : '#a83e39';
    const backX = head.x - facing * 27 * scale;
    ctx.strokeStyle = '#11171c';
    ctx.lineWidth = 12 * scale;
    ctx.beginPath();
    ctx.moveTo(head.x - 25 * scale, head.y - 8 * scale);
    ctx.lineTo(head.x + 25 * scale, head.y - 8 * scale);
    ctx.stroke();
    ctx.strokeStyle = bandColor;
    ctx.lineWidth = 7 * scale;
    ctx.stroke();
    ctx.lineWidth = 5 * scale;
    ctx.beginPath();
    ctx.moveTo(backX, head.y - 8 * scale);
    ctx.quadraticCurveTo(backX - facing * 18 * scale, head.y - 3 * scale,
      backX - facing * 32 * scale, head.y + 5 * scale);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(backX, head.y - 7 * scale);
    ctx.quadraticCurveTo(backX - facing * 17 * scale, head.y - 17 * scale,
      backX - facing * 34 * scale, head.y - 14 * scale);
    ctx.stroke();
  }

  function drawStickman(x, groundY, scale, color, facing, action, now, isEnemy = false) {
    const type = action?.type;
    const pose = combatPoseAt(action, now, isEnemy);
    const size = scale * (isEnemy ? 1.03 : 1);
    const idleShift = action ? 0 : Math.sin(state.sceneTime * .0008 + (isEnemy ? 2 : 0)) * 7;
    const rootX = x + facing * pose.rootShift + idleShift;
    const hip = combatPoint(rootX, groundY - 92 * size + pose.crouch - pose.bob);
    const leanX = facing * pose.lean * .72;
    const shoulder = combatPoint(hip.x + leanX, hip.y - 76 * size);
    const neck = combatPoint(shoulder.x + leanX * .2, shoulder.y - 12 * size);
    const head = combatPoint(neck.x + facing * pose.headTilt * .24, neck.y - 27 * size);
    const frontHand = combatPoint(shoulder.x + facing * pose.frontHand.x * size,
      shoulder.y + pose.frontHand.y * size);
    const rearHand = combatPoint(shoulder.x + facing * pose.rearHand.x * size,
      shoulder.y + pose.rearHand.y * size);
    const frontFoot = combatPoint(hip.x + facing * pose.frontFoot.x * size,
      groundY + (pose.frontFoot.y - 92) * size);
    const rearFoot = combatPoint(hip.x + facing * pose.rearFoot.x * size,
      groundY + (pose.rearFoot.y - 92) * size);
    const frontArm = solveCombatTwoBone(shoulder, frontHand, 42 * size, 43 * size, pose.frontBend * facing);
    const rearArm = solveCombatTwoBone(shoulder, rearHand, 42 * size, 43 * size, pose.rearBend * facing);
    const frontLeg = solveCombatTwoBone(hip, frontFoot, 51 * size, 51 * size, -pose.frontKnee * facing);
    const rearLeg = solveCombatTwoBone(hip, rearFoot, 51 * size, 51 * size, -pose.rearKnee * facing);

    ctx.save();
    ctx.globalAlpha = .22;
    ctx.fillStyle = '#05080a';
    ctx.beginPath();
    ctx.ellipse(hip.x, groundY + 7, 52 * size, 10 * size, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    const lineWidth = 8.5 * size;
    drawCombatLimb([hip, rearLeg.mid, rearLeg.end], color, lineWidth, .82);
    drawCombatLimb([shoulder, rearArm.mid, rearArm.end], color, lineWidth, .82);
    drawCombatLimb([hip, shoulder], color, lineWidth + 2);
    drawCombatLimb([shoulder, neck], color, lineWidth * .72);
    drawCombatLimb([hip, frontLeg.mid, frontLeg.end], color, lineWidth);
    drawCombatLimb([shoulder, frontArm.mid, frontArm.end], color, lineWidth);

    ctx.fillStyle = color;
    ctx.strokeStyle = '#11171c';
    ctx.lineWidth = 5 * size;
    ctx.beginPath();
    ctx.arc(head.x, head.y, 29 * size, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    drawCombatHeadgear(head, size, facing, isEnemy);
    ctx.fillStyle = '#11171c';
    ctx.beginPath();
    ctx.arc(head.x + facing * 10 * size, head.y - 1 * size, 3.3 * size, 0, Math.PI * 2);
    ctx.fill();

    const striking = PLAYER_ATTACK_TYPES.has(type) || ['attack', 'counter'].includes(type);
    if (striking && actionProgress(action, now) > .2) {
      const endpoint = ['kick', 'knee'].includes(type)
        ? frontLeg.end
        : type === 'cross' ? rearArm.end : frontArm.end;
      ctx.fillStyle = color;
      ctx.strokeStyle = '#11171c';
      ctx.lineWidth = 3 * size;
      ctx.beginPath();
      ctx.arc(endpoint.x, endpoint.y, 6 * size, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (actionProgress(action, now) > .45) {
        ctx.globalAlpha = .24;
        ctx.strokeStyle = color;
        ctx.lineWidth = 3 * size;
        ctx.beginPath();
        ctx.moveTo(endpoint.x - facing * 42 * size, endpoint.y + 5 * size);
        ctx.lineTo(endpoint.x - facing * 10 * size, endpoint.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
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
      state.shake = action.type === 'attack' && action.willBlock
        ? 2.5
        : lightStrike ? 2.2 : action.type === 'kick' ? 12 : 8;
      state.flash = action.type === 'attack' && action.willBlock ? .08 : lightStrike ? .055 : .32;
      action.impactDone = true;
      if (action === state.enemyAction && action.type === 'attack' && !action.willBlock) {
        const damage = action.impact.label ? Number(String(action.impact.label).replace(/[^0-9]/g, '')) : currentLevel().timeoutDamage;
        state.playerHp = Math.max(0, state.playerHp - (damage || currentLevel().timeoutDamage));
        state.combo = 0;
        state.phraseHadError = true;
        if (state.playerHp <= 0) finishGame(false);
        updateUi();
      }
      if (action === state.playerAction) {
        if (!state.enemyAction || state.enemyAction.type !== 'attack') {
          state.enemyAction = {
            type: action.reaction || 'hit',
            started: now,
            duration: action.sentenceComplete ? 900 : 360,
            delay: action.sentenceComplete ? .08 : 0
          };
        }
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
    if (state.enemyHp > 0 && !state.enemyAction && !state.pendingWaveAdvanceAt
      && state.enemyNextThinkAt && now >= state.enemyNextThinkAt) {
      enemyAttack('ai');
      state.enemyNextThinkAt = now + 2800 + Math.random() * 2200;
    }
    if (now >= state.wordDeadline && state.enemyHp > 0 && !state.enemyAction && !state.pendingWaveAdvanceAt) {
      enemyAttack('timeout');
      resetWordDeadline(now);
    }
    if (state.pendingWaveAdvanceAt && now >= state.pendingWaveAdvanceAt) {
      state.pendingWaveAdvanceAt = 0;
      if (state.wave === state.lessons.length - 1) finishGame(true);
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
    updateTimerUi(now);
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
    const phases = phaseCount(level);
    $('levelRules').textContent = `Nivel ${level.number}: ${phases} fases · ${writing}. Recuperas ${level.healAmount} de vida cada ${level.healEvery} ${level.healEvery === 1 ? 'frase limpia' : 'frases limpias'}. El límite oculto es de ${level.secondsPerWord} s por palabra. Puedes usar borrar, espacio y Enter.`;
    updateTrainerUi();
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
    else typo(state.typed);
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
  updateTrainerUi();
  loadLeaderboard();
  buildBackgroundCache();
  requestAnimationFrame(render);
})();
