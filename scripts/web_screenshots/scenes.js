// Escenas de las capturas de la web. Cada setup se ejecuta DENTRO de la página de la app (se serializa con
// toString) y deja la pantalla lista para la captura. reset() se ejecuta antes de cada una y deja en
// window.__shots las utilidades comunes.

function reset() {
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const byTitle = (title) => window.workspaceBoards.find(b => b.title === title);
  const isShown = (el) => Boolean(el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden');
  const click = (id) => { const el = document.getElementById(id); if (isShown(el)) el.click(); };
  window.__shots = {
    wait,
    byTitle,
    click,
    async openBoard(title) {
      window.hideHomeScreen();
      await window.switchBoard(byTitle(title).id);
      await wait(300);
    },
    // Encuadrar un rectángulo del mundo dejando sitio a las barras de la app
    frame(x0, y0, x1, y1, maxZoom = 1.15) {
      const e = window.engine;
      const W = e.width, H = e.height;
      const pad = { top: 120, bottom: 110, left: 110, right: 50 };
      const zoom = Math.min((W - pad.left - pad.right) / (x1 - x0), (H - pad.top - pad.bottom) / (y1 - y0), maxZoom);
      const sx = pad.left + (W - pad.left - pad.right) / 2;
      const sy = pad.top + (H - pad.top - pad.bottom) / 2;
      e.camera.zoom = zoom;
      e.camera.x = (sx - W / 2) / zoom - (x0 + x1) / 2;
      e.camera.y = (sy - H / 2) / zoom - (y0 + y1) / 2;
      e.render();
      if (e.onCameraChange) e.onCameraChange();
      if (e.onZoomChange) e.onZoomChange(zoom);
    },
    select(ids) {
      const e = window.engine;
      e.selectedItemIds.clear();
      ids.forEach(id => e.selectedItemIds.add(id));
      if (e.onSelectionChange) e.onSelectionChange(ids);
      e.render();
    },
    item(pred) { return window.engine.items.find(pred); },
    items(pred) { return window.engine.items.filter(pred); },
    screenPoint(wx, wy) {
      const s = window.engine.worldToScreen(wx, wy);
      const rect = window.engine.canvas.getBoundingClientRect();
      return { x: rect.left + s.x, y: rect.top + s.y };
    },
    hover(wx, wy) {
      const p = window.__shots.screenPoint(wx, wy);
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: p.x, clientY: p.y, bubbles: true, pointerId: 1 }));
    }
  };

  // Cerrar todo lo que pueda haber quedado abierto
  ['btn-close-whats-new', 'btn-global-search-close', 'btn-frames-index-close', 'btn-close-freshness-settings',
    'btn-close-brain-ai-settings', 'btn-close-auto-backup-modal', 'btn-close-export-modal', 'btn-search-close'].forEach(click);
  if (isShown(document.getElementById('brain-ai-chat-panel'))) click('btn-brain-ai-close');
  if (window.engine.freshnessMapMode) click('btn-close-freshness-map');
  const flyout = document.getElementById('template-flyout-menu');
  if (flyout) flyout.style.display = 'none';
  ['action-toast-notification', 'dev-toast-notification'].forEach(id => { const el = document.getElementById(id); if (el) el.remove(); });
  window.engine.clearHoverDateTooltip?.();
  window.__shots.select([]);
  window.engine.setRatingHover?.(null, 0);
  // Herramienta de selección (tecla V)
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', code: 'KeyV', bubbles: true }));
}

// Respuestas de la IA falsa (API de Ollama)
function fakeAiResponse(prompt) {
  const msg = (prompt.split('=== MENSAJE DEL USUARIO ===')[1] || '').toLowerCase();
  if (/resum|explica/.test(msg)) {
    return 'Es un apunte de **VEX básico** con tres ideas clave:\n\n'
      + '• **@P, @N y @Cd** son los atributos de posición, normal y color de cada punto.\n'
      + '• Un **Attribute Wrangle** por puntos sirve para ruido y máscaras.\n'
      + '• **chf()** y **chramp()** sacan parámetros a la interfaz para ajustarlos sin tocar código.';
  }
  return 'Te propongo un apunte con lo esencial de Karma XPU en tu tablero de render.\n\n'
    + '<brainboard_action>\n'
    + JSON.stringify({
      action: 'insert_knowledge', summaryMode: 'medio', boardId: 'Referencias 3D', frameTitle: 'Render con Karma',
      url: 'https://www.sidefx.com/docs/houdini/solaris/karma_xpu.html', embedTitle: 'Karma XPU',
      embedDescription: 'Motor de render de Houdini que usa CPU y GPU a la vez.',
      noteTitle: 'KARMA XPU: AJUSTES RÁPIDOS',
      noteText: '• Propósito: previsualizar con calidad final en poco tiempo.\n• Flujo: Karma Render Settings → XPU → denoise OIDN.\n• Integración: lookdev en Solaris antes de exportar a USD.'
    }, null, 2)
    + '\n</brainboard_action>';
}

