// Genera el tablero Ejemplo (app_bundle/boards/ejemplo.json), que va dentro del instalador.
// Es una guía de todas las funciones con elementos de verdad para probar: tarjetas de enlace con estrellas,
// la carpeta del Escritorio (%DESKTOP%, la app la cambia por el Escritorio de cada equipo), notas para alinear,
// huecos de la plantilla Galería y notas de distintas edades para el Mapa de Frescura (ageDays: la app pone
// la fecha al cargar la plantilla). Estilo de BoardInstructorAI.md: grises azulados, marcos con título y sin flechas.
//
// Uso: node scripts/create_curated_ejemplo_board.js
// Al cambiarlo, subir SEED_VERSION. Con 20 o más, las instalaciones que tenían un Ejemplo anterior lo renuevan
// (GUIDE_BOARD_RESET_VERSION en board_app.js) y la versión anterior va a la papelera.
const fs = require('fs');
const path = require('path');

const SEED_VERSION = 20;

const C = {
  frame: '#12161f',
  frameStroke: '#232b3d',
  card: '#161b26',
  cardStroke: '#262e40',
  play: '#1e2533',
  title: '#f8fafc',
  text: '#f1f5f9',
  soft: '#cbd5e1',
  muted: '#94a3b8',
  faint: '#64748b'
};

const items = [];
let z = 0;
const add = (it) => { items.push({ zIndex: ++z, ...it }); return it; };

function frame(id, title, x, y, width, height) {
  return add({ id, type: 'frame', title, x, y, width, height, fillColor: C.frame, strokeColor: C.frameStroke, zIndex: 0 });
}

function header(f, text) {
  return add({
    id: `${f.id}_header`, type: 'text', parentId: f.id,
    x: f.x + 40, y: f.y + 40, width: f.width - 80, height: 58,
    text, fontSize: 22, isBold: true, color: C.text, fillColor: C.card, strokeColor: C.cardStroke, textAlign: 'left'
  });
}

function note(f, id, x, y, width, height, text, opts = {}) {
  return add({
    id, type: 'text', parentId: f.id, x: f.x + x, y: f.y + y, width, height, text,
    fontSize: 16, color: C.text, fillColor: C.card, strokeColor: C.cardStroke, textAlign: 'left', ...opts
  });
}

function image(f, id, src, x, y, width, height) {
  return add({ id, type: 'image', parentId: f.id, src, x: f.x + x, y: f.y + y, width, height });
}

function card(f, id, x, y, { url, domain, title, description, rating }) {
  const it = { id, type: 'embed', parentId: f.id, x: f.x + x, y: f.y + y, width: 350, height: 150, url, domain, title, description, src: '' };
  if (rating) it.rating = rating;
  return add(it);
}

// =========================================================
// CABECERA
// =========================================================
const hero = frame('frame_hero', '✨ BIENVENIDO A BRAIN BOARD', -1650, -860, 3300, 360);
add({ id: 'hero_logo', type: 'image', parentId: hero.id, src: 'brainboard_logo_hero.png', x: -1600, y: -810, width: 250, height: 210 });
add({
  id: 'hero_title', type: 'text', parentId: hero.id, x: -1300, y: -815, width: 2200, height: 60,
  text: 'Bienvenido a Brain Board', fontSize: 40, isBold: true, color: C.title, textAlign: 'left'
});
add({
  id: 'hero_subtitle', type: 'text', parentId: hero.id, x: -1300, y: -748, width: 2800, height: 34,
  text: 'Tu pizarra infinita para guardar referencias, apuntes y enlaces, y volver a encontrarlos. Este tablero es una guía: toca, mueve y prueba todo lo que quieras.',
  fontSize: 17, color: C.muted, textAlign: 'left'
});
[
  '🧠  Cerebro IA\nPregunta a tus tableros · Ctrl+K',
  '🔗  Enlaces con estrellas\nPega una URL y puntúala',
  '📁  Carpetas del PC\nÁbrelas desde la pizarra',
  '🕰️  Mapa de Frescura\nQué está al día y qué no',
  '🔍  Buscar en todo\nCtrl+Shift+F en todos los tableros',
  '🛟  Tu trabajo, a salvo\nCopias diarias y papelera'
].forEach((text, i) => {
  add({
    id: `hero_pill_${i + 1}`, type: 'text', parentId: hero.id,
    x: -1300 + i * 485, y: -690, width: 455, height: 96,
    text, fontSize: 16, color: C.soft, fillColor: C.card, strokeColor: C.cardStroke, textAlign: 'left'
  });
});
add({
  id: 'hero_hint', type: 'text', parentId: hero.id, x: -1300, y: -570, width: 2880, height: 34,
  text: 'Muévete con la rueda del ratón (zoom) y arrastrando con la mano (H) o con la barra espaciadora pulsada. Doble clic en un texto para editarlo.',
  fontSize: 15, color: C.faint, textAlign: 'left'
});

