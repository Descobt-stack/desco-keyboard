const ALLOWED_ORIGINS = new Set([
  'https://descobt-stack.github.io',
  'https://desco-keyboard.josuepmvf.chatgpt.site'
]);

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

function scoreFor(level, wpm, accuracy, hp) {
  return level * 10000 + wpm * 100 + accuracy * 10 + Math.max(0, hp);
}

async function readLeaderboard(request, env) {
  if (!env.DB) return json(request, { error: 'Base de datos no disponible.' }, 503);
  const result = await env.DB.prepare(
    `SELECT player_name AS name, level, score, wpm, accuracy
     FROM scores
     ORDER BY score DESC, updated_at ASC
     LIMIT 50`
  ).all();
  return json(request, result.results || []);
}

async function saveScore(request, env) {
  if (!env.DB) return json(request, { error: 'Base de datos no disponible.' }, 503);
  const body = await request.json();
  const name = typeof body?.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
  const level = Number(body?.level);
  const wpm = Number(body?.wpm);
  const accuracy = Number(body?.accuracy);
  const hp = Number(body?.hp);
  if (!validName(name) || !validInteger(level, 1, 8) || !validInteger(wpm, 0, 300)
    || !validInteger(accuracy, 0, 100) || !validInteger(hp, 0, 100)) {
    return json(request, { error: 'Puntuación inválida.' }, 400);
  }

  const normalizedName = normalizeName(name);
  const score = scoreFor(level, wpm, accuracy, hp);
  const previous = await env.DB.prepare(
    'SELECT score FROM scores WHERE normalized_name = ? AND level = ?'
  ).bind(normalizedName, level).first();
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
