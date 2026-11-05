import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const workerPath = resolve(root, 'dist', 'server', 'index.js');
const manifestPath = resolve(root, 'dist', '.openai', 'hosting.json');
const [source, manifestSource] = await Promise.all([
  readFile(workerPath, 'utf8'),
  readFile(manifestPath, 'utf8')
]);
const manifest = JSON.parse(manifestSource);
assert.equal(manifest.d1, 'DB');
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const module = await import(moduleUrl);
assert.equal(typeof module.default?.fetch, 'function');
for (const required of ['/index.html', '/styles.css', '/phrases.js', '/game.js']) {
  assert.ok(source.includes(required), `Falta el recurso ${required}`);
}
console.log('Artefacto válido: Worker ESM, recursos y binding DB presentes.');
