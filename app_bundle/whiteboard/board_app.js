// Controlador principal de la Pizarra Local de Miro
document.addEventListener('DOMContentLoaded', () => {
  const canvasElement = document.getElementById('viewport-canvas');
  const engine = new CanvasEngine(canvasElement);
  window.engine = engine;

  // Elementos UI
  const boardTitleInput = document.getElementById('board-title');
  const saveStatusText = document.getElementById('save-status-text');
  const propertiesBar = document.getElementById('properties-bar');
  const zoomLevelText = document.getElementById('zoom-level');
  const inlineEditor = document.getElementById('inline-text-editor');
  const assetsDrawer = document.getElementById('assets-drawer');
  const assetsContainer = document.getElementById('assets-container');
  const fileInput = document.getElementById('file-input');

  let activeEditingItem = null;

  // Paleta de colores Miro
  const colors = [
    '#fff9b0', // Amarillo clasico
    '#d5f692', // Verde
    '#cbf3f9', // Azul claro
    '#ffcce1', // Rosa
    '#ffd6a5', // Naranja
    '#e1d4f9', // Purpura
    '#ffffff', // Blanco
    '#e5e5e5'  // Gris
  ];

  // Generar paleta de colores en la barra de propiedades
  const colorPickerContainer = document.getElementById('color-picker-group');
  if (colorPickerContainer) {
    colors.forEach(col => {
      const swatch = document.createElement('div');
      swatch.className = 'color-swatch' + (col === engine.activeColor ? ' active' : '');
      swatch.style.backgroundColor = col;
      swatch.addEventListener('click', () => {
        engine.activeColor = col;
        document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');

        // Si hay elementos seleccionados, cambiarles el color de inmediato
        if (engine.selectedItemIds.size > 0) {
          engine.saveSnapshot();
          engine.items.forEach(it => {
            if (engine.selectedItemIds.has(it.id)) {
              if (it.type === 'sticky_note') it.color = col;
              if (it.type === 'shape') it.fillColor = col;
              if (it.type === 'pen' || it.type === 'connector' || it.type === 'text') it.color = col;
            }
          });
          engine.render();
        }
      });
      colorPickerContainer.appendChild(swatch);
    });
  }

  // Herramientas de la barra lateral
  const toolButtons = document.querySelectorAll('.tool-btn');
  function setActiveTool(toolName, shapeType = null) {
    engine.activeTool = toolName;
    if (shapeType) engine.selectedShapeType = shapeType;
    toolButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === toolName);
    });
    canvasElement.style.cursor = toolName === 'hand' ? 'grab' : 'default';
  }

  toolButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tool = btn.dataset.tool;
      const shape = btn.dataset.shape;
      setActiveTool(tool, shape);
    });
  });

  // Callbacks del motor
  engine.onSelectionChange = (selectedIds) => {
    if (selectedIds.length > 0) {
      propertiesBar.classList.add('visible');
    } else {
      propertiesBar.classList.remove('visible');
      closeInlineEditor();
    }
  };

  engine.onZoomChange = (zoom) => {
    zoomLevelText.innerText = Math.round(zoom * 100) + '%';
  };

  engine.onBoardModified = () => {
    autoSaveBoard();
  };

  // Controles de zoom
  document.getElementById('btn-zoom-in').addEventListener('click', () => {
    engine.zoomAt(window.innerWidth / 2, window.innerHeight / 2, 1.25);
  });
  document.getElementById('btn-zoom-out').addEventListener('click', () => {
    engine.zoomAt(window.innerWidth / 2, window.innerHeight / 2, 0.8);
  });
  document.getElementById('btn-zoom-fit').addEventListener('click', () => {
    engine.fitView();
  });

  // Botones de propiedades
  document.getElementById('btn-prop-duplicate')?.addEventListener('click', () => {
    engine.duplicateSelected();
  });
  document.getElementById('btn-prop-delete')?.addEventListener('click', () => {
    engine.deleteSelected();
  });

  // Deshacer / Rehacer
  document.getElementById('btn-undo')?.addEventListener('click', () => engine.undo());
  document.getElementById('btn-redo')?.addEventListener('click', () => engine.redo());

  // Nuevo tablero
  document.getElementById('btn-new')?.addEventListener('click', () => {
    if (confirm('¿Crear un nuevo tablero en blanco?')) {
      engine.items = [];
      engine.selectedItemIds.clear();
      boardTitleInput.value = 'Tablero Nuevo';
      engine.fitView();
      autoSaveBoard();
    }
  });

  // Exportar como imagen PNG
  document.getElementById('btn-export-png')?.addEventListener('click', () => {
    const dataUrl = canvasElement.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = (boardTitleInput.value || 'tablero') + '.png';
    a.click();
  });

  // Guardar tablero en archivo JSON
  document.getElementById('btn-save')?.addEventListener('click', () => {
    const boardData = {
      name: boardTitleInput.value || 'Tablero',
      updatedAt: new Date().toISOString(),
      items: engine.items
    };
    const jsonStr = JSON.stringify(boardData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (boardTitleInput.value || 'tablero').replace(/[^a-zA-Z0-9_-]/g, '_') + '.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  // Abrir / Importar archivo
  document.getElementById('btn-open')?.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target.result);
        if (data.items && Array.isArray(data.items)) {
          engine.saveSnapshot();
          engine.items = data.items;
          engine.selectedItemIds.clear();
          if (data.name) boardTitleInput.value = data.name;
          engine.fitView();
          autoSaveBoard();
        } else {
          alert('El archivo no tiene el formato de tablero esperado.');
        }
      } catch (err) {
        alert('Error al leer el archivo JSON: ' + err.message);
      }
    };
    reader.readAsText(file);
    fileInput.value = '';
  });

  // Galeria de recursos de extracted_board
  const btnToggleAssets = document.getElementById('btn-toggle-assets');
  const btnCloseDrawer = document.getElementById('btn-close-drawer');

  btnToggleAssets?.addEventListener('click', () => {
    assetsDrawer.classList.toggle('visible');
    if (assetsDrawer.classList.contains('visible') && assetsContainer.children.length === 0) {
      loadAssetsThumbnails();
    }
  });

  btnCloseDrawer?.addEventListener('click', () => {
    assetsDrawer.classList.remove('visible');
  });

  async function loadAssetsThumbnails() {
    try {
      const res = await fetch('whiteboard/assets_index.json');
      if (!res.ok) return;
      const list = await res.json();
      assetsContainer.innerHTML = '';

      list.forEach(item => {
        const thumb = document.createElement('div');
        thumb.className = 'asset-thumb';
        const img = document.createElement('img');
        img.src = '../extracted_board/' + item.Name;
        const lbl = document.createElement('span');
        lbl.innerText = item.Name;

        thumb.appendChild(img);
        thumb.appendChild(lbl);

        thumb.addEventListener('click', () => {
          // Agregar imagen al centro de la vista
          engine.saveSnapshot();
          const center = engine.screenToWorld(window.innerWidth / 2, window.innerHeight / 2);
          const newImgItem = {
            id: 'img_' + Date.now(),
            type: 'image',
            src: '../extracted_board/' + item.Name,
            x: center.x - 150,
            y: center.y - 100,
            width: 300,
            height: 200
          };
          engine.items.push(newImgItem);
          engine.selectedItemIds.clear();
          engine.selectedItemIds.add(newImgItem.id);
          engine.render();
          assetsDrawer.classList.remove('visible');
        });

        assetsContainer.appendChild(thumb);
      });
    } catch (e) {
      console.warn('No se pudo cargar la galeria de assets:', e);
    }
  }

  // Pegar imagenes desde el portapapeles (Ctrl+V)
  window.addEventListener('paste', (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (const it of items) {
      if (it.kind === 'file' && it.type.startsWith('image/')) {
        const blob = it.getAsFile();
        const reader = new FileReader();
        reader.onload = (evt) => {
          const center = engine.screenToWorld(window.innerWidth / 2, window.innerHeight / 2);
          engine.saveSnapshot();
          const imgItem = {
            id: 'pasted_' + Date.now(),
            type: 'image',
            src: evt.target.result,
            x: center.x - 200,
            y: center.y - 150,
            width: 400,
            height: 300
          };
          engine.items.push(imgItem);
          engine.selectedItemIds.clear();
          engine.selectedItemIds.add(imgItem.id);
          engine.render();
        };
        reader.readAsDataURL(blob);
        break;
      }
    }
  });

  // Doble clic para editar texto in-situ
  canvasElement.addEventListener('dblclick', (e) => {
    const world = engine.screenToWorld(e.clientX, e.clientY);
    const clicked = engine.getItemAt(world.x, world.y);
    if (clicked && (clicked.type === 'sticky_note' || clicked.type === 'shape' || clicked.type === 'text' || clicked.type === 'frame')) {
      openInlineEditor(clicked);
    }
  });

  function openInlineEditor(item) {
    activeEditingItem = item;
    const screen = engine.worldToScreen(item.x, item.y);
    const screenW = (item.width || 150) * engine.camera.zoom;
    const screenH = (item.height || 40) * engine.camera.zoom;

    inlineEditor.style.left = `${screen.x}px`;
    inlineEditor.style.top = `${screen.y}px`;
    inlineEditor.style.width = `${screenW}px`;
    inlineEditor.style.height = `${screenH}px`;
    inlineEditor.style.fontSize = `${Math.max(12, 16 * engine.camera.zoom)}px`;
    inlineEditor.value = item.text || item.title || '';
    inlineEditor.style.display = 'block';
    inlineEditor.focus();
    inlineEditor.select();
  }

  function closeInlineEditor() {
    if (!activeEditingItem) return;
    const val = inlineEditor.value;
    if (activeEditingItem.type === 'frame') {
      activeEditingItem.title = val;
    } else {
      activeEditingItem.text = val;
    }
    inlineEditor.style.display = 'none';
    activeEditingItem = null;
    engine.render();
    autoSaveBoard();
  }

  inlineEditor.addEventListener('blur', closeInlineEditor);
  inlineEditor.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      inlineEditor.style.display = 'none';
      activeEditingItem = null;
    }
  });

  // Atajos de teclado globales
  window.addEventListener('keydown', (e) => {
    if (document.activeElement === inlineEditor || document.activeElement === boardTitleInput) return;

    if (e.key === 'Delete' || e.key === 'Backspace') {
      engine.deleteSelected();
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
      if (e.shiftKey) engine.redo();
      else engine.undo();
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
      engine.redo();
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
      e.preventDefault();
      engine.duplicateSelected();
    } else if (e.key === 'v' || e.key === 'V') {
      setActiveTool('select');
    } else if (e.key === 'h' || e.key === 'H') {
      setActiveTool('hand');
    } else if (e.key === 'n' || e.key === 'N') {
      setActiveTool('sticky_note');
    } else if (e.key === 's' || e.key === 'S') {
      setActiveTool('shape', 'rectangle');
    } else if (e.key === 't' || e.key === 'T') {
      setActiveTool('text');
    } else if (e.key === 'p' || e.key === 'P') {
      setActiveTool('pen');
    } else if (e.key === 'l' || e.key === 'L') {
      setActiveTool('connector');
    } else if (e.key === 'f' || e.key === 'F') {
      setActiveTool('frame');
    }
  });

  // Auto-guardado en LocalStorage y carpeta local
  let saveTimeout = null;
  function autoSaveBoard() {
    clearTimeout(saveTimeout);
    saveStatusText.innerText = 'Guardando...';
    saveTimeout = setTimeout(() => {
      const data = {
        name: boardTitleInput.value || 'DEV / AI',
        updatedAt: new Date().toISOString(),
        items: engine.items
      };
      localStorage.setItem('miro_local_current_board', JSON.stringify(data));
      saveStatusText.innerText = 'Guardado en local';
    }, 500);
  }

  // Carga inicial
  async function loadInitialBoard() {
    // 1. Intentar cargar desde LocalStorage
    const saved = localStorage.getItem('miro_local_current_board');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.items) {
          engine.items = parsed.items;
          boardTitleInput.value = parsed.name || 'DEV / AI';
          engine.fitView();
          return;
        }
      } catch (e) {}
    }

    // 2. Si no hay guardado, cargar tablero inicial DEV_AI.json
    try {
      const res = await fetch('../boards/DEV_AI.json');
      if (res.ok) {
        const board = await res.json();
        engine.items = board.items;
        boardTitleInput.value = board.name;
        engine.fitView();
      }
    } catch (e) {
      console.log('Iniciando con tablero vacio');
    }
  }

  loadInitialBoard();
});
