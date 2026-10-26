// Mete las notas de la versión (dist_setup/notas_release_v<versión>.md) en dist_setup/latest.yml como releaseNotes.
// El actualizador usa primero las notas de latest.yml; sin ellas coge las del feed de GitHub, que llegan en HTML
// y, si la release no tiene descripción, son el mensaje del commit del tag.
//
// Uso (después de npm run pack:installer): node scripts/add_release_notes_to_latest.js
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const notesFile = path.join(root, 'dist_setup', `notas_release_v${version}.md`);
const latestFile = path.join(root, 'dist_setup', 'latest.yml');

const notes = fs.readFileSync(notesFile, 'utf8')
  .split(/\r?\n/)
  .map(l => l.trim())
  .filter(l => l.startsWith('- '));
if (notes.length === 0) throw new Error(`No hay viñetas "- " en ${notesFile}`);

let yml = fs.readFileSync(latestFile, 'utf8');
if (!new RegExp(`^version: ${version.replace(/\./g, '\\.')}\\s*$`, 'm').test(yml)) {
  throw new Error(`latest.yml no es de la versión ${version}`);
}
// Quitar unas notas anteriores (bloque releaseNotes y sus líneas sangradas) antes de poner las nuevas
yml = yml.replace(/^releaseNotes:.*\r?\n(?:[ \t]+.*\r?\n?)*/m, '');
yml = yml.replace(/\s*$/, '\n') + 'releaseNotes: |-\n' + notes.map(n => `  ${n}`).join('\n') + '\n';
fs.writeFileSync(latestFile, yml, 'utf8');
console.log(`latest.yml con ${notes.length} notas de la v${version}`);
