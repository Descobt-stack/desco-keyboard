import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const assets = {};
for (const name of ['index.html', 'styles.css', 'phrases.js', 'game.js']) {
  assets[`/${name}`] = await readFile(resolve(root, 'public', name), 'utf8');
}

const handler = await readFile(resolve(root, 'worker', 'handler.js'), 'utf8');
const hosting = await readFile(resolve(root, '.openai', 'hosting.json'), 'utf8');
const output = resolve(root, 'dist');
await rm(output, { recursive: true, force: true });
await mkdir(resolve(output, 'server'), { recursive: true });
await mkdir(resolve(output, '.openai'), { recursive: true });
await writeFile(
  resolve(output, 'server', 'index.js'),
  `const EMBEDDED_ASSETS = ${JSON.stringify(assets)};\n\n${handler}\n`,
  'utf8'
);
await writeFile(resolve(output, '.openai', 'hosting.json'), hosting, 'utf8');
console.log('Sitio Worker construido con cuatro recursos y API global.');
