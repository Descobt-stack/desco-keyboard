const ALLOWED_ORIGINS = new Set([
  'https://descobt-stack.github.io',
  'https://desco-keyboard.josuepmvf.chatgpt.site'
]);
const MAX_SCORE_BODY_BYTES = 2048;
const SCORE_RATE_WINDOW_MS = 60_000;
const SCORE_RATE_LIMIT = 10;
const MAX_SCORE_DURATION_MS = 6 * 60 * 60 * 1000;
const MAX_SCORE_KEYS = 20_000;
const MAX_SCORE_COMBO = 2_000;
const MAX_DEVICE_ID_LENGTH = 80;
const SCORE_PROFILES = [
  { cap: 650, targetWpm: 20, letterTarget: 400, comboTarget: 50 },
  { cap: 725, targetWpm: 25, letterTarget: 440, comboTarget: 50 },
  { cap: 800, targetWpm: 30, letterTarget: 480, comboTarget: 55 },
  { cap: 875, targetWpm: 36, letterTarget: 520, comboTarget: 60 },
  { cap: 950, targetWpm: 45, letterTarget: 780, comboTarget: 90 },
  { cap: 1025, targetWpm: 55, letterTarget: 840, comboTarget: 95 },
  { cap: 1100, targetWpm: 65, letterTarget: 840, comboTarget: 100 },
  { cap: 1175, targetWpm: 78, letterTarget: 1100, comboTarget: 120 }
];
// Mantengo las marcas históricas. La puntuación nueva se agrega sobre el mismo tablero.
const SCOREBOARD_RESET_AT = 0;
const scoreRateBuckets = new Map();

const ASSET_TYPES = {
  '/index.html': 'text/html; charset=utf-8',
  '/styles.css': 'text/css; charset=utf-8',
  '/phrases.js': 'text/javascript; charset=utf-8',
  '/game.js': 'text/javascript; charset=utf-8'
};

function requestOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return null;
  try {
    const current = new URL(request.url).origin;
    return origin === current || ALLOWED_ORIGINS.has(origin) ? origin : false;
  } catch {
    return false;
  }
}

function baseHeaders(request, contentType = 'application/json; charset=utf-8') {
  const origin = requestOrigin(request);
  return {
    'content-type': contentType,
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'x-frame-options': 'SAMEORIGIN',
    'cross-origin-resource-policy': 'same-origin',
    'permissions-policy': 'camera=(), geolocation=(), microphone=()',
    'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' https://desco-keyboard.josuepmvf.chatgpt.site; base-uri 'none'; frame-ancestors 'self'; form-action 'self'",
    ...(origin ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {})
  };
}

function json(request, value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...baseHeaders(request), 'cache-control': 'no-store' }
  });
}

function normalizeName(name) {
  return name.normalize('NFKD').replace(/\p{M}/gu, '').normalize('NFKC')
    .trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');
}

function validName(name) {
  return typeof name === 'string' && /^[\p{L}\p{N} _.-]{2,20}$/u.test(name.trim());
}

