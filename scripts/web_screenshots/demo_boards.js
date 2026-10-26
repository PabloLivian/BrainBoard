// Tableros de demostración para las capturas de la web. Todo es inventado: textos, fechas e imágenes
// (las imágenes se dibujan aquí mismo con canvas, sin fotos de nadie).
// buildDemoBoards se ejecuta DENTRO de la página de la app (se serializa con toString): no puede usar
// nada de fuera de la función.

async function buildDemoBoards({ folderPath, aiEndpoint }) {
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const DAY = 864e5;
  const now = Date.now();
  const ago = (days) => new Date(now - days * DAY).toISOString();
  let seq = 0;
  const uid = (p) => `${p}_demo_${++seq}`;

  // Ocultar novedades y el modal de bienvenida de esta versión
  document.getElementById('btn-confirm-whats-new')?.click();
  document.getElementById('whats-new-modal') && (document.getElementById('whats-new-modal').style.display = 'none');

  // ---------- Imágenes dibujadas ----------
  const paint = (w, h, draw) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    return c.toDataURL('image/jpeg', 0.88);
  };
  const lin = (g, x0, y0, x1, y1, stops) => {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(([o, c]) => gr.addColorStop(o, c));
    return gr;
  };
  // "Render" de una esfera sobre un suelo
  const sphere = (bgTop, bgBottom, base, light) => paint(640, 400, (g, w, h) => {
    g.fillStyle = lin(g, 0, 0, 0, h, [[0, bgTop], [1, bgBottom]]);
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(0, h * 0.68, w, h * 0.32);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.beginPath(); g.ellipse(w * 0.52, h * 0.8, 120, 22, 0, 0, Math.PI * 2); g.fill();
    const r = g.createRadialGradient(w * 0.44, h * 0.38, 12, w * 0.5, h * 0.5, 130);
    r.addColorStop(0, light); r.addColorStop(0.45, base); r.addColorStop(1, 'rgba(0,0,0,0.85)');
    g.fillStyle = r;
    g.beginPath(); g.arc(w * 0.5, h * 0.5, 120, 0, Math.PI * 2); g.fill();
  });
  // Paisaje de acantilado con faro
  const lighthouse = (sky1, sky2, sea, beam) => paint(640, 400, (g, w, h) => {
    g.fillStyle = lin(g, 0, 0, 0, h * 0.7, [[0, sky1], [1, sky2]]);
    g.fillRect(0, 0, w, h);
    g.fillStyle = sea;
    g.fillRect(0, h * 0.68, w, h * 0.32);
    g.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 9; i++) g.fillRect(40 + i * 70, h * 0.72 + (i % 3) * 18, 40, 2);
    g.fillStyle = '#10151c';
    g.beginPath();
    g.moveTo(w * 0.45, h); g.lineTo(w * 0.52, h * 0.62); g.lineTo(w * 0.7, h * 0.58); g.lineTo(w * 0.86, h * 0.66); g.lineTo(w, h * 0.64); g.lineTo(w, h);
    g.fill();
    g.fillStyle = '#e8e2d6';
    g.fillRect(w * 0.66, h * 0.3, 22, h * 0.29);
    g.fillStyle = '#b3402f';
    g.fillRect(w * 0.66, h * 0.38, 22, 14); g.fillRect(w * 0.66, h * 0.48, 22, 14);
    g.fillStyle = '#1b2029';
    g.fillRect(w * 0.655, h * 0.26, 28, 16);
    g.fillStyle = beam;
    g.beginPath(); g.moveTo(w * 0.68, h * 0.28); g.lineTo(0, h * 0.12); g.lineTo(0, h * 0.3); g.closePath(); g.fill();
  });
  // Miniatura de vídeo con título grande (proporción de la franja de imagen de las tarjetas, ~2,4:1;
  // el texto empieza bajo la insignia de la esquina superior izquierda)
  const thumb = (title, sub, c1, c2, accent) => paint(640, 264, (g, w, h) => {
    g.fillStyle = lin(g, 0, 0, w, h, [[0, c1], [1, c2]]);
    g.fillRect(0, 0, w, h);
    g.fillStyle = accent;
    g.globalAlpha = 0.25;
    g.beginPath(); g.arc(w * 0.84, h * 0.62, 110, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;
    g.fillStyle = accent;
    g.font = '700 20px "Segoe UI", sans-serif';
    g.fillText(sub, 44, 106);
    g.fillStyle = '#ffffff';
    g.font = '800 42px "Segoe UI", sans-serif';
    title.split('\n').forEach((line, i) => g.fillText(line, 42, 156 + i * 48));
  });

  const img = {
    luz: thumb('LUZ DE\nTRES PUNTOS', 'ILUMINACIÓN · CURSO', '#1a2133', '#3a2a1a', '#f59e0b'),
    karma: thumb('KARMA XPU\nEN 10 MIN', 'HOUDINI 21 · RENDER', '#101a2b', '#1f3b57', '#38bdf8'),
    hdri: thumb('HDRI DE\nEXTERIORES', 'LOOKDEV · TUTORIAL', '#16261d', '#3b4a2a', '#a3e635'),
    pyro: thumb('PYRO PASO\nA PASO', 'HOUDINI · FX', '#2a1410', '#4a1d0f', '#fb923c'),
    comfy: thumb('COMFYUI\nPARA 3D', 'IA · TEXTURAS', '#1d1630', '#33204a', '#c084fc'),
    s1: sphere('#26303d', '#0d1117', '#3b82f6', '#dbeafe'),
    s2: sphere('#3d2a26', '#120c0b', '#d97706', '#fde68a'),
    s3: sphere('#e5e7eb', '#9ca3af', '#64748b', '#ffffff'),
    f1: lighthouse('#0b1324', '#33465e', '#0d1b2a', 'rgba(255,236,170,0.18)'),
    f2: lighthouse('#f6b26b', '#fde7c7', '#3d5a73', 'rgba(255,255,255,0.12)'),
    f3: lighthouse('#3b2f4a', '#9a6c7a', '#20263a', 'rgba(255,220,160,0.16)')
  };

  // ---------- Piezas de tablero ----------
  const frame = (title, x, y, width, height, days) => ({ id: uid('frame'), type: 'frame', title, x, y, width, height, zIndex: 1, createdAt: ago(days), updatedAt: ago(days) });
  const header = (f, text, days) => ({ id: uid('text'), type: 'text', text, x: f.x + 30, y: f.y + 24, width: f.width - 60, height: 54, fontSize: 22, color: '#ffffff', fillColor: '#2d2d2d', isBold: true, textAlign: 'left', parentId: f.id, zIndex: 2, createdAt: ago(days), updatedAt: ago(days) });
  const note = (f, text, x, y, width, height, days) => ({ id: uid('text'), type: 'text', text, x, y, width, height, fontSize: 16, color: '#1f2937', fillColor: '#ffffff', textAlign: 'left', parentId: f ? f.id : null, zIndex: 3, createdAt: ago(days), updatedAt: ago(days) });
  const card = (f, { url, domain, title, description = '', src = '', rating = 0 }, x, y, width, height, days) => {
    const it = { id: uid('embed'), type: 'embed', url, domain, title, description, src, x, y, width, height, parentId: f ? f.id : null, zIndex: 3, createdAt: ago(days), updatedAt: ago(days) };
    if (rating) it.rating = rating;
    return it;
  };
  const picture = (f, src, x, y, width, height, days) => ({ id: uid('image'), type: 'image', src, x, y, width, height, parentId: f ? f.id : null, zIndex: 3, createdAt: ago(days), updatedAt: ago(days) });
  const sticky = (text, x, y, color, days, width = 220, height = 220) => ({ id: uid('note'), type: 'sticky_note', text, x, y, width, height, color, fontSize: 22, zIndex: 4, createdAt: ago(days), updatedAt: ago(days) });

  // ---------- Tableros ----------
  const boards = [];

  // Referencias 3D: tarjetas de enlace con estrellas, fechas variadas para el Mapa de Frescura
  {
    const items = [];
    const fA = frame('Iluminación y render', 0, 0, 1120, 400, 140);
    items.push(fA, header(fA, 'ILUMINACIÓN Y RENDER', 140),
      card(fA, { url: 'https://www.youtube.com/watch?v=demo-luz-3p', domain: 'YOUTUBE.COM', title: 'Luz de tres puntos explicada', description: 'Key, fill y rim con ejemplos en Blender y Houdini.', src: img.luz, rating: 5 }, 30, 104, 330, 260, 3),
      card(fA, { url: 'https://www.youtube.com/watch?v=demo-karma', domain: 'YOUTUBE.COM', title: 'Karma XPU en 10 minutos', description: 'Ajustes básicos de muestreo y denoise para previsualizar rápido.', src: img.karma, rating: 4 }, 395, 104, 330, 260, 24),
      card(fA, { url: 'https://www.youtube.com/watch?v=demo-hdri', domain: 'YOUTUBE.COM', title: 'HDRI de exteriores para lookdev', description: 'Cómo calibrar la exposición del HDRI y el sol.', src: img.hdri }, 760, 104, 330, 260, 130));
    const fB = frame('Herramientas', 1240, 0, 720, 400, 400);
    items.push(fB, header(fB, 'HERRAMIENTAS', 400),
      card(fB, { url: 'https://github.com/blender/blender', domain: 'GITHUB.COM', title: 'blender/blender', description: 'Código fuente de Blender: modelado, animación y render.', rating: 5 }, 1270, 104, 310, 120, 420),
      card(fB, { url: 'https://github.com/PixarAnimationStudios/OpenUSD', domain: 'GITHUB.COM', title: 'PixarAnimationStudios/OpenUSD', description: 'Formato USD para intercambiar escenas entre programas.', rating: 4 }, 1620, 104, 310, 120, 70),
      card(fB, { url: 'https://github.com/AcademySoftwareFoundation/openvdb', domain: 'GITHUB.COM', title: 'AcademySoftwareFoundation/openvdb', description: 'Volúmenes dispersos para humo, nubes y fluidos.', rating: 3 }, 1270, 250, 310, 120, 230),
      card(fB, { url: 'https://polyhaven.com', domain: 'POLYHAVEN.COM', title: 'Poly Haven', description: 'HDRIs, texturas y modelos gratuitos (CC0).', rating: 5 }, 1620, 250, 310, 120, 1));
    const fC = frame('Moodboard: Faro', 0, 500, 1120, 470, 12);
    items.push(fC, header(fC, 'MOODBOARD · CORTOMETRAJE FARO', 12),
      picture(fC, img.f1, 30, 604, 330, 206, 12), picture(fC, img.f2, 395, 604, 330, 206, 12), picture(fC, img.f3, 760, 604, 330, 206, 9),
      note(fC, '• Paleta fría de noche con el haz del faro como única luz cálida.\n• Probar niebla volumétrica baja sobre el mar.', 30, 836, 1060, 104, 9));
    items.push(
      sticky('Probar Karma con el HDRI del acantilado', 1240, 500, '#fff9b1', 2),
      sticky('Revisar licencias de las texturas antes de entregar', 1490, 500, '#d1f2ff', 45),
      sticky('Pedir feedback del moodboard', 1740, 500, '#d5f692', 0));
    boards.push({ title: 'Referencias 3D', category: 'Creative', icon: '🧊', items });
  }

  // Houdini: apuntes antiguos (salen en rojo en el Mapa de Frescura)
  {
    const items = [];
    const fA = frame('VEX básico', 0, 0, 820, 420, 380);
    items.push(fA, header(fA, 'VEX BÁSICO', 380),
      card(fA, { url: 'https://www.sidefx.com/docs/houdini/vex/index.html', domain: 'SIDEFX.COM', title: 'Referencia de VEX', description: 'Funciones, tipos y contextos de VEX en la documentación oficial.', rating: 4 }, 30, 104, 330, 135, 380),
      note(fA, '• @P, @N y @Cd: posición, normal y color de cada punto.\n• Wrangle por puntos para ruido y máscaras.\n• chf() y chramp() para sacar parámetros a la interfaz.', 390, 104, 400, 260, 380));
    const fB = frame('Pyro', 940, 0, 820, 420, 200);
    items.push(fB, header(fB, 'PYRO', 200),
      card(fB, { url: 'https://www.youtube.com/watch?v=demo-pyro', domain: 'YOUTUBE.COM', title: 'Pyro paso a paso', description: 'Fuego y humo con el Pyro Solver sparse.', src: img.pyro, rating: 5 }, 970, 104, 330, 260, 200),
      note(fB, '• Fuente con Pyro Source a partir de una malla.\n• Resolución baja para el blocking y subir al final.\n• Cachear a VDB antes de iluminar.', 1330, 104, 400, 260, 15));
    boards.push({ title: 'Houdini', category: 'Creative', icon: '🌀', items });
  }

  // IA generativa
  {
    const items = [];
    const fA = frame('Texturas con IA', 0, 0, 820, 420, 6);
    items.push(fA, header(fA, 'TEXTURAS CON IA', 6),
      card(fA, { url: 'https://github.com/comfyanonymous/ComfyUI', domain: 'GITHUB.COM', title: 'comfyanonymous/ComfyUI', description: 'Interfaz de nodos para modelos de difusión.', src: img.comfy, rating: 4 }, 30, 104, 330, 260, 6),
      note(fA, '• Generar variaciones de albedo desde una foto de referencia.\n• Sacar normal y roughness con nodos de mapas.\n• Revisar siempre la licencia del modelo.', 390, 104, 400, 260, 6));
    boards.push({ title: 'IA generativa', category: 'Creative', icon: '🤖', items });
  }

  // Cortometraje Faro: tarjetas de carpeta del equipo
  {
    const items = [];
    const fA = frame('Producción', 0, 0, 1180, 620, 20);
    items.push(fA, header(fA, 'CORTOMETRAJE FARO · PRODUCCIÓN', 20));
    items.push({ id: uid('folder'), type: 'folder', path: folderPath, title: 'Cortometraje Faro', isFile: false, expanded: true, x: 30, y: 104, width: 360, height: 300, zIndex: 5, createdAt: ago(20), updatedAt: ago(20) });
    items.push({ id: uid('folder'), type: 'folder', path: folderPath + '\\faro_layout_v12.blend', title: 'faro_layout_v12.blend', isFile: true, expanded: false, x: 420, y: 104, width: 360, height: 92, zIndex: 5, createdAt: ago(4), updatedAt: ago(4) });
    items.push(picture(fA, img.f1, 420, 224, 330, 206, 18), picture(fA, img.f3, 790, 224, 330, 206, 18));
    items.push(sticky('Render de la secuencia 1 el viernes', 810, 104, '#fff9b1', 1, 310, 92));
    boards.push({ title: 'Cortometraje Faro', category: 'Proyectos', icon: '🎬', items });
  }

  // Viaje a Islandia
  {
    const items = [];
    items.push(sticky('Billetes y coche de alquiler', 0, 0, '#fff9b1', 30), sticky('Faros de la costa sur para fotografiar', 250, 0, '#d1f2ff', 30), picture(null, img.f2, 0, 260, 470, 294, 30));
    boards.push({ title: 'Viaje a Islandia', category: 'Personal', icon: '✈️', items });
  }

  // Tablero que acabará en la papelera
  boards.push({ title: 'Pruebas antiguas', category: 'Random', icon: '🗂️', items: [sticky('Prueba de render descartada', 0, 0, '#ffd6e0', 300)] });

  // ---------- Crear los tableros en la app ----------
  ['Creative', 'Proyectos', 'Personal', 'Random'].forEach(cat => {
    if (!window.workspaceCategories.includes(cat)) window.workspaceCategories.push(cat);
  });
  localStorage.setItem('brainboard_categories', JSON.stringify(window.workspaceCategories));

  const created = [];
  for (const b of boards) {
    const nb = await window.createNewBoard(b.title);
    const entry = window.workspaceBoards.find(x => x.id === nb.id);
    entry.category = b.category;
    entry.icon = b.icon;
    window.engine.items = b.items;
    window.engine.fitView();
    await window.autoSaveBoardImmediately(nb.id);
    created.push({ id: nb.id, title: b.title });
    await wait(150);
  }
  // Últimas aperturas escalonadas para que el Inicio no diga "Hoy" en todos
  const openedHoursAgo = { 'Referencias 3D': 0.2, 'Cortometraje Faro': 3, 'Houdini': 26, 'IA generativa': 50, 'Viaje a Islandia': 140, 'Pruebas antiguas': 900, 'Ejemplo': 200 };
  window.workspaceBoards.forEach(b => {
    const h = openedHoursAgo[b.title];
    if (h === undefined) return;
    b.lastOpenedAt = now - h * 36e5;
    b.lastOpened = window.formatLastOpened(b.lastOpenedAt);
  });
  localStorage.setItem('brainboard_workspace_boards', JSON.stringify(window.workspaceBoards));

  // Cerebro IA: proveedor Ollama apuntando a la IA falsa
  document.getElementById('btn-brain-ai-settings')?.click();
  await wait(300);
  const sel = document.getElementById('brain-ai-provider-select');
  if (sel) { sel.value = 'ollama'; sel.dispatchEvent(new Event('change', { bubbles: true })); }
  await wait(200);
  const key = document.getElementById('brain-ai-apikey-input');
  if (key) { key.value = aiEndpoint; key.dispatchEvent(new Event('input', { bubbles: true })); }
  document.getElementById('btn-save-brain-ai-settings')?.click();
  await wait(300);

  // Una conversación con el Cerebro que acaba en una propuesta para el tablero
  await window.switchBoard(created.find(c => c.title === 'Referencias 3D').id);
  document.getElementById('brain-ai-dock-trigger')?.click();
  await wait(400);
  const input = document.getElementById('brain-ai-input');
  input.value = 'Prepárame un apunte sobre Karma XPU para mi tablero de Referencias 3D';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  document.getElementById('btn-brain-ai-send')?.click();
  for (let i = 0; i < 40 && !document.querySelector('.brain-ai-proposal-card'); i++) await wait(250);
  document.getElementById('btn-brain-ai-close')?.click();

  // Una copia automática hecha y un tablero en la papelera
  window.showHomeScreen();
  await wait(300);
  document.getElementById('btn-home-auto-backups')?.click();
  await wait(300);
  document.getElementById('btn-auto-backup-now')?.click();
  for (let i = 0; i < 40 && document.getElementById('btn-auto-backup-now')?.disabled !== false; i++) await wait(250);
  await wait(500);
  document.getElementById('btn-close-auto-backup-modal')?.click();
  const trashRow = [...document.querySelectorAll('#home-boards-tbody tr')].find(tr => tr.textContent.includes('Pruebas antiguas'));
  trashRow?.querySelector('.btn-board-row-options')?.click();
  await wait(200);
  document.getElementById('home-opt-delete')?.click();
  await wait(200);
  document.getElementById('btn-confirm-delete-board')?.click();
  await wait(600);

  // Que desaparezcan los avisos antes de capturar
  await wait(3500);

  return {
    boards: created.map(c => c.title),
    categories: window.workspaceCategories,
    proposal: Boolean(document.querySelector('.brain-ai-proposal-card')),
    trash: JSON.parse(localStorage.getItem('brainboard_trash_v1') || '[]').map(t => t.title)
  };
}

module.exports = { buildDemoBoards };
