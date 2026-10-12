const fs = require('fs');
const path = require('path');

const resourcesMap = JSON.parse(fs.readFileSync('app_bundle/whiteboard/resources_map.json', 'utf8'));

// Helper para encontrar ID de recurso por nombre
function findResourceId(partialName) {
  for (const [id, info] of Object.entries(resourcesMap)) {
    if (info.name.toLowerCase().includes(partialName.toLowerCase())) {
      return { id, path: info.localPath, name: info.name };
    }
  }
  return null;
}

const items = [];

// ==========================================
// 1. SECCIÓN PRINCIPAL: DEV
// ==========================================
// Cabecera DEV
items.push({
  id: 'header_dev',
  type: 'shape',
  shape: 'rounded',
  x: -1600,
  y: -220,
  width: 3200,
  height: 60,
  text: 'DEV',
  fillColor: '#1e1e1e',
  strokeColor: '#333333',
  strokeWidth: 2
});

// Columnas bajo DEV
const devColumns = [
  { title: 'Full Stack & Guías', x: -1600, width: 420 },
  { title: 'Frontend Roadmap', x: -1140, width: 420 },
  { title: 'HTML / CSS', x: -680, width: 380 },
  { title: 'JavaScript & TS', x: -260, width: 420 },
  { title: 'SQL & Bases de Datos', x: 200, width: 360 },
  { title: 'React & Ecosistema', x: 600, width: 460 },
  { title: 'Git & Workflows', x: 1100, width: 500 }
];

devColumns.forEach((col, idx) => {
  // Fondo de columna
  items.push({
    id: `col_bg_${idx}`,
    type: 'shape',
    shape: 'rounded',
    x: col.x,
    y: -140,
    width: col.width,
    height: 820,
    text: '',
    fillColor: '#f3f4f6',
    strokeColor: '#d1d5db',
    strokeWidth: 1
  });
  // Título de columna
  items.push({
    id: `col_title_${idx}`,
    type: 'shape',
    shape: 'rectangle',
    x: col.x,
    y: -140,
    width: col.width,
    height: 45,
    text: col.title,
    fillColor: '#2d3748',
    strokeColor: '#2d3748',
    strokeWidth: 1
  });
});

// ==========================================
// 2. SECCIÓN PRINCIPAL: AI
// ==========================================
// Cabecera AI
items.push({
  id: 'header_ai',
  type: 'shape',
  shape: 'rounded',
  x: 1800,
  y: -220,
  width: 1400,
  height: 60,
  text: 'AI',
  fillColor: '#1e1e1e',
  strokeColor: '#333333',
  strokeWidth: 2
});

const aiColumns = [
  { title: 'Modelos & LLMs', x: 1800, width: 420 },
  { title: 'ComfyUI & Generación', x: 2260, width: 460 },
  { title: 'Prompts & Agentes', x: 2760, width: 440 }
];

aiColumns.forEach((col, idx) => {
  items.push({
    id: `ai_col_bg_${idx}`,
    type: 'shape',
    shape: 'rounded',
    x: col.x,
    y: -140,
    width: col.width,
    height: 820,
    text: '',
    fillColor: '#f8fafc',
    strokeColor: '#e2e8f0',
    strokeWidth: 1
  });
  items.push({
    id: `ai_col_title_${idx}`,
    type: 'shape',
    shape: 'rectangle',
    x: col.x,
    y: -140,
    width: col.width,
    height: 45,
    text: col.title,
    fillColor: '#1e293b',
    strokeColor: '#1e293b',
    strokeWidth: 1
  });
});

// ==========================================
// 3. SECCIONES INFERIORES: DISEÑO, REFERENCIAS, RECURSOS
// ==========================================
const bottomFrames = [
  { id: 'frame_design', title: 'DISEÑO / UI/UX', x: -1600, y: 740, width: 880, height: 600 },
  { id: 'frame_refs', title: 'REFERENCIAS & PORTFOLIOS', x: -680, y: 740, width: 1040, height: 600 },
  { id: 'frame_tools', title: 'HERRAMIENTAS & RECURSOS', x: 400, y: 740, width: 1200, height: 600 }
];

bottomFrames.forEach(bf => {
  items.push({
    id: bf.id,
    type: 'frame',
    x: bf.x,
    y: bf.y,
    width: bf.width,
    height: bf.height,
    title: bf.title
  });
});

