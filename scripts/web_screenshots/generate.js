// Genera las capturas de la web (modo claro y oscuro) con tableros de demostración inventados,
// en una copia aislada de la app: no lee ni escribe los tableros reales del usuario.
//
// Uso:
//   node scripts/web_screenshots/generate.js --out <carpeta> [--electron <electron.exe>] [--only escena1,escena2] [--keep-open]
//
// - Electron: la versión del instalador (31.2.0). Si no se pasa --electron ni ELECTRON_31_EXE,
//   se instala electron@31.2.0 en la carpeta temporal (unos 100 MB).
// - El perfil de prueba va en una unidad virtual (subst) para que las rutas de las capturas
//   sean neutras (W:\Documentos..., W:\Proyectos...) y no muestren el nombre del usuario del PC.
// - El Cerebro IA usa una IA falsa local con la API de Ollama: no se envía nada ni se gasta nada.
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, execSync } = require('child_process');
const { buildDemoBoards } = require('./demo_boards');
const SCENES = require('./scenes');

const REPO = path.resolve(__dirname, '..', '..');
const CDP_PORT = 9341;
const FAKE_AI_PORT = 11556;
const VIEWPORT = { width: 1440, height: 900 };

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
  return {
    out: get('--out'),
    electron: get('--electron') || process.env.ELECTRON_31_EXE || null,
    only: (get('--only') || '').split(',').map(s => s.trim()).filter(Boolean),
    keepOpen: args.includes('--keep-open')
  };
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function freeDriveLetter() {
  for (const l of ['W', 'V', 'U', 'T', 'S', 'R', 'Q']) {
    if (!fs.existsSync(`${l}:\\`)) return l;
  }
  throw new Error('No hay ninguna letra de unidad libre para la unidad virtual');
}

function ensureElectron(tmp, given) {
  if (given) return given;
  const dir = path.join(tmp, 'electron31');
  console.log('Instalando electron@31.2.0 (solo la primera vez)…');
  execSync(`npm install electron@31.2.0 --prefix "${dir}" --no-audit --no-fund`, { stdio: 'inherit' });
  return path.join(dir, 'node_modules', 'electron', 'dist', 'electron.exe');
}

// Copia de la app sin las semillas de tableros del usuario (solo la de Ejemplo, que va en el instalador)
function copyApp(dest) {
  const src = path.join(REPO, 'app_bundle');
  fs.cpSync(src, path.join(dest, 'app_bundle'), {
    recursive: true,
    filter: (p) => {
      const rel = path.relative(src, p).replace(/\\/g, '/');
      if (rel.startsWith('boards/')) return rel === 'boards/ejemplo.json';
      return true;
    }
  });
  const { version } = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));
  fs.writeFileSync(path.join(dest, 'package.json'), JSON.stringify({ name: 'brain-board-shots', productName: 'Brain Board', version, main: 'launcher.js' }, null, 2));
  fs.writeFileSync(path.join(dest, 'launcher.js'), `
const { app } = require('electron');
process.env.NODE_PATH = ${JSON.stringify(path.join(REPO, 'node_modules'))};
require('module').Module._initPaths();
process.env.APPDATA = ${JSON.stringify(process.env.__SHOTS_APPDATA)};
// Carpeta personal falsa: así la app no detecta nada instalado en este PC ni enseña su ruta
process.env.USERPROFILE = ${JSON.stringify(process.env.__SHOTS_HOME)};
process.env.HOMEDRIVE = ${JSON.stringify(process.env.__SHOTS_HOME.slice(0, 2))};
process.env.HOMEPATH = ${JSON.stringify(process.env.__SHOTS_HOME.slice(2))};
app.setPath('appData', process.env.APPDATA);
app.setPath('documents', ${JSON.stringify(process.env.__SHOTS_DOCS)});
app.commandLine.appendSwitch('remote-debugging-port', '${CDP_PORT}');
// Seguir pintando aunque la ventana quede tapada por otras (si no, las capturas esperan para siempre)
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
require('./app_bundle/main.js');
`);
}

// Carpeta de proyecto de ejemplo para las tarjetas de carpeta
function makeDemoFolder(root) {
  const base = path.join(root, 'Proyectos', 'Cortometraje Faro');
  const files = {
    '01_Guion': ['guion_v04.pdf', 'escaleta.docx'],
    '02_Storyboard': ['sb_secuencia_01.psd', 'sb_secuencia_02.psd', 'animatic_v02.mp4'],
    '03_Assets': ['faro_modelado_v07.blend', 'rocas_scatter.hip', 'acantilado_sculpt.ztl'],
    '04_Render': ['faro_sh010_v003.exr', 'faro_sh020_v001.exr'],
    '05_Musica': ['tema_principal_demo.wav']
  };
  Object.entries(files).forEach(([dir, list]) => {
    fs.mkdirSync(path.join(base, dir), { recursive: true });
    list.forEach(f => fs.writeFileSync(path.join(base, dir, f), ''));
  });
  fs.writeFileSync(path.join(base, 'notas_produccion.txt'), 'Plan de rodaje y entregas');
  fs.writeFileSync(path.join(base, 'faro_layout_v12.blend'), '');
  return base;
}

