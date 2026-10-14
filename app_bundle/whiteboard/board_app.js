// Controlador principal de la Pizarra Brain Board
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

  // Elementos de la barra flotante de herramientas
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
  const btnPropUrl = document.getElementById('btn-prop-url');
  const floatingItemUrlBadge = document.getElementById('floating-item-url-badge');
  const btnOpenFloatingUrl = document.getElementById('btn-open-floating-url');
  const floatingUrlDisplayText = document.getElementById('floating-url-display-text');
  const modalEditUrl = document.getElementById('modal-edit-url');
  const urlModalTitle = document.getElementById('url-modal-title');
  const inputItemUrl = document.getElementById('input-item-url');
  const btnRemoveUrl = document.getElementById('btn-remove-url');
  const btnCancelUrl = document.getElementById('btn-cancel-url');
  const btnSaveUrl = document.getElementById('btn-save-url');
  const btnCloseUrlModal = document.getElementById('btn-close-url-modal');
  let itemPendingUrlEdit = null;

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
  const psPickerBtnEyedropper = document.getElementById('ps-picker-btn-eyedropper');

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

  // Función para activar el Cuentagotas (Soporte multipantalla completo)
  async function activateEyedropper() {
    try {
      if (psPickerBtnEyedropper) psPickerBtnEyedropper.classList.add('active');

      // Ocultar completamente la ventana del selector para que el tablero se vea 100% limpio y no bloquee clics
      if (psColorPickerModal) psColorPickerModal.style.display = 'none';

      // Esperar un frame para asegurar que el renderizador oculte el modal antes de la foto de pantalla
      await new Promise(r => setTimeout(r, 60));

      let pickedHex = null;

      // 1. Usar el capturador multipantalla nativo de Electron si está disponible
      const bridgeApi = window.brainBoard || window.miro;
      if (bridgeApi && typeof bridgeApi.pickScreenColor === 'function') {
        pickedHex = await bridgeApi.pickScreenColor();
      } else if (window.EyeDropper) {
        // Fallback a la API de Chromium si no estuviera disponible el puente
        const eyeDropper = new window.EyeDropper();
        const result = await eyeDropper.open();
        if (result && result.sRGBHex) {
          pickedHex = result.sRGBHex;
        }
      } else {
        alert('La herramienta Cuentagotas no está disponible en este entorno.');
        return;
      }

      if (pickedHex) {
        pickedHex = pickedHex.toUpperCase();
        pickerState.currentHex = pickedHex;
        const [r, g, b] = parseColorToRgb(pickedHex);
        const [h, s, v] = rgbToHsv(r, g, b);
        pickerState.h = h;
        pickerState.s = s;
        pickerState.v = v;
        updatePickerUI(true, true, true);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('Error al usar el cuentagotas:', err);
      }
    } finally {
      if (psColorPickerModal) {
        psColorPickerModal.style.display = 'flex';
        psColorPickerModal.style.visibility = '';
      }
      if (psPickerBtnEyedropper) psPickerBtnEyedropper.classList.remove('active');
    }
  }

  // Listener para el botón Cuentagotas
  psPickerBtnEyedropper?.addEventListener('click', (e) => {
    e.stopPropagation();
    activateEyedropper();
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

  // Cerrar con Escape o activar cuentagotas con 'I' cuando el modal está abierto
  window.addEventListener('keydown', (e) => {
    if (psColorPickerModal && psColorPickerModal.style.display !== 'none') {
      if (e.key === 'Escape') {
        closePhotoshopColorPicker();
      } else if ((e.key === 'i' || e.key === 'I') && document.activeElement !== psPickerHexInput) {
        e.preventDefault();
        activateEyedropper();
      }
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
      groupFillColor.style.display = (first.type === 'image' || first.type === 'pen' || first.type === 'connector') ? 'none' : 'flex';
    }

    // Control de opción Añadir / Editar URL
    const isImage = (first.type === 'image');
    const canHaveUrl = (first.type === 'text' || first.type === 'sticky_note' || first.type === 'image' || first.type === 'shape');

    if (btnPropUrl) {
      btnPropUrl.style.display = canHaveUrl ? 'inline-flex' : 'none';
      const itemUrl = extractUrlFromItem(first);
      const hasUrl = Boolean(itemUrl);
      btnPropUrl.classList.toggle('active', hasUrl);
      btnPropUrl.title = hasUrl ? `Editar URL (${itemUrl})` : 'Añadir URL';
    }

    // Adaptar la barra flotante si el elemento seleccionado es una imagen
    const fontFamGroup = propertiesBar?.querySelector('.font-family-group');
    const fontSizeGroup = propertiesBar?.querySelector('.font-size-group');
    const textStyleGroup = propertiesBar?.querySelector('.text-style-group');
    const alignGroup = propertiesBar?.querySelector('.align-group');
    const textColorGroup = propertiesBar?.querySelector('.color-dropdown-group');

    if (fontFamGroup) fontFamGroup.style.display = isImage ? 'none' : 'flex';
    if (fontSizeGroup) fontSizeGroup.style.display = isImage ? 'none' : 'flex';
    if (textStyleGroup) textStyleGroup.style.display = isImage ? 'none' : 'flex';
    if (alignGroup) alignGroup.style.display = isImage ? 'none' : 'flex';
    if (textColorGroup) textColorGroup.style.display = isImage ? 'none' : 'flex';

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
    updateFloatingUrlBadge();
  };

  engine.onCameraChange = () => {
    if (propertiesBar?.classList.contains('visible')) {
      updatePropertiesBarPosition();
    }
    if (inlineEditor.style.display !== 'none') {
      updateInlineEditorPosition();
    }
    if (floatingItemUrlBadge && floatingItemUrlBadge.style.display !== 'none') {
      updateFloatingUrlBadge();
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
  document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
    engine.zoomAt(window.innerWidth / 2, window.innerHeight / 2, 1.25);
  });
  document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
    engine.zoomAt(window.innerWidth / 2, window.innerHeight / 2, 0.8);
  });
  document.getElementById('btn-zoom-fit')?.addEventListener('click', () => {
    engine.fitView();
  });

  // Botones de propiedades
  document.getElementById('btn-prop-duplicate')?.addEventListener('click', () => {
    duplicateSelectedItems();
  });
  document.getElementById('btn-prop-delete')?.addEventListener('click', () => {
    engine.deleteSelected();
  });

  // =========================================================
  // GESTIÓN DE ENLACES Y BOTÓN FLOTANTE AL LADO DEL ELEMENTO
  // =========================================================

  // Extractor universal de URL desde cualquier elemento (propiedad directa, texto multilínea, dominios, etc.)
  function extractUrlFromItem(it) {
    if (!it) return null;
    if (it.url === '') return null; // Eliminado explícitamente por el usuario
    if (it.url && typeof it.url === 'string' && it.url.trim()) {
      let u = it.url.trim();
      if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
      return u;
    }
    const rawText = typeof it.text === 'string' ? it.text : (typeof it.title === 'string' ? it.title : '');
    if (!rawText) return null;

    const httpMatch = rawText.match(/https?:\/\/[^\s<>"'\)\]]+/i);
    if (httpMatch) return httpMatch[0].replace(/[.,;:)]+$/, '');

    const wwwMatch = rawText.match(/(?:^|\s)(www\.[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+(?:\/[^\s<>"'\)\]]*)?)/i);
    if (wwwMatch) return 'https://' + wwwMatch[1].replace(/[.,;:)]+$/, '');

    const domainOnly = rawText.trim().match(/^([a-zA-Z0-9-]+\.(?:com|org|io|dev|app|net|co|ai|tools|es|xyz|me|tv|gl|sh|build|info)(?:\/[^\s]*)?)$/i);
    if (domainOnly) return 'https://' + domainOnly[1].replace(/[.,;:)]+$/, '');

    const enlaceMatch = rawText.match(/(?:enlace|link|web|url)\s*:\s*([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+(?:\/[^\s<>"'\)\]]*)?)/i);
    if (enlaceMatch) {
      let clean = enlaceMatch[1].replace(/[.,;:)]+$/, '');
      if (!/^https?:\/\//i.test(clean)) clean = 'https://' + clean;
      return clean;
    }
    return null;
  }
  window.extractUrlFromItem = extractUrlFromItem;

  // Helper para abrir enlaces externos de forma segura
  function openExternalUrl(rawUrl) {
    if (!rawUrl) return;
    let url = rawUrl.trim();
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    try {
      const req = window.require || (typeof require !== 'undefined' ? require : null);
      if (req) {
        const { shell } = req('electron');
        if (shell && shell.openExternal) {
          shell.openExternal(url);
          return;
        }
      }
    } catch (e) {}
    window.open(url, '_blank');
  }

  // Actualizar visibilidad y posición del botoncito flotante al lado del elemento seleccionado
  function updateFloatingUrlBadge() {
    if (!floatingItemUrlBadge) return;
    if (engine.selectedItemIds.size !== 1) {
      floatingItemUrlBadge.style.display = 'none';
      return;
    }

    const selId = Array.from(engine.selectedItemIds)[0];
    const item = engine.items.find(i => i.id === selId);
    if (!item) {
      floatingItemUrlBadge.style.display = 'none';
      return;
    }

    const itemUrl = extractUrlFromItem(item);
    if (!itemUrl) {
      floatingItemUrlBadge.style.display = 'none';
      return;
    }

    let displayText = 'Ir al enlace';
    try {
      const u = new URL(/^https?:\/\//i.test(itemUrl) ? itemUrl : 'https://' + itemUrl);
      displayText = u.hostname.replace(/^www\./, '') + ' ↗';
    } catch (e) {
      displayText = 'Abrir enlace ↗';
    }

    if (floatingUrlDisplayText) floatingUrlDisplayText.textContent = displayText;
    if (btnOpenFloatingUrl) btnOpenFloatingUrl.title = `Abrir ${itemUrl} en el navegador`;

    floatingItemUrlBadge.style.display = 'flex';

    // Coordenadas en pantalla calculadas con la cámara del motor
    const topLeft = engine.worldToScreen(item.x, item.y);
    const itemW = (item.width || 100) * engine.camera.zoom;
    const itemH = (item.height || 40) * engine.camera.zoom;
    const badgeW = floatingItemUrlBadge.offsetWidth || 130;
    const badgeH = floatingItemUrlBadge.offsetHeight || 32;

    // Posicionar el botoncito al lado derecho del elemento seleccionado
    let left = topLeft.x + itemW + 8;
    let top = topLeft.y;

    // Si se sale de la pantalla por la derecha, posicionar a la izquierda o arriba
    if (left + badgeW > window.innerWidth - 12) {
      left = topLeft.x - badgeW - 8;
      if (left < 12) {
        left = topLeft.x;
        top = topLeft.y - badgeH - 8;
      }
    }
    if (top < 65) top = 65;
    if (top + badgeH > window.innerHeight - 12) top = window.innerHeight - badgeH - 12;

    floatingItemUrlBadge.style.left = `${left}px`;
    floatingItemUrlBadge.style.top = `${top}px`;
  }
  window.updateFloatingUrlBadge = updateFloatingUrlBadge;

  // Clic en el botón flotante abre el enlace
  btnOpenFloatingUrl?.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (engine.selectedItemIds.size !== 1) return;
    const selId = Array.from(engine.selectedItemIds)[0];
    const item = engine.items.find(i => i.id === selId);
    const itemUrl = extractUrlFromItem(item);
    if (itemUrl) {
      openExternalUrl(itemUrl);
    }
  });

  floatingItemUrlBadge?.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (engine.selectedItemIds.size !== 1) return;
    const selId = Array.from(engine.selectedItemIds)[0];
    const item = engine.items.find(i => i.id === selId);
    const itemUrl = extractUrlFromItem(item);
    if (itemUrl) {
      openExternalUrl(itemUrl);
    }
  });

  // Modal para añadir / editar URL
  function openUrlModal(item) {
    if (!item) {
      item = activeEditingItem || engine.items.find(i => engine.selectedItemIds.has(i.id));
      if (!item) return;
    }
    if (activeEditingItem) {
      closeInlineEditor();
    }
    itemPendingUrlEdit = item;
    const currentUrl = (item.url && typeof item.url === 'string') ? item.url.trim() : (extractUrlFromItem(item) || '');
    if (inputItemUrl) {
      inputItemUrl.value = currentUrl;
    }
    if (urlModalTitle) {
      urlModalTitle.textContent = currentUrl ? 'Editar URL' : 'Añadir URL';
    }
    if (btnRemoveUrl) {
      btnRemoveUrl.style.display = currentUrl ? 'inline-block' : 'none';
    }
    if (modalEditUrl) {
      modalEditUrl.style.display = 'flex';
      setTimeout(() => {
        if (inputItemUrl) {
          inputItemUrl.focus();
          inputItemUrl.select();
        }
      }, 50);
    }
  }

  function closeUrlModal() {
    itemPendingUrlEdit = null;
    if (modalEditUrl) modalEditUrl.style.display = 'none';
  }

  function saveUrlFromModal() {
    if (!itemPendingUrlEdit) return;
    let urlVal = inputItemUrl ? inputItemUrl.value.trim() : '';
    if (urlVal && !/^https?:\/\//i.test(urlVal)) {
      urlVal = 'https://' + urlVal;
    }
    engine.saveSnapshot();
    if (urlVal) {
      itemPendingUrlEdit.url = urlVal;
    } else {
      itemPendingUrlEdit.url = '';
    }
    const targetItem = itemPendingUrlEdit;
    closeUrlModal();
    if (targetItem && !engine.selectedItemIds.has(targetItem.id)) {
      engine.selectedItemIds.clear();
      engine.selectedItemIds.add(targetItem.id);
    }
    engine.render();
    updateFloatingUrlBadge();
    syncPropertiesBarWithSelection();
    if (window.autoSaveBoardImmediately) {
      autoSaveBoardImmediately();
    } else {
      autoSaveBoard();
    }
  }

  function removeUrlFromModal() {
    if (!itemPendingUrlEdit) return;
    engine.saveSnapshot();
    itemPendingUrlEdit.url = '';
    const targetItem = itemPendingUrlEdit;
    closeUrlModal();
    if (targetItem && !engine.selectedItemIds.has(targetItem.id)) {
      engine.selectedItemIds.clear();
      engine.selectedItemIds.add(targetItem.id);
    }
    engine.render();
    updateFloatingUrlBadge();
    syncPropertiesBarWithSelection();
    if (window.autoSaveBoardImmediately) {
      autoSaveBoardImmediately();
    } else {
      autoSaveBoard();
    }
  }

  btnPropUrl?.addEventListener('click', (e) => {
    e.stopPropagation();
    const it = activeEditingItem || engine.items.find(i => engine.selectedItemIds.has(i.id));
    if (it) openUrlModal(it);
  });

  btnSaveUrl?.addEventListener('click', saveUrlFromModal);
  btnRemoveUrl?.addEventListener('click', removeUrlFromModal);
  btnCancelUrl?.addEventListener('click', closeUrlModal);
  btnCloseUrlModal?.addEventListener('click', closeUrlModal);
  modalEditUrl?.addEventListener('click', (e) => {
    if (e.target === modalEditUrl) closeUrlModal();
  });
  inputItemUrl?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveUrlFromModal();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeUrlModal();
    }
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

    const boardsToExport = Array.isArray(workspaceBoards) ? workspaceBoards : [];
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
            const ls = localStorage.getItem(`brainboard_board_${b.id}`) || localStorage.getItem(`miro_board_${b.id}`) || (b.id === 'dev_ai' ? (localStorage.getItem('brainboard_local_current_board_v3') || localStorage.getItem('miro_local_current_board_v3')) : null);
            if (ls) data = JSON.parse(ls);
          } catch (e) {}
        }
        if (!data || !Array.isArray(data.items) || data.items.length === 0) {
          const seed = await fetchBoardSeedData(b.id);
          if (seed) data = seed;
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

  // Convertidor inteligente de elementos importados a Brain Board
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

        // Resolucion determinista y fidedigna contra recursos extraidos (.RTB)
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

          localStorage.setItem('brainboard_active_board_id', currentActiveBoardId);
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

  // =========================================================
  // NOTIFICACIONES TOAST (Sistema global para operaciones)
  // =========================================================
  let devToastTimer = null;
  function showDevToast(msg) {
    let toast = document.getElementById('dev-toast-notification');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'dev-toast-notification';
      toast.className = 'dev-toast-notification';
      document.body.appendChild(toast);
    }
    toast.innerText = msg;
    toast.classList.add('visible');
    clearTimeout(devToastTimer);
    devToastTimer = setTimeout(() => {
      toast.classList.remove('visible');
    }, 2400);
  }

  // =========================================================
  // SISTEMA PROFESIONAL DE COPIAR Y PEGAR (TIPO MIRO)
  // Soporte entre tableros, grupos, conectores, marcos y multimedia
  // =========================================================

  let pasteCascadeCount = 0;
  let lastPasteTargetWorld = null;
  let currentMouseScreen = null;
  let isPasting = false;

  window.addEventListener('pointermove', (e) => {
    currentMouseScreen = { x: e.clientX, y: e.clientY };
  }, { passive: true });

  function computeItemBounds(it) {
    if (!it) return { minX: 0, minY: 0, maxX: 100, maxY: 100, width: 100, height: 100, centerX: 50, centerY: 50 };

    if (it.type === 'connector') {
      const xs = [];
      const ys = [];
      if (it.start && Number.isFinite(it.start.x) && Number.isFinite(it.start.y)) {
        xs.push(it.start.x);
        ys.push(it.start.y);
      }
      if (it.end && Number.isFinite(it.end.x) && Number.isFinite(it.end.y)) {
        xs.push(it.end.x);
        ys.push(it.end.y);
      }
      if (Array.isArray(it.controlPoints)) {
        it.controlPoints.forEach(p => {
          if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) {
            xs.push(p.x);
            ys.push(p.y);
          }
        });
      }
      if (xs.length === 0) return { minX: 0, minY: 0, maxX: 100, maxY: 100, width: 100, height: 100, centerX: 50, centerY: 50 };
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      return { minX, minY, maxX, maxY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY), centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2 };
    }

    if (it.type === 'pen' && Array.isArray(it.points) && it.points.length > 0) {
      const xs = it.points.map(p => p.x).filter(Number.isFinite);
      const ys = it.points.map(p => p.y).filter(Number.isFinite);
      if (xs.length > 0) {
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        return { minX, minY, maxX, maxY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY), centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2 };
      }
    }

    const x = Number.isFinite(it.x) ? it.x : 0;
    const y = Number.isFinite(it.y) ? it.y : 0;
    const w = Number.isFinite(it.width) ? it.width : (it.type === 'text' ? 120 : 100);
    const h = Number.isFinite(it.height) ? it.height : (it.type === 'text' ? 40 : 100);
    return {
      minX: x,
      minY: y,
      maxX: x + w,
      maxY: y + h,
      width: w,
      height: h,
      centerX: x + w / 2,
      centerY: y + h / 2
    };
  }

  function computeItemsBounds(items) {
    if (!items || items.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    items.forEach(it => {
      const b = computeItemBounds(it);
      if (b.minX < minX) minX = b.minX;
      if (b.minY < minY) minY = b.minY;
      if (b.maxX > maxX) maxX = b.maxX;
      if (b.maxY > maxY) maxY = b.maxY;
    });
    if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
    return {
      minX,
      minY,
      maxX,
      maxY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2
    };
  }

  function getItemsToCopy() {
    if (!engine || !engine.selectedItemIds || engine.selectedItemIds.size === 0) return [];

    const itemsMap = new Map();
    // 1. Añadir todos los elementos explícitamente seleccionados
    engine.items.forEach(it => {
      if (engine.selectedItemIds.has(it.id)) {
        itemsMap.set(it.id, it);
      }
    });

    // 2. Si hay marcos (frames) seleccionados, incluir automáticamente todos sus elementos internos
    const selectedFrames = Array.from(itemsMap.values()).filter(it => it.type === 'frame');
    if (selectedFrames.length > 0) {
      engine.items.forEach(child => {
        if (!itemsMap.has(child.id)) {
          for (const frame of selectedFrames) {
            if (child.id !== frame.id && (child.parentId === frame.id || (engine.isItemInsideFrame && engine.isItemInsideFrame(child, frame)))) {
              itemsMap.set(child.id, child);
              break;
            }
          }
        }
      });
    }

    // 3. Incluir conectores que enlacen elementos del grupo copiado
    engine.items.forEach(it => {
      if (it.type === 'connector' && !itemsMap.has(it.id)) {
        if (it.start?.item && it.end?.item && itemsMap.has(it.start.item) && itemsMap.has(it.end.item)) {
          itemsMap.set(it.id, it);
        }
      }
    });

    return Array.from(itemsMap.values());
  }

  function copySelectedToClipboard() {
    const itemsToCopy = getItemsToCopy();
    if (!itemsToCopy || itemsToCopy.length === 0) {
      showDevToast('Selecciona algún elemento para copiar');
      return false;
    }

    // Limpiar propiedades no serializables como imgElement
    const cleanItems = itemsToCopy.map(it => {
      const copy = { ...it };
      if (copy.imgElement) delete copy.imgElement;
      return copy;
    });

    const bounds = computeItemsBounds(cleanItems);
    const payload = {
      source: 'brainboard',
      version: 1,
      boardId: currentActiveBoardId,
      timestamp: Date.now(),
      bounds: bounds,
      items: JSON.parse(JSON.stringify(cleanItems))
    };

    // 1. Guardar en memoria de ventana
    window.__brainboardClipboard = payload;

    // 2. Guardar en localStorage para disponibilidad entre cualquier tablero
    try {
      localStorage.setItem('brainboard_clipboard', JSON.stringify(payload));
    } catch (err) {
      console.warn('No se pudo guardar en localStorage:', err);
    }

    // 3. Escribir en el portapapeles nativo de Electron del sistema
    try {
      const jsonStr = JSON.stringify(payload);
      if (window.brainBoard?.clipboard?.writeText) {
        window.brainBoard.clipboard.writeText(jsonStr);
      } else if (window.miro?.clipboard?.writeText) {
        window.miro.clipboard.writeText(jsonStr);
      } else if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(jsonStr).catch(() => {});
      }
    } catch (err) {}

    pasteCascadeCount = 0;
    lastPasteTargetWorld = null;

    const count = cleanItems.length;
    showDevToast(`Copiado${count > 1 ? 's ' + count + ' elementos' : ' 1 elemento'}`);
    return true;
  }

  function getStoredClipboardPayload() {
    // 1. Comprobar memoria de ventana
    if (window.__brainboardClipboard && window.__brainboardClipboard.source === 'brainboard' && Array.isArray(window.__brainboardClipboard.items) && window.__brainboardClipboard.items.length > 0) {
      return window.__brainboardClipboard;
    }

    // 2. Comprobar portapapeles del sistema operativo mediante API de Electron
    try {
      let clipText = '';
      if (window.brainBoard?.clipboard?.readText) {
        clipText = window.brainBoard.clipboard.readText() || '';
      } else if (window.miro?.clipboard?.readText) {
        clipText = window.miro.clipboard.readText() || '';
      }
      if (clipText && clipText.trim().startsWith('{') && clipText.includes('"source":"brainboard"')) {
        const parsed = JSON.parse(clipText.trim());
        if (parsed && parsed.source === 'brainboard' && Array.isArray(parsed.items) && parsed.items.length > 0) {
          window.__brainboardClipboard = parsed;
          return parsed;
        }
      }
    } catch (e) {}

    // 3. Comprobar localStorage
    try {
      const raw = localStorage.getItem('brainboard_clipboard');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.source === 'brainboard' && Array.isArray(parsed.items) && parsed.items.length > 0) {
          window.__brainboardClipboard = parsed;
          return parsed;
        }
      }
    } catch (e) {}

    return null;
  }

  function getPasteTargetPosition() {
    // 1. Si el cursor del ratón está dentro del canvas (no sobre el drawer lateral ni fuera de pantalla)
    if (currentMouseScreen &&
        currentMouseScreen.x > 0 && currentMouseScreen.x < window.innerWidth &&
        currentMouseScreen.y > 0 && currentMouseScreen.y < window.innerHeight) {
      const drawer = document.getElementById('board-controller-drawer');
      const drawerRect = drawer?.getBoundingClientRect();
      const isOverDrawer = drawer && drawer.classList.contains('open') && drawerRect &&
        currentMouseScreen.x >= drawerRect.left && currentMouseScreen.x <= drawerRect.right &&
        currentMouseScreen.y >= drawerRect.top && currentMouseScreen.y <= drawerRect.bottom;

      if (!isOverDrawer && engine && typeof engine.screenToWorld === 'function') {
        return engine.screenToWorld(currentMouseScreen.x, currentMouseScreen.y);
      }
    }

    // 2. Si el ratón está en un panel o fuera, pegar en el CENTRO del viewport actual del tablero
    if (engine && typeof engine.screenToWorld === 'function') {
      return engine.screenToWorld(window.innerWidth / 2, window.innerHeight / 2);
    }
    return { x: 0, y: 0 };
  }

  function pasteClipboardItems(payload, options = {}) {
    const p = payload || getStoredClipboardPayload();
    if (!p || !Array.isArray(p.items) || p.items.length === 0) {
      showDevToast('El portapapeles está vacío');
      return false;
    }

    // Determinar posición objetivo (cursor del ratón en el tablero actual o centro de la pantalla)
    let targetX, targetY;
    if (options.targetX !== undefined && options.targetY !== undefined) {
      targetX = options.targetX;
      targetY = options.targetY;
    } else {
      const mousePos = getPasteTargetPosition();
      // Cascada de +30px si se pega varias veces seguidas en la misma posición (comportamiento Miro/Figma)
      if (lastPasteTargetWorld && Math.hypot(mousePos.x - lastPasteTargetWorld.x, mousePos.y - lastPasteTargetWorld.y) < 15) {
        pasteCascadeCount++;
      } else {
        pasteCascadeCount = 0;
      }
      lastPasteTargetWorld = { ...mousePos };

      const offset = pasteCascadeCount * 30;
      targetX = mousePos.x + offset;
      targetY = mousePos.y + offset;
    }

    const bounds = p.bounds || computeItemsBounds(p.items);
    const sourceCenterX = bounds ? bounds.centerX : 0;
    const sourceCenterY = bounds ? bounds.centerY : 0;

    const dx = targetX - sourceCenterX;
    const dy = targetY - sourceCenterY;

    const idMap = new Map();
    const newClones = [];

    // Paso 1: Clonar y generar nuevos IDs únicos para cada elemento
    p.items.forEach(it => {
      const clone = JSON.parse(JSON.stringify(it));
      if (clone.imgElement) delete clone.imgElement;
      const newId = (it.type || 'item') + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      idMap.set(it.id, newId);
      clone.id = newId;
      newClones.push(clone);
    });

    // Paso 2: Trasladar coordenadas y remapear referencias entre elementos y conectores
    newClones.forEach(clone => {
      if (clone.type === 'connector') {
        if (clone.start && Number.isFinite(clone.start.x)) clone.start.x += dx;
        if (clone.start && Number.isFinite(clone.start.y)) clone.start.y += dy;
        if (clone.end && Number.isFinite(clone.end.x)) clone.end.x += dx;
        if (clone.end && Number.isFinite(clone.end.y)) clone.end.y += dy;
        if (Array.isArray(clone.controlPoints)) {
          clone.controlPoints.forEach(pt => {
            if (pt && Number.isFinite(pt.x)) pt.x += dx;
            if (pt && Number.isFinite(pt.y)) pt.y += dy;
          });
        }

        // Remapear extremos si los elementos enlazados también fueron copiados
        if (clone.start && clone.start.item) {
          if (idMap.has(clone.start.item)) {
            clone.start.item = idMap.get(clone.start.item);
          } else {
            clone.start.item = null;
          }
        }
        if (clone.end && clone.end.item) {
          if (idMap.has(clone.end.item)) {
            clone.end.item = idMap.get(clone.end.item);
          } else {
            clone.end.item = null;
          }
        }
      } else if (clone.type === 'pen' && Array.isArray(clone.points)) {
        clone.points.forEach(pt => {
          if (pt && Number.isFinite(pt.x)) pt.x += dx;
          if (pt && Number.isFinite(pt.y)) pt.y += dy;
        });
        if (Number.isFinite(clone.x)) clone.x += dx;
        if (Number.isFinite(clone.y)) clone.y += dy;
      } else {
        if (Number.isFinite(clone.x)) clone.x += dx;
        if (Number.isFinite(clone.y)) clone.y += dy;

        // Si pertenece a un marco clonado
        if (clone.parentId && idMap.has(clone.parentId)) {
          clone.parentId = idMap.get(clone.parentId);
        }
      }
    });

    // Paso 3: Guardar snapshot para Deshacer (Ctrl+Z) y añadir elementos al lienzo
    engine.saveSnapshot();
    engine.items.push(...newClones);

    // Paso 4: Seleccionar automáticamente los nuevos elementos pegados
    engine.selectedItemIds.clear();
    newClones.forEach(c => engine.selectedItemIds.add(c.id));
    if (engine.onSelectionChange) engine.onSelectionChange(Array.from(engine.selectedItemIds));

    // Paso 5: Renderizar y auto-guardar
    engine.render();
    autoSaveBoard();

    const count = newClones.length;
    showDevToast(`Pegado${count > 1 ? 's ' + count + ' elementos' : ' 1 elemento'}`);
    return true;
  }

  function duplicateSelectedItems() {
    const itemsToCopy = getItemsToCopy();
    if (itemsToCopy.length === 0) return;

    const bounds = computeItemsBounds(itemsToCopy);
    const payload = {
      source: 'brainboard',
      version: 1,
      bounds: bounds,
      items: JSON.parse(JSON.stringify(itemsToCopy))
    };

    pasteClipboardItems(payload, {
      targetX: bounds.centerX + 30,
      targetY: bounds.centerY + 30,
      isDuplicate: true
    });
  }

  function extractYouTubeVideoId(url) {
    if (!url) return '';
    try {
      const u = new URL(url);
      const host = u.hostname.toLowerCase();
      if (host.includes('youtube.com')) {
        const v = u.searchParams.get('v');
        if (v) return v;
        const parts = u.pathname.split('/').filter(Boolean);
        if (parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'v') return parts[1] || '';
      } else if (host.includes('youtu.be')) {
        return u.pathname.replace(/^\//, '').split('?')[0] || '';
      }
    } catch (e) {}
    return '';
  }

  function pasteExternalImage(dataUrl, imgWidth = null, imgHeight = null, targetWorldPos = null) {
    const target = targetWorldPos || getPasteTargetPosition();
    const handleAddImage = (w, h) => {
      let finalW = w || 400;
      let finalH = h || 300;
      const maxDim = 800;
      if (finalW > maxDim || finalH > maxDim) {
        const ratio = Math.min(maxDim / finalW, maxDim / finalH);
        finalW = Math.round(finalW * ratio);
        finalH = Math.round(finalH * ratio);
      }

      engine.saveSnapshot();
      const imgItem = {
        id: 'pasted_img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        type: 'image',
        src: dataUrl,
        x: target.x - finalW / 2,
        y: target.y - finalH / 2,
        width: finalW,
        height: finalH
      };
      engine.items.push(imgItem);
      engine.selectedItemIds.clear();
      engine.selectedItemIds.add(imgItem.id);
      if (engine.onSelectionChange) engine.onSelectionChange([imgItem.id]);
      engine.render();
      autoSaveBoard();
      showDevToast('Imagen pegada');
    };

    if (imgWidth && imgHeight && imgWidth > 0 && imgHeight > 0) {
      handleAddImage(imgWidth, imgHeight);
    } else {
      const img = new Image();
      img.onload = () => handleAddImage(img.naturalWidth, img.naturalHeight);
      img.onerror = () => handleAddImage(400, 300);
      img.src = dataUrl;
    }
  }

  function pasteExternalUrl(text, targetWorldPos = null) {
    const target = targetWorldPos || getPasteTargetPosition();
    let cleanUrl = text.trim();
    if (!/^https?:\/\//i.test(cleanUrl)) {
      cleanUrl = 'https://' + cleanUrl;
    }
    const domain = engine.extractDomain(cleanUrl);
    let title = '';

    // Intentar leer título desde bookmark o HTML del portapapeles si coincide
    try {
      if (window.brainBoard?.clipboard?.readBookmark) {
        const bm = window.brainBoard.clipboard.readBookmark();
        if (bm && bm.title && bm.url && bm.url.toLowerCase() === cleanUrl.toLowerCase()) {
          title = bm.title;
        }
      }
      if (!title && window.brainBoard?.clipboard?.readHTML) {
        const html = window.brainBoard.clipboard.readHTML() || '';
        const matchTitle = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (matchTitle && matchTitle[1]) title = matchTitle[1].trim();
      }
    } catch (e) {}

    if (!title) {
      title = engine.extractTitle(cleanUrl) || domain;
    }

    // Miniatura de YouTube si aplica
    let previewSrc = '';
    const ytId = extractYouTubeVideoId(cleanUrl);
    if (ytId) {
      previewSrc = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
    } else {
      // Buscar coincidencia en recursos existentes
      const resMap = window.__resourcesMap || {};
      const resEntries = Object.values(resMap);
      const host = domain.split('.')[0].toLowerCase();
      if (host.length > 2) {
        const dm = resEntries.find(re => (re.name && re.name.toLowerCase().includes(host)) || (re.filename && re.filename.toLowerCase().includes(host)));
        if (dm) previewSrc = dm.localPath;
      }
    }

    const hasThumbnail = Boolean(previewSrc);
    const cardWidth = hasThumbnail ? 320 : 280;
    const cardHeight = hasThumbnail ? 260 : 130;

    engine.saveSnapshot();
    const newEmbed = {
      id: 'embed_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      type: 'embed',
      x: target.x - cardWidth / 2,
      y: target.y - cardHeight / 2,
      width: cardWidth,
      height: cardHeight,
      title: title,
      domain: domain,
      url: cleanUrl,
      src: previewSrc,
      description: ''
    };

    engine.items.push(newEmbed);
    engine.selectedItemIds.clear();
    engine.selectedItemIds.add(newEmbed.id);
    if (engine.onSelectionChange) engine.onSelectionChange([newEmbed.id]);
    engine.render();
    autoSaveBoard();
    showDevToast('Enlace web pegado');

    // Carga asíncrona de metadatos web (Open Graph: og:image, título real, descripción)
    const fetchApi = window.brainBoard?.fetchUrlMetadata || window.miro?.fetchUrlMetadata;
    if (fetchApi) {
      fetchApi(cleanUrl).then(meta => {
        if (!meta) return;
        let modified = false;

        if (meta.title && meta.title.length > 2 && meta.title !== domain) {
          newEmbed.title = meta.title;
          modified = true;
        }

        if (meta.description && !newEmbed.description) {
          newEmbed.description = meta.description;
          modified = true;
        }

        if (meta.image) {
          newEmbed.src = meta.image;
          newEmbed.width = 320;
          newEmbed.height = 260;
          modified = true;
        }

        if (modified) {
          engine.render();
          autoSaveBoard();
        }
      }).catch(err => {
        console.warn('No se pudieron obtener metadatos de la URL:', err);
      });
    }
  }

  function pasteExternalText(text, targetWorldPos = null) {
    const target = targetWorldPos || getPasteTargetPosition();
    engine.saveSnapshot();
    const isShort = text.length < 120;
    const w = isShort ? 200 : 320;
    const h = isShort ? 200 : 160;
    const newItem = {
      id: 'text_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      type: isShort ? 'sticky_note' : 'text',
      x: target.x - w / 2,
      y: target.y - h / 2,
      width: w,
      height: h,
      text: text,
      color: '#fff9b1'
    };
    engine.items.push(newItem);
    engine.selectedItemIds.clear();
    engine.selectedItemIds.add(newItem.id);
    if (engine.onSelectionChange) engine.onSelectionChange([newItem.id]);
    engine.render();
    autoSaveBoard();
    showDevToast('Texto pegado');
  }

  async function executePasteAction(pasteEvent = null, targetWorldPos = null) {
    if (isPasting) return;
    isPasting = true;
    setTimeout(() => { isPasting = false; }, 150);

    // Prioridad 1: IMAGEN DEL SISTEMA OPERATIVO
    // 1.a) Mediante la API de portapapeles de Electron (synchronous y ultra-rápida)
    let clipImg = null;
    try {
      if (window.brainBoard?.clipboard?.readImage) {
        clipImg = window.brainBoard.clipboard.readImage();
      } else if (window.miro?.clipboard?.readImage) {
        clipImg = window.miro.clipboard.readImage();
      }
    } catch (e) {}

    if (clipImg && clipImg.dataUrl) {
      pasteExternalImage(clipImg.dataUrl, clipImg.width, clipImg.height, targetWorldPos);
      return;
    }

    // 1.b) Mediante items del evento 'paste' nativo de HTML5
    if (pasteEvent?.clipboardData?.items) {
      for (const it of pasteEvent.clipboardData.items) {
        if (it.kind === 'file' && it.type && it.type.startsWith('image/')) {
          const file = it.getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (evt) => {
              pasteExternalImage(evt.target.result, null, null, targetWorldPos);
            };
            reader.readAsDataURL(file);
            return;
          }
        }
      }
    }

    // 1.c) Mediante archivos del evento 'paste' nativo de HTML5
    if (pasteEvent?.clipboardData?.files && pasteEvent.clipboardData.files.length > 0) {
      for (const file of pasteEvent.clipboardData.files) {
        if (file.type && file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (evt) => {
            pasteExternalImage(evt.target.result, null, null, targetWorldPos);
          };
          reader.readAsDataURL(file);
          return;
        }
      }
    }

    // 1.d) Mediante navigator.clipboard.read() (fallback web estándar)
    if (navigator.clipboard && typeof navigator.clipboard.read === 'function') {
      try {
        const clipItems = await navigator.clipboard.read();
        for (const item of clipItems) {
          const imgType = item.types.find(t => t.startsWith('image/'));
          if (imgType) {
            const blob = await item.getType(imgType);
            if (blob) {
              const reader = new FileReader();
              reader.onload = (evt) => {
                pasteExternalImage(evt.target.result, null, null, targetWorldPos);
              };
              reader.readAsDataURL(blob);
              return;
            }
          }
        }
      } catch (e) {}
    }

    // Prioridad 2: TEXTO O ENLACE DEL PORTAPAPELES
    let clipText = '';
    try {
      if (window.brainBoard?.clipboard?.readText) {
        clipText = window.brainBoard.clipboard.readText() || '';
      } else if (window.miro?.clipboard?.readText) {
        clipText = window.miro.clipboard.readText() || '';
      }
    } catch (e) {}

    if (!clipText && pasteEvent?.clipboardData) {
      try {
        clipText = pasteEvent.clipboardData.getData('text') || '';
      } catch (e) {}
    }

    if (!clipText && navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
      try {
        clipText = await navigator.clipboard.readText();
      } catch (e) {}
    }

    const trimmedText = (clipText || '').trim();

    // 2.a) ¿El texto copiado es un paquete JSON de elementos de Brain Board?
    if (trimmedText.startsWith('{') && trimmedText.includes('"source":"brainboard"')) {
      try {
        const parsed = JSON.parse(trimmedText);
        if (parsed && parsed.source === 'brainboard' && Array.isArray(parsed.items) && parsed.items.length > 0) {
          pasteClipboardItems(parsed, targetWorldPos ? { targetX: targetWorldPos.x, targetY: targetWorldPos.y } : {});
          return;
        }
      } catch (err) {}
    }

    // 2.b) ¿El texto copiado es una URL / enlace web?
    const isUrl = /^https?:\/\/[^\s]+/i.test(trimmedText) || /^www\.[a-z0-9\-]+(\.[a-z0-9\-]+)+[^\s]*/i.test(trimmedText);
    if (isUrl) {
      // Si la URL apunta directamente a un archivo de imagen, pegarlo como imagen
      if (/\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(trimmedText) || trimmedText.includes('gstatic.com/images?')) {
        pasteExternalImage(trimmedText, null, null, targetWorldPos);
        return;
      }
      pasteExternalUrl(trimmedText, targetWorldPos);
      return;
    }

    // 2.c) ¿Texto plano convencional?
    if (trimmedText.length > 0) {
      pasteExternalText(trimmedText, targetWorldPos);
      return;
    }

    // Prioridad 3: Elementos en memoria de Brain Board si el portapapeles del sistema estaba vacío
    const brainPayload = getStoredClipboardPayload();
    if (brainPayload && Array.isArray(brainPayload.items) && brainPayload.items.length > 0) {
      pasteClipboardItems(brainPayload, targetWorldPos ? { targetX: targetWorldPos.x, targetY: targetWorldPos.y } : {});
      return;
    }

    showDevToast('El portapapeles está vacío');
  }

  // Listener para el evento 'paste' nativo del navegador / Electron
  window.addEventListener('paste', (e) => {
    // Si se está editando dentro de un input, textarea o editor in-situ, permitir pegar nativo de texto
    if (document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement === inlineEditor) {
      return;
    }

    e.preventDefault();
    executePasteAction(e);
  });

  // Soporte para arrastrar y soltar (Drag and Drop) imágenes o enlaces directamente en el lienzo
  canvasElement.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  });

  canvasElement.addEventListener('drop', (e) => {
    e.preventDefault();
    const dropWorld = engine.screenToWorld(e.clientX, e.clientY);

    // 1. Archivos arrastrados desde el explorador de archivos o escritorio
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      for (const file of e.dataTransfer.files) {
        if (file.type && file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (evt) => {
            pasteExternalImage(evt.target.result, null, null, dropWorld);
          };
          reader.readAsDataURL(file);
          return;
        }
      }
    }

    // 2. Enlaces o textos arrastrados desde el navegador
    const textData = e.dataTransfer?.getData('text/uri-list') || e.dataTransfer?.getData('text/plain') || '';
    if (textData && textData.trim()) {
      const trimmed = textData.trim();
      const isUrl = /^https?:\/\/[^\s]+/i.test(trimmed) || /^www\.[a-z0-9\-]+(\.[a-z0-9\-]+)+[^\s]*/i.test(trimmed);
      if (isUrl) {
        if (/\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(trimmed) || trimmed.includes('gstatic.com/images?')) {
          pasteExternalImage(trimmed, null, null, dropWorld);
        } else {
          pasteExternalUrl(trimmed, dropWorld);
        }
      } else {
        pasteExternalText(trimmed, dropWorld);
      }
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
      if ((clicked.type === 'embed' || clicked.type === 'image') && clicked.url) {
        openExternalUrl(clicked.url);
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
        textColor = engine.isDarkMode ? '#0f172a' : '#ffffff';
      } else {
        textColor = item.color || (engine.isDarkMode ? '#f1f5f9' : '#1a1a1a');
      }
    } else if (engine.isDarkMode && engine.isDarkColor(textColor)) {
      if (item.fillColor === '#2d2d2d' || item.fillColor === '#40414c' || item.fillColor === '#1a1a1a') {
        textColor = '#0f172a';
      } else if (item.type !== 'sticky_note') {
        textColor = '#f1f5f9';
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
      let bg = activeEditingItem.fillColor;
      if (engine.isDarkMode && (bg === '#2d2d2d' || bg === '#1a1a1a' || bg === '#40414c')) {
        bg = '#eef2f5';
      } else if (engine.isDarkMode && engine.isLightColor(bg)) {
        bg = '#23262d';
      }
      inlineEditor.style.backgroundColor = bg;
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

    // Enter para editar el texto del elemento seleccionado
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
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
      e.preventDefault();
      copySelectedToClipboard();
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'x' || e.key === 'X')) {
      e.preventDefault();
      if (copySelectedToClipboard()) {
        engine.deleteSelected();
      }
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
      e.preventDefault();
      executePasteAction();
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
      e.preventDefault();
      engine.selectAll();
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault();
      if (e.shiftKey) engine.redo();
      else engine.undo();
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
      e.preventDefault();
      engine.redo();
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
      e.preventDefault();
      duplicateSelectedItems();
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
  let currentActiveBoardId = localStorage.getItem('brainboard_active_board_id') || localStorage.getItem('miro_active_board_id') || 'dev_ai';

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

  function saveBoardToDisk(targetBoardId, data) {
    if (typeof window === 'undefined' || typeof window.require !== 'function') return false;
    try {
      const fs = window.require('fs');
      const path = window.require('path');
      const fileBase = targetBoardId === 'dev_ai' ? 'DEV_AI' : targetBoardId;
      const jsonContent = JSON.stringify(data, null, 2);

      const candidatePaths = [
        path.resolve(process.cwd(), `boards/${fileBase}.json`),
        path.resolve(process.cwd(), `app_bundle/boards/${fileBase}.json`),
        path.resolve(__dirname, `../boards/${fileBase}.json`),
        path.resolve(__dirname, `boards/${fileBase}.json`)
      ];

      let saved = false;
      for (const p of candidatePaths) {
        try {
          const dir = path.dirname(p);
          if (fs.existsSync(dir)) {
            fs.writeFileSync(p, jsonContent, 'utf8');
            saved = true;
          }
        } catch (errWrite) {}
      }
      return saved;
    } catch (e) {
      console.warn('No se pudo guardar copia física en disco:', e);
      return false;
    }
  }

  async function autoSaveBoardImmediately(targetBoardId = currentActiveBoardId) {
    if (!targetBoardId) return;
    clearTimeout(saveTimeout);
    const cleanItems = engine.getCleanItems ? engine.getCleanItems() : engine.items;

    // Protección estricta: nunca sobreescribir DEV / AI con 0 items si el motor está vacío
    if (targetBoardId === 'dev_ai' && (!cleanItems || cleanItems.length === 0)) {
      return;
    }

    if (saveStatusText) saveStatusText.innerText = 'Guardando...';
    const boardMeta = workspaceBoards.find(b => b.id === targetBoardId);
    const currentVer = Math.max(engine.currentSeedVersion || 0, boardMeta?.seedVersion || 0, 3);
    engine.currentSeedVersion = currentVer;

    const data = {
      id: targetBoardId,
      name: (boardTitleInput && currentActiveBoardId === targetBoardId ? boardTitleInput.value : boardMeta?.title) || (targetBoardId === 'dev_ai' ? 'DEV / AI' : 'Tablero'),
      updatedAt: new Date().toISOString(),
      seedVersion: currentVer,
      userModified: true,
      items: cleanItems
    };

    // 1. Guardado en IndexedDB indexado por ID de tablero
    await idbSaveBoard(targetBoardId, data);

    // 2. Guardado secundario en LocalStorage
    try {
      localStorage.setItem(`brainboard_board_${targetBoardId}`, JSON.stringify(data));
      if (currentActiveBoardId === targetBoardId) {
        localStorage.setItem('brainboard_active_board_id', targetBoardId);
      }
      if (targetBoardId === 'dev_ai') {
        localStorage.setItem('brainboard_local_current_board_v3', JSON.stringify(data));
      }
    } catch (err) {
      console.warn('LocalStorage saturado, guardado seguro en IndexedDB');
    }

    // 3. Guardado físico directo en disco JSON (boards/ y app_bundle/boards/)
    saveBoardToDisk(targetBoardId, data);

    if (saveStatusText) saveStatusText.innerText = 'Guardado';
  }

  function autoSaveBoard() {
    clearTimeout(saveTimeout);
    const boardToSave = currentActiveBoardId;
    if (saveStatusText) saveStatusText.innerText = 'Guardando...';
    saveTimeout = setTimeout(() => {
      if (currentActiveBoardId === boardToSave) {
        autoSaveBoardImmediately(boardToSave);
      }
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

  const boardSpecialUrlMappings = {
    // Redes sociales y creadores
    '3458764670964036717': 'https://x.com/nekodificador',
    '3458764668683132168': 'https://x.com/VoxelPlot',
    '3458764668366932735': 'https://x.com/andrewpprice',
    '3458764668969485785': 'https://www.linkedin.com/search/results/all/?keywords=Eduardo%20Morales%20Garrido',
    '3458764668684851529': 'https://x.com/RoryFlynn_AI',

    // Enlaces web y recursos
    '3458764668350677074': 'https://github.com/comfyanonymous/ComfyUI/releases',
    '3458764632639506697': 'https://manual.cs50.io/',
    '3458764652752799382': 'https://github.com/midudev/jscamp',
    '3458764674306115025': 'https://jesse-zhou.com',
    '3458764652566924378': 'https://www.hubdev.tools/',
    '3458764652440930529': 'https://uiverse.io/',

    // Midu extensiones & herramientas de desarrollo
    '3458764652439437543': 'https://www.youtube.com/@midudev',
    '3458764652439437608': 'https://marketplace.visualstudio.com/items?itemName=usernamehw.errorlens',
    '3458764652390426898': 'https://sentry.io',
    '3458764652390361242': 'https://www.instagram.com/p/DQrk1P7DNd-/',
    '3458764652390020307': 'https://github.com/lsd-rs/lsd',
    '3458764652390020439': 'https://www.instagram.com/p/DRNSY-RCOOa/',
    '3458764653754061966': 'https://www.instagram.com/p/DNBCEDVCOH-/',
    '3458764652478125820': 'https://www.instagram.com/p/DRSHAagjR3h/',
    '3458764668253576084': 'https://lusion.co/',
    '3458764668249396715': 'https://iabhinav.me/',
    '3458764652442749848': 'https://owasp.org/www-project-noir/',
    '3458764652440930855': 'https://uiverse.io/',
    '3458764653754157548': 'https://animejs.com/',
    '3458764653754157393': 'https://gitdocify.com/',
    '3458764653754062522': 'https://www.scrollxui.dev/',
    '3458764653754062243': 'https://reactbits.dev/',
    '3458764653046809836': 'https://npmtrends.com/',
    '3458764652477713452': 'https://github.com/x1xhlol/system-prompts-and-models-of-ai-tools',
    '3458764653271488347': 'https://www.jscamp.dev/introduccion-a-react/creando-una-spa-desde-cero',
    '3458764671134930808': 'https://www.actionvfx.com/',
    '3458764669572761006': 'https://beeble.ai/research/switchlight-3-0-is-here',
    '3458764669437352207': 'https://blog.comfy.org/',
    '3458764668971739305': 'https://www.youtube.com/@comfyorg',
    '3458764668366932355': 'https://www.youtube.com/@stefan_ai_3d/videos',
    '3458764686777301812': 'https://fal.ai/models/fal-ai/flux-lora-portrait-trainer',
    '3458764674447556381': 'https://www.youtube.com/watch?v=yQSG_4ukq9Q',
    '3458764672258288078': 'https://www.linkedin.com/posts/sunny-minj-063971b3_3dart-cgenvironment-cinema4d-ugcPost-7460719399759396864-4-Lf/',
    '3458764674306324026': 'https://www.michaeltanzillo.com/',
    '3458764673825954950': 'https://vect-standard.com/',
    '3458764674302674309': 'https://hashgraphvc.com/',
    '3458764650252653869': 'https://algorithm-visualizer.org/',
    '3458764642300129004': 'https://algorithm-visualizer.org/',
    '3458764652443642742': 'https://deepwiki.ai',
    '3458764653754062839': 'https://www.instagram.com/p/DSMJBdukbs0/',
    '3458764652566630992': 'https://devdocs.io/',
    '3458764652478124967': 'https://www.instagram.com/p/DSFkSXEjqXz/',
    '3458764652442109846': 'https://quickref.me/',
    '3458764653754062327': 'https://profile-readme-generator.com/es',
    '3458764653686781345': 'https://allsvgicons.com/',
    '3458764653031466029': 'https://unavatar.io/'
  };

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
      } else if (it.type === 'text' || it.type === 'sticky_note') {
        if (!it.url) {
          if (boardSpecialUrlMappings[it.id]) {
            it.url = boardSpecialUrlMappings[it.id];
          } else {
            const ext = extractUrlFromItem(it);
            if (ext) it.url = ext;
          }
        }
      }
    });
  }

  async function fetchBoardSeedData(boardId) {
    if (!boardId) return null;
    const fileBase = boardId === 'dev_ai' ? 'DEV_AI' : boardId;
    const urls = [
      `boards/${fileBase}.json`,
      `../boards/${fileBase}.json`,
      `./boards/${fileBase}.json`,
      `app_bundle/boards/${fileBase}.json`,
      `boards/${boardId}.json`,
      `../boards/${boardId}.json`
    ];
    for (const u of urls) {
      try {
        const res = await fetch(u);
        if (res.ok) {
          return await res.json();
        }
      } catch (e) {}
    }

    if (typeof window !== 'undefined' && typeof window.require === 'function') {
      try {
        const fs = window.require('fs');
        const path = window.require('path');
        const candidatePaths = [
          path.resolve(__dirname, `boards/${fileBase}.json`),
          path.resolve(__dirname, `../boards/${fileBase}.json`),
          path.resolve(__dirname, `../../boards/${fileBase}.json`),
          path.resolve(process.cwd(), `boards/${fileBase}.json`),
          path.resolve(process.cwd(), `app_bundle/boards/${fileBase}.json`),
          path.resolve(__dirname, `boards/${boardId}.json`),
          path.resolve(__dirname, `../boards/${boardId}.json`),
          path.resolve(process.cwd(), `boards/${boardId}.json`)
        ];
        for (const p of candidatePaths) {
          if (fs.existsSync(p)) {
            return JSON.parse(fs.readFileSync(p, 'utf8'));
          }
        }
      } catch (e) {}
    }
    return null;
  }
  window.fetchBoardSeedData = fetchBoardSeedData;

  async function loadSeedBoard(targetBoardId) {
    const board = await fetchBoardSeedData(targetBoardId);
    if (board) {
      const items = (board.items && Array.isArray(board.items)) ? board.items : convertMiroToBrainBoard(board);
      sanitizeEmbedResources(items);
      engine.items = items;
      engine.selectedItemIds.clear();
      engine.clearHistory();
      const meta = workspaceBoards?.find(b => b.id === targetBoardId);
      const bTitle = board.name || meta?.title || (targetBoardId === 'dev_ai' ? 'DEV / AI' : targetBoardId);
      if (boardTitleInput) {
        boardTitleInput.value = bTitle;
        fitBoardTitleWidth();
      }
      updateBoardThumbnailMini(targetBoardId);
      engine.fitView();
      updateMinimap();
      engine.currentSeedVersion = Math.max(board.seedVersion || 0, 3);
      await autoSaveBoardImmediately(targetBoardId);
      return true;
    }
    return false;
  }
  window.loadSeedBoard = loadSeedBoard;
  window.loadSeedDevAiBoard = () => loadSeedBoard('dev_ai');

  // Carga inicial resiliente
  async function loadInitialBoard() {
    currentActiveBoardId = localStorage.getItem('brainboard_active_board_id') || localStorage.getItem('miro_active_board_id') || 'dev_ai';
    workspaceBoards.forEach(b => b.active = (b.id === currentActiveBoardId));
    renderDrawerBoards();
    if (typeof renderTabs === 'function') renderTabs();

    let savedData = await idbLoadBoard(currentActiveBoardId);

    if (!savedData) {
      try {
        const ls = localStorage.getItem(`brainboard_board_${currentActiveBoardId}`) || localStorage.getItem(`miro_board_${currentActiveBoardId}`) || (currentActiveBoardId === 'dev_ai' ? (localStorage.getItem('brainboard_local_current_board_v3') || localStorage.getItem('miro_local_current_board_v3')) : null);
        if (ls) savedData = JSON.parse(ls);
      } catch (e) {}
    }

    // Comprobar si el archivo de semilla en disco tiene una versión más nueva que la caché guardada
    let isOutdatedCache = false;
    let seedData = null;
    try {
      seedData = await fetchBoardSeedData(currentActiveBoardId);
      if (seedData && typeof seedData.seedVersion === 'number') {
        const savedVer = typeof savedData?.seedVersion === 'number' ? savedData.seedVersion : 0;
        // El trabajo del usuario es sagrado: solo considerar desactualizada una plantilla si el usuario NO la ha editado
        if ((!savedData?.userModified && seedData.seedVersion > savedVer) || (currentActiveBoardId === 'space' && seedData.seedVersion >= 5 && savedVer < 5)) {
          isOutdatedCache = true;
        }
      }
    } catch(e) {}

    const hasValidSavedItems = !isOutdatedCache && savedData && Array.isArray(savedData.items) && savedData.items.length > 0;

    if (hasValidSavedItems) {
      sanitizeEmbedResources(savedData.items);
      engine.items = savedData.items;
      engine.items.forEach(it => {
        if (it.imgElement && typeof it.imgElement.getAttribute !== 'function') {
          delete it.imgElement;
        }
      });
      engine.clearHistory();
      const activeMeta = workspaceBoards.find(b => b.id === currentActiveBoardId);
      boardTitleInput.value = savedData.name || activeMeta?.title || (currentActiveBoardId === 'dev_ai' ? 'DEV / AI' : 'Tablero');
      fitBoardTitleWidth();
      updateBoardThumbnailMini(currentActiveBoardId);
      engine.fitView();
      engine.currentSeedVersion = Math.max(savedData.seedVersion || 0, seedData?.seedVersion || 0, 3);
      if (saveStatusText) saveStatusText.innerText = 'Guardado';
      return;
    }

    const seeded = await loadSeedBoard(currentActiveBoardId);
    if (!seeded) {
      engine.items = [];
      engine.clearHistory();
      engine.fitView();
    }
    updateBoardThumbnailMini(currentActiveBoardId);
  }

  // =========================================================
  // CONTROLADOR DE TABLEROS Y MENÚS DE BRAIN BOARD
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
  const menuOptBackup = document.getElementById('menu-opt-backup');
  const menuOptExportHires = document.getElementById('menu-opt-export-hires');
  const menuOptClear = document.getElementById('menu-opt-clear');
  const btnResetZoom = document.getElementById('btn-reset-zoom');

  // Miniatura dinámica del tablero activo
  const boardThumbnailMini = document.getElementById('board-thumbnail-mini');
  function updateBoardThumbnailMini(boardId) {
    if (!boardThumbnailMini) return;
    const targetId = boardId || currentActiveBoardId;
    const b = workspaceBoards.find(x => x.id === targetId);
    if (!b) return;

    if (b.thumbnail) {
      boardThumbnailMini.className = 'board-thumbnail-mini';
      boardThumbnailMini.innerHTML = `<img src="${b.thumbnail}" class="board-thumbnail-mini-img" alt="${b.title || ''}" />`;
    } else if (b.icon === 'code' || b.id === 'dev_ai') {
      boardThumbnailMini.className = 'board-thumbnail-mini thumb-code';
      boardThumbnailMini.innerHTML = `<span class="thumb-code-brackets">&lt;/&gt;</span>`;
    } else {
      boardThumbnailMini.className = 'board-thumbnail-mini thumb-emoji';
      boardThumbnailMini.innerHTML = `<span style="font-size: 15px; line-height: 1;">${b.icon || '📋'}</span>`;
    }
  }
  window.updateBoardThumbnailMini = updateBoardThumbnailMini;

  function loadCategories() {
    try {
      const stored = localStorage.getItem('brainboard_categories');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return ['Creative', 'Random'];
  }

  function saveCategories() {
    try {
      localStorage.setItem('brainboard_categories', JSON.stringify(workspaceCategories));
    } catch (e) {}
  }

  let workspaceCategories = loadCategories();
  window.workspaceCategories = workspaceCategories;

  const DEFAULT_BOARD_THUMBNAILS = {
    'dev_ai': '../extracted_board/3458764518261592670.png',
    '3d_software': '../extracted_board/3458764515599856442.png',
    'concepts': '../extracted_board/3458764515213167678.jpg',
    'general': '../extracted_board/3458764516713307932.png',
    'graphics_design': '../extracted_board/3458764517476483056.png',
    'houdini': '../extracted_board/3458764515521894164.png',
    'impresion_3d': '../extracted_board/3458764515884288757.png',
    'industria': '../extracted_board/3458764515589609465.png',
    'olalla_light_slu': '../extracted_board/3458764516706154583.png',
    'ordenador': '../extracted_board/3458764515218327607.png',
    'recursos': '../extracted_board/3458764515541285192.jpg',
    'space': '../extracted_board/3458764515586134432.png',
    'trips': '../extracted_board/3458764516561379465.png',
    'zbrush': '../extracted_board/3458764515626125193.jpg'
  };
  window.DEFAULT_BOARD_THUMBNAILS = DEFAULT_BOARD_THUMBNAILS;

  function loadWorkspaceBoards() {
    let boards = null;
    try {
      const stored = localStorage.getItem('brainboard_workspace_boards') || localStorage.getItem('miro_workspace_boards');
      if (stored) {
        boards = JSON.parse(stored);
      }
    } catch (e) {}

    const defaultBoards = [
      { id: 'dev_ai', title: 'DEV / AI', icon: 'code', thumbnail: DEFAULT_BOARD_THUMBNAILS['dev_ai'], category: 'Creative', lastOpened: 'Hoy', active: false },
      { id: '3d_software', title: '3D SOFTWARE', icon: 'Ⓜ️', thumbnail: DEFAULT_BOARD_THUMBNAILS['3d_software'], category: 'Random', lastOpened: '19 jun', active: false },
      { id: 'baile', title: 'Baile', icon: '💃', thumbnail: null, category: 'Random', lastOpened: '14 mar', active: false },
      { id: 'concepts', title: 'Concepts', icon: '🎨', thumbnail: DEFAULT_BOARD_THUMBNAILS['concepts'], category: 'Random', lastOpened: '22 may', active: false },
      { id: 'general', title: 'General', icon: '🚀', thumbnail: DEFAULT_BOARD_THUMBNAILS['general'], category: 'Random', lastOpened: '24 may', active: false },
      { id: 'graphics_design', title: 'Graphics Design', icon: '📊', thumbnail: DEFAULT_BOARD_THUMBNAILS['graphics_design'], category: 'Random', lastOpened: '8 oct', active: false },
      { id: 'houdini', title: 'Houdini', icon: '⚡', thumbnail: DEFAULT_BOARD_THUMBNAILS['houdini'], category: 'Random', lastOpened: '11 may', active: false },
      { id: 'impresion_3d', title: 'Impresión 3D', icon: '🗑️', thumbnail: DEFAULT_BOARD_THUMBNAILS['impresion_3d'], category: 'Random', lastOpened: '2 oct', active: false },
      { id: 'industria', title: 'INDUSTRIA', icon: '🪐', thumbnail: DEFAULT_BOARD_THUMBNAILS['industria'], category: 'Random', lastOpened: '15 jun', active: false },
      { id: 'olalla_light_slu', title: 'Olalla Light SLU', icon: '💡', thumbnail: DEFAULT_BOARD_THUMBNAILS['olalla_light_slu'], category: 'Random', lastOpened: '12 abr', active: false },
      { id: 'ordenador', title: 'Ordenador', icon: '💻', thumbnail: DEFAULT_BOARD_THUMBNAILS['ordenador'], category: 'Random', lastOpened: '25 ago', active: false },
      { id: 'recursos', title: 'Recursos', icon: '📁', thumbnail: DEFAULT_BOARD_THUMBNAILS['recursos'], category: 'Random', lastOpened: '4 sep', active: false },
      { id: 'space', title: 'SPACE', icon: '🌌', thumbnail: DEFAULT_BOARD_THUMBNAILS['space'], category: 'Ciencia & Espacio', lastOpened: 'Hoy', active: false },
      { id: 'trips', title: 'TRIPS', icon: '✈️', thumbnail: DEFAULT_BOARD_THUMBNAILS['trips'], category: 'Random', lastOpened: '29 sep', active: false },
      { id: 'zbrush', title: 'ZBRUSH', icon: '🗿', thumbnail: DEFAULT_BOARD_THUMBNAILS['zbrush'], category: 'Random', lastOpened: '22 jun', active: false }
    ];

    if (!Array.isArray(boards) || boards.length === 0) {
      return defaultBoards;
    }

    // Normalizar y migrar datos asegurando categoría, miniatura y fecha de apertura
    boards.forEach(b => {
      if (b.id === 'dev_ai' || b.title?.trim().toLowerCase() === 'dev / ai') {
        b.category = 'Creative';
        if (!b.icon) b.icon = 'code';
      } else if (!b.category) {
        b.category = 'Random';
      }
      if (!b.thumbnail && DEFAULT_BOARD_THUMBNAILS[b.id]) {
        b.thumbnail = DEFAULT_BOARD_THUMBNAILS[b.id];
      }
      if (!b.lastOpened) {
        b.lastOpened = 'Hoy';
      }
    });

    // Agregar tableros de la vista general si faltaban o enriquecer los existentes
    defaultBoards.forEach(def => {
      const existing = boards.find(b => b.id === def.id || b.title?.trim().toLowerCase() === def.title.trim().toLowerCase());
      if (!existing) {
        boards.push(def);
      } else {
        if (!existing.id) existing.id = def.id;
        if (!existing.category) existing.category = def.category;
        if (!existing.icon || existing.icon === '📋') existing.icon = def.icon;
        if (!existing.thumbnail && def.thumbnail) existing.thumbnail = def.thumbnail;
      }
    });

    return boards;
  }

  function saveWorkspaceBoards() {
    try {
      localStorage.setItem('brainboard_workspace_boards', JSON.stringify(workspaceBoards));
    } catch (e) {}
  }

  const workspaceBoards = loadWorkspaceBoards();
  window.workspaceBoards = workspaceBoards;

  // --- Sistema de Pestañas de Brain Board ---
  const tabsList = document.getElementById('tabs-list');
  const btnTabNew = document.getElementById('btn-tab-new');

  function loadOpenTabs() {
    try {
      const data = localStorage.getItem('brainboard_open_tabs') || localStorage.getItem('miro_open_tabs');
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
      localStorage.setItem('brainboard_open_tabs', JSON.stringify(openTabs));
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

  async function openBoardTab(boardId) {
    if (!openTabs.includes(boardId)) {
      openTabs.push(boardId);
      saveOpenTabs();
    }
    return await switchBoard(boardId);
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
    showHomeScreen();
  });

  window.switchBoard = switchBoard;

  async function switchBoard(targetBoardId) {
    if (!targetBoardId) return;

    // Si ya estamos en el tablero activo y tiene contenido, no reiniciar
    if (targetBoardId === currentActiveBoardId && engine.items.length > 0) {
      engine.fitView();
      updateMinimap();
      return;
    }

    // Cancelar cualquier temporizador pendiente de autoguardado antes de cambiar
    clearTimeout(saveTimeout);

    // 1. Guardar de forma inmediata el tablero anterior antes de salir de él
    if (activeEditingItem) closeInlineEditor();
    const prevBoardId = currentActiveBoardId;
    if (prevBoardId && prevBoardId !== targetBoardId) {
      await autoSaveBoardImmediately(prevBoardId);
    }

    // 2. LIMPIEZA INMEDIATA: Vaciar elementos, selección, conectores e historial
    // para evitar cualquier contaminación visual o de estado cruzada
    engine.items = [];
    engine.selectedItemIds.clear();
    engine.clearHistory();
    engine.camera = { x: 0, y: 0, zoom: 1 };
    engine.activeConnector = null;
    engine.isConnectingFromPort = false;
    engine.hoveredSnapPort = null;
    engine.hoveredConnectorPort = null;
    engine.lastPointerWorld = null;
    pasteCascadeCount = 0;
    lastPasteTargetWorld = null;
    engine.render();

    // 3. Establecer el nuevo tablero activo
    hideHomeScreen();
    currentActiveBoardId = targetBoardId;
    localStorage.setItem('brainboard_active_board_id', currentActiveBoardId);
    workspaceBoards.forEach(b => b.active = (b.id === targetBoardId));
    const activeMeta = workspaceBoards.find(b => b.id === targetBoardId);
    if (boardTitleInput) {
      boardTitleInput.value = activeMeta?.title || (targetBoardId === 'dev_ai' ? 'DEV / AI' : targetBoardId);
      fitBoardTitleWidth();
    }
    updateBoardThumbnailMini(targetBoardId);

    if (!openTabs.includes(targetBoardId)) {
      openTabs.push(targetBoardId);
      saveOpenTabs();
    }
    renderTabs();
    renderDrawerBoards();

    // 4. Cargar el estado guardado del tablero objetivo desde IndexedDB
    let saved = await idbLoadBoard(targetBoardId);
    if (!saved) {
      try {
        const ls = localStorage.getItem(`brainboard_board_${targetBoardId}`) || localStorage.getItem(`miro_board_${targetBoardId}`) || (targetBoardId === 'dev_ai' ? (localStorage.getItem('brainboard_local_current_board_v3') || localStorage.getItem('miro_local_current_board_v3')) : null);
        if (ls) saved = JSON.parse(ls);
      } catch (e) {}
    }

    // Comprobar si el archivo de semilla en disco tiene una versión más nueva que la caché guardada
    let isOutdatedCache = false;
    let seedData = null;
    try {
      seedData = await fetchBoardSeedData(targetBoardId);
      if (seedData && typeof seedData.seedVersion === 'number') {
        const savedVer = typeof saved?.seedVersion === 'number' ? saved.seedVersion : 0;
        // El trabajo del usuario es sagrado: solo considerar desactualizada una plantilla si el usuario NO la ha editado
        if ((!saved?.userModified && seedData.seedVersion > savedVer) || (targetBoardId === 'space' && seedData.seedVersion >= 5 && savedVer < 5)) {
          isOutdatedCache = true;
        }
      }
    } catch(e) {}

    const hasValidSavedItems = !isOutdatedCache && saved && Array.isArray(saved.items) && saved.items.length > 0;

    if (hasValidSavedItems) {
      sanitizeEmbedResources(saved.items);
      engine.items = saved.items;
      engine.items.forEach(it => {
        if (it.imgElement && typeof it.imgElement.getAttribute !== 'function') {
          delete it.imgElement;
        }
      });
      engine.selectedItemIds.clear();
      engine.clearHistory();
      if (boardTitleInput) {
        boardTitleInput.value = saved.name || activeMeta?.title || (targetBoardId === 'dev_ai' ? 'DEV / AI' : targetBoardId);
        fitBoardTitleWidth();
      }
      engine.fitView();
      updateMinimap();
      engine.currentSeedVersion = Math.max(saved.seedVersion || 0, seedData?.seedVersion || 0, 3);
      if (saveStatusText) saveStatusText.innerText = 'Guardado';
      return;
    }

    // 5. Si no tiene datos guardados todavía (o tenían 0 items), sembrar con archivo de tablero correspondiente
    const seeded = await loadSeedBoard(targetBoardId);
    if (seeded) return;

    // 6. Para cualquier otro tablero nuevo sin contenido previo, iniciar completamente limpio
    engine.items = [];
    engine.selectedItemIds.clear();
    engine.clearHistory();
    engine.fitView();
    updateMinimap();
    await autoSaveBoardImmediately(targetBoardId);
  }

  // Crear nuevo tablero en la sección de TABLEROS
  async function createNewBoard(customName) {
    clearTimeout(saveTimeout);
    // 1. Guardar de forma inmediata el tablero actual antes de salir de él
    if (activeEditingItem) closeInlineEditor();
    if (currentActiveBoardId) {
      await autoSaveBoardImmediately(currentActiveBoardId);
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
    const targetCat = (typeof currentCategoryFilter !== 'undefined' && currentCategoryFilter !== 'all') ? currentCategoryFilter : 'Random';
    const newBoard = { id: newBoardId, title: name, icon: '📋', category: targetCat, lastOpened: 'Hoy', active: true };

    // 4. LIMPIEZA ABSOLUTA DEL LIENZO: vaciar items, selección, historial y controles
    engine.items = [];
    engine.selectedItemIds.clear();
    engine.clearHistory();
    engine.camera = { x: 0, y: 0, zoom: 1 };
    engine.activeConnector = null;
    engine.isConnectingFromPort = false;
    engine.hoveredSnapPort = null;
    engine.hoveredConnectorPort = null;
    engine.render();

    // 5. Marcar inactivos los demás y añadir a la lista del espacio de trabajo
    if (Array.isArray(workspaceBoards)) {
      workspaceBoards.forEach(b => b.active = false);
      workspaceBoards.push(newBoard);
      saveWorkspaceBoards();
    }

    if (!openTabs.includes(newBoardId)) {
      openTabs.push(newBoardId);
      saveOpenTabs();
    }

    // 6. Establecer como activo
    currentActiveBoardId = newBoardId;
    localStorage.setItem('brainboard_active_board_id', currentActiveBoardId);

    // 7. Actualizar campo de título en la barra superior
    if (boardTitleInput) {
      boardTitleInput.value = name;
      fitBoardTitleWidth();
    }

    // 8. Renderizar de inmediato en la sección de TABLEROS del panel y en pestañas
    renderDrawerBoards();
    renderTabs();
    if (typeof renderHomeScreen === 'function') renderHomeScreen();

    // 9. Guardar inmediatamente el estado inicial en IndexedDB y LocalStorage
    await autoSaveBoardImmediately(newBoardId);

    // 10. Ajustar vista y actualizar minimapa
    engine.fitView();
    updateMinimap();

    // 11. Mantener el panel abierto y hacer scroll suave al nuevo tablero creado
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
    if (boardId === 'dev_ai') return;
    const b = workspaceBoards.find(it => it.id === boardId);
    if (!b) return;

    boardPendingDeletion = boardId;
    if (deleteBoardModalMsg) {
      deleteBoardModalMsg.innerHTML = `¿Estás seguro de que deseas eliminar el tablero <strong>"${b.title}"</strong>?<br><br>Esta acción no se puede deshacer y se perderán todos los datos guardados en él.`;
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
    if (boardId === 'dev_ai') return;
    const idx = workspaceBoards.findIndex(b => b.id === boardId);
    if (idx === -1) return;

    workspaceBoards.splice(idx, 1);
    saveWorkspaceBoards();

    if (openTabs.includes(boardId)) {
      const oIdx = openTabs.indexOf(boardId);
      openTabs.splice(oIdx, 1);
      if (openTabs.length === 0 && workspaceBoards.length > 0) openTabs = [workspaceBoards[0].id];
      saveOpenTabs();
    }
    renderTabs();

    try {
      localStorage.removeItem(`brainboard_board_${boardId}`);
      localStorage.removeItem(`miro_board_${boardId}`);
      await idbDeleteBoard(boardId);
    } catch (e) {}

    renderDrawerBoards(inputDrawerSearch ? inputDrawerSearch.value : '');
    if (typeof renderHomeScreen === 'function') renderHomeScreen();

    if (currentActiveBoardId === boardId) {
      const fallbackId = openTabs[0] || (workspaceBoards[0] ? workspaceBoards[0].id : null);
      if (fallbackId) {
        await switchBoard(fallbackId);
      }
    }
  }

  function renderDrawerBoards(filter = '') {
    if (!drawerBoardsList) return;
    drawerBoardsList.innerHTML = '';
    const filtered = workspaceBoards.filter(b => b.title.toLowerCase().includes(filter.toLowerCase()));
    filtered.forEach(board => {
      const item = document.createElement('div');
      item.className = 'drawer-board-item' + (board.active ? ' active' : '');
      const canDelete = board.id !== 'dev_ai';
      let thumbHtml = '';
      const thumbSrc = board.thumbnail || DEFAULT_BOARD_THUMBNAILS[board.id];
      if (thumbSrc) {
        thumbHtml = `<div class="drawer-board-thumb"><img src="${thumbSrc}" class="drawer-board-thumb-img" alt="${board.title}" onerror="this.style.display='none'; this.parentElement.innerText='${board.icon || '📋'}';" /></div>`;
      } else if (board.icon === 'code' || board.id === 'dev_ai') {
        thumbHtml = `<div class="drawer-board-thumb thumb-code"><span class="thumb-code-brackets" style="font-size: 11px;">&lt;/&gt;</span></div>`;
      } else {
        thumbHtml = `<div class="drawer-board-icon">${board.icon || '📋'}</div>`;
      }

      item.innerHTML = `
        ${thumbHtml}
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

  // Clic en el logo de Brain Board lleva a la pantalla de Inicio
  document.querySelector('.brainboard-logo-brand')?.addEventListener('click', () => {
    boardControllerDrawer?.classList.remove('open');
    showHomeScreen();
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
  menuOptBackup?.addEventListener('click', () => {
    boardOptionsMenu?.classList.remove('visible');
    exportAllBoardsBackup();
  });
  menuOptExportHires?.addEventListener('click', () => {
    boardOptionsMenu?.classList.remove('visible');
    openExportModal();
  });
  btnResetZoom?.addEventListener('click', () => {
    engine.fitView();
  });

  // =========================================================
  // GESTIÓN DE TEMA (MODO OSCURO / CLARO)
  // =========================================================
  const btnToggleTheme = document.getElementById('btn-toggle-theme');
  const btnHomeToggleTheme = document.getElementById('btn-home-toggle-theme');

  function applyTheme(theme) {
    const isDark = theme === 'dark';
    if (isDark) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
    engine.setDarkMode(isDark);
    try {
      localStorage.setItem('brainboard_theme', isDark ? 'dark' : 'light');
    } catch (e) {}
    try {
      updateMinimap();
    } catch (e) {}
  }
  window.applyTheme = applyTheme;

  function toggleTheme() {
    const isCurrentDark = document.body.classList.contains('dark-theme');
    applyTheme(isCurrentDark ? 'light' : 'dark');
  }
  window.toggleTheme = toggleTheme;

  btnToggleTheme?.addEventListener('click', toggleTheme);
  btnHomeToggleTheme?.addEventListener('click', toggleTheme);
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

  // =========================================================
  // OPCIONES DE DESARROLLADOR (DEV TOOLS)
  // =========================================================
  const btnDevOptionsTrigger = document.getElementById('btn-dev-options-trigger');
  const devOptionsMenu = document.getElementById('dev-options-menu');
  const devOptSelectArrows = document.getElementById('dev-opt-select-arrows');
  const devOptSelectFrames = document.getElementById('dev-opt-select-frames');

  btnDevOptionsTrigger?.addEventListener('click', (e) => {
    e.stopPropagation();
    boardOptionsMenu?.classList.remove('visible');
    devOptionsMenu?.classList.toggle('visible');
  });

  function selectItemsByFilter(filterFn, labelSingular, labelPlural) {
    if (!engine || !Array.isArray(engine.items)) return;
    engine.selectedItemIds.clear();
    const matching = engine.items.filter(filterFn);
    matching.forEach(it => engine.selectedItemIds.add(it.id));
    if (engine.onSelectionChange) {
      engine.onSelectionChange(Array.from(engine.selectedItemIds));
    }
    engine.render();

    const count = matching.length;
    const msg = count === 0
      ? `No se encontraron ${labelPlural} en este tablero`
      : (count === 1 ? `1 ${labelSingular} seleccionado` : `${count} ${labelPlural} seleccionados`);
    showDevToast(msg);
  }

  devOptSelectArrows?.addEventListener('click', () => {
    devOptionsMenu?.classList.remove('visible');
    selectItemsByFilter(
      it => it.type === 'connector' || it.type === 'arrow',
      'flecha',
      'flechas'
    );
  });

  devOptSelectFrames?.addEventListener('click', () => {
    devOptionsMenu?.classList.remove('visible');
    selectItemsByFilter(
      it => it.type === 'frame',
      'marco contenedor',
      'marcos contenedores'
    );
  });

  // Cierre de menús flotantes al hacer clic fuera
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#board-options-menu') && !e.target.closest('#btn-board-options-trigger')) {
      boardOptionsMenu?.classList.remove('visible');
    }
    if (!e.target.closest('#dev-options-menu') && !e.target.closest('#btn-dev-options-trigger')) {
      devOptionsMenu?.classList.remove('visible');
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
    btnBoardSearchTrigger?.classList.add('active');
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
    btnBoardSearchTrigger?.classList.remove('active');
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
    if (boardSearchBar && boardSearchBar.style.display === 'flex') {
      closeSearchBar();
    } else {
      openSearchBar();
    }
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
  // 3. COMENTARIOS Y PINES FLOTANTES (Pin interactivo)
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

  // =========================================================================
  // CONTROLADOR DE PANTALLA DE INICIO (HOME DASHBOARD) & VISTA GENERAL
  // =========================================================================

  const homeScreen = document.getElementById('home-screen');
  const homeBoardsTbody = document.getElementById('home-boards-tbody');
  const homeCategoriesList = document.getElementById('home-categories-list');
  const homeCountAll = document.getElementById('home-count-all');
  const homeNavAll = document.getElementById('home-nav-all');
  const homeViewTitle = document.getElementById('home-view-title');
  const homeViewSubtitle = document.getElementById('home-view-subtitle');
  const inputHomeSearch = document.getElementById('input-home-search');
  const btnHomeNewBoard = document.getElementById('btn-home-new-board');
  const btnHomeCreateBoardTop = document.getElementById('btn-home-create-board-top');
  const btnHomeAddCategory = document.getElementById('btn-home-add-category');
  const btnHomeImport = document.getElementById('btn-home-import');
  const btnHomeBackup = document.getElementById('btn-home-backup');
  const btnTabHome = document.getElementById('btn-tab-home');
  const btnBrandHome = document.getElementById('btn-brand-home');
  const homeRowOptionsMenu = document.getElementById('home-row-options-menu');

  // Modales de la Pantalla de Inicio
  const renameBoardModal = document.getElementById('rename-board-modal');
  const inputRenameBoardTitle = document.getElementById('input-rename-board-title');
  const btnCloseRenameModal = document.getElementById('btn-close-rename-modal');
  const btnCancelRename = document.getElementById('btn-cancel-rename');
  const btnConfirmRename = document.getElementById('btn-confirm-rename');

  const changeThumbnailModal = document.getElementById('change-thumbnail-modal');
  const thumbModalPreview = document.getElementById('thumb-modal-preview');
  const btnUploadThumbImage = document.getElementById('btn-upload-thumb-image');
  const inputThumbFile = document.getElementById('input-thumb-file');
  const btnResetThumb = document.getElementById('btn-reset-thumb');
  const thumbIconsGrid = document.getElementById('thumb-icons-grid');
  const btnCloseThumbModal = document.getElementById('btn-close-thumb-modal');
  const btnCancelThumb = document.getElementById('btn-cancel-thumb');
  const btnConfirmThumb = document.getElementById('btn-confirm-thumb');

  const moveCategoryModal = document.getElementById('move-category-modal');
  const moveCatOptionsList = document.getElementById('move-cat-options-list');
  const inputInlineNewCat = document.getElementById('input-inline-new-cat');
  const btnInlineAddCat = document.getElementById('btn-inline-add-cat');
  const btnCloseMoveCatModal = document.getElementById('btn-close-move-cat-modal');
  const btnCancelMoveCat = document.getElementById('btn-cancel-move-cat');
  const btnConfirmMoveCat = document.getElementById('btn-confirm-move-cat');

  const newCategoryModal = document.getElementById('new-category-modal');
  const inputNewCatName = document.getElementById('input-new-cat-name');
  const btnCloseNewCatModal = document.getElementById('btn-close-new-cat-modal');
  const btnCancelNewCat = document.getElementById('btn-cancel-new-cat');
  const btnConfirmNewCat = document.getElementById('btn-confirm-new-cat');

  // Opciones de menú contextual de fila
  const homeOptRename = document.getElementById('home-opt-rename');
  const homeOptThumbnail = document.getElementById('home-opt-thumbnail');
  const homeOptExportHires = document.getElementById('home-opt-export-hires');
  const homeOptExportJson = document.getElementById('home-opt-export-json');
  const homeOptMoveCat = document.getElementById('home-opt-move-cat');
  const homeOptDelete = document.getElementById('home-opt-delete');

  const QUICK_THUMB_ICONS = ['⚡', '📊', '🗑️', 'Ⓜ️', '🪐', '🚀', '💃', '🎨', '💻', '🧠', '📁', '📐', '📝', '🎯', '💡', '💎'];

  let currentCategoryFilter = 'all';
  let homeSearchQuery = '';
  let activeRowActionBoardId = null;
  let activeRowActionButton = null;
  let boardPendingRename = null;
  let boardPendingThumbnailEdit = null;
  let tempSelectedThumbnail = null;
  let tempSelectedIcon = null;
  let boardPendingCategoryMove = null;
  let tempTargetCategory = null;

  // Exportar 4K reutilizando motor
  async function exportBoardHiResById(boardId, scale = 4) {
    const b = workspaceBoards.find(x => x.id === boardId);
    const titleClean = (b?.title || 'tablero').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${titleClean}_4K.png`;

    let items = null;
    if (currentActiveBoardId === boardId && engine.items && engine.items.length > 0) {
      items = engine.items;
    } else {
      const saved = await idbLoadBoard(boardId);
      if (saved && Array.isArray(saved.items) && saved.items.length > 0) {
        items = saved.items;
      } else {
        const seedData = await fetchBoardSeedData(boardId);
        if (seedData) {
          items = (seedData.items && Array.isArray(seedData.items)) ? seedData.items : convertMiroToBrainBoard(seedData);
        }
      }
    }

    if (!items || items.length === 0) {
      alert(`El tablero "${b?.title || boardId}" no contiene elementos para exportar.`);
      return;
    }

    const prevItems = engine.items;
    const prevActive = currentActiveBoardId;
    try {
      engine.items = items;
      await engine.exportHiRes({ scale, filename });
    } catch (err) {
      console.error('Error al exportar 4K:', err);
    } finally {
      engine.items = prevItems;
      currentActiveBoardId = prevActive;
    }
  }

  // Exportar JSON reutilizando función
  async function exportBoardJsonById(boardId) {
    const b = workspaceBoards.find(x => x.id === boardId);
    const title = b?.title || 'Tablero';
    let dataToExport = null;

    if (currentActiveBoardId === boardId && engine.items && engine.items.length > 0) {
      const cleanItems = engine.getCleanItems ? engine.getCleanItems() : engine.items;
      dataToExport = {
        name: title,
        updatedAt: new Date().toISOString(),
        items: cleanItems
      };
    } else {
      const saved = await idbLoadBoard(boardId);
      if (saved && Array.isArray(saved.items) && saved.items.length > 0) {
        dataToExport = {
          name: saved.name || title,
          updatedAt: saved.updatedAt || new Date().toISOString(),
          items: saved.items
        };
      } else {
        const seedData = await fetchBoardSeedData(boardId);
        if (seedData) {
          dataToExport = seedData;
        }
      }

      if (!dataToExport) {
        dataToExport = {
          name: title,
          updatedAt: new Date().toISOString(),
          items: []
        };
      }
    }

    const jsonStr = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = title.replace(/[^a-zA-Z0-9_-]/g, '_') + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function showHomeScreen() {
    clearTimeout(saveTimeout);
    if (currentActiveBoardId && engine.items && engine.items.length > 0) {
      autoSaveBoardImmediately(currentActiveBoardId);
      const activeB = workspaceBoards.find(it => it.id === currentActiveBoardId);
      if (activeB) {
        activeB.lastOpened = 'Hoy';
        saveWorkspaceBoards();
      }
    }
    closeHomeRowOptionsMenu();
    boardOptionsMenu?.classList.remove('visible');
    devOptionsMenu?.classList.remove('visible');
    boardControllerDrawer?.classList.remove('open');
    assetsDrawer?.classList.remove('visible');
    if (homeScreen) homeScreen.style.display = 'flex';

    // Ocultar barras de herramientas exclusivas del lienzo/tableros
    const topBar = document.getElementById('top-bar');
    const leftToolbar = document.getElementById('left-toolbar');
    const zoomControls = document.getElementById('zoom-controls');
    const tabsBar = document.getElementById('tabs-bar');
    const minimapContainer = document.getElementById('minimap-container');
    const btnShowMinimap = document.getElementById('btn-show-minimap');
    const propertiesBar = document.getElementById('properties-bar');
    const floatingItemUrlBadge = document.getElementById('floating-item-url-badge');

    if (topBar) topBar.style.display = 'none';
    if (leftToolbar) leftToolbar.style.display = 'none';
    if (zoomControls) zoomControls.style.display = 'none';
    if (tabsBar) tabsBar.style.display = 'none';
    if (minimapContainer) minimapContainer.style.display = 'none';
    if (btnShowMinimap) btnShowMinimap.style.display = 'none';
    if (propertiesBar) propertiesBar.classList.remove('visible');
    if (floatingItemUrlBadge) floatingItemUrlBadge.style.display = 'none';

    renderHomeScreen();
  }
  window.showHomeScreen = showHomeScreen;

  function hideHomeScreen() {
    closeHomeRowOptionsMenu();
    if (homeScreen) homeScreen.style.display = 'none';

    // Mostrar barras de herramientas en la vista del tablero
    const topBar = document.getElementById('top-bar');
    const leftToolbar = document.getElementById('left-toolbar');
    const zoomControls = document.getElementById('zoom-controls');
    const tabsBar = document.getElementById('tabs-bar');
    if (topBar) topBar.style.display = 'flex';
    if (leftToolbar) leftToolbar.style.display = 'flex';
    if (zoomControls) zoomControls.style.display = 'flex';
    if (tabsBar) tabsBar.style.display = 'flex';

    setTimeout(() => {
      engine.resize();
      engine.render();
    }, 50);
  }
  window.hideHomeScreen = hideHomeScreen;

  async function openBoardFromHome(boardId) {
    if (!boardId) return;
    const b = workspaceBoards.find(it => it.id === boardId);
    if (b) {
      b.lastOpened = 'Hoy';
      saveWorkspaceBoards();
    }
    hideHomeScreen();
    await openBoardTab(boardId);
  }

  function renderHomeScreen() {
    if (!homeBoardsTbody) return;
    homeBoardsTbody.innerHTML = '';

    if (homeCountAll) {
      homeCountAll.textContent = workspaceBoards.length;
    }

    renderHomeCategories();

    let filtered = workspaceBoards.filter(b => {
      if (currentCategoryFilter !== 'all' && (b.category || 'Random') !== currentCategoryFilter) {
        return false;
      }

      if (homeSearchQuery) {
        const query = homeSearchQuery.toLowerCase();
        const matchesTitle = (b.title || '').toLowerCase().includes(query);
        const matchesCat = (b.category || '').toLowerCase().includes(query);
        if (!matchesTitle && !matchesCat) return false;
      }

      return true;
    });

    if (homeViewTitle) {
      if (currentCategoryFilter === 'all') {
        homeViewTitle.textContent = homeSearchQuery ? `Resultados de búsqueda` : 'Todos los tableros';
      } else {
        homeViewTitle.textContent = currentCategoryFilter;
      }
    }
    if (homeViewSubtitle) {
      homeViewSubtitle.textContent = `${filtered.length} ${filtered.length === 1 ? 'tablero' : 'tableros'}`;
    }

    if (filtered.length === 0) {
      const emptyRow = document.createElement('tr');
      emptyRow.innerHTML = `
        <td colspan="4" style="text-align: center; padding: 48px 16px; color: #94a3b8; font-size: 14px;">
          No se encontraron tableros en esta categoría.
        </td>
      `;
      homeBoardsTbody.appendChild(emptyRow);
      return;
    }

    filtered.forEach(board => {
      const tr = document.createElement('tr');
      tr.setAttribute('data-board-id', board.id);

      let thumbHtml = '';
      if (board.thumbnail) {
        thumbHtml = `<div class="board-table-thumb"><img src="${board.thumbnail}" class="board-table-thumb-img" alt="${board.title}" /></div>`;
      } else if (board.icon === 'code' || board.id === 'dev_ai') {
        thumbHtml = `<div class="board-table-thumb thumb-code"><span class="thumb-code-brackets">&lt;/&gt;</span></div>`;
      } else {
        thumbHtml = `<div class="board-table-thumb thumb-emoji">${board.icon || '📋'}</div>`;
      }

      tr.innerHTML = `
        <td class="td-name">
          <div class="board-cell-name">
            ${thumbHtml}
            <div class="board-table-info">
              <span class="board-table-title">${board.title}</span>
            </div>
          </div>
        </td>
        <td class="td-space">
          <span class="board-table-space">${board.category || 'Random'}</span>
        </td>
        <td class="td-opened">
          <span class="board-table-opened">${board.lastOpened || 'Hoy'}</span>
        </td>
        <td class="td-actions">
          <button class="btn-board-row-options" data-board-id="${board.id}" title="Opciones">⋮</button>
        </td>
      `;

      tr.addEventListener('click', (e) => {
        if (e.target.closest('.btn-board-row-options')) return;
        openBoardFromHome(board.id);
      });

      const optBtn = tr.querySelector('.btn-board-row-options');
      if (optBtn) {
        optBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openHomeRowOptionsMenu(board.id, optBtn);
        });
      }

      homeBoardsTbody.appendChild(tr);
    });
  }

  function renderHomeCategories() {
    if (!homeCategoriesList) return;
    homeCategoriesList.innerHTML = '';

    if (homeNavAll) {
      homeNavAll.classList.toggle('active', currentCategoryFilter === 'all');
    }

    workspaceCategories.forEach(cat => {
      const count = workspaceBoards.filter(b => (b.category || 'Random') === cat).length;
      const item = document.createElement('div');
      item.className = 'home-category-item' + (currentCategoryFilter === cat ? ' active' : '');
      item.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        <span class="home-category-name">${cat}</span>
        <span class="home-nav-count">${count}</span>
      `;

      item.addEventListener('click', () => {
        currentCategoryFilter = cat;
        renderHomeScreen();
      });

      homeCategoriesList.appendChild(item);
    });
  }

  function openHomeRowOptionsMenu(boardId, btnEl) {
    if (!homeRowOptionsMenu) return;

    if (activeRowActionBoardId === boardId && homeRowOptionsMenu.style.display === 'block') {
      closeHomeRowOptionsMenu();
      return;
    }

    if (activeRowActionButton) {
      activeRowActionButton.classList.remove('active');
    }

    activeRowActionBoardId = boardId;
    activeRowActionButton = btnEl;
    btnEl.classList.add('active');

    const rect = btnEl.getBoundingClientRect();
    const menuWidth = 220;
    const menuHeight = 240;

    let left = rect.right - menuWidth;
    let top = rect.bottom + 4;

    if (top + menuHeight > window.innerHeight) {
      top = rect.top - menuHeight - 4;
    }
    if (left < 10) left = 10;

    homeRowOptionsMenu.style.left = `${left}px`;
    homeRowOptionsMenu.style.top = `${top}px`;
    homeRowOptionsMenu.style.display = 'block';
  }

  function closeHomeRowOptionsMenu() {
    if (activeRowActionButton) {
      activeRowActionButton.classList.remove('active');
      activeRowActionButton = null;
    }
    activeRowActionBoardId = null;
    if (homeRowOptionsMenu) {
      homeRowOptionsMenu.style.display = 'none';
    }
  }

  window.addEventListener('click', (e) => {
    if (homeRowOptionsMenu && homeRowOptionsMenu.style.display === 'block') {
      if (!homeRowOptionsMenu.contains(e.target) && !e.target.closest('.btn-board-row-options')) {
        closeHomeRowOptionsMenu();
      }
    }
  });

  // --- Opciones de la Fila ---

  // 1. Cambiar nombre
  homeOptRename?.addEventListener('click', () => {
    const boardId = activeRowActionBoardId;
    closeHomeRowOptionsMenu();
    if (!boardId) return;

    const b = workspaceBoards.find(x => x.id === boardId);
    if (!b) return;

    boardPendingRename = boardId;
    if (inputRenameBoardTitle) {
      inputRenameBoardTitle.value = b.title || '';
    }
    if (renameBoardModal) {
      renameBoardModal.style.display = 'flex';
      setTimeout(() => inputRenameBoardTitle?.focus(), 50);
    }
  });

  function closeRenameModal() {
    boardPendingRename = null;
    if (renameBoardModal) renameBoardModal.style.display = 'none';
  }
  btnCloseRenameModal?.addEventListener('click', closeRenameModal);
  btnCancelRename?.addEventListener('click', closeRenameModal);
  renameBoardModal?.addEventListener('click', (e) => {
    if (e.target === renameBoardModal) closeRenameModal();
  });

  async function executeRenameBoard() {
    if (!boardPendingRename) return;
    const newName = inputRenameBoardTitle?.value?.trim();
    if (!newName) return;

    const b = workspaceBoards.find(x => x.id === boardPendingRename);
    if (b) {
      b.title = newName;
      saveWorkspaceBoards();
    }

    try {
      const saved = await idbLoadBoard(boardPendingRename);
      if (saved) {
        saved.name = newName;
        await idbSaveBoard(boardPendingRename, saved);
      }
    } catch (e) {}

    if (currentActiveBoardId === boardPendingRename && boardTitleInput) {
      boardTitleInput.value = newName;
      fitBoardTitleWidth();
    }

    renderTabs();
    renderDrawerBoards();
    renderHomeScreen();
    closeRenameModal();
  }
  btnConfirmRename?.addEventListener('click', executeRenameBoard);
  inputRenameBoardTitle?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') executeRenameBoard();
    if (e.key === 'Escape') closeRenameModal();
  });

  // 2. Cambiar miniatura
  homeOptThumbnail?.addEventListener('click', () => {
    const boardId = activeRowActionBoardId;
    closeHomeRowOptionsMenu();
    if (!boardId) return;

    const b = workspaceBoards.find(x => x.id === boardId);
    if (!b) return;

    boardPendingThumbnailEdit = boardId;
    tempSelectedThumbnail = b.thumbnail || null;
    tempSelectedIcon = b.icon || '📋';

    updateThumbModalPreview();
    renderThumbModalIconsGrid();

    if (changeThumbnailModal) {
      changeThumbnailModal.style.display = 'flex';
    }
  });

  function updateThumbModalPreview() {
    if (!thumbModalPreview) return;
    if (tempSelectedThumbnail) {
      thumbModalPreview.innerHTML = `<img src="${tempSelectedThumbnail}" style="width:100%;height:100%;object-fit:cover;" />`;
    } else if (tempSelectedIcon === 'code') {
      thumbModalPreview.innerHTML = `<div class="thumb-code" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;"><span class="thumb-code-brackets">&lt;/&gt;</span></div>`;
    } else {
      thumbModalPreview.innerHTML = tempSelectedIcon || '📋';
    }
  }

  function renderThumbModalIconsGrid() {
    if (!thumbIconsGrid) return;
    thumbIconsGrid.innerHTML = '';
    QUICK_THUMB_ICONS.forEach(icon => {
      const btn = document.createElement('div');
      btn.className = 'thumb-icon-choice' + (!tempSelectedThumbnail && tempSelectedIcon === icon ? ' selected' : '');
      btn.textContent = icon;
      btn.addEventListener('click', () => {
        tempSelectedThumbnail = null;
        tempSelectedIcon = icon;
        updateThumbModalPreview();
        renderThumbModalIconsGrid();
      });
      thumbIconsGrid.appendChild(btn);
    });
  }

  btnUploadThumbImage?.addEventListener('click', () => {
    inputThumbFile?.click();
  });

  inputThumbFile?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      tempSelectedThumbnail = evt.target.result;
      updateThumbModalPreview();
      renderThumbModalIconsGrid();
    };
    reader.readAsDataURL(file);
  });

  btnResetThumb?.addEventListener('click', () => {
    tempSelectedThumbnail = null;
    const b = workspaceBoards.find(x => x.id === boardPendingThumbnailEdit);
    tempSelectedIcon = (b?.id === 'dev_ai') ? 'code' : '📋';
    updateThumbModalPreview();
    renderThumbModalIconsGrid();
  });

  function closeThumbModal() {
    boardPendingThumbnailEdit = null;
    tempSelectedThumbnail = null;
    tempSelectedIcon = null;
    if (changeThumbnailModal) changeThumbnailModal.style.display = 'none';
  }
  btnCloseThumbModal?.addEventListener('click', closeThumbModal);
  btnCancelThumb?.addEventListener('click', closeThumbModal);
  changeThumbnailModal?.addEventListener('click', (e) => {
    if (e.target === changeThumbnailModal) closeThumbModal();
  });

  btnConfirmThumb?.addEventListener('click', () => {
    if (!boardPendingThumbnailEdit) return;
    const b = workspaceBoards.find(x => x.id === boardPendingThumbnailEdit);
    if (b) {
      b.thumbnail = tempSelectedThumbnail;
      b.icon = tempSelectedIcon || '📋';
      saveWorkspaceBoards();
    }
    renderTabs();
    renderDrawerBoards();
    renderHomeScreen();
    if (boardPendingThumbnailEdit === currentActiveBoardId) {
      updateBoardThumbnailMini(currentActiveBoardId);
    }
    closeThumbModal();
  });

  // 3. Exportar 4K
  homeOptExportHires?.addEventListener('click', async () => {
    const boardId = activeRowActionBoardId;
    closeHomeRowOptionsMenu();
    if (!boardId) return;
    await exportBoardHiResById(boardId, 4);
  });

  // 4. Exportar JSON
  homeOptExportJson?.addEventListener('click', async () => {
    const boardId = activeRowActionBoardId;
    closeHomeRowOptionsMenu();
    if (!boardId) return;
    await exportBoardJsonById(boardId);
  });

  // 5. Mover de categoría
  homeOptMoveCat?.addEventListener('click', () => {
    const boardId = activeRowActionBoardId;
    closeHomeRowOptionsMenu();
    if (!boardId) return;

    const b = workspaceBoards.find(x => x.id === boardId);
    if (!b) return;

    boardPendingCategoryMove = boardId;
    tempTargetCategory = b.category || 'Random';
    renderMoveCategoryOptions();

    if (moveCategoryModal) moveCategoryModal.style.display = 'flex';
  });

  function renderMoveCategoryOptions() {
    if (!moveCatOptionsList) return;
    moveCatOptionsList.innerHTML = '';
    workspaceCategories.forEach(cat => {
      const item = document.createElement('div');
      item.className = 'move-cat-option-item' + (tempTargetCategory === cat ? ' selected' : '');
      item.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        <span style="flex:1;">${cat}</span>
        ${tempTargetCategory === cat ? '<span style="color:#2563eb;font-weight:700;">✓</span>' : ''}
      `;
      item.addEventListener('click', () => {
        tempTargetCategory = cat;
        renderMoveCategoryOptions();
      });
      moveCatOptionsList.appendChild(item);
    });
  }

  btnInlineAddCat?.addEventListener('click', () => {
    const name = inputInlineNewCat?.value?.trim();
    if (!name) return;
    if (!workspaceCategories.includes(name)) {
      workspaceCategories.push(name);
      saveCategories();
    }
    tempTargetCategory = name;
    if (inputInlineNewCat) inputInlineNewCat.value = '';
    renderMoveCategoryOptions();
  });

  function closeMoveCatModal() {
    boardPendingCategoryMove = null;
    tempTargetCategory = null;
    if (moveCategoryModal) moveCategoryModal.style.display = 'none';
  }
  btnCloseMoveCatModal?.addEventListener('click', closeMoveCatModal);
  btnCancelMoveCat?.addEventListener('click', closeMoveCatModal);
  moveCategoryModal?.addEventListener('click', (e) => {
    if (e.target === moveCategoryModal) closeMoveCatModal();
  });

  btnConfirmMoveCat?.addEventListener('click', () => {
    if (!boardPendingCategoryMove || !tempTargetCategory) return;
    const b = workspaceBoards.find(x => x.id === boardPendingCategoryMove);
    if (b) {
      b.category = tempTargetCategory;
      saveWorkspaceBoards();
    }
    renderHomeScreen();
    closeMoveCatModal();
  });


  // 6. Eliminar
  homeOptDelete?.addEventListener('click', () => {
    const boardId = activeRowActionBoardId;
    closeHomeRowOptionsMenu();
    if (!boardId) return;
    openDeleteBoardModal(boardId);
  });

  // Crear nueva categoría
  btnHomeAddCategory?.addEventListener('click', () => {
    if (newCategoryModal) {
      if (inputNewCatName) inputNewCatName.value = '';
      newCategoryModal.style.display = 'flex';
      setTimeout(() => inputNewCatName?.focus(), 50);
    }
  });

  function closeNewCatModal() {
    if (newCategoryModal) newCategoryModal.style.display = 'none';
  }
  btnCloseNewCatModal?.addEventListener('click', closeNewCatModal);
  btnCancelNewCat?.addEventListener('click', closeNewCatModal);
  newCategoryModal?.addEventListener('click', (e) => {
    if (e.target === newCategoryModal) closeNewCatModal();
  });

  function executeCreateCategory() {
    const name = inputNewCatName?.value?.trim();
    if (!name) return;
    if (!workspaceCategories.includes(name)) {
      workspaceCategories.push(name);
      saveCategories();
    }
    currentCategoryFilter = name;
    renderHomeScreen();
    closeNewCatModal();
  }
  btnConfirmNewCat?.addEventListener('click', executeCreateCategory);
  inputNewCatName?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') executeCreateCategory();
    if (e.key === 'Escape') closeNewCatModal();
  });

  // Eventos de barra lateral y cabecera en Inicio
  homeNavAll?.addEventListener('click', () => {
    currentCategoryFilter = 'all';
    renderHomeScreen();
  });

  inputHomeSearch?.addEventListener('input', (e) => {
    homeSearchQuery = e.target.value.trim();
    renderHomeScreen();
  });

  btnHomeNewBoard?.addEventListener('click', async () => {
    const newBoard = await createNewBoard();
    if (newBoard) {
      if (currentCategoryFilter !== 'all') {
        newBoard.category = currentCategoryFilter;
      } else {
        newBoard.category = 'Random';
      }
      saveWorkspaceBoards();
      openBoardFromHome(newBoard.id);
    }
  });

  btnHomeCreateBoardTop?.addEventListener('click', async () => {
    const newBoard = await createNewBoard();
    if (newBoard) {
      if (currentCategoryFilter !== 'all') {
        newBoard.category = currentCategoryFilter;
      } else {
        newBoard.category = 'Random';
      }
      saveWorkspaceBoards();
      openBoardFromHome(newBoard.id);
    }
  });

  btnHomeImport?.addEventListener('click', () => {
    fileInput?.click();
  });

  btnHomeBackup?.addEventListener('click', () => {
    exportAllBoardsBackup();
  });

  // Navegación hacia la pantalla de inicio
  btnTabHome?.addEventListener('click', () => {
    showHomeScreen();
  });

  btnBrandHome?.addEventListener('click', () => {
    showHomeScreen();
  });

  // "Vista general" en el drawer lateral también lleva a Inicio
  document.querySelector('.drawer-nav-row')?.addEventListener('click', () => {
    boardControllerDrawer?.classList.remove('open');
    showHomeScreen();
  });

  // Renderizar la pantalla de inicio de inmediato
  showHomeScreen();

  // Cargar y aplicar tema guardado (Modo Oscuro por defecto)
  const savedTheme = localStorage.getItem('brainboard_theme') || 'dark';
  applyTheme(savedTheme);

  loadInitialBoard().then(() => {
    updateMinimap();
    fitBoardTitleWidth();
  });
});
