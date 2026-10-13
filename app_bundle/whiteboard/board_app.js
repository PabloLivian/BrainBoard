// Controlador principal de la Pizarra Local de Miro
document.addEventListener('DOMContentLoaded', () => {
  const canvasElement = document.getElementById('viewport-canvas');
  const engine = new CanvasEngine(canvasElement);
  window.engine = engine;

  // Elementos UI
  const boardTitleInput = document.getElementById('board-title');
  const saveStatusText = document.getElementById('save-status-text');

  // Ajuste responsivo automático del ancho del título según la longitud del texto
  function fitBoardTitleWidth() {
    if (!boardTitleInput) return;
    const text = boardTitleInput.value || boardTitleInput.placeholder || 'DEV / AI';
    let span = document.getElementById('board-title-measure-span');
    if (!span) {
      span = document.createElement('span');
      span.id = 'board-title-measure-span';
      span.style.cssText = 'position:absolute;visibility:hidden;height:0;overflow:hidden;white-space:pre;pointer-events:none;top:-9999px;left:-9999px;';
      document.body.appendChild(span);
    }
    const comp = window.getComputedStyle(boardTitleInput);
    span.style.fontSize = comp.fontSize || '14px';
    span.style.fontFamily = comp.fontFamily || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    span.style.fontWeight = comp.fontWeight || '600';
    span.style.letterSpacing = comp.letterSpacing || 'normal';
    span.textContent = text;
    const measuredWidth = Math.ceil(span.getBoundingClientRect().width);
    // Margen amplio para evitar cualquier truncado o puntos suspensivos y dejar holgura al cursor
    const optimalWidth = Math.max(75, Math.min(420, measuredWidth + 36));
    boardTitleInput.style.width = `${optimalWidth}px`;
  }
  window.fitBoardTitleWidth = fitBoardTitleWidth;

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

  // =========================================================================
  // GESTIÓN DE COLORES FAVORITOS Y SELECTOR DE COLOR ESTILO PHOTOSHOP
  // =========================================================================

  const DEFAULT_FAVORITE_COLORS = [
    '#1a1a1a', '#ffffff', '#475569', '#dc2626',
    '#d97706', '#16a34a', '#2563eb', '#9333ea',
    '#fff9b0', '#d5f692', '#cbf3f9', '#ffcce1',
    '#ffd6a5', '#e1d4f9', '#2d2d2d', '#bbcbd2'
  ];

  function getFavoriteColors() {
    try {
      const raw = localStorage.getItem('brainboard_favorite_colors');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (err) {
      console.warn('Error al leer colores favoritos:', err);
    }
    return [...DEFAULT_FAVORITE_COLORS];
  }

  function saveFavoriteColors(colors) {
    try {
      localStorage.setItem('brainboard_favorite_colors', JSON.stringify(colors));
    } catch (err) {
      console.warn('Error al guardar colores favoritos:', err);
    }
  }

  function addFavoriteColor(hex) {
    if (!hex) return;
    const normalized = hex.trim().toLowerCase();
    const current = getFavoriteColors();
    const existingIndex = current.findIndex(c => c.toLowerCase() === normalized);
    if (existingIndex !== -1) {
      current.splice(existingIndex, 1);
    }
    current.push(normalized);
    saveFavoriteColors(current);
    renderColorPopovers();
  }

  function removeFavoriteColor(hex) {
    if (!hex) return;
    const normalized = hex.trim().toLowerCase();
    let current = getFavoriteColors();
    current = current.filter(c => c.toLowerCase() !== normalized);
    saveFavoriteColors(current);
    renderColorPopovers();
  }

  function applyColorToSelection(type, colorHex) {
    if (type === 'text') {
      if (textColorIndicator) textColorIndicator.style.backgroundColor = colorHex;
      if (engine.selectedItemIds.size > 0) {
        engine.saveSnapshot();
        engine.items.forEach(it => {
          if (engine.selectedItemIds.has(it.id)) {
            it.textColor = colorHex;
            it.color = colorHex;
          }
        });
        if (activeEditingItem) {
          activeEditingItem.textColor = colorHex;
          activeEditingItem.color = colorHex;
          inlineEditor.style.color = colorHex;
          inlineEditor.style.caretColor = colorHex;
        }
        engine.render();
        autoSaveBoard();
      }
    } else if (type === 'fill') {
      if (fillColorIndicator) fillColorIndicator.style.backgroundColor = colorHex;
      if (engine.selectedItemIds.size > 0) {
        engine.saveSnapshot();
        engine.items.forEach(it => {
          if (engine.selectedItemIds.has(it.id)) {
            if (it.type === 'sticky_note') it.color = colorHex;
            else if (it.type === 'shape' || it.type === 'text' || it.type === 'frame') it.fillColor = colorHex;
          }
        });
        engine.render();
        autoSaveBoard();
      }
    }
  }

  function renderColorPopovers() {
    const favorites = getFavoriteColors();

    function populatePopover(popover, targetMode) {
      if (!popover) return;
      popover.innerHTML = '';

      // Encabezado informativo: "Click derecho para Eliminar"
      const header = document.createElement('div');
      header.className = 'color-palette-header';
      header.textContent = 'Click derecho para Eliminar';
      popover.appendChild(header);

      // Grid de colores favoritos
      const grid = document.createElement('div');
      grid.className = 'color-palette-grid';

      favorites.forEach(col => {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        swatch.style.backgroundColor = col;
        swatch.title = `${col} (Click derecho para eliminar)`;

        // Clic izquierdo: seleccionar y aplicar color
        swatch.addEventListener('click', (e) => {
          e.stopPropagation();
          applyColorToSelection(targetMode, col);
          popover.classList.remove('visible');
        });

        // Clic derecho: eliminar color de favoritos
        swatch.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          removeFavoriteColor(col);
        });

        grid.appendChild(swatch);
      });

      // Botón "+" para abrir el selector de color avanzado estilo Photoshop
      const addBtn = document.createElement('div');
      addBtn.className = 'color-swatch-add';
      addBtn.textContent = '+';
      addBtn.title = 'Añadir color a favoritos';
      addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        popover.classList.remove('visible');
        const currentColor = targetMode === 'text'
          ? (textColorIndicator?.style.backgroundColor || '#1a1a1a')
          : (fillColorIndicator?.style.backgroundColor || '#fff9b0');
        openPhotoshopColorPicker(targetMode, currentColor);
      });
      grid.appendChild(addBtn);

      popover.appendChild(grid);
    }

    populatePopover(textColorPopover, 'text');
    populatePopover(fillColorPopover, 'fill');
  }

  // --- Funciones de Conversión de Color HSV / RGB / HEX ---
  function parseColorToRgb(str) {
    if (!str) return [255, 255, 255];
    str = String(str).trim();
    if (str.startsWith('rgb')) {
      const match = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
      if (match) {
        return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
      }
    }
    let hex = str.replace('#', '');
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    if (hex.length === 6) {
      const num = parseInt(hex, 16);
      if (!isNaN(num)) {
        return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
      }
    }
    return [255, 255, 255];
  }

  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
      const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }

  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    const s = max === 0 ? 0 : d / max;
    const v = max;

    if (max !== min) {
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h *= 60;
    }
    return [h, s, v];
  }

  function hsvToRgb(h, s, v) {
    const c = v * s;
    const hp = ((h % 360) + 360) % 360 / 60;
    const x = c * (1 - Math.abs((hp % 2) - 1));
    let r = 0, g = 0, b = 0;
    if (hp >= 0 && hp < 1) { r = c; g = x; b = 0; }
    else if (hp >= 1 && hp < 2) { r = x; g = c; b = 0; }
    else if (hp >= 2 && hp < 3) { r = 0; g = c; b = x; }
    else if (hp >= 3 && hp < 4) { r = 0; g = x; b = c; }
    else if (hp >= 4 && hp < 5) { r = x; g = 0; b = c; }
    else if (hp >= 5 && hp < 6) { r = c; g = 0; b = x; }
    const m = v - c;
    return [
      Math.round((r + m) * 255),
      Math.round((g + m) * 255),
      Math.round((b + m) * 255)
    ];
  }

  // --- Controlador del Selector de Color estilo Photoshop (Modo Saturación) ---
  const psColorPickerModal = document.getElementById('ps-color-picker-modal');
  const psPickerBtnClose = document.getElementById('ps-picker-btn-close');
  const psPicker2DContainer = document.getElementById('ps-picker-2d-container');
  const psPickerCanvas2D = document.getElementById('ps-picker-canvas-2d');
  const psPickerCursor2D = document.getElementById('ps-picker-cursor-2d');
  const psPickerSliderWrapper = document.getElementById('ps-picker-slider-wrapper');
  const psPickerCanvasSat = document.getElementById('ps-picker-canvas-sat');
  const psPickerArrowLeft = document.getElementById('ps-picker-slider-arrow-left');
  const psPickerArrowRight = document.getElementById('ps-picker-slider-arrow-right');
  const psPickerPreviewNew = document.getElementById('ps-picker-preview-new');
  const psPickerPreviewCurrent = document.getElementById('ps-picker-preview-current');
  const psPickerHexInput = document.getElementById('ps-picker-hex-input');
  const psPickerBtnApply = document.getElementById('ps-picker-btn-apply');
  const psPickerBtnCancel = document.getElementById('ps-picker-btn-cancel');

  const pickerState = {
    h: 0,
    s: 1,
    v: 1,
    initialHex: '#FFFFFF',
    currentHex: '#FFFFFF',
    mode: 'text'
  };

  function draw2DCanvas(canvas, s) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(256, 256);
    const data = new Uint32Array(imgData.data.buffer);

    const baseR = new Float32Array(256);
    const baseG = new Float32Array(256);
    const baseB = new Float32Array(256);

    for (let x = 0; x < 256; x++) {
      const h = (x / 256) * 360;
      const [r, g, b] = hsvToRgb(h, s, 1.0);
      baseR[x] = r;
      baseG[x] = g;
      baseB[x] = b;
    }

    for (let y = 0; y < 256; y++) {
      const v = (255 - y) / 255;
      const rowOffset = y * 256;
      for (let x = 0; x < 256; x++) {
        const r = (baseR[x] * v) | 0;
        const g = (baseG[x] * v) | 0;
        const b = (baseB[x] * v) | 0;
        data[rowOffset + x] = (255 << 24) | (b << 16) | (g << 8) | r;
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }

  function drawSatSlider(canvas, h, v) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    const [rTop, gTop, bTop] = hsvToRgb(h, 1.0, v);
    const [rBot, gBot, bBot] = hsvToRgb(h, 0.0, v);
    grad.addColorStop(0, `rgb(${rTop},${gTop},${bTop})`);
    grad.addColorStop(1, `rgb(${rBot},${gBot},${bBot})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 22, 256);
  }

  function updatePickerUI(update2D = true, updateSat = true, updateHex = true) {
    const [r, g, b] = hsvToRgb(pickerState.h, pickerState.s, pickerState.v);
    const hex = rgbToHex(r, g, b).toUpperCase();
    pickerState.currentHex = hex;

    // Actualizar posición de cursor 2D
    const curX = Math.round((pickerState.h / 360) * 256);
    const curY = Math.round((1.0 - pickerState.v) * 256);
    if (psPickerCursor2D) {
      psPickerCursor2D.style.left = `${Math.max(0, Math.min(256, curX))}px`;
      psPickerCursor2D.style.top = `${Math.max(0, Math.min(256, curY))}px`;
    }

    // Actualizar punteros de la barra de saturación
    const arrowY = Math.round((1.0 - pickerState.s) * 256);
    if (psPickerArrowLeft) psPickerArrowLeft.style.top = `${Math.max(0, Math.min(256, arrowY))}px`;
    if (psPickerArrowRight) psPickerArrowRight.style.top = `${Math.max(0, Math.min(256, arrowY))}px`;

    // Muestra de color nuevo
    if (psPickerPreviewNew) psPickerPreviewNew.style.backgroundColor = hex;

    // Campo de texto hexadecimal
    if (updateHex && psPickerHexInput && document.activeElement !== psPickerHexInput) {
      psPickerHexInput.value = hex.replace('#', '');
    }

    // Redibujar lienzos según corresponda
    if (update2D && psPickerCanvas2D) {
      draw2DCanvas(psPickerCanvas2D, pickerState.s);
    }
    if (updateSat && psPickerCanvasSat) {
      drawSatSlider(psPickerCanvasSat, pickerState.h, pickerState.v);
    }
  }

  // Interacción de arrastre en el lienzo 2D
  if (psPicker2DContainer) {
    psPicker2DContainer.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { psPicker2DContainer.setPointerCapture(e.pointerId); } catch (_) {}
      function handlePointer(ev) {
        const rect = psPicker2DContainer.getBoundingClientRect();
        const x = Math.max(0, Math.min(255, ev.clientX - rect.left));
        const y = Math.max(0, Math.min(255, ev.clientY - rect.top));
        pickerState.h = (x / 256) * 360;
        pickerState.v = 1.0 - (y / 256);
        updatePickerUI(false, true, true);
      }
      handlePointer(e);

      const onPointerMove = (ev) => handlePointer(ev);
      const onPointerUp = (ev) => {
        try { psPicker2DContainer.releasePointerCapture(ev.pointerId); } catch (_) {}
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
      };
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    });
  }

  // Interacción de arrastre en el deslizador de Saturación
  if (psPickerSliderWrapper) {
    psPickerSliderWrapper.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { psPickerSliderWrapper.setPointerCapture(e.pointerId); } catch (_) {}
      function handlePointer(ev) {
        const rect = psPickerSliderWrapper.getBoundingClientRect();
        const y = Math.max(0, Math.min(255, ev.clientY - rect.top));
        pickerState.s = Math.max(0, Math.min(1, 1.0 - (y / 256)));
        updatePickerUI(true, false, true);
      }
      handlePointer(e);

      const onPointerMove = (ev) => handlePointer(ev);
      const onPointerUp = (ev) => {
        try { psPickerSliderWrapper.releasePointerCapture(ev.pointerId); } catch (_) {}
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
      };
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    });
  }

  // Entrada de texto Hexadecimal
  psPickerHexInput?.addEventListener('input', () => {
    let val = psPickerHexInput.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
    psPickerHexInput.value = val.toUpperCase();
    if (val.length === 6) {
      const [r, g, b] = parseColorToRgb('#' + val);
      const [h, s, v] = rgbToHsv(r, g, b);
      pickerState.h = h;
      pickerState.s = s;
      pickerState.v = v;
      updatePickerUI(true, true, false);
    }
  });

  // Clic en color "Actual" para restaurar color original
  psPickerPreviewCurrent?.addEventListener('click', () => {
    const [r, g, b] = parseColorToRgb(pickerState.initialHex);
    const [h, s, v] = rgbToHsv(r, g, b);
    pickerState.h = h;
    pickerState.s = s;
    pickerState.v = v;
    updatePickerUI(true, true, true);
  });

  function closePhotoshopColorPicker() {
    if (psColorPickerModal) psColorPickerModal.style.display = 'none';
  }

  function openPhotoshopColorPicker(mode, initialColor) {
    pickerState.mode = mode;
    const [r, g, b] = parseColorToRgb(initialColor);
    const [h, s, v] = rgbToHsv(r, g, b);
    pickerState.h = h;
    pickerState.s = s;
    pickerState.v = v;
    const initialHex = rgbToHex(r, g, b).toUpperCase();
    pickerState.initialHex = initialHex;
    pickerState.currentHex = initialHex;

    if (psPickerPreviewCurrent) {
      psPickerPreviewCurrent.style.backgroundColor = initialHex;
      psPickerPreviewCurrent.title = `Color anterior: ${initialHex} (Click para restaurar)`;
    }

    // Resetear posición de la ventana centrada si fue movida
    const win = document.querySelector('.ps-picker-window');
    if (win) {
      win.style.position = '';
      win.style.left = '';
      win.style.top = '';
      win.style.margin = '';
    }

    updatePickerUI(true, true, true);
    if (psColorPickerModal) psColorPickerModal.style.display = 'flex';
  }

  // Botón "Añadir a favoritos"
  psPickerBtnApply?.addEventListener('click', () => {
    const hex = pickerState.currentHex;
    addFavoriteColor(hex);
    applyColorToSelection(pickerState.mode, hex);
    closePhotoshopColorPicker();
  });

  // Botón "Cancelar" y botón de cerrar "✕"
  psPickerBtnCancel?.addEventListener('click', closePhotoshopColorPicker);
  psPickerBtnClose?.addEventListener('click', closePhotoshopColorPicker);

  // Cerrar al hacer clic en el backdrop fuera de la ventana
  psColorPickerModal?.addEventListener('click', (e) => {
    if (e.target === psColorPickerModal) {
      closePhotoshopColorPicker();
    }
  });

  // Cerrar con Escape
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && psColorPickerModal && psColorPickerModal.style.display !== 'none') {
      closePhotoshopColorPicker();
    }
  });

  // Soporte para arrastrar la ventana modal del selector desde su barra de título
  const psPickerTitlebar = document.querySelector('.ps-picker-titlebar');
  const psPickerWindow = document.querySelector('.ps-picker-window');
  let isDraggingModal = false;
  let modalDragOffsetX = 0, modalDragOffsetY = 0;

  if (psPickerTitlebar && psPickerWindow) {
    psPickerTitlebar.style.cursor = 'move';
    psPickerTitlebar.addEventListener('mousedown', (e) => {
      if (e.target.id === 'ps-picker-btn-close') return;
      isDraggingModal = true;
      const rect = psPickerWindow.getBoundingClientRect();
      modalDragOffsetX = e.clientX - rect.left;
      modalDragOffsetY = e.clientY - rect.top;

      psPickerWindow.style.position = 'fixed';
      psPickerWindow.style.left = `${rect.left}px`;
      psPickerWindow.style.top = `${rect.top}px`;
      psPickerWindow.style.margin = '0';
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDraggingModal) return;
      let newX = e.clientX - modalDragOffsetX;
      let newY = e.clientY - modalDragOffsetY;
      newX = Math.max(10, Math.min(window.innerWidth - psPickerWindow.offsetWidth - 10, newX));
      newY = Math.max(10, Math.min(window.innerHeight - psPickerWindow.offsetHeight - 10, newY));
      psPickerWindow.style.left = `${newX}px`;
      psPickerWindow.style.top = `${newY}px`;
    });

    window.addEventListener('mouseup', () => {
      isDraggingModal = false;
    });
  }

  // Inicializar popovers de color
  renderColorPopovers();

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

  // Guardar tablero en archivo JSON
  function saveBoardToFile() {
    const cleanItems = engine.getCleanItems ? engine.getCleanItems() : engine.items;
    const boardData = {
      name: boardTitleInput.value || 'Tablero',
      updatedAt: new Date().toISOString(),
      items: cleanItems
    };
    const jsonStr = JSON.stringify(boardData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (boardTitleInput.value || 'tablero').replace(/[^a-zA-Z0-9_-]/g, '_') + '.json';
    a.click();
    URL.revokeObjectURL(url);
    if (typeof autoSaveBoardImmediately === 'function') {
      autoSaveBoardImmediately();
    }
  }

  // Exportar como imagen PNG en Alta Resolución
  document.getElementById('btn-export-png')?.addEventListener('click', () => {
    openExportModal();
  });
  document.getElementById('btn-export-hires-trigger')?.addEventListener('click', () => {
    openExportModal();
  });

  // Guardar tablero en archivo JSON
  document.getElementById('btn-save')?.addEventListener('click', saveBoardToFile);

  // Abrir / Importar archivo
  document.getElementById('btn-drawer-import')?.addEventListener('click', () => {
    fileInput.click();
  });
  document.getElementById('btn-open')?.addEventListener('click', () => {
    fileInput.click();
  });

  // Exportar copia de seguridad de todos los tableros
  async function exportAllBoardsBackup() {
    if (typeof autoSaveBoardImmediately === 'function') {
      autoSaveBoardImmediately();
    }

    const boardsToExport = Array.isArray(workspaceBoards) ? workspaceBoards.filter(b => b.id !== 'recursos') : [];
    if (boardsToExport.length === 0) {
      alert('No hay tableros para exportar.');
      return;
    }

    // Recopilar datos de cada tablero desde IndexedDB / LocalStorage / estado activo
    const exportedDataList = [];
    for (const b of boardsToExport) {
      let data = null;
      if (b.id === currentActiveBoardId) {
        const cleanItems = engine.getCleanItems ? engine.getCleanItems() : engine.items;
        data = {
          id: b.id,
          name: boardTitleInput.value || b.title || 'Tablero',
          updatedAt: new Date().toISOString(),
          items: cleanItems
        };
      } else {
        data = await idbLoadBoard(b.id);
        if (!data) {
          try {
            const ls = localStorage.getItem(`miro_board_${b.id}`) || (b.id === 'dev_ai' ? localStorage.getItem('miro_local_current_board_v3') : null);
            if (ls) data = JSON.parse(ls);
          } catch (e) {}
        }
      }

      const boardItems = (data && Array.isArray(data.items)) ? data.items : [];
      const safeTitle = (b.title || b.id || 'tablero').replace(/[^a-zA-Z0-9_\-\u00C0-\u017F\s]/g, '').trim().replace(/\s+/g, '_');
      const filename = `${safeTitle || 'tablero'}.json`;

      exportedDataList.push({
        id: b.id,
        filename: filename,
        content: JSON.stringify({
          id: b.id,
          name: b.title || (data ? data.name : b.id),
          icon: b.icon || '📋',
          updatedAt: (data && data.updatedAt) ? data.updatedAt : new Date().toISOString(),
          items: boardItems
        }, null, 2)
      });
    }

    // 1. Si el navegador/Chromium soporta File System Access API (showDirectoryPicker)
    if (typeof window.showDirectoryPicker === 'function') {
      try {
        const dirHandle = await window.showDirectoryPicker({
          id: 'brain_board_backup',
          mode: 'readwrite',
          startIn: 'documents'
        });

        let savedCount = 0;
        for (const item of exportedDataList) {
          const fileHandle = await dirHandle.getFileHandle(item.filename, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(item.content);
          await writable.close();
          savedCount++;
        }

        alert(`¡Copia de seguridad completada con éxito!\nSe han guardado ${savedCount} tableros en la carpeta seleccionada.`);
        return;
      } catch (err) {
        // Si el usuario canceló la selección de carpeta, no hacer nada
        if (err.name === 'AbortError') return;
        console.warn('Error con showDirectoryPicker, recurriendo a descarga:', err);
      }
    }

    // 2. Método de descarga secuencial en caso de que no esté disponible o falle showDirectoryPicker
    let delay = 0;
    for (const item of exportedDataList) {
      setTimeout(() => {
        const blob = new Blob([item.content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = item.filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      }, delay);
      delay += 250;
    }
  }

  document.getElementById('btn-drawer-backup')?.addEventListener('click', () => {
    boardControllerDrawer?.classList.remove('open');
    exportAllBoardsBackup();
  });

  // Definición integral de reglas y recursos para tarjetas de enlace (Web Bookmarks)
  const embedSanitizeRules = [
    { match: (u, t) => u.includes('scrollxui') || t.includes('scrollx'), src: '../extracted_board/3458764517509523994.png', title: 'ScrollX UI - Interactive React Components...', description: 'ScrollX UI is an open-source library with customizable, animated, interactive React components to help developers build first, visually appealing UIs.' },
    { match: (u, t) => u.includes('reactbits') || t.includes('react bits'), src: '../extracted_board/3458764517509519997.png', title: 'React Bits', description: 'An open source collection of high quality, animated, interactive & fully customizable React components for building stunning, memorable u...' },
    { match: (u, t) => u.includes('untitledui'), src: '../extracted_board/3458764517477372552.jpg', title: 'Untitled UI - Figma UI Kit and React Compon...', description: "Is billed as the 'world's largest Figma UI kit and React component library'. Kickstart any project with everything you need to design and develop stun..." },
    { match: (u, t) => u.includes('system-prompts') || u.includes('nanobananaproprompts'), src: '../extracted_board/3458764517478043354.png', title: 'GitHub - x1xhlol/system-prompts-and-models-of-ai-tools', description: 'Full, Approved Code, Clever Code, Quality Code, Redundancy, Clutter, Curves, Tables AI, Jamovi, Miro, Unleashed, Unleash, Manuals, Hidden AI, Directives...' },
    { match: (u, t) => u.includes('swapy') || t.includes('swapy'), src: '../extracted_board/3458764517480665009.png', title: 'Swapy, a simple JavaScript tool for converting...', description: 'A simple JavaScript tool for converting any layout you have to drag-to-swap layout.' },
    { match: (u, t) => u.includes('npmtrends') || t.includes('npm trends') || t.includes('npmtrends'), src: '../extracted_board/3458764517492930057.png', title: 'npm trends: Compare NPM package downloads', description: 'Which NPM package should you use? Compare packages: download stats, bundle sizes, github stars and more. Spot trends, pick the winner.' },
    { match: (u, t) => u.includes('unavatar') || t.includes('unavatar'), src: '../extracted_board/3458764517492598138.png', title: 'unavatar', description: 'The universal avatar service that offers everything you need to easily retrieve user avatars' },
    { match: (u, t) => u.includes('allsvgicons') || t.includes('allsvgicons'), src: '../extracted_board/3458764517480685287.png', title: 'All SVG Icons - Free and Open Source SVG Vec...', description: 'Browse and download 250,000+ free SVG icons for your projects. Use as Web Fonts and customize, Copy Raw SVG code or download as PNG, SVG...' },
    { match: (u, t) => u.includes('profile-readme-generator'), src: '../extracted_board/3458764517509492692.png', title: 'Profile Readme Generator', description: 'Beautify your github profile with this amazing tool, creating the readme your profile deserves! Feel free to visit the profile readme generator you will find...' },
    { match: (u, t) => u.includes('gitdocify'), src: '', title: 'GitDocify', description: 'Instant, Professional, Code Documentation. Document your code in seconds with AI.' },
    { match: (u, t) => u.includes('daisyui'), src: '', title: 'daisyUI — Tailwind CSS Components', description: 'The most popular, free and open-source Tailwind CSS component library.' },
    { match: (u, t) => u.includes('animejs') || t.includes('anime.js'), src: '../extracted_board/3458764517509516195.png', title: 'Anime.js | JavaScript Animation Engine', description: 'A fast and versatile JavaScript animation library' },
    { match: (u, t) => u.includes('stitch.withgoogle.com'), src: '../extracted_board/3458764517494401517.png', title: 'Stitch - Design with AI', description: 'Stitch generates UIs for mobile and web applications, mixing design intention fast and easy.' },
    { match: (u, t) => u.includes('hologram-particles'), src: '../extracted_board/3458764517967499097.png', title: 'GitHub - cortiz2894/hologram-particles', description: 'A webgl/three.js hologram particle effect built with Three.js/WebGL, Noise Shaders, and WebGL. This repository is a free open-source resource for...' },
    { match: (u, t) => u.includes('websitevice') || t.includes('websitevice'), src: '../extracted_board/3458764517478105021.jpg' },
    { match: (u, t) => u.includes('developer-portfolios'), src: '../extracted_board/3458764517991228105.png' },
    { match: (u, t) => u.includes('awwwards') || t.includes('awwwards'), src: '../extracted_board/3458764517873211164.jpg' },
    { match: (u, t) => u.includes('stevenolver') || t.includes('stevenolver'), src: '../extracted_board/3458764517873211164.jpg' },
    { match: (u, t) => u.includes('tradingview.com/lightweight-charts') || t.includes('lightweight charts'), src: '../extracted_board/3458764517478079397.jpg' },
    { match: (u, t) => u.includes('pexels.com') || t.includes('pexels'), src: '../extracted_board/3458764517966736743.jpg' },
    { match: (u, t) => u.includes('tweakcn.com') || t.includes('tweakcn'), src: '../extracted_board/3458764517540044281.png' },
    { match: (u, t) => u.includes('tailframes.com') || t.includes('tailframes'), src: '../extracted_board/3458764517480618703.jpg' },
    { match: (u, t) => u.includes('100vibecoding'), src: '../extracted_board/3458764517478108959.png' },
    { match: (u, t) => u.includes('midudev/jscamp'), src: '../extracted_board/3458764517485645384.jpg' },
    { match: (u, t) => u.includes('shotdeck.com') || t.includes('shotdeck'), src: '../extracted_board/3458764517966720474.jpg' },
    { match: (u, t) => u.includes('michaeltanzillo'), src: '../extracted_board/3458764517991339081.png' },
    { match: (u, t) => u.includes('hashgraphvc'), src: '../extracted_board/3458764517991203410.png' },
    { match: (u, t) => u.includes('devdocs.io') || t.includes('devdocs'), src: '../extracted_board/3458764517478090111.png' },
    { match: (u, t) => u.includes('database.build') || t.includes('database'), src: '../extracted_board/3458764517477378523.png' },
    { match: (u, t) => u.includes('codecademy.com'), src: '../extracted_board/3458764516866751278.png' },
    { match: (u, t) => u.includes('top-100-comfyui'), src: '../extracted_board/3458764517940451934.png' },
    { match: (u, t) => u.includes('flux-lora-portrait-trainer'), src: '../extracted_board/3458764518239369352.png' },
    { match: (u, t) => u.includes('learngitbranching'), src: '../extracted_board/3458764517478046803.png' },
    { match: (u, t) => u.includes('openmodeldb'), src: '../extracted_board/3458764517503661529.png' }
  ];

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

        let description = it.description || '';

        // Resolucion determinista y fidedigna contra recursos extraidos de Miro (.RTB)
        let matched = false;
        for (const rule of embedSanitizeRules) {
          if (rule.match(uLower, tLower)) {
            src = rule.src;
            if (rule.title) title = rule.title;
            if (rule.description) description = rule.description;
            matched = true;
            break;
          }
        }

        if (!matched && !src && it.previewUrl) {
          const m = resEntries.find(re => it.previewUrl.includes(re.name) || (re.filename && it.previewUrl.includes(re.filename)));
          if (m) src = m.localPath;
        } else if (!matched && !src && uStr.includes('youtube.com')) {
          const yt = resEntries.find(re => re.filename && (re.filename.includes('=s900') || re.filename.includes('default.jpg') || (re.name && re.name.includes('default.jpg'))));
          if (yt) src = yt.localPath;
        }

        if (!matched && src && (src.includes('3458764518028914135.png') || src.includes('3458764517918099491.png'))) {
          src = '';
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
          src: src || '',
          description
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
          const boardName = data.name || file.name.replace(/\.[^/.]+$/, "");
          const boardId = data.id || ('board_' + Date.now());

          if (Array.isArray(workspaceBoards)) {
            let existing = workspaceBoards.find(b => b.id === boardId || b.title.toLowerCase() === boardName.toLowerCase());
            if (!existing) {
              existing = { id: boardId, title: boardName, icon: '📋', active: true };
              workspaceBoards.push(existing);
            }
            workspaceBoards.forEach(b => b.active = (b.id === existing.id));
            currentActiveBoardId = existing.id;
            if (typeof saveWorkspaceBoards === 'function') saveWorkspaceBoards();
          } else {
            currentActiveBoardId = boardId;
          }

          localStorage.setItem('miro_active_board_id', currentActiveBoardId);
          engine.saveSnapshot();
          engine.items = convertMiroToBrainBoard(data);
          engine.selectedItemIds.clear();
          boardTitleInput.value = boardName;
          fitBoardTitleWidth();
          engine.fitView();
          if (typeof renderDrawerBoards === 'function') renderDrawerBoards();
          boardControllerDrawer?.classList.remove('open');
          if (typeof autoSaveBoardImmediately === 'function') {
            autoSaveBoardImmediately(currentActiveBoardId);
          } else {
            autoSaveBoard();
          }
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
    // Si el nuevo elemento enfocado es parte de la barra de propiedades, un popover o el modal de color, no cerrar
    if (e.relatedTarget && (propertiesBar?.contains(e.relatedTarget) || textColorPopover?.contains(e.relatedTarget) || fillColorPopover?.contains(e.relatedTarget) || psColorPickerModal?.contains(e.relatedTarget))) {
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

  async function idbDeleteBoard(boardId) {
    try {
      const db = await openDatabase();
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.delete(`board_${boardId}`);
      if (typeof boardId === 'string' && boardId.startsWith('board_')) {
        store.delete(boardId);
      }
      return new Promise((resolve) => {
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch (e) {
      return false;
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

    if (saveStatusText) saveStatusText.innerText = 'Guardado';
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
    fitBoardTitleWidth();
    if (Array.isArray(workspaceBoards)) {
      const currentMeta = workspaceBoards.find(b => b.id === currentActiveBoardId);
      if (currentMeta && boardTitleInput.value.trim()) {
        currentMeta.title = boardTitleInput.value.trim();
        if (typeof saveWorkspaceBoards === 'function') saveWorkspaceBoards();
        if (typeof renderDrawerBoards === 'function') renderDrawerBoards();
        if (typeof renderTabs === 'function') renderTabs();
      }
    }
    autoSaveBoard();
  });
  boardTitleInput?.addEventListener('change', fitBoardTitleWidth);
  boardTitleInput?.addEventListener('keyup', fitBoardTitleWidth);

  // Cargar mapa de recursos locales extraídos del .RTB
  fetch('whiteboard/resources_map.json')
    .then(r => r.json())
    .then(m => { window.__resourcesMap = m; })
    .catch(() => {});

  // Corrección y saneamiento proactivo de recursos de enlaces
  function sanitizeEmbedResources(items) {
    if (!Array.isArray(items)) return;
    items.forEach(it => {
      if (it.type === 'embed' || it.type === 'preview') {
        const u = (it.url || '').toLowerCase();
        const t = (it.title || '').toLowerCase();
        let matched = false;
        for (const rule of embedSanitizeRules) {
          if (rule.match(u, t)) {
            if (it.src !== rule.src) it.src = rule.src;
            if (rule.title && it.title !== rule.title) it.title = rule.title;
            if (rule.description && it.description !== rule.description) it.description = rule.description;
            matched = true;
            break;
          }
        }
        if (!matched && it.src && (it.src.includes('3458764518028914135.png') || it.src.includes('3458764517918099491.png'))) {
          it.src = '';
        }
      }
    });
  }

  // Carga inicial resiliente
  async function loadInitialBoard() {
    currentActiveBoardId = localStorage.getItem('miro_active_board_id') || 'dev_ai';
    workspaceBoards.forEach(b => b.active = (b.id === currentActiveBoardId));
    renderDrawerBoards();
    if (typeof renderTabs === 'function') renderTabs();

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
      fitBoardTitleWidth();
      engine.fitView();
      if (saveStatusText) saveStatusText.innerText = 'Guardado';
      return;
    }

    if (currentActiveBoardId === 'dev_ai') {
      try {
        const res = await fetch('../boards/DEV_AI.json');
        if (res.ok) {
          const board = await res.json();
          engine.items = (board.items && Array.isArray(board.items)) ? board.items : convertMiroToBrainBoard(board);
          boardTitleInput.value = board.name || 'DEV / AI';
          fitBoardTitleWidth();
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
  const menuOptSave = document.getElementById('menu-opt-save');
  const menuOptExportHires = document.getElementById('menu-opt-export-hires');
  const menuOptResetZoom = document.getElementById('menu-opt-reset-zoom');
  const menuOptClear = document.getElementById('menu-opt-clear');

  function loadWorkspaceBoards() {
    try {
      const stored = localStorage.getItem('miro_workspace_boards');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [
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
  }

  function saveWorkspaceBoards() {
    try {
      localStorage.setItem('miro_workspace_boards', JSON.stringify(workspaceBoards));
    } catch (e) {}
  }

  const workspaceBoards = loadWorkspaceBoards();
  window.workspaceBoards = workspaceBoards;

  // --- Sistema de Pestañas estilo Miro Desktop ---
  const tabsList = document.getElementById('tabs-list');
  const btnTabNew = document.getElementById('btn-tab-new');

  function loadOpenTabs() {
    try {
      const data = localStorage.getItem('miro_open_tabs');
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {}
    return ['dev_ai'];
  }

  let openTabs = loadOpenTabs();
  window.openTabs = openTabs;

  function saveOpenTabs() {
    try {
      localStorage.setItem('miro_open_tabs', JSON.stringify(openTabs));
    } catch (e) {}
  }
  window.saveOpenTabs = saveOpenTabs;

  function renderTabs() {
    if (!tabsList) return;
    tabsList.innerHTML = '';

    if (!Array.isArray(openTabs) || openTabs.length === 0) {
      openTabs = [currentActiveBoardId || 'dev_ai'];
      saveOpenTabs();
    }

    if (currentActiveBoardId && !openTabs.includes(currentActiveBoardId)) {
      openTabs.push(currentActiveBoardId);
      saveOpenTabs();
    }

    openTabs.forEach(boardId => {
      const bMeta = workspaceBoards.find(b => b.id === boardId);
      const title = bMeta?.title || (boardId === 'dev_ai' ? 'DEV / AI' : 'Tablero');
      const icon = bMeta?.icon || (boardId === 'dev_ai' ? '🧠' : '📋');
      const isActive = (boardId === currentActiveBoardId);

      const tabEl = document.createElement('div');
      tabEl.className = 'tab-item' + (isActive ? ' active' : '');
      tabEl.setAttribute('data-board-id', boardId);
      tabEl.title = title;

      tabEl.innerHTML = `
        <span class="tab-icon">${icon}</span>
        <span class="tab-title">${title}</span>
        ${openTabs.length > 1 ? '<button class="tab-close-btn" title="Cerrar pestaña">✕</button>' : ''}
      `;

      tabEl.addEventListener('click', (e) => {
        if (e.target.closest('.tab-close-btn')) return;
        if (currentActiveBoardId !== boardId) {
          switchBoard(boardId);
        }
      });

      const closeBtn = tabEl.querySelector('.tab-close-btn');
      if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          closeBoardTab(boardId);
        });
      }

      tabsList.appendChild(tabEl);
    });
  }
  window.renderTabs = renderTabs;

  function openBoardTab(boardId) {
    if (!openTabs.includes(boardId)) {
      openTabs.push(boardId);
      saveOpenTabs();
    }
    switchBoard(boardId);
  }
  window.openBoardTab = openBoardTab;

  async function closeBoardTab(boardId) {
    if (openTabs.length <= 1) return;
    const idx = openTabs.indexOf(boardId);
    if (idx === -1) return;

    openTabs.splice(idx, 1);
    saveOpenTabs();

    if (currentActiveBoardId === boardId) {
      const nextId = openTabs[Math.max(0, idx - 1)] || openTabs[0];
      await switchBoard(nextId);
    } else {
      renderTabs();
    }
  }
  window.closeBoardTab = closeBoardTab;

  btnTabNew?.addEventListener('click', (e) => {
    e.stopPropagation();
    const nb = createNewBoard();
    if (nb && nb.id) {
      if (!openTabs.includes(nb.id)) {
        openTabs.push(nb.id);
        saveOpenTabs();
      }
      renderTabs();
    }
  });

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
    fitBoardTitleWidth();

    if (!openTabs.includes(targetBoardId)) {
      openTabs.push(targetBoardId);
      saveOpenTabs();
    }
    renderTabs();
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
      fitBoardTitleWidth();
      engine.fitView();
      if (saveStatusText) saveStatusText.innerText = 'Guardado';
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
          fitBoardTitleWidth();
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

  // Crear nuevo tablero en la sección de TABLEROS
  function createNewBoard(customName) {
    // 1. Guardar de forma inmediata el tablero actual antes de salir de él
    if (activeEditingItem) closeInlineEditor();
    if (currentActiveBoardId) {
      autoSaveBoardImmediately(currentActiveBoardId);
    }

    // 2. Generar nombre de tablero limpio y único
    let name = customName;
    if (!name || typeof name !== 'string' || !name.trim()) {
      const baseName = 'Tablero Nuevo';
      let candidate = baseName;
      let counter = 1;
      while (workspaceBoards && workspaceBoards.some(b => b.title.trim().toLowerCase() === candidate.toLowerCase())) {
        counter++;
        candidate = `${baseName} ${counter}`;
      }
      name = candidate;
    } else {
      name = name.trim();
    }

    // 3. Crear identificador único para el tablero
    const newBoardId = 'board_' + Date.now();
    const newBoard = { id: newBoardId, title: name, icon: '📋', active: true };

    // 4. Marcar inactivos los demás y añadir a la lista del espacio de trabajo
    if (Array.isArray(workspaceBoards)) {
      workspaceBoards.forEach(b => b.active = false);
      workspaceBoards.push(newBoard);
      saveWorkspaceBoards();
    }

    if (!openTabs.includes(newBoardId)) {
      openTabs.push(newBoardId);
      saveOpenTabs();
    }

    // 5. Establecer como activo
    currentActiveBoardId = newBoardId;
    localStorage.setItem('miro_active_board_id', currentActiveBoardId);

    // 6. Actualizar campo de título en la barra superior
    if (boardTitleInput) {
      boardTitleInput.value = name;
      fitBoardTitleWidth();
    }

    // 7. Limpiar lienzo para el nuevo tablero
    engine.saveSnapshot();
    engine.items = [];
    engine.selectedItemIds.clear();
    engine.fitView();

    // 8. Renderizar de inmediato en la sección de TABLEROS del panel y en pestañas
    renderDrawerBoards();
    renderTabs();

    // 9. Guardar inmediatamente el estado inicial en IndexedDB y LocalStorage
    autoSaveBoardImmediately(newBoardId);

    // 10. Mantener el panel abierto y hacer scroll suave al nuevo tablero creado
    setTimeout(() => {
      const activeEl = drawerBoardsList?.querySelector('.drawer-board-item.active');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 40);

    return newBoard;
  }
  window.createNewBoard = createNewBoard;

  // Control del modal de seguridad para confirmación de eliminación de tablero
  let boardPendingDeletion = null;
  const deleteBoardModal = document.getElementById('delete-board-modal');
  const deleteBoardModalMsg = document.getElementById('delete-board-modal-msg');
  const btnCloseDeleteModal = document.getElementById('btn-close-delete-modal');
  const btnCancelDeleteBoard = document.getElementById('btn-cancel-delete-board');
  const btnConfirmDeleteBoard = document.getElementById('btn-confirm-delete-board');

  function openDeleteBoardModal(boardId) {
    if (boardId === 'dev_ai' || boardId === 'recursos') return;
    const b = workspaceBoards.find(it => it.id === boardId);
    if (!b) return;

    boardPendingDeletion = boardId;
    if (deleteBoardModalMsg) {
      deleteBoardModalMsg.innerHTML = `¿Estás seguro de que deseas eliminar el tablero <strong>"${b.title}"</strong>?<br><br>Esta acción no se puede deshacer y se perderán todos los cambios guardados.`;
    }
    if (deleteBoardModal) {
      deleteBoardModal.style.display = 'flex';
    }
  }

  function closeDeleteBoardModal() {
    boardPendingDeletion = null;
    if (deleteBoardModal) {
      deleteBoardModal.style.display = 'none';
    }
  }

  async function executeDeleteBoard() {
    if (!boardPendingDeletion) return;
    const boardId = boardPendingDeletion;
    closeDeleteBoardModal();
    await deleteBoard(boardId);
  }

  btnCloseDeleteModal?.addEventListener('click', closeDeleteBoardModal);
  btnCancelDeleteBoard?.addEventListener('click', closeDeleteBoardModal);
  btnConfirmDeleteBoard?.addEventListener('click', executeDeleteBoard);
  deleteBoardModal?.addEventListener('click', (e) => {
    if (e.target === deleteBoardModal) closeDeleteBoardModal();
  });

  window.addEventListener('keydown', (e) => {
    if (deleteBoardModal && deleteBoardModal.style.display === 'flex') {
      if (e.key === 'Escape') {
        closeDeleteBoardModal();
      } else if (e.key === 'Enter') {
        executeDeleteBoard();
      }
    }
  });

  async function deleteBoard(boardId) {
    if (boardId === 'dev_ai' || boardId === 'recursos') return;
    const idx = workspaceBoards.findIndex(b => b.id === boardId);
    if (idx === -1) return;

    workspaceBoards.splice(idx, 1);
    saveWorkspaceBoards();

    if (openTabs.includes(boardId)) {
      const oIdx = openTabs.indexOf(boardId);
      openTabs.splice(oIdx, 1);
      if (openTabs.length === 0) openTabs = ['dev_ai'];
      saveOpenTabs();
    }
    renderTabs();

    try {
      localStorage.removeItem(`miro_board_${boardId}`);
      await idbDeleteBoard(boardId);
    } catch (e) {}

    if (currentActiveBoardId === boardId) {
      await switchBoard(openTabs[0] || 'dev_ai');
    } else {
      renderDrawerBoards(inputDrawerSearch ? inputDrawerSearch.value : '');
    }
  }

  function renderDrawerBoards(filter = '') {
    if (!drawerBoardsList) return;
    drawerBoardsList.innerHTML = '';
    const filtered = workspaceBoards.filter(b => b.title.toLowerCase().includes(filter.toLowerCase()));
    filtered.forEach(board => {
      const item = document.createElement('div');
      item.className = 'drawer-board-item' + (board.active ? ' active' : '');
      const canDelete = board.id !== 'dev_ai' && board.id !== 'recursos';
      item.innerHTML = `
        <div class="drawer-board-icon">${board.icon || '📋'}</div>
        <span class="drawer-board-title" title="${board.title}">${board.title}</span>
        ${canDelete ? `
          <button class="drawer-board-delete-btn" title="Eliminar tablero" data-id="${board.id}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        ` : ''}
      `;
      item.addEventListener('click', (e) => {
        if (e.target.closest('.drawer-board-delete-btn')) return;
        boardControllerDrawer?.classList.remove('open');
        openBoardTab(board.id);
      });
      const delBtn = item.querySelector('.drawer-board-delete-btn');
      if (delBtn) {
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openDeleteBoardModal(board.id);
        });
      }
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
    if (drawerCalloutBox) drawerCalloutBox.style.display = 'none';
  });

  // Crear nuevo tablero desde el cajón (+)
  btnDrawerNewBoard?.addEventListener('click', (e) => {
    e.stopPropagation();
    createNewBoard();
  });

  document.getElementById('btn-section-new-board')?.addEventListener('click', (e) => {
    e.stopPropagation();
    createNewBoard();
  });

  // Clic en el logo de Brain Board abre/cierra el drawer lateral
  document.querySelector('.brainboard-logo-brand')?.addEventListener('click', () => {
    boardControllerDrawer?.classList.toggle('open');
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
    fitBoardTitleWidth();
  });
  menuOptSave?.addEventListener('click', () => {
    boardOptionsMenu?.classList.remove('visible');
    saveBoardToFile();
  });
  menuOptExportHires?.addEventListener('click', () => {
    boardOptionsMenu?.classList.remove('visible');
    openExportModal();
  });
  menuOptResetZoom?.addEventListener('click', () => {
    boardOptionsMenu?.classList.remove('visible');
    engine.fitView();
  });
  menuOptClear?.addEventListener('click', () => {
    boardOptionsMenu?.classList.remove('visible');
    if (confirm('¿Limpiar todo el contenido del tablero actual?')) {
      engine.saveSnapshot();
      engine.items = [];
      engine.selectedItemIds.clear();
      engine.fitView();
      autoSaveBoardImmediately();
    }
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
    fitBoardTitleWidth();
  });
});