// IA falsa con la API de Ollama: respuestas fijas según la petición
function startFakeAi() {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      let prompt = '';
      try { prompt = JSON.parse(body).prompt || ''; } catch (e) {}
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ response: SCENES.fakeAiResponse(prompt) }));
    });
  });
  server.listen(FAKE_AI_PORT, '127.0.0.1');
  return server;
}

async function getPageWs() {
  for (let i = 0; i < 120; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json`);
      const targets = await res.json();
      const page = targets.find(t => t.type === 'page' && /index\.html/.test(t.url));
      if (page) return page.webSocketDebuggerUrl;
    } catch (e) {}
    await sleep(500);
  }
  throw new Error('La app de prueba no ha arrancado');
}

async function connect() {
  const ws = new WebSocket(await getPageWs());
  let seq = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  };
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`${method} no ha respondido en 30 s`));
    }, 30000);
    pending.set(id, (msg) => { clearTimeout(timer); resolve(msg); });
    ws.send(JSON.stringify({ id, method, params }));
  });
  // Ejecuta una función en la página con sus argumentos (serializados en JSON)
  const run = async (fn, arg = null) => {
    const r = await send('Runtime.evaluate', {
      expression: `(${fn.toString()})(${JSON.stringify(arg)})`,
      awaitPromise: true,
      returnByValue: true
    });
    if (r.result?.exceptionDetails) {
      throw new Error(r.result.exceptionDetails.exception?.description || JSON.stringify(r.result.exceptionDetails));
    }
    return r.result?.result?.value;
  };
  return { ws, send, run };
}

async function main() {
  const opts = parseArgs();
  if (!opts.out) {
    console.error('Falta --out <carpeta de salida>');
    process.exit(1);
  }
  const outDir = path.resolve(opts.out);
  fs.mkdirSync(outDir, { recursive: true });

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bb-web-shots-'));
  const drive = freeDriveLetter();
  execSync(`subst ${drive}: "${tmp}"`);
  const root = `${drive}:\\`;
  process.env.__SHOTS_APPDATA = path.join(root, 'AppData');
  process.env.__SHOTS_DOCS = path.join(root, 'Documentos');
  process.env.__SHOTS_HOME = path.join(root, 'Usuario');
  fs.mkdirSync(process.env.__SHOTS_HOME, { recursive: true });
  fs.mkdirSync(process.env.__SHOTS_APPDATA, { recursive: true });
  fs.mkdirSync(process.env.__SHOTS_DOCS, { recursive: true });

  let app = null;
  let ai = null;
  const cleanup = () => {
    try { if (app && !app.killed) app.kill(); } catch (e) {}
    try { if (ai) ai.close(); } catch (e) {}
    try { execSync(`subst ${drive}: /d`); } catch (e) {}
    setTimeout(() => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {} }, 1500);
  };
  process.on('SIGINT', () => { cleanup(); process.exit(1); });

  try {
    const electronExe = ensureElectron(tmp, opts.electron);
    const appDir = path.join(root, 'app');
    copyApp(appDir);
    const folderPath = makeDemoFolder(root);
    ai = startFakeAi();

    app = spawn(electronExe, ['.'], { cwd: appDir, stdio: 'ignore' });
    const page = await connect();
    await page.send('Emulation.setDeviceMetricsOverride', { ...VIEWPORT, deviceScaleFactor: 1, mobile: false });
    await sleep(2500);
    await page.run(() => window.dispatchEvent(new Event('resize')));

    console.log('Creando tableros de demostración…');
    const demo = await page.run(buildDemoBoards, { folderPath, aiEndpoint: `http://127.0.0.1:${FAKE_AI_PORT}` });
    console.log('  ' + JSON.stringify(demo));

    const scenes = SCENES.list.filter(s => opts.only.length === 0 || opts.only.includes(s.id));
    for (const scene of scenes) {
      for (const theme of ['light', 'dark']) {
        await page.run((t) => { window.applyTheme(t); window.engine.render(); }, theme);
        await page.run(SCENES.reset);
        await sleep(200);
        await page.run(scene.setup, { theme, folderPath });
        await sleep(scene.wait || 600);
        const shot = await page.send('Page.captureScreenshot', { format: 'webp', quality: 88 });
        const file = path.join(outDir, `${scene.id}-${theme}.webp`);
        fs.writeFileSync(file, Buffer.from(shot.result.data, 'base64'));
        console.log(`  ${path.basename(file)}`);
        // Recorte de la zona importante (portada de la web): <id>-crop-<tema>.webp
        if (scene.crop) {
          const [x, y, width, height] = scene.crop;
          const crop = await page.send('Page.captureScreenshot', { format: 'webp', quality: 90, clip: { x, y, width, height, scale: 1 } });
          const cropFile = path.join(outDir, `${scene.id}-crop-${theme}.webp`);
          fs.writeFileSync(cropFile, Buffer.from(crop.result.data, 'base64'));
          console.log(`  ${path.basename(cropFile)}`);
        }
      }
    }

    if (opts.keepOpen) {
      console.log(`App de prueba abierta (CDP en el puerto ${CDP_PORT}). Ctrl+C para cerrarla.`);
      await new Promise(() => {});
    }
    page.ws.close();
  } finally {
    if (!opts.keepOpen) cleanup();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