// =========================================================
// 1 · CEREBRO IA
// =========================================================
const brain = frame('frame_cerebro', '🧠 1 · CEREBRO IA', -1650, -440, 1620, 820);
header(brain, 'Pregunta a tus tableros');
image(brain, 'cerebro_img', 'ejemplo_cerebro.webp', 40, 124, 760, 475);
note(brain, 'cerebro_note', 830, 124, 750, 475,
  '• Ábrelo con el botón Brain de abajo o con Ctrl+K.\n\n' +
  '• Conoce todo lo que guardas: qué es, en qué tablero está y cuándo lo pusiste.\n\n' +
  '• Acciones rápidas: ✍️ Apunte · 🔗 Añadir recurso · 📋 Briefing · 🕰️ Revisar apuntes obsoletos.\n\n' +
  '• Nada cambia sin tu permiso: te enseña una propuesta, tú pulsas Insertar y luego puedes Deshacer.\n\n' +
  '• Selecciona algo del tablero y pulsa ✨ en su barra para preguntar solo sobre eso.');
note(brain, 'cerebro_ia', 40, 630, 1540, 150,
  '⚙️ Qué IA usa (engranaje del chat): Ollama funciona en tu PC sin enviar nada. Claude Code o Gemini CLI usan tu cuenta. ' +
  'Con una clave de API (Claude, Gemini u OpenAI), las preguntas van a ese proveedor. Sin configurar nada, usa un servicio gratuito de terceros.\n' +
  'Gemini gratis: aistudio.google.com → Create API key → pégala en el engranaje.',
  { fontSize: 15, color: C.soft });

// =========================================================
// 2 · ENLACES Y CARPETAS
// =========================================================
const links = frame('frame_enlaces', '🔗 2 · ENLACES Y CARPETAS', 30, -440, 1620, 820);
header(links, 'Pega un enlace o una carpeta y listo');
card(links, 'enlace_github', 40, 124, {
  url: 'https://github.com/PabloLivian/BrainBoard', domain: 'GITHUB.COM', title: 'PabloLivian/BrainBoard',
  description: 'Código y versiones de Brain Board.', rating: 5
});
card(links, 'enlace_docs', 420, 124, {
  url: 'https://brain-board-web-two.vercel.app/documentacion', domain: 'BRAIN-BOARD-WEB-TWO.VERCEL.APP', title: 'Documentación de Brain Board',
  description: 'Todas las funciones explicadas con capturas.', rating: 4
});
card(links, 'enlace_polyhaven', 800, 124, {
  url: 'https://polyhaven.com', domain: 'POLYHAVEN.COM', title: 'Poly Haven',
  description: 'HDRIs y texturas gratis. Pruébalo: pasa el ratón y ponle estrellas.'
});
add({
  id: 'carpeta_escritorio', type: 'folder', parentId: links.id, path: '%DESKTOP%', title: 'Escritorio',
  isFile: false, expanded: false, x: links.x + 1190, y: links.y + 124, width: 350, height: 122
});
add({
  id: 'carpeta_hint', type: 'text', parentId: links.id, x: links.x + 1190, y: links.y + 262, width: 350, height: 60,
  text: '👆 Es tu Escritorio. Pulsa «Ver contenido» para desplegarlo.', fontSize: 14, color: C.muted, textAlign: 'left'
});
note(links, 'enlaces_note', 40, 304, 1110, 220,
  '🔗 Enlaces\n' +
  '• Pega una URL (Ctrl+V) y se convierte en tarjeta con título, descripción y miniatura.\n' +
  '• Pasa el ratón por una tarjeta y ponle de 1 a 5 estrellas; pulsa la misma estrella para quitarla.\n' +
  '• Si pegas un enlace que ya tenías en cualquier tablero, te avisa con un botón «Ver».\n' +
  '• Ábrelo con el botón ↗ de la tarjeta, con doble clic o con Ctrl + clic.');
