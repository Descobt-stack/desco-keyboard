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
// Nueva temporada de puntuación: las marcas anteriores quedan fuera del tablero activo.
// Se conservan en D1 para no hacer una eliminación irreversible desde el Worker.
const SCOREBOARD_RESET_AT = Date.parse('2026-11-06T18:17:39.555Z');
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
  return name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');
}

function validName(name) {
  return typeof name === 'string' && /^[\p{L}\p{N} _.-]{2,20}$/u.test(name.trim());
}

function validInteger(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
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
  return json(request, result.results || []);
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
  if (!validName(name) || !validInteger(level, 1, 8) || !validInteger(wpm, 0, 300)
    || !validInteger(accuracy, 0, 100) || !validInteger(hp, 0, 100)
    || typeof body?.completed !== 'boolean'
    || !validInteger(correctKeys, 0, MAX_SCORE_KEYS)
    || !validInteger(wrongKeys, 0, MAX_SCORE_KEYS)
    || !validInteger(durationMs, 1000, MAX_SCORE_DURATION_MS)
    || !validInteger(phasesCompleted, 0, phaseCountForLevel(level))
    || !validInteger(progressPercent, 0, 100)
    || !validInteger(bestCombo, 0, MAX_SCORE_COMBO)) {
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
  const score = scoreFor(level, wpm, accuracy, hp, bestCombo, correctKeys, progressPercent, completed);
  const previous = await env.DB.prepare(
    'SELECT score FROM scores WHERE normalized_name = ? AND level = ? AND updated_at >= ?'
  ).bind(normalizedName, level, SCOREBOARD_RESET_AT).first();
  if (previous && Number(previous.score) >= score) {
    return json(request, { saved: false, score: Number(previous.score) });
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
  ).bind(name, normalizedName, level, score, wpm, accuracy, hp, now, now).run();
  return json(request, { saved: true, score }, 201);
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