const list = [
  // ---------- Portada: funciones HERO ----------
  {
    id: 'cerebro',
    crop: [240, 240, 960, 600],
    setup: async () => {
      const S = window.__shots;
      await S.openBoard('Referencias 3D');
      S.frame(-20, -40, 1120, 400);
      S.click('brain-ai-dock-trigger');
      await S.wait(500);
      const msgs = document.getElementById('brain-ai-messages');
      if (msgs) msgs.scrollTop = msgs.scrollHeight;
    }
  },
  {
    id: 'enlaces',
    crop: [400, 225, 960, 600],
    setup: async () => {
      const S = window.__shots;
      await S.openBoard('Referencias 3D');
      S.frame(-20, -40, 1120, 400);
      const card = S.item(i => i.title === 'HDRI de exteriores para lookdev');
      const L = window.engine.getEmbedRatingLayout(card);
      S.hover(L.x + 7 + 3 * 16 + 6, L.y + 11);
    }
  },
  {
    id: 'frescura',
    crop: [230, 50, 960, 600],
    setup: async () => {
      const S = window.__shots;
      await S.openBoard('Referencias 3D');
      S.click('btn-toggle-freshness-map');
      await S.wait(300);
      S.frame(-20, -40, 1990, 970, 1);
    }
  },
  {
    id: 'busqueda',
    crop: [240, 70, 960, 600],
    wait: 1200,
    setup: async () => {
      const S = window.__shots;
      await S.openBoard('Houdini');
      S.frame(-20, -40, 1760, 420);
      window.openGlobalSearch('render');
      await S.wait(700);
      const input = document.getElementById('global-search-input');
      input?.dispatchEvent(new Event('input', { bubbles: true }));
    }
  },
  {
    id: 'copias',
    crop: [240, 160, 960, 600],
    setup: async () => {
      const S = window.__shots;
      window.showHomeScreen();
      await S.wait(300);
      S.click('btn-home-auto-backups');
    }
  },
  {
    id: 'carpetas',
    crop: [170, 130, 960, 600],
    wait: 1200,
    setup: async () => {
      const S = window.__shots;
      await S.openBoard('Cortometraje Faro');
      S.frame(-20, -40, 1180, 620);
    }
  },

  // ---------- Documentación ----------
  {
    id: 'inicio',
    setup: async () => {
      window.showHomeScreen();
    }
  },
  {
    id: 'papelera',
    setup: async () => {
      const S = window.__shots;
      window.showHomeScreen();
      await S.wait(200);
      S.click('btn-home-trash');
    }
  },
  {
    id: 'lienzo',
    setup: async () => {
      const S = window.__shots;
      await S.openBoard('Houdini');
      S.frame(-20, -40, 1760, 420);
      const note = S.item(i => i.type === 'text' && /Pyro Source/.test(i.text || ''));
      S.select([note.id]);
    }
  },
  {
    id: 'plantillas',
    setup: async () => {
      const S = window.__shots;
      await S.openBoard('IA generativa');
      S.frame(-20, -40, 820, 420);
      S.click('btn-tool-template');
    }
  },
  {
    id: 'alinear',
    setup: async () => {
      const S = window.__shots;
      await S.openBoard('Referencias 3D');
      S.frame(1200, 380, 1990, 760);
      const notes = S.items(i => i.type === 'sticky_note');
      S.select(notes.map(n => n.id));
      await S.wait(300);
      document.getElementById('btn-prop-align-objects')?.click();
    }
  },
  {
    id: 'indice',
    setup: async () => {
      const S = window.__shots;
      await S.openBoard('Referencias 3D');
      S.frame(-20, -40, 1990, 970, 1);
      S.click('btn-frames-index-trigger');
    }
  },
  {
    id: 'fecha',
    wait: 2600,
    setup: async () => {
      const S = window.__shots;
      await S.openBoard('Houdini');
      S.frame(-20, -40, 1760, 420);
      const card = S.item(i => i.title === 'Referencia de VEX');
      S.hover(card.x + card.width / 2, card.y + card.height - 30);
    }
  },
  {
    id: 'frescura-ajustes',
    setup: async () => {
      const S = window.__shots;
      await S.openBoard('Referencias 3D');
      S.click('btn-toggle-freshness-map');
      await S.wait(300);
      S.frame(-20, -40, 1990, 970, 1);
      S.click('btn-freshness-settings');
    }
  },
  {
    id: 'cerebro-seleccion',
    setup: async () => {
      const S = window.__shots;
      await S.openBoard('Houdini');
      S.frame(-20, -40, 1760, 420);
      const note = S.item(i => i.type === 'text' && /@P, @N/.test(i.text || ''));
      S.select([note.id]);
      await S.wait(200);
      S.click('btn-prop-ask-brain');
    }
  },
  {
    id: 'cerebro-ajustes',
    setup: async () => {
      const S = window.__shots;
      await S.openBoard('Referencias 3D');
      S.frame(-20, -40, 1120, 400);
      document.getElementById('btn-brain-ai-settings')?.click();
    }
  }
];

module.exports = { reset, fakeAiResponse, list };