note(links, 'carpetas_note', 40, 554, 1110, 220,
  '📁 Carpetas y archivos del PC\n' +
  '• Pega una ruta, copia una carpeta en el Explorador (Ctrl+C) y pégala, o arrástrala al tablero.\n' +
  '• La tarjeta lee el disco cada vez que la miras: siempre está al día.\n' +
  '• Doble clic en una fila abre ese archivo; en la cabecera, abre la carpeta.\n' +
  '• Si la ruta no existe en este PC (un disco desconectado), la tarjeta sale en rojo.');

// =========================================================
// 3 · MAPA DE FRESCURA
// =========================================================
const fresh = frame('frame_frescura', '🕰️ 3 · MAPA DE FRESCURA', -1650, 440, 1620, 780);
header(fresh, '¿Qué sigue al día y qué conviene revisar?');
[
  { age: 0, text: '🟢 Colocado hoy\nReciente: hasta 7 días' },
  { age: 20, text: '🔵 Hace 20 días\nActual: hasta 30 días' },
  { age: 100, text: '🟠 Hace unos 3 meses\nIntermedio: hasta 6 meses' },
  { age: 400, text: '🔴 Hace más de un año\nAntiguo: más de 6 meses' }
].forEach((s, i) => {
  note(fresh, `frescura_muestra_${i + 1}`, 40 + i * 393, 124, 360, 100, s.text, { fontSize: 16, ageDays: s.age });
});
image(fresh, 'frescura_img', 'ejemplo_frescura.webp', 40, 264, 760, 475);
note(fresh, 'frescura_note', 830, 264, 750, 475,
  '• Cada cosa guarda cuándo la colocaste. Deja el ratón quieto 2 segundos encima para verlo.\n\n' +
  '• Pulsa el reloj 🕒 de la barra de arriba: todo se colorea según su antigüedad. Pruébalo con las 4 notas de arriba.\n\n' +
  '• Si algo antiguo sigue valiendo, selecciónalo y pulsa «Marcar como revisado»: vuelve a contar como reciente.\n\n' +
  '• El engranaje de la barra del mapa cambia los días de cada color.\n\n' +
  '• En el Cerebro, «Revisar apuntes obsoletos» te propone ponerlos al día.');

// =========================================================
// 4 · BUSCAR Y NAVEGAR
// =========================================================
const search = frame('frame_buscar', '🔍 4 · BUSCAR Y NAVEGAR', 30, 440, 1620, 780);
header(search, 'Encuéntralo todo, en cualquier tablero');
image(search, 'buscar_img', 'ejemplo_busqueda.webp', 40, 124, 760, 475);
note(search, 'buscar_note', 830, 124, 750, 475,
  '• Ctrl+F busca en el tablero abierto.\n\n' +
  '• Ctrl+Shift+F busca en todos tus tableros a la vez (también el botón «En todos» de la barra de búsqueda, o Enter en el buscador de Inicio).\n\n' +
  '• No distingue mayúsculas ni tildes, acepta las palabras en cualquier orden y busca también en las descripciones de las tarjetas.\n\n' +
  '• El botón de lista de la barra de arriba abre el índice de secciones: salta a cualquier marco del tablero.');
note(search, 'buscar_pestanas', 40, 630, 745, 110,
  '📑 Pestañas: abre varios tableros a la vez y cambia entre ellos, como en el navegador.', { fontSize: 15, color: C.soft });
note(search, 'buscar_inicio', 835, 630, 745, 110,
  '🏠 Inicio: tus tableros por categorías, con su miniatura y la última vez que los abriste.', { fontSize: 15, color: C.soft });

// =========================================================
// 5 · ORDENAR EL LIENZO
// =========================================================
const canvas = frame('frame_lienzo', '✏️ 5 · ORDENAR EL LIENZO', -1650, 1280, 1620, 570);
header(canvas, 'Plantillas, alinear, capas y duplicar');
[
  { x: 40, y: 124, text: '1. Arrastra un recuadro alrededor de estas tres notas…' },
  { x: 375, y: 168, text: '2. …pulsa el botón Alinear de su barra de propiedades…' },
  { x: 710, y: 140, text: '3. …y prueba «Arriba» o «Distribuir».' }
].forEach((n, i) => {
  note(canvas, `lienzo_alinear_${i + 1}`, n.x, n.y, 300, 120, n.text, { fillColor: C.play, fontSize: 15, color: C.soft });
});
[40, 375, 710].forEach((x, i) => {
  add({
    id: `lienzo_hueco_${i + 1}`, type: 'shape', shape: 'rectangle', parentId: canvas.id,
    x: canvas.x + x, y: canvas.y + 330, width: 300, height: 190,
    text: 'Pega o arrastra una imagen aquí', fontSize: 14, isBold: false,
    fillColor: C.card, strokeColor: '#334155', strokeWidth: 1.5, color: C.muted, textColor: C.muted,
    isImagePlaceholder: true
  });
});
note(canvas, 'lienzo_note', 1050, 124, 530, 396,
  '• Plantillas (botón de la barra izquierda): Apuntes, Recurso + apunte, Galería y Comparativa. Los huecos de la izquierda son de la Galería: pega una imagen encima.\n' +
  '• Alinear y distribuir: con 2 o más elementos seleccionados.\n' +
  '• Capas: ] trae adelante y [ envía atrás (con Shift, al frente o al fondo).\n' +
  '• Duplicar: arrastra con Alt pulsado o Ctrl+D.\n' +
  '• Pega recortes de Windows (Win+Shift+S) tal cual.\n' +
  '• Todo se deshace con Ctrl+Z.',
  { fontSize: 15 });