// ==========================================
// 4. UBICACIÓN DE IMÁGENES EXTRAÍDAS DEL .RTB
// ==========================================

// En Git: learnGitBranching
const gitImg = findResourceId('learngitbranching');
if (gitImg) {
  items.push({
    id: 'img_git_branching',
    type: 'image',
    x: 1120,
    y: -70,
    width: 460,
    height: 260,
    src: gitImg.path
  });
  items.push({
    id: 'note_git',
    type: 'sticky_note',
    x: 1120,
    y: 210,
    width: 220,
    height: 220,
    text: 'Learn Git Branching interactivo:\n- git checkout -b\n- git rebase -i\n- git cherry-pick',
    color: '#fff9b0'
  });
}

// En JavaScript: anime.js y lightweight-charts
const animeImg = findResourceId('anime-js');
if (animeImg) {
  items.push({
    id: 'img_animejs',
    type: 'image',
    x: -240,
    y: -70,
    width: 380,
    height: 210,
    src: animeImg.path
  });
}
const chartsImg = findResourceId('lightweight-charts');
if (chartsImg) {
  items.push({
    id: 'img_charts',
    type: 'image',
    x: -240,
    y: 160,
    width: 380,
    height: 210,
    src: chartsImg.path
  });
}

// En Diseño: DaVinci Resolve y Untitled UI
const davinciImg = findResourceId('davinciresolve');
if (davinciImg) {
  items.push({
    id: 'img_davinci',
    type: 'image',
    x: -1560,
    y: 800,
    width: 380,
    height: 220,
    src: davinciImg.path
  });
}
const untitledUi = findResourceId('untitled-ui');
if (untitledUi) {
  items.push({
    id: 'img_untitledui',
    type: 'image',
    x: -1140,
    y: 800,
    width: 400,
    height: 240,
    src: untitledUi.path
  });
}

// En Referencias: Awwwards y Portfolios
const awwwardsImg = findResourceId('awwwards');
if (awwwardsImg) {
  items.push({
    id: 'img_awwwards',
    type: 'image',
    x: -640,
    y: 800,
    width: 440,
    height: 240,
    src: awwwardsImg.path
  });
}
const portfoliosImg = findResourceId('developer-portfolios');
if (portfoliosImg) {
  items.push({
    id: 'img_portfolios',
    type: 'image',
    x: -160,
    y: 800,
    width: 460,
    height: 240,
    src: portfoliosImg.path
  });
}

// En AI: ComfyUI y Prompts
const comfyImg = findResourceId('comfyui');
if (comfyImg) {
  items.push({
    id: 'img_comfyui',
    type: 'image',
    x: 2280,
    y: -70,
    width: 420,
    height: 230,
    src: comfyImg.path
  });
}
const promptsImg = findResourceId('system-prompts');
if (promptsImg) {
  items.push({
    id: 'img_prompts',
    type: 'image',
    x: 2780,
    y: -70,
    width: 400,
    height: 230,
    src: promptsImg.path
  });
}
const modelDbImg = findResourceId('openmodeldb');
if (modelDbImg) {
  items.push({
    id: 'img_modeldb',
    type: 'image',
    x: 1820,
    y: -70,
    width: 380,
    height: 220,
    src: modelDbImg.path
  });
}

// Capturas de pantalla reales encontradas
const screenshots = Object.values(resourcesMap).filter(r => r.name.toLowerCase().includes('captura de pantalla'));
screenshots.forEach((shot, idx) => {
  if (idx === 0) {
    items.push({
      id: 'shot_0',
      type: 'image',
      x: -660,
      y: -70,
      width: 340,
      height: 220,
      src: shot.localPath
    });
  } else if (idx === 1) {
    items.push({
      id: 'shot_1',
      type: 'image',
      x: 620,
      y: -70,
      width: 420,
      height: 250,
      src: shot.localPath
    });
  } else if (idx === 2) {
    items.push({
      id: 'shot_2',
      type: 'image',
      x: 440,
      y: 800,
      width: 460,
      height: 260,
      src: shot.localPath
    });
  }
});

// Guardar archivo DEV_AI.json
const boardData = {
  name: 'DEV / AI',
  updatedAt: new Date().toISOString(),
  items
};

fs.writeFileSync('boards/DEV_AI.json', JSON.stringify(boardData, null, 2));
console.log('Tablero DEV / AI generado exitosamente con', items.length, 'elementos y recursos locales.');
