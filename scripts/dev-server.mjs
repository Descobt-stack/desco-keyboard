import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';

const valueAfter = (flag, fallback) => {
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
};
const host = valueAfter('--host', '127.0.0.1');
const port = Number(valueAfter('--port', '4173'));
const root = resolve(import.meta.dirname, '..', 'public');
const board = [];
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };

const server = createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  if (url.pathname === '/api/leaderboard') {
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(board.sort((a, b) => b.score - a.score).slice(0, 10)));
    return;
  }
  if (url.pathname === '/api/scores' && request.method === 'POST') {
    let raw = '';
    for await (const chunk of request) raw += chunk;
    const entry = JSON.parse(raw || '{}');
    board.push(entry);
    response.statusCode = 201;
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ saved: true, score: entry.score || 0 }));
    return;
  }
  const path = url.pathname === '/' ? '/index.html' : url.pathname;
  if (!['/index.html', '/styles.css', '/phrases.js', '/game.js'].includes(path)) {
    response.statusCode = 404;
    response.end('Not found');
    return;
  }
  try {
    const data = await readFile(resolve(root, `.${path}`));
    response.setHeader('content-type', types[extname(path)] || 'application/octet-stream');
    response.end(data);
  } catch {
    response.statusCode = 404;
    response.end('Not found');
  }
});

server.listen(port, host, () => console.log(`Desco Keyboard preview: http://${host}:${port}`));