function validInteger(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

function validDeviceId(value) {
  return typeof value === 'string'
    && value.length >= 16
    && value.length <= MAX_DEVICE_ID_LENGTH
    && /^[a-zA-Z0-9_-]+$/.test(value);
}

function scoreProfile(level) {
  return SCORE_PROFILES[Math.min(SCORE_PROFILES.length, Math.max(1, Math.round(level))) - 1];
}

function scoreBandStart(level) {
  const normalizedLevel = Math.min(SCORE_PROFILES.length, Math.max(1, Math.round(level)));
  return normalizedLevel === 1 ? 0 : scoreProfile(normalizedLevel - 1).cap + 1;
}

function scoreRatio(value, target) {
  return Math.max(0, Math.min(1, Number(value) / Math.max(1, target)));
}

function scoreGrade(score, level, perfect = false) {
  const profile = scoreProfile(level);
  if (perfect || Number(score) > profile.cap) return 'S+';
  const bandStart = scoreBandStart(level);
  const performance = Number(score) < bandStart
    ? scoreRatio(Number(score), profile.cap)
    : scoreRatio(Number(score) - bandStart, profile.cap - bandStart);
  if (performance >= .9) return 'SS';
  if (performance >= .78) return 'S';
  if (performance >= .65) return 'A';
  if (performance >= .52) return 'B';
  if (performance >= .38) return 'C';
  return 'D';
}

function scoreFor(level, wpm, accuracy, hp, bestCombo, correctKeys, progressPercent, completed) {
  const profile = scoreProfile(level);
  const cappedWpm = Math.min(200, Math.max(0, Math.round(wpm)));
  const progress = completed ? 1 : scoreRatio(progressPercent, 100);
  const weighted = scoreRatio(cappedWpm, profile.targetWpm) * .25
    + scoreRatio(accuracy, 100) * .25
    + scoreRatio(correctKeys, profile.letterTarget) * .20
    + scoreRatio(bestCombo, profile.comboTarget) * .15
    + scoreRatio(hp, 100) * .15;
  if (!completed) return Math.round(profile.cap * weighted * progress * .1);
  const bandStart = scoreBandStart(level);
  const bandWidth = Math.max(1, profile.cap - bandStart);
  return bandStart + Math.round(bandWidth * weighted);
}

function isPerfectRun(completed, accuracy, wrongKeys, progressPercent, phasesCompleted, level) {
  return completed && accuracy === 100 && wrongKeys === 0
    && progressPercent === 100 && phasesCompleted === phaseCountForLevel(level);
}

function phaseCountForLevel(level) {
  return level <= 4 ? 10 : 16;
}

function derivedWpm(correctKeys, durationMs) {
  return Math.round((correctKeys / 5) / Math.max(durationMs / 60_000, 0.001));
}

function derivedAccuracy(correctKeys, wrongKeys) {
  const total = correctKeys + wrongKeys;
  return total ? Math.round((correctKeys / total) * 100) : 100;
}

function scoreClientKey(request) {
  return request.headers.get('cf-connecting-ip')
    || request.headers.get('x-forwarded-for')
    || 'unknown';
}

function rateLimited(request) {
  const now = Date.now();
  const key = scoreClientKey(request);
  const bucket = scoreRateBuckets.get(key);
  if (!bucket || now - bucket.startedAt >= SCORE_RATE_WINDOW_MS) {
    scoreRateBuckets.set(key, { startedAt: now, count: 1 });
    if (scoreRateBuckets.size > 1000) {
      for (const [candidate, value] of scoreRateBuckets) {
        if (now - value.startedAt >= SCORE_RATE_WINDOW_MS) scoreRateBuckets.delete(candidate);
      }
    }
    return false;
  }
  bucket.count += 1;
  return bucket.count > SCORE_RATE_LIMIT;
}

async function readLeaderboard(request, env) {
  if (!env.DB) return json(request, { error: 'Base de datos no disponible.' }, 503);
  const requestedLevel = new URL(request.url).searchParams.get('level');
  const level = requestedLevel === null ? null : Number(requestedLevel);
  if (requestedLevel !== null && !validInteger(level, 1, 8)) {
    return json(request, { error: 'Nivel inválido.' }, 400);
  }
  const result = level
    ? await env.DB.prepare(
      `SELECT player_name AS name, level, score, wpm, accuracy
       FROM scores
       WHERE updated_at >= ? AND level = ?
       ORDER BY score DESC, updated_at ASC
       LIMIT 50`
    ).bind(SCOREBOARD_RESET_AT, level).all()
    : await env.DB.prepare(
      `SELECT player_name AS name, level, score, wpm, accuracy
       FROM scores
       WHERE updated_at >= ?
       ORDER BY score DESC, updated_at ASC
       LIMIT 50`
    ).bind(SCOREBOARD_RESET_AT).all();
  return json(request, (result.results || []).map((entry) => ({
    ...entry,
    grade: scoreGrade(Number(entry.score), Number(entry.level))
  })));
}

async function resolvePlayerIdentity(env, level, name, normalizedName, deviceId) {
  const deviceKey = `${normalizedName}::${deviceId}`;
  const result = await env.DB.prepare(
    `SELECT id, player_name, normalized_name, score
     FROM scores
     WHERE level = ? AND (normalized_name = ? OR normalized_name LIKE ?)`
  ).bind(level, normalizedName, `${normalizedName}::%`).all();
  const rows = result.results || [];
  const sameDevice = rows.find((row) => row.normalized_name === deviceKey);
  if (sameDevice) {
    return { key: deviceKey, displayName: sameDevice.player_name, legacyId: null };
  }

  // La primera sesión que vuelva a usar un nombre histórico reclama esa fila.
  // Así conservo la marca existente sin crear un duplicado para el mismo jugador.
  const legacy = rows.find((row) => row.normalized_name === normalizedName);
  if (legacy) {
    return { key: deviceKey, displayName: name, legacyId: Number(legacy.id) };
  }

  const usedNames = new Set(rows.map((row) => String(row.player_name)));
  const normalizedDisplay = (value) => normalizeName(value);
  const baseIsUsed = rows.some((row) => normalizedDisplay(row.player_name) === normalizedName);
  let displayName = name;
  if (baseIsUsed || usedNames.has(name)) {
    let suffix = 2;
    while (usedNames.has(`${name} (${suffix})`)
      || rows.some((row) => normalizedDisplay(row.player_name) === normalizedDisplay(`${name} (${suffix})`))) {
      suffix += 1;
    }
    displayName = `${name} (${suffix})`;
  }
  return { key: deviceKey, displayName, legacyId: null };
}

async function topScoreForLevel(env, level) {
  const result = await env.DB.prepare('SELECT MAX(score) AS score FROM scores WHERE level = ?').bind(level).first();
  return Number(result?.score || 0);
}

async function saveScore(request, env) {
  if (!env.DB) return json(request, { error: 'Base de datos no disponible.' }, 503);
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return json(request, { error: 'El tablero espera JSON.' }, 415);
  }
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_SCORE_BODY_BYTES) {
    return json(request, { error: 'La puntuación supera el tamaño permitido.' }, 413);
  }
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_SCORE_BODY_BYTES) {
    return json(request, { error: 'La puntuación supera el tamaño permitido.' }, 413);
  }
  let body;
  try {
    body = JSON.parse(raw || '{}');
  } catch {
    return json(request, { error: 'JSON inválido.' }, 400);
  }
  const name = typeof body?.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
  const level = Number(body?.level);
  const wpm = Number(body?.wpm);
  const accuracy = Number(body?.accuracy);
  const hp = Number(body?.hp);
  const completed = body?.completed === true;
  const correctKeys = Number(body?.correctKeys);
  const wrongKeys = Number(body?.wrongKeys);
  const durationMs = Number(body?.durationMs);
  const phasesCompleted = Number(body?.phasesCompleted);
  const progressPercent = Number(body?.progressPercent);
  const bestCombo = Number(body?.bestCombo);
  const deviceId = typeof body?.deviceId === 'string' ? body.deviceId : '';
  if (!validName(name) || !validInteger(level, 1, 8) || !validInteger(wpm, 0, 300)
    || !validInteger(accuracy, 0, 100) || !validInteger(hp, 0, 100)
    || typeof body?.completed !== 'boolean'
    || !validInteger(correctKeys, 0, MAX_SCORE_KEYS)
    || !validInteger(wrongKeys, 0, MAX_SCORE_KEYS)
    || !validInteger(durationMs, 1000, MAX_SCORE_DURATION_MS)
    || !validInteger(phasesCompleted, 0, phaseCountForLevel(level))
    || !validInteger(progressPercent, 0, 100)
    || !validInteger(bestCombo, 0, MAX_SCORE_COMBO)
    || !validDeviceId(deviceId)) {
    return json(request, { error: 'Puntuación inválida.' }, 400);
  }

  const expectedWpm = Math.min(200, Math.max(0, derivedWpm(correctKeys, durationMs)));
  const expectedAccuracy = derivedAccuracy(correctKeys, wrongKeys);
  const expectedPhases = phaseCountForLevel(level);
  if (Math.abs(wpm - expectedWpm) > 1 || accuracy !== expectedAccuracy
    || bestCombo > correctKeys
    || progressPercent < Math.floor((phasesCompleted / expectedPhases) * 100)
    || (completed ? (phasesCompleted !== expectedPhases || progressPercent !== 100)
      : progressPercent >= 100)) {
    return json(request, { error: 'La marca no coincide con el entrenamiento.' }, 422);
  }

  const normalizedName = normalizeName(name);
  const identity = await resolvePlayerIdentity(env, level, name, normalizedName, deviceId);
  const previous = identity.legacyId
    ? await env.DB.prepare('SELECT score FROM scores WHERE id = ?').bind(identity.legacyId).first()
    : await env.DB.prepare(
      'SELECT score FROM scores WHERE normalized_name = ? AND level = ? AND updated_at >= ?'
    ).bind(identity.key, level, SCOREBOARD_RESET_AT).first();

  if (identity.legacyId) {
    await env.DB.prepare(
      'UPDATE scores SET player_name = ?, normalized_name = ? WHERE id = ? AND normalized_name = ?'
    ).bind(identity.displayName, identity.key, identity.legacyId, normalizedName).run();
  }

  const perfect = isPerfectRun(completed, accuracy, wrongKeys, progressPercent, phasesCompleted, level);
  const baseScore = scoreFor(level, wpm, accuracy, hp, bestCombo, correctKeys, progressPercent, completed);
  const score = perfect
    ? Math.max(baseScore, (await topScoreForLevel(env, level)) + 1, scoreProfile(level).cap + 1)
    : baseScore;
  if (previous && Number(previous.score) >= score) {
    return json(request, {
      saved: false,
      name: identity.displayName,
      score: Number(previous.score),
      grade: scoreGrade(Number(previous.score), level, perfect)
    });
  }

  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO scores
      (player_name, normalized_name, level, score, wpm, accuracy, hp, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(normalized_name, level) DO UPDATE SET
       player_name = excluded.player_name,
       score = excluded.score,
       wpm = excluded.wpm,
       accuracy = excluded.accuracy,
       hp = excluded.hp,
       updated_at = excluded.updated_at`
  ).bind(identity.displayName, identity.key, level, score, wpm, accuracy, hp, now, now).run();
  return json(request, { saved: true, name: identity.displayName, score, grade: scoreGrade(score, level, perfect) }, 201);
}

function serveAsset(request, pathname) {
  const assetPath = pathname === '/' ? '/index.html' : pathname;
  const source = EMBEDDED_ASSETS[assetPath];
  if (source === undefined) return null;
  return new Response(request.method === 'HEAD' ? null : source, {
    headers: {
      ...baseHeaders(request, ASSET_TYPES[assetPath]),
      'cache-control': assetPath === '/index.html' ? 'no-cache' : 'public, max-age=300'
    }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = requestOrigin(request);
    if (origin === false) return json(request, { error: 'Origen no permitido.' }, 403);
    if (url.pathname === '/api/scores' && request.method === 'POST' && origin === null) {
      return json(request, { error: 'Se requiere un origen válido.' }, 403);
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...baseHeaders(request),
          'access-control-allow-methods': 'GET, POST, OPTIONS',
          'access-control-allow-headers': 'content-type'
        }
      });
    }

    try {
      if (url.pathname === '/api/leaderboard' && request.method === 'GET') {
        return await readLeaderboard(request, env);
      }
      if (url.pathname === '/api/scores' && request.method === 'POST') {
        if (rateLimited(request)) return json(request, { error: 'Demasiados intentos. Espera un minuto.' }, 429);
        return await saveScore(request, env);
      }
      if (request.method === 'GET' || request.method === 'HEAD') {
        const asset = serveAsset(request, url.pathname);
        if (asset) return asset;
      }
      return json(request, { error: 'Ruta no encontrada.' }, 404);
    } catch (error) {
      console.error('Desco Keyboard Worker', error);
      return json(request, { error: 'Error interno del tablero.' }, 500);
    }
  }
};