// =========================================================
// 6 · TU TRABAJO A SALVO
// =========================================================
const safe = frame('frame_copias', '🛟 6 · TU TRABAJO A SALVO', 30, 1280, 1620, 570);
header(safe, 'Guardado automático, copias diarias y papelera');
image(safe, 'copias_img', 'ejemplo_copias.webp', 40, 124, 640, 400);
note(safe, 'copias_note', 710, 124, 870, 400,
  '• Cada cambio se guarda solo, al momento.\n' +
  '• Una vez al día se copia todo en Documentos\\BrainBoard\\Copias automáticas (se guardan las 10 últimas). Se restauran desde Inicio → Copias automáticas.\n' +
  '• Borrar un tablero lo manda a la Papelera durante 30 días (Inicio → Papelera).\n' +
  '• Copia de seguridad (.rtb) en Inicio: todos los tableros con sus imágenes en un solo paquete.\n' +
  '• Menú ⋮ del tablero: exportarlo (.rtb) o guardarlo como imagen PNG / JPG.\n' +
  '• Tus tableros viven en tu ordenador: no hace falta cuenta.',
  { fontSize: 15 });

// =========================================================
// 7 · ATAJOS DE TECLADO
// =========================================================
const keys = frame('frame_atajos', '⌨️ 7 · ATAJOS DE TECLADO', -1650, 1910, 3300, 320);
header(keys, 'Atajos de teclado');
[
  '🛠️ Herramientas\nV seleccionar · H mano · N nota · S forma\nT texto · L conector · P lápiz · F marco · C comentario',
  '✂️ Editar\nCtrl+C / Ctrl+X / Ctrl+V · Ctrl+A seleccionar todo\nCtrl+D o Alt + arrastrar duplicar\nCtrl+Z deshacer · Ctrl+Y rehacer',
  '🔍 Buscar y Cerebro\nCtrl+F buscar en el tablero\nCtrl+Shift+F buscar en todos\nCtrl+K abrir el Cerebro',
  '🗂️ Capas y vista\n] adelante · [ atrás (con Shift: al frente / al fondo)\nEspacio + arrastrar para moverte\nRueda del ratón para el zoom'
].forEach((text, i) => {
  note(keys, `atajos_${i + 1}`, 40 + i * 810, 124, 780, 156, text, { fontSize: 15, color: C.soft });
});

// =========================================================
const board = {
  id: 'ejemplo',
  name: 'Ejemplo',
  title: 'Ejemplo',
  category: 'General',
  icon: '✨',
  thumbnail: null,
  updatedAt: new Date().toISOString(),
  seedVersion: SEED_VERSION,
  userModified: false,
  items
};

// Comprobaciones: nada fuera de su marco ni coordenadas inválidas
const frames = new Map(items.filter(i => i.type === 'frame').map(f => [f.id, f]));
items.forEach(it => {
  ['x', 'y', 'width', 'height'].forEach(k => {
    if (!Number.isFinite(it[k])) throw new Error(`${it.id}: ${k} no es un número`);
  });
  const f = it.parentId && frames.get(it.parentId);
  if (f && (it.x < f.x || it.y < f.y || it.x + it.width > f.x + f.width || it.y + it.height > f.y + f.height)) {
    throw new Error(`${it.id} se sale de su marco ${f.id}`);
  }
});

const dest = path.resolve(__dirname, '../app_bundle/boards/ejemplo.json');
fs.writeFileSync(dest, JSON.stringify(board, null, 2), 'utf8');
console.log(`Ejemplo guardado en ${dest}: ${items.length} elementos, seedVersion ${SEED_VERSION}`);
