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

  // Elementos de la barra flotante estilo Miro
  const fontFamilySelect = document.getElementById('prop-font-family');
  const fontSizeInput = document.getElementById('prop-font-size');
  const btnFontSizeDec = document.getElementById('btn-font-size-dec');
  const btnFontSizeInc = document.getElementById('btn-font-size-inc');
  const btnBold = document.getElementById('btn-prop-bold');
  const btnItalic = document.getElementById('btn-prop-italic');
  const btnAlignLeft = document.getElementById('btn-align-left');
  const btnAlignCenter = document.getElementById('btn-align-center');
  const btnAlignRight = document.getElementById('btn-align-right');
  const btnTextColorTrigger = document.getElementById('btn-text-color-trigger');
  const textColorIndicator = document.getElementById('text-color-indicator');
  const textColorPopover = document.getElementById('text-color-popover');
  const btnFillColorTrigger = document.getElementById('btn-fill-color-trigger');
  const fillColorIndicator = document.getElementById('fill-color-indicator');
  const fillColorPopover = document.getElementById('fill-color-popover');
  const groupFillColor = document.getElementById('group-fill-color');

  let activeEditingItem = null;

  // Evitar que el clic en la barra flotante desfoque el editor de texto
  propertiesBar?.addEventListener('mousedown', (e) => {
    if (e.target.tagName !== 'SELECT' && e.target.tagName !== 'INPUT') {
      e.preventDefault();
    }
  });

  // Paleta de colores Miro
  const paletteColors = [
    '#1a1a1a', '#ffffff', '#475569', '#dc2626',
    '#d97706', '#16a34a', '#2563eb', '#9333ea',
    '#fff9b0', '#d5f692', '#cbf3f9', '#ffcce1',
    '#ffd6a5', '#e1d4f9', '#2d2d2d', '#bbcbd2'
  ];

  // Poblar popover de color de texto
  if (textColorPopover) {
    paletteColors.forEach(col => {
      const swatch = document.createElement('div');
      swatch.className = 'color-swatch';
      swatch.style.backgroundColor = col;
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        if (textColorIndicator) textColorIndicator.style.backgroundColor = col;
        textColorPopover.classList.remove('visible');
        if (engine.selectedItemIds.size > 0) {
          engine.saveSnapshot();
          engine.items.forEach(it => {
            if (engine.selectedItemIds.has(it.id)) {
              it.textColor = col;
              it.color = col;
            }
          });
          if (activeEditingItem) {
            activeEditingItem.textColor = col;
            activeEditingItem.color = col;
            inlineEditor.style.color = col;
            inlineEditor.style.caretColor = col;
          }
          engine.render();
          autoSaveBoard();
        }
      });
      textColorPopover.appendChild(swatch);
    });
  }

  // Poblar popover de color de relleno
  if (fillColorPopover) {
    paletteColors.forEach(col => {
      const swatch = document.createElement('div');
      swatch.className = 'color-swatch';
      swatch.style.backgroundColor = col;
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        if (fillColorIndicator) fillColorIndicator.style.backgroundColor = col;
        fillColorPopover.classList.remove('visible');
        if (engine.selectedItemIds.size > 0) {
          engine.saveSnapshot();
          engine.items.forEach(it => {
            if (engine.selectedItemIds.has(it.id)) {
              if (it.type === 'sticky_note') it.color = col;
              else if (it.type === 'shape' || it.type === 'text' || it.type === 'frame') it.fillColor = col;
            }
          });
          engine.render();
          autoSaveBoard();
        }
      });
      fillColorPopover.appendChild(swatch);
    });
  }

  // Toggles de popovers
  btnTextColorTrigger?.addEventListener('click', (e) => {
    e.stopPropagation();
    textColorPopover?.classList.toggle('visible');
    fillColorPopover?.classList.remove('visible');
  });

  btnFillColorTrigger?.addEventListener('click', (e) => {
    e.stopPropagation();
    fillColorPopover?.classList.toggle('visible');
    textColorPopover?.classList.remove('visible');
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.color-dropdown-group')) {
      textColorPopover?.classList.remove('visible');
      fillColorPopover?.classList.remove('visible');
    }
  });

  // Acciones tipográficas en la barra de propiedades
  function updateFontSize(newSize) {
    newSize = Math.max(8, Math.min(140, parseInt(newSize) || 14));
    if (fontSizeInput) fontSizeInput.value = newSize;
    if (engine.selectedItemIds.size > 0) {
      engine.saveSnapshot();
      engine.items.forEach(it => {
        if (engine.selectedItemIds.has(it.id)) {
          it.fontSize = newSize;
        }
      });
      if (activeEditingItem) {
        activeEditingItem.fontSize = newSize;
        inlineEditor.style.fontSize = `${newSize * engine.camera.zoom}px`;
      }
      engine.render();
      autoSaveBoard();
    }
  }

  btnFontSizeDec?.addEventListener('click', () => {
    updateFontSize((parseInt(fontSizeInput?.value) || 14) - 2);
  });
  btnFontSizeInc?.addEventListener('click', () => {
    updateFontSize((parseInt(fontSizeInput?.value) || 14) + 2);
  });
  fontSizeInput?.addEventListener('change', () => {
    updateFontSize(fontSizeInput.value);
  });

  fontFamilySelect?.addEventListener('change', () => {
    const font = fontFamilySelect.value;
    if (engine.selectedItemIds.size > 0) {
      engine.saveSnapshot();
      engine.items.forEach(it => {
        if (engine.selectedItemIds.has(it.id)) {
          it.fontFamily = font;
        }
      });
      if (activeEditingItem) {
        activeEditingItem.fontFamily = font;
        inlineEditor.style.fontFamily = font;
      }
      engine.render();
      autoSaveBoard();
    }
  });

  btnBold?.addEventListener('click', () => {
    const wasBold = btnBold.classList.contains('active');
    const isBold = !wasBold;
    btnBold.classList.toggle('active', isBold);
    if (engine.selectedItemIds.size > 0) {
      engine.saveSnapshot();
      engine.items.forEach(it => {
        if (engine.selectedItemIds.has(it.id)) {
          it.isBold = isBold;
        }
      });
      if (activeEditingItem) {
        activeEditingItem.isBold = isBold;
        inlineEditor.style.fontWeight = isBold ? '700' : '400';
      }
      engine.render();
      autoSaveBoard();
    }
  });

  btnItalic?.addEventListener('click', () => {
    const wasItalic = btnItalic.classList.contains('active');
    const isItalic = !wasItalic;
    btnItalic.classList.toggle('active', isItalic);
    if (engine.selectedItemIds.size > 0) {
      engine.saveSnapshot();
      engine.items.forEach(it => {
        if (engine.selectedItemIds.has(it.id)) {
          it.isItalic = isItalic;
        }
      });
      if (activeEditingItem) {
        activeEditingItem.isItalic = isItalic;
        inlineEditor.style.fontStyle = isItalic ? 'italic' : 'normal';
      }
      engine.render();
      autoSaveBoard();
    }
  });

  function setAlignment(align) {
    btnAlignLeft?.classList.toggle('active', align === 'left');
    btnAlignCenter?.classList.toggle('active', align === 'center');
    btnAlignRight?.classList.toggle('active', align === 'right');
    if (engine.selectedItemIds.size > 0) {
      engine.saveSnapshot();
      engine.items.forEach(it => {
        if (engine.selectedItemIds.has(it.id)) {
          it.textAlign = align;
        }
      });
      if (activeEditingItem) {
        activeEditingItem.textAlign = align;
        inlineEditor.style.textAlign = align;
      }
      engine.render();
      autoSaveBoard();
    }
  }

  btnAlignLeft?.addEventListener('click', () => setAlignment('left'));
  btnAlignCenter?.addEventListener('click', () => setAlignment('center'));
  btnAlignRight?.addEventListener('click', () => setAlignment('right'));

  // Posicionar la barra flotante encima del elemento seleccionado
  function updatePropertiesBarPosition() {
    if (engine.selectedItemIds.size === 0) {
      propertiesBar?.classList.remove('visible');
      return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    engine.items.forEach(it => {
      if (engine.selectedItemIds.has(it.id)) {
        let bx = it.x, by = it.y, bw = it.width || 100, bh = it.height || 40;
        if (it.type === 'connector' && it.start && it.end) {
          bx = Math.min(it.start.x, it.end.x);
          by = Math.min(it.start.y, it.end.y);
          bw = Math.max(Math.abs(it.end.x - it.start.x), 20);
          bh = Math.max(Math.abs(it.end.y - it.start.y), 20);
        }
        minX = Math.min(minX, bx);
        minY = Math.min(minY, by);
        maxX = Math.max(maxX, bx + bw);
        maxY = Math.max(maxY, by + bh);
      }
    });

    if (!isFinite(minX)) return;

    const screenTopLeft = engine.worldToScreen(minX, minY);
    const screenBottomRight = engine.worldToScreen(maxX, maxY);

    const barW = propertiesBar.offsetWidth || 440;
    const barH = propertiesBar.offsetHeight || 42;

    const centerX = (screenTopLeft.x + screenBottomRight.x) / 2;
    let left = centerX - barW / 2;
    let top = screenTopLeft.y - barH - 12;

    // Si se desborda por arriba de la pantalla, ponerla debajo del elemento
    if (top < 65) {
      top = screenBottomRight.y + 12;
    }

    // Mantener dentro de los bordes laterales
    const pad = 16;
    left = Math.max(pad, Math.min(window.innerWidth - barW - pad, left));

    propertiesBar.style.left = `${left}px`;
    propertiesBar.style.top = `${top}px`;
    propertiesBar.style.bottom = 'auto';
    propertiesBar.style.transform = 'none';
    propertiesBar.classList.add('visible');
  }

  // Sincronizar controles de la barra de propiedades con el elemento actual
  function syncPropertiesBarWithSelection() {
    const selectedItems = engine.items.filter(it => engine.selectedItemIds.has(it.id));
    if (selectedItems.length === 0) {
      propertiesBar?.classList.remove('visible');
      textColorPopover?.classList.remove('visible');
      fillColorPopover?.classList.remove('visible');
      return;
    }

    const first = selectedItems[0];

    // Familia tipográfica
    if (fontFamilySelect) {
      fontFamilySelect.value = first.fontFamily || (first.type === 'code' ? 'monospace' : 'OpenSans');
    }

    // Tamaño de fuente
    if (fontSizeInput) {
      const defaultSize = first.type === 'shape' ? (first.height >= 50 && first.text?.length <= 10 ? 22 : 14) : 15;
      fontSizeInput.value = first.fontSize || defaultSize;
    }

    // Negrita
    if (btnBold) {
      const isBold = first.isBold !== undefined ? Boolean(first.isBold) : Boolean(first.fillColor || (first.fontSize || 15) >= 24);
      btnBold.classList.toggle('active', isBold);
    }

    // Cursiva
    if (btnItalic) {
      btnItalic.classList.toggle('active', Boolean(first.isItalic));
    }

    // Alineación
    const align = first.textAlign || (first.type === 'shape' || first.type === 'sticky_note' || (first.fillColor && first.fillColor !== 'transparent') ? 'center' : 'left');
    btnAlignLeft?.classList.toggle('active', align === 'left');
    btnAlignCenter?.classList.toggle('active', align === 'center');
    btnAlignRight?.classList.toggle('active', align === 'right');

    // Indicadores de color
    if (textColorIndicator) {
      let tColor = first.textColor;
      if (!tColor) {
        if (first.type === 'sticky_note') tColor = '#1a1a1a';
        else if (first.fillColor === '#2d2d2d' || first.fillColor === '#40414c' || first.fillColor === '#1a1a1a') tColor = '#ffffff';
        else tColor = first.color || '#1a1a1a';
      }
      textColorIndicator.style.backgroundColor = tColor;
    }
    if (fillColorIndicator) {
      fillColorIndicator.style.backgroundColor = first.fillColor || (first.type === 'sticky_note' ? (first.color || '#fff9b0') : (first.type === 'frame' ? '#bbcbd2' : '#ffffff'));
    }

    if (groupFillColor) {
      groupFillColor.style.display = (first.type === 'pen' || first.type === 'connector') ? 'none' : 'flex';
    }

    updatePropertiesBarPosition();
  }

  // Herramientas de la barra lateral
  const toolButtons = document.querySelectorAll('.tool-btn');
  const shapeToolBtn = document.getElementById('btn-tool-shape');
  const shapeFlyoutMenu = document.getElementById('shape-flyout-menu');
  const shapeToolIcon = document.getElementById('shape-tool-icon');
  const flyoutItems = document.querySelectorAll('.flyout-item');

  const shapeSvgs = {
    rectangle: '<rect x="3" y="5" width="18" height="14" rx="2"/>',
    circle: '<circle cx="12" cy="12" r="9"/>',
    diamond: '<path d="M12 2l10 10-10 10L2 12z"/>',
    triangle: '<polygon points="12 3 22 21 2 21"/>',
    rounded: '<rect x="3" y="5" width="18" height="14" rx="6"/>'
  };

  const shapeTitles = {
    rectangle: 'Forma: Rectángulo (S)',
    circle: 'Forma: Círculo',
    diamond: 'Forma: Rombo',
    triangle: 'Forma: Triángulo',
    rounded: 'Forma: Redondeado'
  };

  function setShapeType(shape) {
    if (!shapeSvgs[shape]) shape = 'rectangle';
    engine.selectedShapeType = shape;
    if (shapeToolBtn) {
      shapeToolBtn.dataset.shape = shape;
      shapeToolBtn.title = `${shapeTitles[shape] || 'Forma'} - Clic derecho para cambiar`;
    }
    if (shapeToolIcon) {
      shapeToolIcon.innerHTML = shapeSvgs[shape];
    }
    flyoutItems.forEach(item => {
      item.classList.toggle('active', item.dataset.shape === shape);
    });
  }

  function setActiveTool(toolName, shapeType = null) {
    engine.activeTool = toolName;
    if (shapeType) {
      setShapeType(shapeType);
    }
    toolButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === toolName);
    });
    canvasElement.style.cursor = toolName === 'hand' ? 'grab' : 'default';
    if (shapeFlyoutMenu && toolName !== 'shape') {
      shapeFlyoutMenu.style.display = 'none';
    }
  }

  toolButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tool = btn.dataset.tool;
      const shape = btn.dataset.shape || (tool === 'shape' ? engine.selectedShapeType : null);
      setActiveTool(tool, shape);
      if (shapeFlyoutMenu) shapeFlyoutMenu.style.display = 'none';
    });
  });

  // Clic derecho en el botón de formas: despliega menú estilo Photoshop
  shapeToolBtn?.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (shapeFlyoutMenu) {
      const isVisible = shapeFlyoutMenu.style.display !== 'none';
      shapeFlyoutMenu.style.display = isVisible ? 'none' : 'flex';
    }
  });

  // Clic en opciones del menú desplegable de formas
  flyoutItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const shape = item.dataset.shape;
      setShapeType(shape);
      setActiveTool('shape', shape);
      if (shapeFlyoutMenu) shapeFlyoutMenu.style.display = 'none';
    });
  });

  // Callbacks del motor
  engine.onSelectionChange = (selectedIds) => {
    if (activeEditingItem && !selectedIds.includes(activeEditingItem.id)) {
      closeInlineEditor();
    }
    if (selectedIds.length > 0) {
      syncPropertiesBarWithSelection();
    } else {
      propertiesBar?.classList.remove('visible');
      textColorPopover?.classList.remove('visible');
      fillColorPopover?.classList.remove('visible');
      closeInlineEditor();
    }
  };

  engine.onCameraChange = () => {
    if (propertiesBar?.classList.contains('visible')) {
      updatePropertiesBarPosition();
    }
    if (inlineEditor.style.display !== 'none') {
      updateInlineEditorPosition();
    }
    updateMinimap();
  };

  engine.onZoomChange = (zoom) => {
    zoomLevelText.innerText = Math.round(zoom * 100) + '%';
  };

  engine.onBoardModified = () => {
    autoSaveBoard();
    updateMinimap();
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

  // Exportar como imagen PNG en Alta Resolución
  document.getElementById('btn-export-png')?.addEventListener('click', () => {
    openExportModal();
  });
  document.getElementById('btn-export-hires-trigger')?.addEventListener('click', () => {
    openExportModal();
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

  // Convertidor inteligente de elementos de Miro a Brain Board
  function convertMiroToBrainBoard(data) {
    if (!data || !Array.isArray(data.items)) return [];

    // Si ya viene pre-convertido (todos tienen coordenadas absolutas x/y o start/end sin relativeTo)
    const isAlreadyConverted = data.items.length > 0 && data.items.every(it => !it.relativeTo && (it.type === 'connector' || it.type === 'curve' || (typeof it.x === 'number' && typeof it.y === 'number')));
    if (isAlreadyConverted) return data.items;

    const cleanText = (html) => {
      if (!html) return '';
      return String(html)
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<p[^>]*>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
        .replace(/&#x([a-f0-9]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .trim();
    };

    const colorMap = {
      light_yellow: '#fff9b0', yellow: '#ffec3d',
      light_green: '#d5f692', green: '#73d13d',
      light_blue: '#cbf3f9', blue: '#40a9ff',
      light_pink: '#ffcce1', pink: '#ff85c0',
      violet: '#e1d4f9', gray: '#e5e5e5',
      black: '#1a1a1a', white: '#ffffff',
      transparent: 'transparent'
    };
    const mapColor = (col) => colorMap[col] || col || '#ffffff';

    const itemsById = new Map();
    data.items.forEach(it => itemsById.set(it.id, it));

    function getWorldBounds(it) {
      const w = it.width || 100;
      const h = it.height || 40;
      if (it.relativeTo === 'parent_top_left' && it.parentId) {
        const parent = itemsById.get(it.parentId);
        if (parent) {
          const pBounds = getWorldBounds(parent);
          const cx = pBounds.x + it.x;
          const cy = pBounds.y + it.y;
          if (it.origin === 'center') {
            return { x: cx - w / 2, y: cy - h / 2, width: w, height: h };
          } else {
            return { x: cx, y: cy, width: w, height: h };
          }
        }
      }
      if (it.origin === 'center') {
        return { x: (it.x || 0) - w / 2, y: (it.y || 0) - h / 2, width: w, height: h };
      } else {
        return { x: it.x || 0, y: it.y || 0, width: w, height: h };
      }
    }

    const resMap = window.__resourcesMap || {};
    const resEntries = Object.values(resMap);

    return data.items.map(it => {
      const b = getWorldBounds(it);

      if (it.type === 'sticky_note') {
        return {
          id: it.id || 'note_' + Math.random(),
          type: 'sticky_note',
          x: b.x,
          y: b.y,
          width: b.width,
          height: b.height,
          text: cleanText(it.content),
          color: mapColor(it.style?.fillColor)
        };
      }
      if (it.type === 'shape') {
        let shapeType = 'rectangle';
        if (it.shape === 'round_rectangle') shapeType = 'rounded';
        else if (it.shape === 'circle') shapeType = 'circle';
        else if (it.shape === 'rhombus') shapeType = 'diamond';
        else if (it.shape === 'triangle') shapeType = 'triangle';

        return {
          id: it.id || 'shape_' + Math.random(),
          type: 'shape',
          shape: shapeType,
          x: b.x,
          y: b.y,
          width: b.width,
          height: b.height,
          text: cleanText(it.content),
          fillColor: mapColor(it.style?.fillColor),
          strokeColor: mapColor(it.style?.borderColor || it.style?.color || '#1a1a1a'),
          strokeWidth: it.style?.borderWidth || 1
        };
      }
      if (it.type === 'text' || it.type === 'table_text') {
        const hasFill = Boolean((it.style?.fillColor && it.style.fillColor !== 'transparent') || (it.fillColor && it.fillColor !== 'transparent'));
        return {
          id: it.id || 'text_' + Math.random(),
          type: 'text',
          x: b.x,
          y: b.y,
          width: b.width,
          height: b.height,
          text: it.text !== undefined ? it.text : cleanText(it.content),
          fontSize: it.fontSize || Math.round(it.style?.fontSize || 16),
          fillColor: hasFill ? mapColor(it.style?.fillColor || it.fillColor) : null,
          color: mapColor(it.style?.color || it.color || (hasFill ? '#ffffff' : '#1a1a1a')),
          textAlign: it.style?.textAlign || it.textAlign || (hasFill ? 'center' : 'left')
        };
      }
      if (it.type === 'code') {
        return {
          id: it.id || 'code_' + Math.random(),
          type: 'code',
          x: b.x,
          y: b.y,
          width: b.width,
          height: b.height,
          title: it.title || 'Code',
          text: cleanText(it.content)
        };
      }
      if (it.type === 'frame') {
        return {
          id: it.id || 'frame_' + Math.random(),
          type: 'frame',
          x: b.x,
          y: b.y,
          width: b.width,
          height: b.height,
          title: it.title || '',
          fillColor: mapColor(it.style?.fillColor || it.fillColor || '#bbcbd2')
        };
      }
      if (it.type === 'image') {
        let src = it.url || it.src;
        let localSrc = null;
        const resId = it.resourceId || (typeof src === 'string' && src.match(/\/resources\/(\d+)\//)?.[1]);
        if (resId && resMap[resId]) {
          localSrc = resMap[resId].localPath;
        } else if (resEntries.length > 0) {
          // Relación de aspecto
          const r = b.width / b.height;
          const match = resEntries.find(re => re.ratio && Math.abs(re.ratio - r) < 0.04);
          if (match) localSrc = match.localPath;
        }
        return {
          id: it.id || 'img_' + Math.random(),
          type: 'image',
          x: b.x,
          y: b.y,
          width: b.width,
          height: b.height,
          src: localSrc || src || ''
        };
      }
      if (it.type === 'embed' || it.type === 'preview') {
        const uStr = it.url || it.previewUrl || '';
        let domain = it.domain || '';
        let title = it.title || '';
        try {
          if (uStr) {
            const u = new URL(uStr);
            if (!domain) domain = u.hostname.replace(/^www\./, '').toUpperCase();
            if (!title) {
              if (domain.includes('YOUTUBE')) {
                const match = u.pathname.match(/@([^\/\?]+)/);
                title = match ? `@${match[1]}` : 'YouTube';
              } else if (domain.includes('GITHUB')) {
                const parts = u.pathname.split('/').filter(Boolean);
                title = parts.length > 0 ? parts.join('/') : 'GitHub';
              } else {
                const pathClean = decodeURIComponent(u.pathname.replace(/^\/|\/$/g, ''));
                if (pathClean) {
                  const parts = pathClean.split('/');
                  const t = parts[parts.length - 1].replace(/[-_]/g, ' ');
                  title = t.charAt(0).toUpperCase() + t.slice(1);
                } else {
                  const parts = domain.split('.');
                  title = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
                }
              }
            }
          }
        } catch (e) {}

        let src = it.src || '';
        const uLower = uStr.toLowerCase();
        const tLower = (title || '').toLowerCase();

        // Resolucion determinista y fidedigna contra recursos extraidos de Miro (.RTB)
        if (uLower.includes('websitevice') || tLower.includes('websitevice')) {
          src = '../extracted_board/3458764517478105021.jpg';
        } else if (uLower.includes('awwwards') || tLower.includes('awwwards')) {
          src = '../extracted_board/3458764517873211164.jpg';
        } else if (uLower.includes('tradingview.com/lightweight-charts') || tLower.includes('lightweight charts')) {
          src = '../extracted_board/3458764517478079397.jpg';
        } else if (uLower.includes('pexels.com') || tLower.includes('pexels')) {
          src = '../extracted_board/3458764517966736743.jpg';
        } else if (uLower.includes('system-prompts') || uLower.includes('nanobananaproprompts') || tLower.includes('prompts')) {
          src = '../extracted_board/3458764517478043354.png';
        } else if (!src && it.previewUrl) {
          const m = resEntries.find(re => it.previewUrl.includes(re.name) || (re.filename && it.previewUrl.includes(re.filename)));
          if (m) src = m.localPath;
        } else if (!src && uStr.includes('youtube.com')) {
          const yt = resEntries.find(re => re.filename && (re.filename.includes('=s900') || re.filename.includes('default.jpg') || (re.name && re.name.includes('default.jpg'))));
          if (yt) src = yt.localPath;
        } else if (!src && uStr) {
          try {
            const host = new URL(uStr).hostname.replace(/^www\./, '').split('.')[0].toLowerCase();
            if (host.length > 2) {
              const dm = resEntries.find(re => (re.name && re.name.toLowerCase().includes(host)) || (re.filename && re.filename.toLowerCase().includes(host)));
              if (dm) src = dm.localPath;
            }
          } catch (err) {}
        }

        // Fallback autentico de Miro: nunca dinosaurio para bookmarks genericos
        if (!src || src.includes('3458764517918099491.png')) {
          src = '../extracted_board/3458764517903244362.svg';
        }

        return {
          id: it.id || 'embed_' + Math.random(),
          type: 'embed',
          x: b.x,
          y: b.y,
          width: b.width,
          height: b.height,
          title: title || domain || 'Enlace',
          domain: domain || 'ENLACE',
          url: uStr,
          src
        };
      }
      if (it.type === 'connector' || it.type === 'curve') {
        let startPoint = { x: b.x, y: b.y };
        let endPoint = { x: b.x + b.width, y: b.y + b.height };

        if (it.start?.item && itemsById.has(it.start.item)) {
          const s = getWorldBounds(itemsById.get(it.start.item));
          const pos = it.start.position || { x: 0.5, y: 0.5 };
          startPoint = { x: s.x + s.width * pos.x, y: s.y + s.height * pos.y };
        } else if (it.start?.point) {
          startPoint = it.start.point;
        }

        if (it.end?.item && itemsById.has(it.end.item)) {
          const e = getWorldBounds(itemsById.get(it.end.item));
          const pos = it.end.position || { x: 0.5, y: 0.5 };
          endPoint = { x: e.x + e.width * pos.x, y: e.y + e.height * pos.y };
        } else if (it.end?.point) {
          endPoint = it.end.point;
        }

        return {
          id: it.id || 'conn_' + Math.random(),
          type: 'connector',
          start: startPoint,
          end: endPoint,
          color: mapColor(it.style?.strokeColor || '#1a1a1a'),
          strokeWidth: it.style?.strokeWidth || 2
        };
      }
      return it;
    });
  }

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target.result);
        if (data.items && Array.isArray(data.items)) {
          engine.saveSnapshot();
          engine.items = convertMiroToBrainBoard(data);
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

  // Pegar imagenes o enlaces desde el portapapeles (Ctrl+V)
  window.addEventListener('paste', (e) => {
    // Si se está editando dentro de un input o textarea, permitir pegar nativo
    if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
      return;
    }

    const clipboardData = e.clipboardData || window.clipboardData;
    if (!clipboardData) return;

    // 1. Pegar imágenes
    const items = clipboardData.items;
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
          autoSaveBoard();
        };
        reader.readAsDataURL(blob);
        return;
      }
    }

    // 2. Pegar enlaces (URLs) -> generar tarjeta de enlace estilo Miro
    const text = clipboardData.getData('text')?.trim();
    if (text && /^https?:\/\/[^\s]+/i.test(text)) {
      e.preventDefault();
      const center = engine.screenToWorld(window.innerWidth / 2, window.innerHeight / 2);
      const domain = engine.extractDomain(text);
      const title = engine.extractTitle(text);

      let previewSrc = '';
      const resMap = window.__resourcesMap || {};
      const resEntries = Object.values(resMap);
      if (domain.includes('YOUTUBE')) {
        const yt = resEntries.find(re => re.filename && (re.filename.includes('=s900') || re.filename.includes('default.jpg') || (re.name && re.name.includes('default.jpg'))));
        if (yt) previewSrc = yt.localPath;
      } else {
        const host = domain.split('.')[0].toLowerCase();
        if (host.length > 2) {
          const dm = resEntries.find(re => (re.name && re.name.toLowerCase().includes(host)) || (re.filename && re.filename.toLowerCase().includes(host)));
          if (dm) previewSrc = dm.localPath;
        }
      }

      engine.saveSnapshot();
      const newEmbed = {
        id: 'embed_' + Date.now(),
        type: 'embed',
        x: center.x - 140,
        y: center.y - 100,
        width: 280,
        height: 200,
        title: title || domain,
        domain: domain,
        url: text,
        src: previewSrc
      };

      engine.items.push(newEmbed);
      engine.selectedItemIds.clear();
      engine.selectedItemIds.add(newEmbed.id);
      engine.render();
      autoSaveBoard();
      if (engine.onSelectionChange) engine.onSelectionChange([newEmbed.id]);
    }
  });

  // Doble clic para editar texto in-situ o abrir enlaces
  canvasElement.addEventListener('dblclick', (e) => {
    const world = engine.screenToWorld(e.clientX, e.clientY);
    let clicked = null;
    if (engine.selectedItemIds.size === 1) {
      const selId = Array.from(engine.selectedItemIds)[0];
      const selItem = engine.items.find(i => i.id === selId);
      if (selItem && engine.isPointInsideItem(world.x, world.y, selItem)) {
        clicked = selItem;
      }
    }
    if (!clicked) {
      clicked = engine.getItemAt(world.x, world.y, true);
    }
    if (!clicked) {
      clicked = engine.getItemAt(world.x, world.y, false);
    }
    if (clicked) {
      if (clicked.type === 'embed' && clicked.url) {
        try {
          if (window.require) {
            const { shell } = window.require('electron');
            shell.openExternal(clicked.url);
          } else {
            window.open(clicked.url, '_blank');
          }
        } catch (err) {
          window.open(clicked.url, '_blank');
        }
        return;
      }
      if (clicked.type === 'sticky_note' || clicked.type === 'shape' || clicked.type === 'text' || clicked.type === 'frame' || clicked.type === 'code') {
        openInlineEditor(clicked);
      }
    }
  });

  engine.onEditingFinish = () => {
    if (activeEditingItem) closeInlineEditor();
  };

  function openInlineEditor(item) {
    if (!item) return;
    activeEditingItem = item;
    engine.editingItemId = item.id;

    if (!engine.selectedItemIds.has(item.id)) {
      engine.selectedItemIds.clear();
      engine.selectedItemIds.add(item.id);
    }
    syncPropertiesBarWithSelection();

    const zoom = engine.camera.zoom;
    const fontSize = item.fontSize || (item.type === 'shape' ? 14 : (item.type === 'code' ? 12.5 : 16));
    const fontFamily = item.fontFamily || (item.type === 'code' ? '"Fira Code", Consolas, monospace' : 'OpenSans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif');
    const isBold = item.isBold !== undefined ? item.isBold : (Boolean(item.fillColor) || fontSize >= 24);
    const isItalic = Boolean(item.isItalic);
    const align = item.textAlign || (item.type === 'sticky_note' || item.type === 'shape' || (item.fillColor && item.fillColor !== 'transparent') ? 'center' : 'left');

    let textColor = item.textColor;
    if (!textColor) {
      if (item.type === 'sticky_note') {
        textColor = '#1a1a1a';
      } else if (item.type === 'code') {
        textColor = '#abb2bf';
      } else if (item.fillColor === '#2d2d2d' || item.fillColor === '#40414c' || item.fillColor === '#1a1a1a') {
        textColor = '#ffffff';
      } else {
        textColor = item.color || '#1a1a1a';
      }
    }

    inlineEditor.style.fontFamily = fontFamily;
    inlineEditor.style.fontSize = `${fontSize * zoom}px`;
    inlineEditor.style.fontWeight = isBold ? '700' : '400';
    inlineEditor.style.fontStyle = isItalic ? 'italic' : 'normal';
    inlineEditor.style.textAlign = align;
    inlineEditor.style.color = textColor;
    inlineEditor.style.caretColor = textColor;
    inlineEditor.style.lineHeight = '1.35';

    inlineEditor.value = item.text || item.title || '';

    // 1. Mostrar primero para que las dimensiones y estilos sean calculables
    inlineEditor.style.display = 'block';

    // 2. Posicionar exactamente encima del elemento
    updateInlineEditorPosition();

    // Ocultar texto en el canvas para evitar doble renderizado
    engine.render();

    // Enfocar y colocar el cursor al final del texto (sin seleccionar todo en azul)
    inlineEditor.focus();
    const len = inlineEditor.value.length;
    inlineEditor.setSelectionRange(len, len);
  }

  function updateInlineEditorPosition() {
    if (!activeEditingItem) return;
    const screen = engine.worldToScreen(activeEditingItem.x, activeEditingItem.y);
    const zoom = engine.camera.zoom;
    const screenW = Math.max(80, (activeEditingItem.width || 150) * zoom);
    const screenH = Math.max(30, (activeEditingItem.height || 40) * zoom);
    const fontSize = activeEditingItem.fontSize || (activeEditingItem.type === 'shape' ? 14 : (activeEditingItem.type === 'code' ? 12.5 : 16));

    inlineEditor.style.left = `${screen.x}px`;
    inlineEditor.style.top = `${screen.y}px`;
    inlineEditor.style.width = `${screenW}px`;
    inlineEditor.style.fontSize = `${fontSize * zoom}px`;
    inlineEditor.style.lineHeight = '1.35';

    if (activeEditingItem.type === 'sticky_note') {
      inlineEditor.style.padding = `${16 * zoom}px ${12 * zoom}px`;
      inlineEditor.style.backgroundColor = activeEditingItem.color || '#fff9b0';
      inlineEditor.style.borderRadius = `${6 * zoom}px`;
    } else if (activeEditingItem.type === 'code') {
      inlineEditor.style.padding = `${34 * zoom}px 14px 12px ${44 * zoom}px`;
      inlineEditor.style.backgroundColor = '#1e1e24';
      inlineEditor.style.borderRadius = `${8 * zoom}px`;
    } else if (activeEditingItem.fillColor && activeEditingItem.fillColor !== 'transparent') {
      inlineEditor.style.padding = `${10 * zoom}px ${14 * zoom}px`;
      inlineEditor.style.backgroundColor = activeEditingItem.fillColor;
      inlineEditor.style.borderRadius = `${Math.min(8, (activeEditingItem.height || 40) / 4) * zoom}px`;
    } else {
      inlineEditor.style.padding = '0px';
      inlineEditor.style.backgroundColor = 'transparent';
      inlineEditor.style.borderRadius = '3px';
    }

    // Auto-ajustar altura al contenido para que nunca se oculte texto
    inlineEditor.style.height = 'auto';
    const scrollH = inlineEditor.scrollHeight;
    inlineEditor.style.height = `${Math.max(screenH, scrollH)}px`;
  }

  window.openInlineEditor = openInlineEditor;
  window.closeInlineEditor = closeInlineEditor;

  function closeInlineEditor() {
    if (!activeEditingItem) return;
    const val = inlineEditor.value;
    if (activeEditingItem.type === 'frame') {
      activeEditingItem.title = val;
    } else {
      activeEditingItem.text = val;
    }
    inlineEditor.style.display = 'none';
    inlineEditor.style.backgroundColor = 'transparent';
    activeEditingItem = null;
    engine.editingItemId = null;
    engine.saveSnapshot();
    engine.render();
    autoSaveBoardImmediately();
  }

  inlineEditor.addEventListener('input', () => {
    if (!activeEditingItem) return;
    const val = inlineEditor.value;
    if (activeEditingItem.type === 'frame') {
      activeEditingItem.title = val;
    } else {
      activeEditingItem.text = val;
    }

    // Auto-expandir altura si el texto crece
    const zoom = engine.camera.zoom;
    const minH = (activeEditingItem.height || 40) * zoom;
    inlineEditor.style.height = 'auto';
    const newScrollH = inlineEditor.scrollHeight;
    inlineEditor.style.height = `${Math.max(minH, newScrollH)}px`;
    if (newScrollH > minH) {
      activeEditingItem.height = newScrollH / zoom;
    }
    autoSaveBoard();
  });

  inlineEditor.addEventListener('blur', (e) => {
    // Si el nuevo elemento enfocado es parte de la barra de propiedades o un popover, no cerrar
    if (e.relatedTarget && (propertiesBar?.contains(e.relatedTarget) || textColorPopover?.contains(e.relatedTarget) || fillColorPopover?.contains(e.relatedTarget))) {
      return;
    }
    closeInlineEditor();
  });

  inlineEditor.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.88;
    engine.zoomAt(e.clientX, e.clientY, factor);
  }, { passive: false });

  inlineEditor.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeInlineEditor();
    }
  });

  // Atajos de teclado globales
  window.addEventListener('keydown', (e) => {
    // Si se pulsa Ctrl+F o Cmd+F abrir siempre el buscador
    if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
      e.preventDefault();
      openSearchBar();
      return;
    }

    if (e.key === 'Escape') {
      closeSearchBar();
      if (commentPopover) commentPopover.style.display = 'none';
      if (exportHiresModal) exportHiresModal.style.display = 'none';
      if (shapeFlyoutMenu) shapeFlyoutMenu.style.display = 'none';
      return;
    }

    if (document.activeElement === inlineEditor || document.activeElement === boardTitleInput ||
        document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

    // Enter para editar el texto del elemento seleccionado (estilo Miro)
    if (e.key === 'Enter' && engine.selectedItemIds.size === 1 && !activeEditingItem) {
      const selectedItem = engine.items.find(it => engine.selectedItemIds.has(it.id));
      if (selectedItem && (selectedItem.type === 'text' || selectedItem.type === 'sticky_note' || selectedItem.type === 'shape' || selectedItem.type === 'code' || selectedItem.type === 'frame')) {
        e.preventDefault();
        openInlineEditor(selectedItem);
        return;
      }
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      engine.deleteSelected();
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault();
      if (e.shiftKey) engine.redo();
      else engine.undo();
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
      e.preventDefault();
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
      setActiveTool('shape', engine.selectedShapeType || 'rectangle');
    } else if (e.key === 't' || e.key === 'T') {
      setActiveTool('text');
    } else if (e.key === 'p' || e.key === 'P') {
      setActiveTool('pen');
    } else if (e.key === 'l' || e.key === 'L') {
      setActiveTool('connector');
    } else if (e.key === 'f' || e.key === 'F') {
      setActiveTool('frame');
    } else if (e.key === 'c' || e.key === 'C') {
      setActiveTool('comment');
    }
  });

  // =========================================================
  // =========================================================
  // SISTEMA DE ALMACENAMIENTO MULTI-TABLERO (IndexedDB + LocalStorage)
  // =========================================================
  const IDB_NAME = 'BrainBoardStorage_v1';
  const IDB_STORE = 'boards';
  let currentActiveBoardId = localStorage.getItem('miro_active_board_id') || 'dev_ai';

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(IDB_NAME, 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function idbSaveBoard(boardId, data) {
    try {
      const db = await openDatabase();
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.put({ id: `board_${boardId}`, data: data, updatedAt: Date.now() });
      if (boardId === 'dev_ai') {
        store.put({ id: 'current_board', data: data, updatedAt: Date.now() });
      }
      return new Promise((resolve) => {
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch (e) {
      console.warn('IndexedDB no disponible:', e);
      return false;
    }
  }

  async function idbLoadBoard(boardId) {
    try {
      const db = await openDatabase();
      return new Promise((resolve) => {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const store = tx.objectStore(IDB_STORE);
        const req = store.get(`board_${boardId}`);
        req.onsuccess = () => {
          if (req.result?.data) {
            resolve(req.result.data);
          } else if (boardId === 'dev_ai') {
            // Compatibilidad con clave histórica
            const reqLegacy = store.get('current_board');
            reqLegacy.onsuccess = () => resolve(reqLegacy.result?.data || null);
            reqLegacy.onerror = () => resolve(null);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      });
    } catch (e) {
      return null;
    }
  }

  let saveTimeout = null;

  window.autoSaveBoardImmediately = autoSaveBoardImmediately;

  function autoSaveBoardImmediately(targetBoardId = currentActiveBoardId) {
    clearTimeout(saveTimeout);
    if (saveStatusText) saveStatusText.innerText = 'Guardando...';
    const cleanItems = engine.getCleanItems ? engine.getCleanItems() : engine.items;
    const boardMeta = workspaceBoards.find(b => b.id === targetBoardId);
    const data = {
      id: targetBoardId,
      name: boardTitleInput.value || boardMeta?.title || 'DEV / AI',
      updatedAt: new Date().toISOString(),
      items: cleanItems
    };

    // 1. Guardado en IndexedDB indexado por ID de tablero
    idbSaveBoard(targetBoardId, data);

    // 2. Guardado secundario en LocalStorage
    try {
      localStorage.setItem(`miro_board_${targetBoardId}`, JSON.stringify(data));
      localStorage.setItem('miro_active_board_id', targetBoardId);
      if (targetBoardId === 'dev_ai') {
        localStorage.setItem('miro_local_current_board_v3', JSON.stringify(data));
      }
    } catch (err) {
      console.warn('LocalStorage saturado, guardado seguro en IndexedDB');
    }

    if (saveStatusText) saveStatusText.innerText = 'Guardado en local';
  }

  function autoSaveBoard() {
    clearTimeout(saveTimeout);
    if (saveStatusText) saveStatusText.innerText = 'Guardando...';
    saveTimeout = setTimeout(() => {
      autoSaveBoardImmediately();
    }, 400);
  }

  // Guardado inmediato en cierre de ventana, recarga o pérdida de visibilidad
  window.addEventListener('beforeunload', () => {
    if (activeEditingItem) closeInlineEditor();
    autoSaveBoardImmediately();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (activeEditingItem) closeInlineEditor();
      autoSaveBoardImmediately();
    }
  });

  boardTitleInput?.addEventListener('input', () => {
    autoSaveBoard();
  });

  // Cargar mapa de recursos locales extraídos del .RTB
  fetch('whiteboard/resources_map.json')
    .then(r => r.json())
    .then(m => { window.__resourcesMap = m; })
    .catch(() => {});

  // Botón para cargar directamente el tablero DEV / AI
  const btnLoadDevAi = document.getElementById('btn-load-dev-ai');
  btnLoadDevAi?.addEventListener('click', async () => {
    if (currentActiveBoardId === 'dev_ai') {
      const confirmReset = confirm('¿Deseas restaurar la plantilla original DEV / AI desde el archivo? Esto sobreescribirá tus cambios locales en este tablero.');
      if (!confirmReset) {
        engine.fitView();
        return;
      }
      try {
        const res = await fetch('../boards/DEV_AI.json');
        if (res.ok) {
          const board = await res.json();
          engine.saveSnapshot();
          engine.items = (board.items && Array.isArray(board.items)) ? board.items : convertMiroToBrainBoard(board);
          engine.selectedItemIds.clear();
          boardTitleInput.value = board.name || 'DEV / AI';
          engine.fitView();
          autoSaveBoardImmediately('dev_ai');
        }
      } catch (e) {
        alert('Error cargando plantilla DEV / AI: ' + e.message);
      }
    } else {
      switchBoard('dev_ai');
    }
  });

  // Corrección y saneamiento proactivo de recursos de enlaces (evitar dinosaurios / imágenes erróneas)
  function sanitizeEmbedResources(items) {
    if (!Array.isArray(items)) return;
    items.forEach(it => {
      if (it.type === 'embed' || it.type === 'preview') {
        const u = (it.url || '').toLowerCase();
        const t = (it.title || '').toLowerCase();
        if (u.includes('websitevice') || t.includes('websitevice')) {
          it.src = '../extracted_board/3458764517478105021.jpg';
        } else if (u.includes('awwwards') || t.includes('awwwards')) {
          it.src = '../extracted_board/3458764517873211164.jpg';
        } else if (u.includes('tradingview.com/lightweight-charts') || t.includes('lightweight charts')) {
          it.src = '../extracted_board/3458764517478079397.jpg';
        } else if (u.includes('pexels.com') || t.includes('pexels')) {
          it.src = '../extracted_board/3458764517966736743.jpg';
        } else if (u.includes('system-prompts') || u.includes('nanobananaproprompts') || t.includes('prompts')) {
          it.src = '../extracted_board/3458764517478043354.png';
        } else if (it.src && it.src.includes('3458764517918099491.png')) {
          it.src = '../extracted_board/3458764517903244362.svg';
        }
      }
    });
  }

  // Carga inicial resiliente
  async function loadInitialBoard() {
    currentActiveBoardId = localStorage.getItem('miro_active_board_id') || 'dev_ai';
    workspaceBoards.forEach(b => b.active = (b.id === currentActiveBoardId));
    renderDrawerBoards();

    let savedData = await idbLoadBoard(currentActiveBoardId);

    if (!savedData) {
      try {
        const ls = localStorage.getItem(`miro_board_${currentActiveBoardId}`) || (currentActiveBoardId === 'dev_ai' ? localStorage.getItem('miro_local_current_board_v3') : null);
        if (ls) savedData = JSON.parse(ls);
      } catch (e) {}
    }

    if (savedData && Array.isArray(savedData.items) && savedData.items.length > 0) {
      sanitizeEmbedResources(savedData.items);
      engine.items = savedData.items;
      engine.items.forEach(it => {
        if (it.imgElement && typeof it.imgElement.getAttribute !== 'function') {
          delete it.imgElement;
        }
      });
      const activeMeta = workspaceBoards.find(b => b.id === currentActiveBoardId);
      boardTitleInput.value = savedData.name || activeMeta?.title || 'DEV / AI';
      engine.fitView();
      if (saveStatusText) saveStatusText.innerText = 'Guardado en local';
      return;
    }

    if (currentActiveBoardId === 'dev_ai') {
      try {
        const res = await fetch('../boards/DEV_AI.json');
        if (res.ok) {
          const board = await res.json();
          engine.items = (board.items && Array.isArray(board.items)) ? board.items : convertMiroToBrainBoard(board);
          boardTitleInput.value = board.name || 'DEV / AI';
          engine.fitView();
          autoSaveBoardImmediately('dev_ai');
        }
      } catch (e) {
        console.log('Iniciando con tablero vacio');
      }
    } else {
      engine.items = [];
      engine.fitView();
    }
  }

  // =========================================================
  // CONTROLADOR DE BOARD Y MENÚS ESTILO MIRO (REA)
  // =========================================================
  const btnToggleBoardDrawer = document.getElementById('btn-toggle-board-drawer');
  const boardControllerDrawer = document.getElementById('board-controller-drawer');
  const btnCloseBoardDrawer = document.getElementById('btn-close-board-drawer');
  const btnDrawerSearch = document.getElementById('btn-drawer-search');
  const drawerSearchContainer = document.getElementById('drawer-search-container');
  const inputDrawerSearch = document.getElementById('input-drawer-search');
  const btnDrawerNewBoard = document.getElementById('btn-drawer-new-board');
  const drawerBoardsList = document.getElementById('drawer-boards-list');
  const btnCloseCallout = document.getElementById('btn-close-callout');
  const drawerCalloutBox = document.getElementById('drawer-callout-box');
  const btnCreateSection = document.getElementById('btn-create-section');
  const btnBoardOptionsTrigger = document.getElementById('btn-board-options-trigger');
  const boardOptionsMenu = document.getElementById('board-options-menu');
  const menuOptRename = document.getElementById('menu-opt-rename');
  const menuOptExportJson = document.getElementById('menu-opt-export-json');
  const menuOptExportPng = document.getElementById('menu-opt-export-png');
  const menuOptResetZoom = document.getElementById('menu-opt-reset-zoom');
  const menuOptClear = document.getElementById('menu-opt-clear');

  const workspaceBoards = [
    { id: 'dev_ai', title: 'DEV / AI', icon: '⚡', active: true },
    { id: 'graphics_design', title: 'Graphics Design', icon: '📊', active: false },
    { id: 'impresion_3d', title: 'Impresión 3D', icon: '🗑️', active: false },
    { id: 'recursos', title: 'Recursos', icon: '🏠', active: false },
    { id: 'houdini', title: 'Houdini', icon: '🌀', active: false },
    { id: 'concepts', title: 'Concepts', icon: '💡', active: false },
    { id: 'industria', title: 'INDUSTRIA', icon: '🪐', active: false },
    { id: 'zbrush', title: 'ZBRUSH', icon: '🏃', active: false },
    { id: '3d_software', title: '3D SOFTWARE', icon: 'Ⓜ️', active: false }
  ];

  window.switchBoard = switchBoard;

  async function switchBoard(targetBoardId) {
    if (targetBoardId === 'recursos') {
      assetsDrawer?.classList.add('visible');
      loadAssetsThumbnails();
      return;
    }

    // 1. Guardar de forma inmediata el tablero actual antes de salir de él
    if (activeEditingItem) closeInlineEditor();
    autoSaveBoardImmediately(currentActiveBoardId);

    // 2. Establecer el nuevo tablero activo
    currentActiveBoardId = targetBoardId;
    localStorage.setItem('miro_active_board_id', currentActiveBoardId);
    workspaceBoards.forEach(b => b.active = (b.id === targetBoardId));
    const activeMeta = workspaceBoards.find(b => b.id === targetBoardId);
    boardTitleInput.value = activeMeta?.title || targetBoardId;
    renderDrawerBoards();

    // 3. Cargar el estado guardado del tablero objetivo desde IndexedDB
    let saved = await idbLoadBoard(targetBoardId);
    if (!saved) {
      try {
        const ls = localStorage.getItem(`miro_board_${targetBoardId}`) || (targetBoardId === 'dev_ai' ? localStorage.getItem('miro_local_current_board_v3') : null);
        if (ls) saved = JSON.parse(ls);
      } catch (e) {}
    }

    if (saved && Array.isArray(saved.items)) {
      sanitizeEmbedResources(saved.items);
      engine.saveSnapshot();
      engine.items = saved.items;
      engine.items.forEach(it => {
        if (it.imgElement && typeof it.imgElement.getAttribute !== 'function') {
          delete it.imgElement;
        }
      });
      engine.selectedItemIds.clear();
      boardTitleInput.value = saved.name || activeMeta?.title || targetBoardId;
      engine.fitView();
      if (saveStatusText) saveStatusText.innerText = 'Guardado en local';
      return;
    }

    // 4. Si es dev_ai y no tiene datos guardados todavía, sembrar con DEV_AI.json
    if (targetBoardId === 'dev_ai') {
      try {
        const res = await fetch('../boards/DEV_AI.json');
        if (res.ok) {
          const board = await res.json();
          engine.saveSnapshot();
          engine.items = (board.items && Array.isArray(board.items)) ? board.items : convertMiroToBrainBoard(board);
          engine.selectedItemIds.clear();
          boardTitleInput.value = board.name || 'DEV / AI';
          engine.fitView();
          autoSaveBoardImmediately('dev_ai');
        }
      } catch (e) {
        engine.items = [];
        engine.fitView();
      }
      return;
    }

    // 5. Para cualquier otro tablero sin contenido previo, iniciar tablero nuevo
    engine.saveSnapshot();
    engine.items = [];
    engine.selectedItemIds.clear();
    engine.fitView();
    autoSaveBoardImmediately(targetBoardId);
  }

  function renderDrawerBoards(filter = '') {
    if (!drawerBoardsList) return;
    drawerBoardsList.innerHTML = '';
    const filtered = workspaceBoards.filter(b => b.title.toLowerCase().includes(filter.toLowerCase()));
    filtered.forEach(board => {
      const item = document.createElement('div');
      item.className = 'drawer-board-item' + (board.active ? ' active' : '');
      item.innerHTML = `
        <div class="drawer-board-icon">${board.icon}</div>
        <span>${board.title}</span>
      `;
      item.addEventListener('click', () => {
        boardControllerDrawer?.classList.remove('open');
        switchBoard(board.id);
      });
      drawerBoardsList.appendChild(item);
    });
  }

  renderDrawerBoards();

  // Abrir / cerrar cajón lateral de tableros
  btnToggleBoardDrawer?.addEventListener('click', (e) => {
    e.stopPropagation();
    boardControllerDrawer?.classList.toggle('open');
    boardOptionsMenu?.classList.remove('visible');
  });

  btnCloseBoardDrawer?.addEventListener('click', () => {
    boardControllerDrawer?.classList.remove('open');
  });

  // Buscador de tableros dentro del drawer
  btnDrawerSearch?.addEventListener('click', () => {
    if (!drawerSearchContainer) return;
    const isHidden = drawerSearchContainer.style.display === 'none';
    drawerSearchContainer.style.display = isHidden ? 'block' : 'none';
    if (isHidden) inputDrawerSearch?.focus();
  });

  inputDrawerSearch?.addEventListener('input', (e) => {
    renderDrawerBoards(e.target.value);
  });

  // Callout informativo
  btnCloseCallout?.addEventListener('click', () => {
    if (drawerCalloutBox) drawerCalloutBox.style.display = 'none';
  });
  btnCreateSection?.addEventListener('click', () => {
    const secName = prompt('Nombre de la nueva sección:');
    if (secName) {
      alert(`Sección "${secName}" creada en el espacio Creative.`);
    }
  });

  // Crear nuevo tablero desde el cajón (+)
  btnDrawerNewBoard?.addEventListener('click', () => {
    const name = prompt('Nombre del nuevo tablero:');
    if (name) {
      const newB = { id: 'board_' + Date.now(), title: name, icon: '📋', active: true };
      workspaceBoards.forEach(b => b.active = false);
      workspaceBoards.push(newB);
      boardTitleInput.value = name;
      engine.saveSnapshot();
      engine.items = [];
      engine.selectedItemIds.clear();
      engine.fitView();
      boardControllerDrawer?.classList.remove('open');
      renderDrawerBoards();
      autoSaveBoard();
    }
  });

  // Opciones de tablero [⋮]
  btnBoardOptionsTrigger?.addEventListener('click', (e) => {
    e.stopPropagation();
    boardOptionsMenu?.classList.toggle('visible');
  });

  // Opciones del dropdown [⋮]
  menuOptRename?.addEventListener('click', () => {
    boardOptionsMenu?.classList.remove('visible');
    boardTitleInput.focus();
    boardTitleInput.select();
  });
  menuOptExportJson?.addEventListener('click', () => {
    boardOptionsMenu?.classList.remove('visible');
    document.getElementById('btn-save')?.click();
  });
  menuOptExportPng?.addEventListener('click', () => {
    boardOptionsMenu?.classList.remove('visible');
    document.getElementById('btn-export-png')?.click();
  });
  menuOptResetZoom?.addEventListener('click', () => {
    boardOptionsMenu?.classList.remove('visible');
    engine.fitView();
  });
  menuOptClear?.addEventListener('click', () => {
    boardOptionsMenu?.classList.remove('visible');
    document.getElementById('btn-new')?.click();
  });

  // Cierre de menús flotantes al hacer clic fuera
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#board-options-menu') && !e.target.closest('#btn-board-options-trigger')) {
      boardOptionsMenu?.classList.remove('visible');
    }
    if (!e.target.closest('#board-controller-drawer') && !e.target.closest('#btn-toggle-board-drawer')) {
      boardControllerDrawer?.classList.remove('open');
    }
    if (!e.target.closest('#shape-tool-wrapper')) {
      if (shapeFlyoutMenu) shapeFlyoutMenu.style.display = 'none';
    }
  });

  // =========================================================
  // 1. MINI-MAPA INTERACTIVO (RADAR DE NAVEGACIÓN)
  // =========================================================
  const minimapContainer = document.getElementById('minimap-container');
  const minimapCanvas = document.getElementById('minimap-canvas');
  const btnToggleMinimap = document.getElementById('btn-toggle-minimap');
  const btnShowMinimap = document.getElementById('btn-show-minimap');

  let isMinimapPanning = false;

  function updateMinimap() {
    if (!minimapCanvas || !minimapContainer) return;
    if (minimapContainer.style.display === 'none') return;
    engine.renderMinimap(minimapCanvas);
  }

  if (minimapCanvas) {
    minimapCanvas.addEventListener('pointerdown', (e) => {
      isMinimapPanning = true;
      engine.panFromMinimap(e.offsetX, e.offsetY);
    });

    window.addEventListener('pointermove', (e) => {
      if (!isMinimapPanning) return;
      const rect = minimapCanvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      engine.panFromMinimap(mx, my);
    });

    window.addEventListener('pointerup', () => {
      isMinimapPanning = false;
    });
  }

  btnToggleMinimap?.addEventListener('click', () => {
    if (minimapContainer) minimapContainer.style.display = 'none';
    if (btnShowMinimap) btnShowMinimap.style.display = 'flex';
  });

  btnShowMinimap?.addEventListener('click', () => {
    if (minimapContainer) minimapContainer.style.display = 'flex';
    if (btnShowMinimap) btnShowMinimap.style.display = 'none';
    updateMinimap();
  });

  // =========================================================
  // 2. BUSCADOR GLOBAL EN EL TABLERO (Ctrl + F)
  // =========================================================
  const boardSearchBar = document.getElementById('board-search-bar');
  const boardSearchInput = document.getElementById('board-search-input');
  const boardSearchCount = document.getElementById('board-search-count');
  const btnSearchPrev = document.getElementById('btn-search-prev');
  const btnSearchNext = document.getElementById('btn-search-next');
  const btnSearchClose = document.getElementById('btn-search-close');
  const btnBoardSearchTrigger = document.getElementById('btn-board-search-trigger');

  let searchResults = [];
  let currentSearchIndex = -1;

  function openSearchBar() {
    if (!boardSearchBar) return;
    boardSearchBar.style.display = 'flex';
    if (boardSearchInput) {
      boardSearchInput.focus();
      boardSearchInput.select();
      if (boardSearchInput.value.trim()) {
        doSearch(boardSearchInput.value);
      }
    }
  }

  function closeSearchBar() {
    if (!boardSearchBar) return;
    boardSearchBar.style.display = 'none';
    searchResults = [];
    currentSearchIndex = -1;
    if (boardSearchCount) boardSearchCount.textContent = '0/0';
  }

  function doSearch(query) {
    const q = (query || '').trim().toLowerCase();
    searchResults = [];
    currentSearchIndex = -1;

    if (!q) {
      if (boardSearchCount) boardSearchCount.textContent = '0/0';
      return;
    }

    engine.items.forEach(it => {
      let textToSearch = '';
      if (it.text) textToSearch += ' ' + it.text;
      if (it.title) textToSearch += ' ' + it.title;
      if (it.code) textToSearch += ' ' + it.code;
      if (it.url) textToSearch += ' ' + it.url;
      if (it.domain) textToSearch += ' ' + it.domain;
      if (it.author) textToSearch += ' ' + it.author;

      if (textToSearch.toLowerCase().includes(q)) {
        searchResults.push(it);
      }
    });

    if (searchResults.length > 0) {
      gotoSearchResult(0);
    } else {
      if (boardSearchCount) boardSearchCount.textContent = '0/0';
    }
  }

  function gotoSearchResult(idx) {
    if (searchResults.length === 0) return;
    if (idx < 0) idx = searchResults.length - 1;
    if (idx >= searchResults.length) idx = 0;

    currentSearchIndex = idx;
    if (boardSearchCount) {
      boardSearchCount.textContent = `${idx + 1}/${searchResults.length}`;
    }

    const item = searchResults[idx];
    engine.selectedItemIds.clear();
    engine.selectedItemIds.add(item.id);

    // Centrar la cámara suavemente en el elemento
    engine.zoomToItem(item, Math.max(0.75, engine.camera.zoom));
    syncPropertiesBarWithSelection();
  }

  btnBoardSearchTrigger?.addEventListener('click', () => {
    openSearchBar();
  });

  boardSearchInput?.addEventListener('input', (e) => {
    doSearch(e.target.value);
  });

  boardSearchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        gotoSearchResult(currentSearchIndex - 1);
      } else {
        gotoSearchResult(currentSearchIndex + 1);
      }
    } else if (e.key === 'Escape') {
      closeSearchBar();
    }
  });

  btnSearchPrev?.addEventListener('click', () => gotoSearchResult(currentSearchIndex - 1));
  btnSearchNext?.addEventListener('click', () => gotoSearchResult(currentSearchIndex + 1));
  btnSearchClose?.addEventListener('click', closeSearchBar);

  // =========================================================
  // 3. COMENTARIOS Y PINES FLOTANTES (Pin estilo Miro)
  // =========================================================
  const commentPopover = document.getElementById('comment-popover');
  const commentAvatarChar = document.getElementById('comment-avatar-char');
  const commentAuthorName = document.getElementById('comment-author-name');
  const commentTimestamp = document.getElementById('comment-timestamp');
  const commentTextInput = document.getElementById('comment-text-input');
  const btnCommentResolve = document.getElementById('btn-comment-resolve');
  const btnCommentDelete = document.getElementById('btn-comment-delete');
  const btnCommentClose = document.getElementById('btn-comment-close');
  const btnCommentSave = document.getElementById('btn-comment-save');

  let activeCommentItem = null;

  function openCommentPopover(comment, screenX, screenY) {
    if (!commentPopover) return;
    activeCommentItem = comment;

    if (commentAvatarChar) {
      commentAvatarChar.textContent = (comment.author ? comment.author.charAt(0) : 'U').toUpperCase();
    }
    if (commentAuthorName) {
      commentAuthorName.textContent = comment.author || 'Usuario';
    }
    if (commentTimestamp) {
      commentTimestamp.textContent = comment.time || 'Ahora';
    }
    if (commentTextInput) {
      commentTextInput.value = comment.text || '';
    }
    if (btnCommentResolve) {
      btnCommentResolve.textContent = comment.resolved ? '↩ Reabrir' : '✓ Resolver';
      btnCommentResolve.title = comment.resolved ? 'Marcar como pendiente' : 'Marcar como resuelto';
    }

    const popW = 280;
    const popH = 170;
    const posX = Math.min(window.innerWidth - popW - 15, Math.max(15, screenX + 16));
    const posY = Math.min(window.innerHeight - popH - 15, Math.max(15, screenY - 20));

    commentPopover.style.left = `${posX}px`;
    commentPopover.style.top = `${posY}px`;
    commentPopover.style.display = 'flex';

    if (commentTextInput) {
      setTimeout(() => commentTextInput.focus(), 50);
    }
  }

  engine.onCommentClick = (comment, screenX, screenY) => {
    openCommentPopover(comment, screenX, screenY);
  };

  engine.onCommentCreated = (comment, screenX, screenY) => {
    openCommentPopover(comment, screenX, screenY);
  };

  btnCommentSave?.addEventListener('click', () => {
    if (!activeCommentItem) return;
    engine.saveSnapshot();
    activeCommentItem.text = commentTextInput ? commentTextInput.value : '';
    commentPopover.style.display = 'none';
    engine.render();
    autoSaveBoard();
  });

  btnCommentResolve?.addEventListener('click', () => {
    if (!activeCommentItem) return;
    engine.saveSnapshot();
    activeCommentItem.resolved = !activeCommentItem.resolved;
    commentPopover.style.display = 'none';
    engine.render();
    autoSaveBoard();
  });

  btnCommentDelete?.addEventListener('click', () => {
    if (!activeCommentItem) return;
    engine.saveSnapshot();
    engine.items = engine.items.filter(it => it.id !== activeCommentItem.id);
    engine.selectedItemIds.clear();
    commentPopover.style.display = 'none';
    engine.render();
    autoSaveBoard();
  });

  btnCommentClose?.addEventListener('click', () => {
    if (commentPopover) commentPopover.style.display = 'none';
  });

  // =========================================================
  // 4. EXPORTACIÓN HI-RES VECTORIAL / 4K A PNG
  // =========================================================
  const exportHiresModal = document.getElementById('export-hires-modal');
  const btnCloseExportModal = document.getElementById('btn-close-export-modal');
  const btnCancelExport = document.getElementById('btn-cancel-export');
  const btnConfirmExport = document.getElementById('btn-confirm-export');

  function openExportModal() {
    if (!exportHiresModal) return;
    if (propertiesBar) propertiesBar.classList.remove('visible');
    if (commentPopover) commentPopover.style.display = 'none';
    exportHiresModal.style.display = 'flex';

    // Deshabilitar radio de selección si no hay nada seleccionado
    const radioSelection = document.querySelector('input[name="export-scope"][value="selection"]');
    const radioAll = document.querySelector('input[name="export-scope"][value="all"]');
    if (radioSelection && radioAll) {
      if (engine.selectedItemIds.size === 0) {
        radioSelection.disabled = true;
        radioAll.checked = true;
      } else {
        radioSelection.disabled = false;
        radioSelection.checked = true;
      }
    }
  }

  function closeExportModal() {
    if (exportHiresModal) exportHiresModal.style.display = 'none';
  }

  // Selección visual de tarjetas de calidad
  document.querySelectorAll('.quality-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.quality-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    });
  });

  btnCloseExportModal?.addEventListener('click', closeExportModal);
  btnCancelExport?.addEventListener('click', closeExportModal);

  btnConfirmExport?.addEventListener('click', async () => {
    const scaleRadio = document.querySelector('input[name="export-scale"]:checked');
    const scale = parseInt(scaleRadio?.value || '2', 10);

    const scopeRadio = document.querySelector('input[name="export-scope"]:checked');
    const scope = scopeRadio?.value || 'all';

    let bounds = null;
    if (scope === 'selection' && engine.selectedItemIds.size > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      engine.items.filter(it => engine.selectedItemIds.has(it.id)).forEach(it => {
        const x = it.x || 0;
        const y = it.y || 0;
        const w = it.width || 50;
        const h = it.height || 50;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + w);
        maxY = Math.max(maxY, y + h);
      });
      const pad = 40;
      bounds = {
        x: minX - pad,
        y: minY - pad,
        width: Math.max(100, maxX - minX + pad * 2),
        height: Math.max(100, maxY - minY + pad * 2)
      };
    }

    const titleClean = (boardTitleInput.value || 'tablero').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${titleClean}_${scale}x.png`;

    btnConfirmExport.textContent = 'Procesando...';
    btnConfirmExport.disabled = true;

    try {
      await engine.exportHiRes({ bounds, scale, filename });
    } finally {
      btnConfirmExport.textContent = 'Descargar PNG';
      btnConfirmExport.disabled = false;
      closeExportModal();
    }
  });

  loadInitialBoard().then(() => {
    updateMinimap();
  });
});
