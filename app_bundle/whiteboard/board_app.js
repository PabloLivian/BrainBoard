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

  // Modal de propiedades del componente (Inspector JSON)
  const btnPropInspect = document.getElementById('btn-prop-inspect');
  const modalItemProperties = document.getElementById('modal-item-properties');
  const propModalBadge = document.getElementById('prop-modal-badge');
  const propModalId = document.getElementById('prop-modal-id');
  const statItemType = document.getElementById('stat-item-type');
  const statItemPos = document.getElementById('stat-item-pos');
  const statItemSize = document.getElementById('stat-item-size');
  const propItemJsonTextarea = document.getElementById('prop-item-json-textarea');
  const propModalErrorMsg = document.getElementById('prop-modal-error-msg');
  const btnCopyItemJson = document.getElementById('btn-copy-item-json');
  const btnCopyItemJsonLabel = document.getElementById('btn-copy-item-json-label');
  const iconCopyItemJson = document.getElementById('icon-copy-item-json');
  const btnClosePropertiesModal = document.getElementById('btn-close-properties-modal');
  const btnCloseProperties = document.getElementById('btn-close-properties');
  const btnApplyItemJson = document.getElementById('btn-apply-item-json');
  let itemPendingProperties = null;

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
    const align = first.textAlign || (first.type === 'shape' || first.type === 'sticky_note' || (first.fillColor && first.fillColor !== 'transparent' && (!first.text || !first.text.includes('\n'))) ? 'center' : 'left');
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
  const shapeFlyoutItems = shapeFlyoutMenu ? shapeFlyoutMenu.querySelectorAll('.flyout-item') : [];

  const templateToolBtn = document.getElementById('btn-tool-template');
  const templateFlyoutMenu = document.getElementById('template-flyout-menu');
  const templateFlyoutItems = templateFlyoutMenu ? templateFlyoutMenu.querySelectorAll('.flyout-item') : [];

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
    shapeFlyoutItems.forEach(item => {
      item.classList.toggle('active', item.dataset.shape === shape);
    });
  }

  function setActiveTool(toolName, shapeType = null, templateType = null) {
    engine.activeTool = toolName;
    if (shapeType) {
      setShapeType(shapeType);
    }
    if (templateType) {
      engine.selectedTemplateType = templateType;
    }
    toolButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === toolName);
    });
    canvasElement.style.cursor = toolName === 'hand' ? 'grab' : 'default';
    if (shapeFlyoutMenu && toolName !== 'shape') {
      shapeFlyoutMenu.style.display = 'none';
    }
    if (templateFlyoutMenu && toolName !== 'template') {
      templateFlyoutMenu.style.display = 'none';
    }
  }

  toolButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tool = btn.dataset.tool;
      const isAlreadyActive = engine.activeTool === tool;
      const shape = btn.dataset.shape || (tool === 'shape' ? engine.selectedShapeType : null);
      const template = tool === 'template' ? (engine.selectedTemplateType || 'apuntes') : null;

      if (tool === 'template' && isAlreadyActive && templateFlyoutMenu) {
        const isVisible = templateFlyoutMenu.style.display !== 'none';
        templateFlyoutMenu.style.display = isVisible ? 'none' : 'flex';
        if (shapeFlyoutMenu) shapeFlyoutMenu.style.display = 'none';
        return;
      }
      if (tool === 'shape' && isAlreadyActive && shapeFlyoutMenu) {
        const isVisible = shapeFlyoutMenu.style.display !== 'none';
        shapeFlyoutMenu.style.display = isVisible ? 'none' : 'flex';
        if (templateFlyoutMenu) templateFlyoutMenu.style.display = 'none';
        return;
      }

      setActiveTool(tool, shape, template);
      if (shapeFlyoutMenu) shapeFlyoutMenu.style.display = 'none';
      if (templateFlyoutMenu) templateFlyoutMenu.style.display = 'none';
    });
  });

  // Clic derecho en el botón de formas: despliega menú estilo Photoshop
  shapeToolBtn?.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (shapeFlyoutMenu) {
      const isVisible = shapeFlyoutMenu.style.display !== 'none';
      shapeFlyoutMenu.style.display = isVisible ? 'none' : 'flex';
      if (templateFlyoutMenu) templateFlyoutMenu.style.display = 'none';
    }
  });

  // Clic en opciones del menú desplegable de formas
  shapeFlyoutItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const shape = item.dataset.shape;
      setShapeType(shape);
      setActiveTool('shape', shape);
      if (shapeFlyoutMenu) shapeFlyoutMenu.style.display = 'none';
    });
  });

  // Clic derecho en el botón de plantillas: despliega menú con plantillas disponibles
  templateToolBtn?.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (templateFlyoutMenu) {
      const isVisible = templateFlyoutMenu.style.display !== 'none';
      templateFlyoutMenu.style.display = isVisible ? 'none' : 'flex';
      if (shapeFlyoutMenu) shapeFlyoutMenu.style.display = 'none';
    }
  });

  // Clic en opciones del menú desplegable de plantillas
  templateFlyoutItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const tpl = item.dataset.template || 'apuntes';
      engine.selectedTemplateType = tpl;
      if (templateFlyoutMenu) templateFlyoutMenu.style.display = 'none';
      insertTemplate(tpl);
    });
  });

  function insertTemplate(templateType = 'apuntes', customPos = null) {
    if (!engine) return;
    engine.saveSnapshot();
    const pos = customPos || getPasteTargetPosition();
    const createdIds = engine.insertTemplateAt(pos.x, pos.y, templateType);
    setActiveTool('select');
    if (engine.onSelectionChange) engine.onSelectionChange(createdIds);
    if (engine.onBoardModified) engine.onBoardModified();
    engine.render();
    autoSaveBoardImmediately();
    showDevToast('Plantilla de apuntes insertada');
  }
  window.insertTemplate = insertTemplate;

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

  // Botones de capas y orden
  document.getElementById('btn-prop-bring-forward')?.addEventListener('click', (e) => {
    if (e.shiftKey) {
      engine.bringToFront();
    } else {
      engine.bringForward();
    }
    autoSaveBoardImmediately();
  });
  document.getElementById('btn-prop-send-backward')?.addEventListener('click', (e) => {
    if (e.shiftKey) {
      engine.sendToBack();
    } else {
      engine.sendBackward();
    }
    autoSaveBoardImmediately();
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

  // Helper para abrir enlaces externos en el navegador predeterminado del sistema
  function openExternalUrl(rawUrl) {
    if (!rawUrl) return;
    let url = rawUrl.trim();
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    try {
      if (window.brainBoard && typeof window.brainBoard.openExternal === 'function') {
        window.brainBoard.openExternal(url);
        return;
      }
      if (window.miro && typeof window.miro.openExternal === 'function') {
        window.miro.openExternal(url);
        return;
      }
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

  // =========================================================
  // MODAL DE PROPIEDADES DEL COMPONENTE (INSPECTOR JSON)
  // =========================================================

  function getCleanItemForInspector(it) {
    if (!it) return {};
    const copy = { ...it };
    if ('imgElement' in copy) delete copy.imgElement;
    return copy;
  }

  function openPropertiesModal(item) {
    if (!item) {
      item = activeEditingItem || engine.items.find(i => engine.selectedItemIds.has(i.id));
      if (!item) return;
    }
    if (activeEditingItem) {
      closeInlineEditor();
    }
    itemPendingProperties = item;

    // Actualizar badges y estadísticas rápidas
    const typeStr = (item.type || 'COMPONENTE').toUpperCase();
    if (propModalBadge) propModalBadge.textContent = typeStr;
    if (propModalId) propModalId.textContent = `#${item.id || ''}`;
    if (statItemType) statItemType.textContent = item.type || '-';
    if (statItemPos) statItemPos.textContent = `X: ${Math.round(item.x || 0)}, Y: ${Math.round(item.y || 0)}`;
    if (statItemSize) statItemSize.textContent = `${Math.round(item.width || 0)} × ${Math.round(item.height || 0)} px`;
    const statItemCreatedDate = document.getElementById('stat-item-created-date');
    if (statItemCreatedDate && typeof engine.getItemFreshnessInfo === 'function') {
      const fInfo = engine.getItemFreshnessInfo(item);
      statItemCreatedDate.textContent = `${fInfo.formattedDateTime} (${fInfo.relativeText})`;
      statItemCreatedDate.style.color = fInfo.color;
    }

    // Ocultar mensaje de error
    if (propModalErrorMsg) {
      propModalErrorMsg.textContent = '';
      propModalErrorMsg.style.display = 'none';
    }

    // Resetear botón de copiar
    resetCopyJsonBtn();

    // Formatear JSON limpio
    const cleanItem = getCleanItemForInspector(item);
    if (propItemJsonTextarea) {
      propItemJsonTextarea.value = JSON.stringify(cleanItem, null, 2);
    }

    if (modalItemProperties) {
      modalItemProperties.style.display = 'flex';
      setTimeout(() => {
        if (propItemJsonTextarea) {
          propItemJsonTextarea.focus();
        }
      }, 50);
    }
  }

  function closePropertiesModal() {
    itemPendingProperties = null;
    if (modalItemProperties) modalItemProperties.style.display = 'none';
    if (propModalErrorMsg) {
      propModalErrorMsg.textContent = '';
      propModalErrorMsg.style.display = 'none';
    }
    resetCopyJsonBtn();
  }

  let copyTimeout = null;
  function resetCopyJsonBtn() {
    if (copyTimeout) clearTimeout(copyTimeout);
    if (btnCopyItemJsonLabel) btnCopyItemJsonLabel.textContent = 'Copiar JSON';
    if (iconCopyItemJson) {
      iconCopyItemJson.innerHTML = `
        <rect x="9" y="9" width="13" height="13" rx="2"/>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
      `;
    }
  }

  function copyPropertiesJson() {
    if (!propItemJsonTextarea) return;
    const text = propItemJsonTextarea.value;
    navigator.clipboard.writeText(text).then(() => {
      if (btnCopyItemJsonLabel) btnCopyItemJsonLabel.textContent = '¡Copiado! ✓';
      if (iconCopyItemJson) {
        iconCopyItemJson.innerHTML = '<polyline points="20 6 9 17 4 12"/>';
      }
      if (copyTimeout) clearTimeout(copyTimeout);
      copyTimeout = setTimeout(resetCopyJsonBtn, 2000);
    }).catch(err => {
      console.error('Error al copiar JSON:', err);
    });
  }

  function applyPropertiesJson() {
    if (!itemPendingProperties || !propItemJsonTextarea) return;
    let parsed;
    try {
      parsed = JSON.parse(propItemJsonTextarea.value);
    } catch (e) {
      if (propModalErrorMsg) {
        propModalErrorMsg.textContent = `Error JSON: ${e.message}`;
        propModalErrorMsg.style.display = 'inline';
      }
      return;
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      if (propModalErrorMsg) {
        propModalErrorMsg.textContent = 'El JSON debe ser un objeto válido {...}';
        propModalErrorMsg.style.display = 'inline';
      }
      return;
    }

    // Guardar snapshot de historial para deshacer con Ctrl+Z
    engine.saveSnapshot();

    // Actualizar propiedades del objeto manteniendo id consistente
    const targetItem = itemPendingProperties;
    const origId = targetItem.id;
    const hadImgElement = targetItem.imgElement;

    // Eliminar propiedades viejas que no estén en el nuevo objeto excepto id e imgElement
    for (const key of Object.keys(targetItem)) {
      if (!(key in parsed) && key !== 'id' && key !== 'imgElement') {
        delete targetItem[key];
      }
    }
    Object.assign(targetItem, parsed);
    targetItem.id = origId; // Preservar id para no desvincular selección o conectores
    if (hadImgElement && targetItem.type === 'image') {
      targetItem.imgElement = hadImgElement;
    }

    closePropertiesModal();

    // Re-seleccionar y re-renderizar
    if (targetItem && !engine.selectedItemIds.has(targetItem.id)) {
      engine.selectedItemIds.clear();
      engine.selectedItemIds.add(targetItem.id);
    }

    engine.render();
    updateFloatingUrlBadge();
    syncPropertiesBarWithSelection();
    updateMinimap();

    if (window.autoSaveBoardImmediately) {
      autoSaveBoardImmediately();
    } else {
      autoSaveBoard();
    }
  }

  btnPropInspect?.addEventListener('click', (e) => {
    e.stopPropagation();
    const it = activeEditingItem || engine.items.find(i => engine.selectedItemIds.has(i.id));
    if (it) openPropertiesModal(it);
  });

  btnCopyItemJson?.addEventListener('click', copyPropertiesJson);
  btnApplyItemJson?.addEventListener('click', applyPropertiesJson);
  btnCloseProperties?.addEventListener('click', closePropertiesModal);
  btnClosePropertiesModal?.addEventListener('click', closePropertiesModal);

  modalItemProperties?.addEventListener('click', (e) => {
    if (e.target === modalItemProperties) closePropertiesModal();
  });

  propItemJsonTextarea?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closePropertiesModal();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      applyPropertiesJson();
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

  function getCleanImageFilename(src) {
    if (!src || typeof src !== 'string') return null;
    if (src.startsWith('data:') || src.startsWith('http:') || src.startsWith('https:')) return null;
    let filename = src;
    if (src.includes('extracted_board/')) filename = src.split('extracted_board/').pop();
    else if (src.includes('extracted_board\\')) filename = src.split('extracted_board\\').pop();
    filename = filename.replace(/\\/g, '/').split('/').pop();
    filename = filename.split('?')[0].split('#')[0];
    return filename && /\.(png|jpg|jpeg|gif|webp|svg|bmp)$/i.test(filename) ? filename : null;
  }

  // Exportar tablero en formato .RTB (paquete autónomo con imágenes)
  async function exportBoardToRTB(targetBoardId, customDestinationPath = null, silent = false) {
    const boardId = targetBoardId || currentActiveBoardId;
    if (!boardId) return null;

    let dataToExport = null;
    const b = Array.isArray(workspaceBoards) ? workspaceBoards.find(x => x.id === boardId) : null;
    const title = b?.title || boardId;

    if (currentActiveBoardId === boardId && engine.items && engine.items.length > 0) {
      if (typeof autoSaveBoardImmediately === 'function') {
        autoSaveBoardImmediately(boardId);
      }
      const cleanItems = engine.getCleanItems ? engine.getCleanItems() : engine.items;
      dataToExport = {
        id: boardId,
        title: boardTitleInput ? boardTitleInput.value : title,
        name: boardTitleInput ? boardTitleInput.value : title,
        category: b?.category || 'General',
        icon: b?.icon || '📋',
        thumbnail: b?.thumbnail || null,
        updatedAt: new Date().toISOString(),
        items: cleanItems
      };
    } else {
      const saved = await idbLoadBoard(boardId);
      if (saved && Array.isArray(saved.items) && saved.items.length > 0) {
        dataToExport = {
          id: boardId,
          title: saved.name || saved.title || title,
          name: saved.name || saved.title || title,
          category: b?.category || saved.category || 'General',
          icon: b?.icon || saved.icon || '📋',
          thumbnail: b?.thumbnail || saved.thumbnail || null,
          updatedAt: saved.updatedAt || new Date().toISOString(),
          items: saved.items
        };
      } else {
        const seedData = await fetchBoardSeedData(boardId);
        if (seedData) {
          dataToExport = seedData;
        }
      }
    }

    if (!dataToExport || !Array.isArray(dataToExport.items)) {
      if (!silent) alert(`El tablero "${title}" no tiene datos disponibles para exportar.`);
      return null;
    }

    dataToExport.thumbnail = b?.thumbnail || dataToExport.thumbnail || null;
    dataToExport.icon = b?.icon || dataToExport.icon || '📋';
    dataToExport.category = b?.category || dataToExport.category || 'General';

    const items = dataToExport.items;
    const mediaSet = new Set();

    items.forEach(it => {
      const candidates = [it.src, it.url, it.preview];
      candidates.forEach(src => {
        const cleanName = getCleanImageFilename(src);
        if (cleanName) mediaSet.add(cleanName);
      });
    });

    if (dataToExport.thumbnail) {
      const cleanThumb = getCleanImageFilename(dataToExport.thumbnail);
      if (cleanThumb) mediaSet.add(cleanThumb);
    }

    if (typeof window !== 'undefined' && typeof window.require === 'function') {
      try {
        const fs = window.require('fs');
        const path = window.require('path');
        const os = window.require('os');
        const { execFileSync } = window.require('child_process');
        const electron = window.require('electron');

        let destinationRtb = customDestinationPath;
        if (!destinationRtb) {
          const safeTitle = (dataToExport.title || title || 'tablero').replace(/[/\\?%*:|"<>]/g, '_');
          const defaultFilename = safeTitle + '.rtb';

          if (electron && electron.ipcRenderer) {
            try {
              const res = await electron.ipcRenderer.invoke('show-save-dialog', {
                title: 'Exportar tablero a archivo RTB (con imágenes)',
                defaultPath: defaultFilename,
                filters: [
                  { name: 'Archivo de Tablero Miro / BrainBoard (*.rtb)', extensions: ['rtb'] },
                  { name: 'Todos los archivos', extensions: ['*'] }
                ]
              });
              if (res.canceled || !res.filePath) {
                return null;
              }
              destinationRtb = res.filePath;
            } catch (eDiag) {
              console.warn('show-save-dialog no disponible:', eDiag);
            }
          }

          if (!destinationRtb) {
            const downloadsFolder = path.join(os.homedir(), 'Downloads');
            destinationRtb = path.join(fs.existsSync(downloadsFolder) ? downloadsFolder : os.homedir(), defaultFilename);
          }
        }

        const stagingDir = path.join(os.tmpdir(), 'bb_export_' + Date.now());
        fs.mkdirSync(stagingDir, { recursive: true });

        const appData = (process && process.env && process.env.APPDATA) || (process.platform === 'win32' ? 'C:\\Users\\Usuario\\AppData\\Roaming' : (process.platform === 'darwin' ? (process.env.HOME || '') + '/Library/Application Support' : '/var/local'));
        const sourceDirs = [
          path.join(appData, 'BrainBoard', 'extracted_board'),
          'C:\\Users\\Usuario\\AppData\\Roaming\\BrainBoard\\extracted_board',
          'C:\\Users\\Usuario\\Desktop\\DEV\\BrainBoard\\extracted_board',
          path.resolve('extracted_board')
        ];

        const copiedMedia = [];
        const resourcesMeta = [];

        mediaSet.forEach(filename => {
          let foundSrc = null;
          for (const sDir of sourceDirs) {
            const cand = path.join(sDir, filename);
            if (fs.existsSync(cand)) {
              foundSrc = cand;
              break;
            }
          }
          if (foundSrc) {
            const dst = path.join(stagingDir, filename);
            try {
              fs.copyFileSync(foundSrc, dst);
              copiedMedia.push(filename);
              resourcesMeta.push({
                id: path.parse(filename).name,
                fileName: filename,
                type: 'image'
              });
            } catch (eCopy) {
              console.warn('Error al copiar archivo a staging:', filename, eCopy);
            }
          }
        });

        const exportItems = items.map(it => {
          const clone = Object.assign({}, it);
          if (clone.src) {
            const cName = getCleanImageFilename(clone.src);
            if (cName) clone.src = '../extracted_board/' + cName;
          }
          return clone;
        });

        const finalBoardData = Object.assign({}, dataToExport, { items: exportItems });

        // Procesar y empaquetar miniatura si existe
        if (dataToExport.thumbnail) {
          const rawThumb = dataToExport.thumbnail;
          if (typeof rawThumb === 'string' && rawThumb.startsWith('data:image/')) {
            const extMatch = rawThumb.match(/^data:image\/([a-zA-Z0-9+]+);base64,/);
            let ext = 'png';
            if (extMatch && extMatch[1]) {
              ext = extMatch[1].replace('jpeg', 'jpg');
            }
            const thumbFileName = `thumb_${boardId}.${ext}`;
            const base64Data = rawThumb.replace(/^data:image\/[a-zA-Z0-9+]+;base64,/, '');
            try {
              fs.writeFileSync(path.join(stagingDir, thumbFileName), Buffer.from(base64Data, 'base64'));
              copiedMedia.push(thumbFileName);
              resourcesMeta.push({
                id: path.parse(thumbFileName).name,
                fileName: thumbFileName,
                type: 'image'
              });
              finalBoardData.thumbnail = `../extracted_board/${thumbFileName}`;
            } catch (eThumb) {
              console.warn('Error al guardar miniatura base64 en RTB:', eThumb);
            }
          } else {
            const cleanThumb = getCleanImageFilename(rawThumb);
            if (cleanThumb) {
              finalBoardData.thumbnail = `../extracted_board/${cleanThumb}`;
              let foundSrc = null;
              for (const sDir of sourceDirs) {
                const cand = path.join(sDir, cleanThumb);
                if (fs.existsSync(cand)) {
                  foundSrc = cand;
                  break;
                }
              }
              if (foundSrc && !fs.existsSync(path.join(stagingDir, cleanThumb))) {
                try {
                  fs.copyFileSync(foundSrc, path.join(stagingDir, cleanThumb));
                  copiedMedia.push(cleanThumb);
                  resourcesMeta.push({
                    id: path.parse(cleanThumb).name,
                    fileName: cleanThumb,
                    type: 'image'
                  });
                } catch (eThumbCopy) {
                  console.warn('Error al copiar miniatura física en RTB:', eThumbCopy);
                }
              }
            } else if (typeof rawThumb === 'string' && fs.existsSync(rawThumb)) {
              const ext = path.extname(rawThumb) || '.png';
              const thumbFileName = `thumb_${boardId}${ext}`;
              try {
                fs.copyFileSync(rawThumb, path.join(stagingDir, thumbFileName));
                copiedMedia.push(thumbFileName);
                resourcesMeta.push({
                  id: path.parse(thumbFileName).name,
                  fileName: thumbFileName,
                  type: 'image'
                });
                finalBoardData.thumbnail = `../extracted_board/${thumbFileName}`;
              } catch (eAbs) {
                console.warn('Error al copiar miniatura absoluta en RTB:', eAbs);
              }
            }
          }
        }

        fs.writeFileSync(path.join(stagingDir, 'canvas.json'), JSON.stringify(finalBoardData, null, 2), 'utf8');
        fs.writeFileSync(path.join(stagingDir, 'board.json'), JSON.stringify(finalBoardData, null, 2), 'utf8');
        fs.writeFileSync(path.join(stagingDir, 'resources.json'), JSON.stringify({ resources: resourcesMeta }, null, 2), 'utf8');

        if (fs.existsSync(destinationRtb)) {
          fs.unlinkSync(destinationRtb);
        }

        const filesToPack = fs.readdirSync(stagingDir);
        if (filesToPack.length > 150) {
          execFileSync('tar', ['-cf', destinationRtb, '-C', stagingDir, '.']);
        } else {
          execFileSync('tar', ['-cf', destinationRtb, '-C', stagingDir, ...filesToPack]);
        }

        fs.rmSync(stagingDir, { recursive: true, force: true });

        const stats = fs.statSync(destinationRtb);
        const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
        if (!silent) {
          alert(`¡Tablero "${dataToExport.title || title}" exportado con éxito!\n\nArchivo: ${destinationRtb}\nTamaño: ${sizeMb} MB\nImágenes empaquetadas: ${copiedMedia.length}`);
        }
        return {
          success: true,
          path: destinationRtb,
          title: dataToExport.title || title,
          imagesCount: copiedMedia.length,
          sizeMb: sizeMb
        };
      } catch (err) {
        console.error('Error al exportar RTB:', err);
        if (!silent) alert('Error al exportar archivo .RTB: ' + err.message);
        return { success: false, error: err.message };
      }
    } else {
      saveBoardToFile();
      return null;
    }
  }
  window.exportBoardToRTB = exportBoardToRTB;

  // Diálogo nativo o input file para importar tableros
  async function triggerImportBoard() {
    if (typeof window !== 'undefined' && typeof window.require === 'function') {
      try {
        const electron = window.require('electron');
        if (electron && electron.ipcRenderer) {
          const res = await electron.ipcRenderer.invoke('show-open-dialog', {
            title: 'Importar tablero (.rtb / .json)',
            filters: [
              { name: 'Tableros de Miro / BrainBoard (*.rtb, *.brainboard, *.json)', extensions: ['rtb', 'brainboard', 'json'] },
              { name: 'Archivos RTB (*.rtb, *.brainboard)', extensions: ['rtb', 'brainboard'] },
              { name: 'Archivos JSON (*.json)', extensions: ['json'] },
              { name: 'Todos los archivos', extensions: ['*'] }
            ],
            properties: ['openFile']
          });
          if (res && !res.canceled && res.filePaths && res.filePaths.length > 0) {
            await handleImportFile(res.filePaths[0]);
            return;
          } else if (res && res.canceled) {
            return;
          }
        }
      } catch (e) {
        console.warn('show-open-dialog fallback:', e);
      }
    }
    fileInput?.click();
  }
  window.triggerImportBoard = triggerImportBoard;

  // Lógica de importación para .RTB (desempaquetado y restauración de imágenes) y .JSON
  async function handleImportFile(input) {
    if (!input) return;
    const isPath = typeof input === 'string';
    const filePath = isPath ? input : (input.path || input.name);
    const fileName = isPath ? (typeof window.require === 'function' ? window.require('path').basename(input) : input.split(/[/\\]/).pop()) : input.name;
    const isRtb = fileName.toLowerCase().endsWith('.rtb') || fileName.toLowerCase().endsWith('.brainboard');

    if (isRtb) {
      if (typeof window !== 'undefined' && typeof window.require === 'function') {
        try {
          const fs = window.require('fs');
          const path = window.require('path');
          const os = window.require('os');
          const { execFileSync } = window.require('child_process');

          let actualRtbPath = isPath ? input : input.path;
          let tempRtbCreated = false;

          if (!actualRtbPath) {
            const buffer = await input.arrayBuffer();
            actualRtbPath = path.join(os.tmpdir(), 'imported_' + Date.now() + '.rtb');
            fs.writeFileSync(actualRtbPath, Buffer.from(buffer));
            tempRtbCreated = true;
          }

          const stagingDir = path.join(os.tmpdir(), 'bb_import_' + Date.now());
          fs.mkdirSync(stagingDir, { recursive: true });

          execFileSync('tar', ['-xf', actualRtbPath, '-C', stagingDir]);

          if (tempRtbCreated) {
            try { fs.unlinkSync(actualRtbPath); } catch (e) {}
          }

          let boardData = null;
          const candidateJsons = ['canvas.json', 'board.json'];
          for (const cj of candidateJsons) {
            const p = path.join(stagingDir, cj);
            if (fs.existsSync(p)) {
              try {
                boardData = JSON.parse(fs.readFileSync(p, 'utf8'));
                break;
              } catch (eJson) {
                console.warn('Fallo al parsear ' + cj + ':', eJson);
              }
            }
          }

          if (!boardData) {
            const allFiles = fs.readdirSync(stagingDir);
            for (const f of allFiles) {
              if (f.endsWith('.json') && f !== 'resources.json') {
                try {
                  const parsed = JSON.parse(fs.readFileSync(path.join(stagingDir, f), 'utf8'));
                  if (parsed && (parsed.items || parsed.widgets)) {
                    boardData = parsed;
                    break;
                  }
                } catch (e) {}
              }
            }
          }

          if (!boardData) {
            fs.rmSync(stagingDir, { recursive: true, force: true });
            alert('El archivo .RTB no contiene una estructura de tablero legible.\n\nNota: Si este archivo proviene de una exportación cifrada de Miro, se requiere su JSON correspondiente para interpretar los elementos.');
            return;
          }

          const appData = (process && process.env && process.env.APPDATA) || (process.platform === 'win32' ? 'C:\\Users\\Usuario\\AppData\\Roaming' : (process.platform === 'darwin' ? (process.env.HOME || '') + '/Library/Application Support' : '/var/local'));
          const targetDirs = [
            path.join(appData, 'BrainBoard', 'extracted_board'),
            'C:\\Users\\Usuario\\AppData\\Roaming\\BrainBoard\\extracted_board',
            'C:\\Users\\Usuario\\Desktop\\DEV\\BrainBoard\\extracted_board',
            path.resolve('extracted_board')
          ];

          targetDirs.forEach(td => {
            try { if (!fs.existsSync(td)) fs.mkdirSync(td, { recursive: true }); } catch (e) {}
          });

          const stagingFiles = fs.readdirSync(stagingDir);
          const mediaExts = /\.(png|jpg|jpeg|gif|webp|svg|bmp)$/i;
          const mediaFiles = stagingFiles.filter(f => mediaExts.test(f));
          let copiedImagesCount = 0;

          mediaFiles.forEach(mf => {
            const srcPath = path.join(stagingDir, mf);
            targetDirs.forEach(td => {
              try {
                const dstPath = path.join(td, mf);
                fs.copyFileSync(srcPath, dstPath);
              } catch (e) {}
            });
            copiedImagesCount++;
          });

          fs.rmSync(stagingDir, { recursive: true, force: true });

          const baseName = fileName.replace(/\.[^/.]+$/, "");
          const boardName = boardData.name || boardData.title || baseName;
          let boardId = boardData.id || ('board_' + Date.now());

          if (Array.isArray(workspaceBoards)) {
            let collision = workspaceBoards.find(b => b.id === boardId);
            if (collision && collision.title !== boardName) {
              boardId = 'board_' + Date.now();
              boardData.id = boardId;
            }
          }

          boardData.userModified = true;
          boardData.title = boardName;
          boardData.name = boardName;

          saveBoardToDisk(boardId, boardData);

          if (Array.isArray(workspaceBoards)) {
            let existing = workspaceBoards.find(b => b.id === boardId);
            const now = Date.now();
            if (!existing) {
              existing = {
                id: boardId,
                title: boardName,
                icon: boardData.icon || '📋',
                thumbnail: boardData.thumbnail || null,
                category: boardData.category || 'General',
                lastOpenedAt: now,
                lastOpened: formatLastOpened(now),
                active: true
              };
              workspaceBoards.push(existing);
            } else {
              existing.title = boardName;
              if (boardData.thumbnail) existing.thumbnail = boardData.thumbnail;
              if (boardData.icon) existing.icon = boardData.icon;
              if (boardData.category) existing.category = boardData.category;
              existing.lastOpenedAt = now;
              existing.lastOpened = formatLastOpened(now);
              existing.active = true;
            }
            saveWorkspaceBoards();
          }

          await idbSaveBoard(boardId, boardData);
          localStorage.setItem('brainboard_board_' + boardId, JSON.stringify(boardData));

          await openBoardTab(boardId);
          if (typeof renderDrawerBoards === 'function') renderDrawerBoards();
          if (typeof renderDrawerCategories === 'function') renderDrawerCategories();
          if (typeof renderHomeScreen === 'function') renderHomeScreen();

          alert(`¡Tablero "${boardName}" importado con éxito!\n\nSe han restaurado ${copiedImagesCount} imágenes en el almacén local.`);
          return;
        } catch (err) {
          console.error('Error al importar archivo RTB:', err);
          alert('Error al importar archivo .RTB: ' + err.message);
          return;
        }
      } else {
        alert('La importación de archivos .RTB requiere el entorno Electron.');
        return;
      }
    }

    // Archivo JSON
    let jsonData = null;
    let fallbackName = fileName.replace(/\.[^/.]+$/, "");
    if (isPath && typeof window !== 'undefined' && typeof window.require === 'function') {
      try {
        const fs = window.require('fs');
        jsonData = JSON.parse(fs.readFileSync(input, 'utf8'));
      } catch (err) {
        alert('Error al leer el archivo JSON: ' + err.message);
        return;
      }
    } else {
      try {
        const text = await input.text();
        jsonData = JSON.parse(text);
      } catch (err) {
        alert('Error al leer el archivo JSON: ' + err.message);
        return;
      }
    }

    if (jsonData && (jsonData.items || jsonData.widgets)) {
      const boardName = jsonData.name || jsonData.title || fallbackName;
      let boardId = jsonData.id || ('board_' + Date.now());

      if (Array.isArray(workspaceBoards)) {
        let collision = workspaceBoards.find(b => b.id === boardId);
        if (collision && collision.title !== boardName) {
          boardId = 'board_' + Date.now();
          jsonData.id = boardId;
        }
        let existing = workspaceBoards.find(b => b.id === boardId);
        const now = Date.now();
        if (!existing) {
          existing = {
            id: boardId,
            title: boardName,
            icon: jsonData.icon || '📋',
            thumbnail: jsonData.thumbnail || null,
            category: jsonData.category || 'General',
            lastOpenedAt: now,
            lastOpened: formatLastOpened(now),
            active: true
          };
          workspaceBoards.push(existing);
        } else {
          existing.title = boardName;
          if (jsonData.thumbnail) existing.thumbnail = jsonData.thumbnail;
          if (jsonData.icon) existing.icon = jsonData.icon;
          if (jsonData.category) existing.category = jsonData.category;
          existing.lastOpenedAt = now;
          existing.lastOpened = formatLastOpened(now);
          existing.active = true;
        }
        saveWorkspaceBoards();
      }

      jsonData.userModified = true;
      jsonData.title = boardName;
      jsonData.name = boardName;

      saveBoardToDisk(boardId, jsonData);
      await idbSaveBoard(boardId, jsonData);
      localStorage.setItem('brainboard_board_' + boardId, JSON.stringify(jsonData));

      await openBoardTab(boardId);
      if (typeof renderDrawerBoards === 'function') renderDrawerBoards();
      if (typeof renderDrawerCategories === 'function') renderDrawerCategories();
      if (typeof renderHomeScreen === 'function') renderHomeScreen();

      if (typeof autoSaveBoardImmediately === 'function') {
        autoSaveBoardImmediately(boardId);
      }
    } else {
      alert('El archivo no tiene el formato de tablero esperado.');
    }
  }
  window.handleImportFile = handleImportFile;

  // Guardar tablero en archivo JSON
  document.getElementById('btn-save')?.addEventListener('click', saveBoardToFile);

  // Abrir / Importar archivo
  document.getElementById('btn-drawer-import')?.addEventListener('click', () => {
    triggerImportBoard();
  });
  document.getElementById('btn-open')?.addEventListener('click', () => {
    triggerImportBoard();
  });

  // Exportar copia de seguridad de todos los tableros en formato .RTB (con imágenes)
  async function exportAllBoardsBackup() {
    if (typeof autoSaveBoardImmediately === 'function') {
      autoSaveBoardImmediately();
    }

    const boardsToExport = Array.isArray(workspaceBoards) ? workspaceBoards : [];
    if (boardsToExport.length === 0) {
      alert('No hay tableros para exportar.');
      return;
    }

    if (typeof window !== 'undefined' && typeof window.require === 'function') {
      try {
        const fs = window.require('fs');
        const path = window.require('path');
        const os = window.require('os');
        const electron = window.require('electron');

        let targetFolder = null;
        if (electron && electron.ipcRenderer) {
          try {
            const res = await electron.ipcRenderer.invoke('show-open-dialog', {
              title: 'Seleccionar carpeta para guardar la copia de seguridad de todos los tableros (.rtb)',
              properties: ['openDirectory', 'createDirectory']
            });
            if (res.canceled || !res.filePaths || res.filePaths.length === 0) {
              return; // Cancelado por el usuario
            }
            targetFolder = res.filePaths[0];
          } catch (eDiag) {
            console.warn('show-open-dialog fallback:', eDiag);
          }
        }

        if (!targetFolder) {
          const downloadsFolder = path.join(os.homedir(), 'Downloads');
          targetFolder = fs.existsSync(downloadsFolder) ? downloadsFolder : os.homedir();
        }

        // Crear subcarpeta con fecha y hora para agrupar limpiamente la copia de seguridad
        const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const backupSubdir = path.join(targetFolder, `BrainBoard_Backup_RTB_${dateStr}`);
        fs.mkdirSync(backupSubdir, { recursive: true });

        let savedCount = 0;
        let totalImages = 0;
        const usedFilenames = new Set();

        for (const b of boardsToExport) {
          let safeTitle = (b.title || b.id || 'tablero').replace(/[/\\?%*:|"<>]/g, '_').trim();
          if (!safeTitle) safeTitle = 'tablero';
          let finalFileName = `${safeTitle}.rtb`;
          let counter = 1;
          while (usedFilenames.has(finalFileName.toLowerCase())) {
            finalFileName = `${safeTitle}_${counter}.rtb`;
            counter++;
          }
          usedFilenames.add(finalFileName.toLowerCase());

          const destRtbPath = path.join(backupSubdir, finalFileName);
          const result = await exportBoardToRTB(b.id, destRtbPath, true);
          if (result && result.success) {
            savedCount++;
            totalImages += (result.imagesCount || 0);
          }
        }

        alert(`¡Copia de seguridad en formato .RTB completada con éxito!\n\nSe han exportado ${savedCount} tableros con un total de ${totalImages} imágenes incluidas en la carpeta:\n\n${backupSubdir}`);
        return;
      } catch (err) {
        console.error('Error en exportAllBoardsBackup:', err);
        alert('Error al generar la copia de seguridad RTB: ' + err.message);
        return;
      }
    }

    alert('La copia de seguridad en formato .RTB requiere el entorno de escritorio Electron.');
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

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await handleImportFile(file);
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
        img.src = resolveImageSrc('../extracted_board/' + item.Name);
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

  // Listener para actualizaciones automáticas de Brain Board
  const updateApplyingOverlay = document.getElementById('update-applying-overlay');
  const updateApplyingText = document.getElementById('update-applying-text');

  try {
    if (typeof window !== 'undefined' && window.require) {
      const electronModule = window.require('electron');
      if (electronModule && electronModule.ipcRenderer) {
        electronModule.ipcRenderer.on('updater-message', (_event, data) => {
          if (!data) return;
          if (data.status === 'applying') {
            if (updateApplyingOverlay) {
              if (updateApplyingText && data.text) {
                updateApplyingText.textContent = data.text;
              }
              updateApplyingOverlay.style.display = 'flex';
            }
          } else if (data.text) {
            showDevToast(data.text);
          }
        });
      }
    }
  } catch (_e) {}

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

  function getSystemClipboardText() {
    let clipText = '';
    try {
      if (window.brainBoard?.clipboard?.readText) {
        clipText = window.brainBoard.clipboard.readText() || '';
      } else if (window.miro?.clipboard?.readText) {
        clipText = window.miro.clipboard.readText() || '';
      } else {
        const electron = typeof window.require === 'function' ? window.require('electron') : null;
        if (electron?.clipboard?.readText) {
          clipText = electron.clipboard.readText() || '';
        }
      }
    } catch (e) {}
    return (clipText || '').trim();
  }

  function writeSystemClipboardText(text) {
    if (!text) return;
    try {
      if (window.brainBoard?.clipboard?.writeText) {
        window.brainBoard.clipboard.writeText(text);
        return;
      }
      if (window.miro?.clipboard?.writeText) {
        window.miro.clipboard.writeText(text);
        return;
      }
      const electron = typeof window.require === 'function' ? window.require('electron') : null;
      if (electron?.clipboard?.writeText) {
        electron.clipboard.writeText(text);
        return;
      }
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).catch(() => {});
      }
    } catch (e) {}
  }

  let lastClipTextOnBlur = null;
  window.addEventListener('blur', () => {
    try {
      lastClipTextOnBlur = getSystemClipboardText();
    } catch (e) {}
  });

  window.addEventListener('focus', () => {
    try {
      const currentText = getSystemClipboardText();
      // Si el portapapeles cambió mientras la ventana de BrainBoard estuvo en segundo plano
      if (lastClipTextOnBlur !== null && currentText !== lastClipTextOnBlur) {
        if (!currentText.includes('"source":"brainboard"')) {
          // El usuario copió deliberadamente un texto/enlace en otra aplicación (Chrome, Notepad, etc.)
          window.__brainboardLastCopySource = 'external';
          try {
            localStorage.setItem('brainboard_last_copy_source', 'external');
          } catch (e) {}
        }
      }
    } catch (e) {}
  });

  function copySelectedToClipboard() {
    const itemsToCopy = getItemsToCopy();
    if (!itemsToCopy || itemsToCopy.length === 0) {
      showDevToast('Selecciona algún elemento para copiar');
      return false;
    }

    // Registrar el texto externo que ya existía en el portapapeles justo antes de copiar en el tablero
    const prevExtText = getSystemClipboardText();
    window.__brainboardExternalTextBeforeBoardCopy = prevExtText;
    try {
      localStorage.setItem('brainboard_ext_text_before_copy', prevExtText);
    } catch (e) {}

    // Limpiar propiedades no serializables como imgElement
    const cleanItems = itemsToCopy.map(it => {
      const copy = { ...it };
      delete copy.imgElement;
      delete copy._previewImg;
      delete copy._canvas;
      return copy;
    });

    const bounds = computeItemsBounds(cleanItems);
    const now = Date.now();
    const payload = {
      source: 'brainboard',
      version: 1,
      boardId: currentActiveBoardId,
      timestamp: now,
      bounds: bounds,
      items: JSON.parse(JSON.stringify(cleanItems))
    };

    // 1. Guardar en memoria de ventana
    window.__brainboardClipboard = payload;
    window.__brainboardLastCopySource = 'board';
    window.__brainboardLastBoardCopyTime = now;

    // 2. Guardar en localStorage para disponibilidad entre cualquier tablero
    try {
      localStorage.setItem('brainboard_clipboard', JSON.stringify(payload));
      localStorage.setItem('brainboard_last_copy_source', 'board');
      localStorage.setItem('brainboard_last_board_copy_time', String(now));
    } catch (err) {
      console.warn('No se pudo guardar en localStorage:', err);
    }

    // 3. Escribir en el portapapeles nativo de Electron del sistema
    try {
      const jsonStr = JSON.stringify(payload);
      writeSystemClipboardText(jsonStr);
    } catch (err) {}

    pasteCascadeCount = 0;
    lastPasteTargetWorld = null;

    const count = cleanItems.length;
    showDevToast(`Copiado${count > 1 ? 's ' + count + ' elementos' : ' 1 elemento'}`);
    return true;
  }

  function getStoredClipboardPayload() {
    // 1. Comprobar memoria de ventana activa
    if (window.__brainboardClipboard && window.__brainboardClipboard.source === 'brainboard' && Array.isArray(window.__brainboardClipboard.items) && window.__brainboardClipboard.items.length > 0) {
      return window.__brainboardClipboard;
    }

    // 2. Comprobar portapapeles del sistema operativo mediante API nativa de Electron
    try {
      const clipText = getSystemClipboardText();
      if (clipText && clipText.startsWith('{') && clipText.includes('"source":"brainboard"')) {
        const parsed = JSON.parse(clipText);
        if (parsed && parsed.source === 'brainboard' && Array.isArray(parsed.items) && parsed.items.length > 0) {
          window.__brainboardClipboard = parsed;
          return parsed;
        }
      }
    } catch (e) {}

    // 3. Comprobar localStorage como almacenamiento persistente compartido entre pestañas y tableros
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
    // 1. Si el cursor del ratón está dentro del lienzo y no sobre paneles, barras de herramientas o pestañas
    if (currentMouseScreen &&
        currentMouseScreen.x > 75 && currentMouseScreen.x < (window.innerWidth - 30) &&
        currentMouseScreen.y > 90 && currentMouseScreen.y < (window.innerHeight - 30)) {
      const drawer = document.getElementById('board-controller-drawer');
      const drawerRect = drawer?.getBoundingClientRect();
      const isOverDrawer = drawer && drawer.classList.contains('open') && drawerRect &&
        currentMouseScreen.x >= drawerRect.left && currentMouseScreen.x <= drawerRect.right &&
        currentMouseScreen.y >= drawerRect.top && currentMouseScreen.y <= drawerRect.bottom;

      if (!isOverDrawer && engine && typeof engine.screenToWorld === 'function') {
        return engine.screenToWorld(currentMouseScreen.x, currentMouseScreen.y);
      }
    }

    // 2. Si el ratón está sobre pestañas, menús superiores o fuera, pegar en el CENTRO del viewport actual del tablero
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

    // Calcular zIndex para colocar los elementos pegados al frente de los elementos existentes
    const currentMaxZ = engine.items.reduce((max, it) => Math.max(max, typeof it.zIndex === 'number' ? it.zIndex : 10), 10);
    const minPastedZ = p.items.reduce((min, it) => Math.min(min, typeof it.zIndex === 'number' ? it.zIndex : 10), Infinity);
    const zBaseOffset = Number.isFinite(minPastedZ) ? (currentMaxZ + 5 - minPastedZ) : 10;

    const idMap = new Map();
    const newClones = [];
    const nowIso = new Date().toISOString();

    // Paso 1: Clonar y generar nuevos IDs únicos para cada elemento
    p.items.forEach(it => {
      const clone = JSON.parse(JSON.stringify(it));
      if (clone.imgElement) delete clone.imgElement;
      const newId = (it.type || 'item') + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      idMap.set(it.id, newId);
      clone.id = newId;
      clone.createdAt = nowIso;
      clone.updatedAt = nowIso;

      if (typeof clone.zIndex === 'number') {
        clone.zIndex += zBaseOffset;
      } else {
        clone.zIndex = currentMaxZ + 5;
      }

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

        // Si pertenece a un marco clonado remapearlo, de lo contrario desvincular
        if (clone.parentId && idMap.has(clone.parentId)) {
          clone.parentId = idMap.get(clone.parentId);
        } else {
          delete clone.parentId;
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
    autoSaveBoardImmediately();

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
      const nowIso = new Date().toISOString();
      const imgItem = {
        id: 'pasted_img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        type: 'image',
        createdAt: nowIso,
        updatedAt: nowIso,
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

    if (!title || title.toLowerCase().includes('antes de ir a youtube') || title.toLowerCase().includes('before you continue to youtube')) {
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
    const nowIso = new Date().toISOString();
    const newEmbed = {
      id: 'embed_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      type: 'embed',
      createdAt: nowIso,
      updatedAt: nowIso,
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
    const nowIso = new Date().toISOString();
    const newItem = {
      id: 'text_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      type: isShort ? 'sticky_note' : 'text',
      createdAt: nowIso,
      updatedAt: nowIso,
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

    // Obtener texto del portapapeles del sistema (Electron directo, bridge, pasteEvent o navigator)
    let clipText = getSystemClipboardText();

    if (!clipText && pasteEvent?.clipboardData) {
      try {
        clipText = (pasteEvent.clipboardData.getData('text') || '').trim();
      } catch (e) {}
    }

    if (!clipText && navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
      try {
        clipText = (await navigator.clipboard.readText() || '').trim();
      } catch (e) {}
    }

    const trimmedText = (clipText || '').trim();

    // Prioridad 1: ELEMENTOS DE BRAIN BOARD
    // 1.a) Si el texto del portapapeles contiene el paquete JSON serializado de Brain Board
    if (trimmedText.startsWith('{') && trimmedText.includes('"source":"brainboard"')) {
      try {
        const parsed = JSON.parse(trimmedText);
        if (parsed && parsed.source === 'brainboard' && Array.isArray(parsed.items) && parsed.items.length > 0) {
          pasteClipboardItems(parsed, targetWorldPos ? { targetX: targetWorldPos.x, targetY: targetWorldPos.y } : {});
          return;
        }
      } catch (err) {}
    }

    // 1.b) Si hay datos de Brain Board en memoria o localStorage y lo último copiado fue de la pizarra
    const storedPayload = getStoredClipboardPayload();
    const lastSource = window.__brainboardLastCopySource || localStorage.getItem('brainboard_last_copy_source') || '';
    const extTextBeforeCopy = window.__brainboardExternalTextBeforeBoardCopy ?? localStorage.getItem('brainboard_ext_text_before_copy') ?? null;

    // Solo se considera que hay texto externo fresco si:
    // - Hay texto en el portapapeles y NO es de BrainBoard
    // - Y es DISTINTO del texto externo previo que ya residía en el portapapeles antes del Ctrl+C en BrainBoard
    // - O bien la última copia no provino de BrainBoard
    let hasFreshExternalText = false;
    if (trimmedText.length > 0 && !trimmedText.includes('"source":"brainboard"')) {
      if (lastSource !== 'board' || !storedPayload || !Array.isArray(storedPayload.items) || storedPayload.items.length === 0) {
        hasFreshExternalText = true;
      } else if (extTextBeforeCopy !== null && trimmedText !== extTextBeforeCopy) {
        hasFreshExternalText = true;
      }
    }

    const hasFreshPasteEventImage = Boolean(pasteEvent?.clipboardData?.items && Array.from(pasteEvent.clipboardData.items).some(it => it.kind === 'file' && it.type && it.type.startsWith('image/')));

    if (storedPayload && Array.isArray(storedPayload.items) && storedPayload.items.length > 0 && !hasFreshExternalText && !hasFreshPasteEventImage) {
      pasteClipboardItems(storedPayload, targetWorldPos ? { targetX: targetWorldPos.x, targetY: targetWorldPos.y } : {});
      return;
    }

    // Prioridad 2: IMAGEN DEL SISTEMA OPERATIVO O APLICACIÓN EXTERNA
    // 2.a) Mediante items del evento 'paste' nativo de HTML5
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

    // 2.b) Mediante archivos del evento 'paste' nativo de HTML5
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

    // 2.c) Mediante API de portapapeles de Electron (directa o bridge)
    let clipImg = null;
    try {
      const electron = typeof window.require === 'function' ? window.require('electron') : null;
      if (electron?.clipboard?.readImage) {
        const img = electron.clipboard.readImage();
        if (img && !img.isEmpty()) {
          const size = img.getSize();
          clipImg = { dataUrl: img.toDataURL(), width: size.width, height: size.height };
        }
      } else if (window.brainBoard?.clipboard?.readImage) {
        clipImg = window.brainBoard.clipboard.readImage();
      } else if (window.miro?.clipboard?.readImage) {
        clipImg = window.miro.clipboard.readImage();
      }
    } catch (e) {}

    if (clipImg && clipImg.dataUrl) {
      pasteExternalImage(clipImg.dataUrl, clipImg.width, clipImg.height, targetWorldPos);
      return;
    }

    // 2.d) Mediante navigator.clipboard.read() (fallback web estándar)
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

    // Prioridad 3: TEXTO O ENLACE EXTERNO DEL PORTAPAPELES
    if (trimmedText.length > 0) {
      const isUrl = /^https?:\/\/[^\s]+/i.test(trimmedText) || /^www\.[a-z0-9\-]+(\.[a-z0-9\-]+)+[^\s]*/i.test(trimmedText);
      if (isUrl) {
        if (/\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(trimmedText) || trimmedText.includes('gstatic.com/images?')) {
          pasteExternalImage(trimmedText, null, null, targetWorldPos);
          return;
        }
        pasteExternalUrl(trimmedText, targetWorldPos);
        return;
      }

      pasteExternalText(trimmedText, targetWorldPos);
      return;
    }

    // Fallback: Si no había texto externo ni imagen externa, usar lo almacenado en BrainBoard
    if (storedPayload && Array.isArray(storedPayload.items) && storedPayload.items.length > 0) {
      pasteClipboardItems(storedPayload, targetWorldPos ? { targetX: targetWorldPos.x, targetY: targetWorldPos.y } : {});
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
      if (clicked.type === 'frame') {
        if (engine.isPointOnFrameHeader(clicked, world.x, world.y)) {
          openInlineEditor(clicked);
          return;
        } else {
          clicked = null;
        }
      } else if (clicked.type === 'sticky_note' || clicked.type === 'shape' || clicked.type === 'text' || clicked.type === 'code') {
        openInlineEditor(clicked);
        return;
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
    const align = item.textAlign || (item.type === 'sticky_note' || item.type === 'shape' ? 'center' : ((item.fillColor && item.fillColor !== 'transparent' && (!item.text || !item.text.includes('\n'))) ? 'center' : 'left'));

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

    if (activeEditingItem.type === 'frame') {
      const tabHeight = 26 * zoom;
      const tabWidth = Math.max(80 * zoom, (activeEditingItem.title ? activeEditingItem.title.length * 9.5 + 24 : 80) * zoom);
      inlineEditor.style.left = `${screen.x}px`;
      inlineEditor.style.top = `${screen.y - tabHeight}px`;
      inlineEditor.style.width = `${tabWidth}px`;
      inlineEditor.style.height = `${tabHeight}px`;
      inlineEditor.style.padding = `${3 * zoom}px ${8 * zoom}px`;
      inlineEditor.style.fontSize = `${13 * zoom}px`;
      inlineEditor.style.fontWeight = '600';
      inlineEditor.style.borderRadius = `${4 * zoom}px`;
      inlineEditor.style.backgroundColor = engine.isDarkMode ? '#2D323E' : '#475569';
      inlineEditor.style.color = '#ffffff';
      inlineEditor.style.caretColor = '#ffffff';
      inlineEditor.style.lineHeight = `${20 * zoom}px`;
      return;
    }

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

  // Manejo de desplazamiento con flechas del teclado y agrupación de snapshots para Undo
  let isArrowMoving = false;
  let arrowMoveTimeout = null;

  function handleArrowKeyMove(dx, dy) {
    if (engine.selectedItemIds.size === 0) return;

    // Si es el inicio de la ráfaga de movimiento, registramos un único snapshot en el historial
    if (!isArrowMoving) {
      engine.saveSnapshot();
      isArrowMoving = true;
    }

    // Mover los elementos seleccionados (sin crear snapshots intermedios)
    engine.moveSelected(dx, dy, false);
    updatePropertiesBarPosition();

    // Debounce para finalizar la ráfaga y consolidar el guardado
    clearTimeout(arrowMoveTimeout);
    arrowMoveTimeout = setTimeout(() => {
      isArrowMoving = false;
      autoSaveBoard();
    }, 400);
  }

  // Al soltar las teclas de flecha, consolidar el guardado si se estaba moviendo
  window.addEventListener('keyup', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      if (isArrowMoving) {
        clearTimeout(arrowMoveTimeout);
        arrowMoveTimeout = setTimeout(() => {
          isArrowMoving = false;
          autoSaveBoard();
        }, 200);
      }
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
      if (templateFlyoutMenu) templateFlyoutMenu.style.display = 'none';
      if (modalItemProperties && modalItemProperties.style.display !== 'none') {
        closePropertiesModal();
      }
      return;
    }

    if (document.activeElement === inlineEditor || document.activeElement === boardTitleInput ||
        document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.isContentEditable || activeEditingItem) return;

    // Movimiento con flechas del teclado (soporta un elemento o selección múltiple)
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      if (engine.selectedItemIds.size > 0) {
        e.preventDefault();

        let step = 5; // Paso base en unidades del canvas
        if (e.shiftKey) {
          step = 50; // Movimiento rápido con Shift (10x)
        } else if (e.altKey || e.ctrlKey || e.metaKey) {
          step = 1; // Micro-ajuste milimétrico de precisión con Alt/Ctrl
        }

        let dx = 0, dy = 0;
        if (e.key === 'ArrowUp') dy = -step;
        else if (e.key === 'ArrowDown') dy = step;
        else if (e.key === 'ArrowLeft') dx = -step;
        else if (e.key === 'ArrowRight') dx = step;

        handleArrowKeyMove(dx, dy);
        return;
      }
    }

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
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C' || e.code === 'KeyC')) {
      e.preventDefault();
      copySelectedToClipboard();
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'x' || e.key === 'X' || e.code === 'KeyX')) {
      e.preventDefault();
      if (copySelectedToClipboard()) {
        engine.deleteSelected();
      }
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V' || e.code === 'KeyV')) {
      e.preventDefault();
      executePasteAction();
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A' || e.code === 'KeyA')) {
      e.preventDefault();
      engine.selectAll();
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z' || e.code === 'KeyZ')) {
      e.preventDefault();
      if (e.shiftKey) engine.redo();
      else engine.undo();
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y' || e.code === 'KeyY')) {
      e.preventDefault();
      engine.redo();
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D' || e.code === 'KeyD')) {
      e.preventDefault();
      duplicateSelectedItems();
    } else if (e.key === ']' || e.code === 'BracketRight') {
      e.preventDefault();
      if (e.shiftKey) {
        engine.bringToFront();
      } else {
        engine.bringForward();
      }
      autoSaveBoardImmediately();
    } else if (e.key === '[' || e.code === 'BracketLeft') {
      e.preventDefault();
      if (e.shiftKey) {
        engine.sendToBack();
      } else {
        engine.sendBackward();
      }
      autoSaveBoardImmediately();
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

  function resolveImageSrc(src) {
    if (!src) return src;
    if (src.startsWith('data:') || src.startsWith('http:') || src.startsWith('https:')) {
      return src;
    }
    if (typeof window !== 'undefined' && typeof window.require === 'function') {
      try {
        const fs = window.require('fs');
        const path = window.require('path');
        let filename = src;
        if (src.includes('extracted_board/')) {
          filename = src.split('extracted_board/').pop();
        } else if (src.includes('extracted_board\\')) {
          filename = src.split('extracted_board\\').pop();
        }
        filename = filename.replace(/\\/g, '/').split('/').pop();

        const appData = (process && process.env && process.env.APPDATA) || (process.platform === 'win32' ? 'C:\\Users\\Usuario\\AppData\\Roaming' : (process.platform === 'darwin' ? (process.env.HOME || '') + '/Library/Application Support' : '/var/local'));
        const candidates = [
          path.join(appData, 'BrainBoard', 'extracted_board', filename),
          'C:\\Users\\Usuario\\AppData\\Roaming\\BrainBoard\\extracted_board\\' + filename,
          'C:\\Users\\Usuario\\Desktop\\DEV\\BrainBoard\\extracted_board\\' + filename,
          path.resolve(__dirname, src),
          path.resolve(process.cwd(), src),
          path.resolve('c:/Users/Usuario/Desktop/DEV/BrainBoard/extracted_board', filename),
          path.resolve('c:/Users/Usuario/Desktop/DEV/BrainBoard', src.replace(/^\.\.\//, ''))
        ];

        for (const cand of candidates) {
          if (fs.existsSync(cand)) {
            return 'file:///' + cand.replace(/\\/g, '/');
          }
        }
        return 'file:///' + (appData + '/BrainBoard/extracted_board/' + filename).replace(/\\/g, '/');
      } catch (e) {}
    }
    return src;
  }
  window.resolveImageSrc = resolveImageSrc;

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
    if (boardMeta) {
      boardMeta.lastOpenedAt = Date.now();
      boardMeta.lastOpened = formatLastOpened(boardMeta.lastOpenedAt);
      saveWorkspaceBoards();
    }
    const currentVer = Math.max(engine.currentSeedVersion || 0, boardMeta?.seedVersion || 0, 3);
    engine.currentSeedVersion = currentVer;

    const data = {
      id: targetBoardId,
      name: (boardTitleInput && currentActiveBoardId === targetBoardId ? boardTitleInput.value : boardMeta?.title) || (targetBoardId === 'dev_ai' ? 'DEV / AI' : 'Tablero'),
      category: boardMeta?.category || 'General',
      icon: boardMeta?.icon || '📋',
      thumbnail: boardMeta?.thumbnail || null,
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

  // Cargar mapa de fechas históricas de colocación para hidratar sin destruir ediciones en IndexedDB
  window.__historicalDatesMap = {};
  fetch('whiteboard/historical_dates_map.json')
    .then(r => r.json())
    .then(m => {
      if (m && typeof m === 'object') {
        window.__historicalDatesMap = m;
        if (engine && Array.isArray(engine.items)) {
          hydrateBoardItemsDates(engine.items);
        }
      }
    })
    .catch(() => {});

  function hydrateBoardItemsDates(items, seedItems = null, fallbackIso = null) {
    if (!Array.isArray(items)) return;
    const histMap = window.__historicalDatesMap || {};
    const seedDateById = new Map();
    if (Array.isArray(seedItems)) {
      seedItems.forEach(s => {
        if (s && s.id && s.createdAt) {
          seedDateById.set(String(s.id), s.createdAt);
        }
      });
    }
    const defaultIso = fallbackIso || '2025-11-15T12:00:00.000Z';
    items.forEach(it => {
      if (!it) return;
      if (!it.createdAt || isNaN(Date.parse(it.createdAt))) {
        const idStr = String(it.id || '');
        if (seedDateById.has(idStr)) {
          it.createdAt = seedDateById.get(idStr);
        } else if (histMap[idStr]) {
          it.createdAt = histMap[idStr];
        } else {
          const m = idStr.match(/(?:^|_)(\d{13})(?:_|$)/);
          if (m) {
            const ms = Number(m[1]);
            const nowMs = Date.now();
            it.createdAt = new Date((ms > 1577836800000 && ms <= nowMs + 86400000) ? ms : nowMs).toISOString();
          } else {
            it.createdAt = defaultIso;
          }
        }
      }
      if (!it.updatedAt || isNaN(Date.parse(it.updatedAt))) {
        it.updatedAt = it.createdAt;
      }
    });
  }

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

  // Corrección y saneamiento proactivo de recursos de enlaces y fechas de colocación
  function sanitizeEmbedResources(items, seedItems = null) {
    if (!Array.isArray(items)) return;
    hydrateBoardItemsDates(items, seedItems);
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
    currentActiveBoardId = localStorage.getItem('brainboard_active_board_id') || localStorage.getItem('miro_active_board_id') || 'ejemplo';
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
        if ((!savedData?.userModified && seedData.seedVersion > savedVer) || ((currentActiveBoardId === 'space' || currentActiveBoardId === 'espacio') && seedData.seedVersion >= 10 && savedVer < 10) || (currentActiveBoardId === 'ejemplo' && seedData.seedVersion >= 10 && savedVer < 10)) {
          isOutdatedCache = true;
        }
      }
    } catch(e) {}

    const hasValidSavedItems = !isOutdatedCache && savedData && Array.isArray(savedData.items) && savedData.items.length > 0;

    if (hasValidSavedItems) {
      sanitizeEmbedResources(savedData.items, seedData?.items);
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
  const drawerCategoriesList = document.getElementById('drawer-categories-list');
  const btnDrawerToggleCategories = document.getElementById('btn-drawer-toggle-categories');
  const btnDrawerAddCategory = document.getElementById('btn-drawer-add-category');
  const btnDrawerNavHome = document.getElementById('btn-drawer-nav-home');
  const btnHomeToggleCategories = document.getElementById('btn-home-toggle-categories');
  let currentDrawerCategoryFilter = null;
  const btnBoardOptionsTrigger = document.getElementById('btn-board-options-trigger');
  const boardOptionsMenu = document.getElementById('board-options-menu');
  const menuOptRename = document.getElementById('menu-opt-rename');
  const menuOptThumbnail = document.getElementById('menu-opt-thumbnail');
  const menuOptExportRtb = document.getElementById('menu-opt-export-rtb');
  const menuOptExportHires = document.getElementById('menu-opt-export-hires');
  const menuOptClear = document.getElementById('menu-opt-clear');
  const btnResetZoom = document.getElementById('btn-reset-zoom');

  // Miniatura dinámica del tablero activo
  const BRAIN_LOGO_SVG = `<svg viewBox="0 0 620.95 522.11" fill="#3b82f6" style="width:100%;height:100%;max-width:28px;max-height:24px;"><path d="M0,228.49c-.21-23.92,7.34-45.33,20.15-65.04,8.65-13.29,16.23-26.99,22.23-41.79,11.47-28.31,32.76-45.92,62.5-53.19,7.12-1.74,14.19-3.66,21.34-5.28,14.28-3.24,24.88-12.37,35.26-21.83,17.38-15.85,38.13-23.18,61.31-24.57,16.22-.97,31.84,2.5,47.3,6.64,12.5,3.35,23.5,1.01,34.07-6.19,13.09-8.92,27.34-15.26,43.35-16.79,24.32-2.32,45.79,4.52,64.3,20.38,6.71,5.75,12.83,12.21,18.05,19.33,10.48,14.29,25.02,20.15,42.03,21.82,19.61,1.92,38.28,6.64,54.92,18.06,14.86,10.2,24.8,23.9,31.05,40.53,2.23,5.92,4.25,11.95,5.11,18.26,2.53,18.52,11.42,33.78,23.49,47.67,11.63,13.38,22.08,27.69,27.72,44.75,11.98,36.21,8.66,70.41-15.16,101.16-8.03,10.36-18.34,18.5-31.27,22.32-8.15,2.4-12.49,7.19-13.51,15.83-1.93,16.42-7.08,31.77-16.44,45.62-13.77,20.38-32.82,33.25-56.24,39.85-17.27,4.87-34.83,7.47-52.84,5.21-.82-.1-1.67-.11-2.5-.08-2.13,.08-4.63-.44-5.93,1.75-1.38,2.34,.68,4.1,1.83,5.8,3.93,5.79,8.12,11.4,11.99,17.22,7.14,10.75,7.08,19.48,.03,28-6.72,8.12-18.48,10.49-29.21,5.83-5.31-2.31-9.46-5.89-12.89-10.67-22.62-31.53-45.36-62.97-68.16-94.37-6.05-8.34-15.57-11.12-25.69-8.48-16.1,4.2-31.88,9.64-48.56,11.51-48.25,5.43-88.82-24.67-99.36-66.25-3.24-12.77-6.45-15.08-19.61-14.14-26.06,1.87-50.88-2.7-73.69-15.6C20.8,301.28,1.39,270.31,0,228.49Zm576.46,40.19c.65-16.58-6.11-30.97-16.01-44.24-8.36-11.2-18.05-21.37-25.32-33.42-8.7-14.44-12.1-30.61-15.43-46.75-3.92-19-15.03-30.64-33.81-35.17-9.73-2.34-19.66-3.56-29.53-5.11-16.03-2.51-31.05-7.26-43.53-18.39-7.64-6.81-13.97-14.75-20.45-22.54-8.14-9.78-18.18-15.86-30.81-17.78-16.65-2.53-34.94,6.1-41.12,19.45-2.76,5.97-2.67,11.42,1.53,16.82,9.08,11.67,9.59,24.53,4.2,37.76-1.46,3.58-1.21,6.33,.87,9.29,8.14,11.58,16.33,23.12,24.32,34.81,2.35,3.44,5.18,4.68,9.26,4.43,9.7-.58,18.61,1.38,27.03,6.89,14.05,9.19,22.62,27.99,19.49,44.63-3.78,20.07-18.01,32.83-35.34,36.53-15.83,3.38-29.24-2.37-40.3-13.59-3.18-3.22-5.97-3.88-10.11-2.48-17.21,5.78-34.49,11.36-51.78,16.92-3.57,1.15-5.53,3.17-6.02,7.02-3.05,24.07-25.74,40.74-48.89,37.5-7.83-1.1-13.35,2.2-16.73,9-7.09,14.24-6.51,28.51,1.67,41.97,9.45,15.56,29.13,23.34,47.84,19.96,16.78-3.03,32.74-9,49.13-13.41,13.02-3.5,19.85-11.19,21.83-24.6,2.28-15.44,14.4-27.49,28.74-30.34,15.9-3.17,30.84,2.97,39.52,17.06,2.81,4.56,5.43,5.33,10.1,3.47,18.38-7.32,37.55-9.94,57.26-9.45,10.82,.26,21.64,.08,32.46,.75,6.01,.37,6.64-.79,4.5-6.23-5.3-13.48-10.75-26.91-15.87-40.46-1.46-3.86-3.51-5.63-7.72-6.43-25.88-4.94-38.15-30.32-26.08-53.42,8.53-16.34,29.93-23.3,46.07-15.16,18.79,9.48,25.95,31.93,16.99,47.33-5.97,10.26-6.66,18.77-1.05,28.5,.08,.14,.11,.31,.17,.47,4.28,10.48,8,21.24,15.36,30.15,15.26,18.47,37.27,18.76,49.98-2.19,5.38-8.86,7.95-18.63,7.59-29.55ZM45.39,225.98c.63,22.26,9.38,40.34,28.32,52.61,22.02,14.26,46.26,17.78,71.4,11.35,17.09-4.37,29.28-14.99,31.9-33.69,.81-5.78,1.57-11.55,3.18-17.17,1.11-3.86,.36-7.16-2.33-10.17-4.32-4.84-8.61-9.72-12.76-14.7-2.73-3.27-5.63-4.23-10.04-3.27-16.43,3.58-31.65-3.18-39.36-18.48-7.4-14.66-5.88-26.68,5.77-40.72,6.43-7.74,15.66-12.21,26.14-11.38,25.57,2.02,39.92,22.62,33.37,47.53-.72,2.73-.39,4.77,1.4,6.86,4.98,5.81,9.91,11.66,15.36,17.06,2.57,2.54,5.07,3.23,8.52,2.18,18.69-5.66,34.5-.85,47.36,13.63,2.6,2.92,5.13,3.74,8.76,2.53,17.85-5.95,35.73-11.8,53.6-17.67,2.64-.87,4.06-2.55,4.46-5.39,1.07-7.53,3.6-14.56,7.95-20.82,2.44-3.5,2.16-6.58-.04-10.13-5.96-9.65-13.19-18.43-19.13-28.06-3.85-6.25-8.53-8.29-15.89-8.28-14.87,.02-25.62-7.64-31.57-21.24-5.41-12.35-4.27-24.32,3.61-35.5,5.05-7.16,4.19-10.83-3.73-14.42-15.12-6.87-31.01-8.87-47.32-5.97-11.48,2.04-21.18,7.79-29.18,16.27-11.23,11.9-24.57,20.32-40.34,24.84-12.49,3.57-25.02,7-37.43,10.82-11.16,3.43-19.79,10.5-23.16,21.7-5.67,18.83-15.47,35.26-26.56,51.19-7.99,11.47-12.49,24.23-12.24,38.49Zm402.24,126.08v.07c-13.15,0-26.31-.3-39.44,.11-7.56,.24-15.46,1.82-19.9,8.57-5.86,8.9-13.37,15-23.26,18.66-5.42,2-6.57,6.04-3.16,10.7,3.34,4.56,7.28,8.62,12.28,11.53,10.68,6.2,22.44,9.25,34.36,11.64,21.09,4.24,42.2,5.73,63.19-.75,16.21-5.01,28.26-14.48,33.91-31.04,4.87-14.28-1.7-30.11-20.54-29.56-12.47,.36-24.97,.07-37.45,.07Z"/></svg>`;

  const boardThumbnailMini = document.getElementById('board-thumbnail-mini');
  function updateBoardThumbnailMini(boardId) {
    if (!boardThumbnailMini) return;
    const targetId = boardId || currentActiveBoardId;
    const b = workspaceBoards.find(x => x.id === targetId) || { id: targetId };

    const isWelcome = b.id === 'ejemplo' || b.id === 'bienvenida' || (b.title && (b.title.toLowerCase().includes('bienvenida') || b.title.toLowerCase() === 'ejemplo'));

    if (b.thumbnail) {
      boardThumbnailMini.className = 'board-thumbnail-mini';
      boardThumbnailMini.innerHTML = `<img src="${resolveImageSrc(b.thumbnail)}" class="board-thumbnail-mini-img" alt="${b.title || ''}" />`;
    } else if (isWelcome) {
      boardThumbnailMini.className = 'board-thumbnail-mini';
      boardThumbnailMini.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:rgba(59,130,246,0.12);padding:2px;">${BRAIN_LOGO_SVG}</div>`;
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
    return ['General'];
  }

  function saveCategories() {
    try {
      localStorage.setItem('brainboard_categories', JSON.stringify(workspaceCategories));
    } catch (e) {}
  }

  let workspaceCategories = loadCategories();
  window.workspaceCategories = workspaceCategories;

  const DEFAULT_BOARD_THUMBNAILS = {};
  window.DEFAULT_BOARD_THUMBNAILS = DEFAULT_BOARD_THUMBNAILS;

  function formatLastOpened(val) {
    if (!val) return 'Hoy';
    let date = null;
    if (typeof val === 'number') {
      date = new Date(val);
    } else if (val instanceof Date) {
      date = val;
    } else if (typeof val === 'string') {
      const trimmed = val.trim();
      // Si ya tiene el formato completo con hora "Hoy, 15:30", "Ayer, 21:14", etc.
      if (trimmed.includes(':') && (trimmed.toLowerCase().startsWith('hoy') || trimmed.toLowerCase().startsWith('ayer') || /^\d{1,2}\s+[a-zA-Z]{3}/i.test(trimmed))) {
        return trimmed;
      }
      // Parsear legacy string tipo "14 mar" o "14 mar 2026"
      const matchMonth = trimmed.match(/^(\d{1,2})\s+([a-zA-Z]{3,})/i);
      if (matchMonth) {
        const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
        const mIdx = months.indexOf(matchMonth[2].toLowerCase().slice(0, 3));
        if (mIdx !== -1) {
          const d = parseInt(matchMonth[1], 10);
          const currentYear = new Date().getFullYear();
          date = new Date(currentYear, mIdx, d, 12, 0);
        }
      }
      if (!date) {
        const parsed = Date.parse(trimmed);
        if (!isNaN(parsed)) {
          date = new Date(parsed);
        } else {
          const now = new Date();
          const hh = String(now.getHours()).padStart(2, '0');
          const mm = String(now.getMinutes()).padStart(2, '0');
          if (trimmed.toLowerCase() === 'hoy') return `Hoy, ${hh}:${mm}`;
          if (trimmed.toLowerCase() === 'ayer') return `Ayer, ${hh}:${mm}`;
          return trimmed;
        }
      }
    } else {
      return 'Hoy';
    }

    if (!date || isNaN(date.getTime())) return 'Hoy';

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const targetDayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const diffDays = Math.round((todayStart - targetDayStart) / (24 * 60 * 60 * 1000));

    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const timeStr = `${hh}:${mm}`;

    if (diffDays <= 0) {
      return `Hoy, ${timeStr}`;
    } else if (diffDays === 1) {
      return `Ayer, ${timeStr}`;
    } else {
      const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
      const day = date.getDate();
      const month = months[date.getMonth()];
      if (date.getFullYear() === now.getFullYear()) {
        return `${day} ${month}, ${timeStr}`;
      } else {
        return `${day} ${month} ${date.getFullYear()}, ${timeStr}`;
      }
    }
  }
  window.formatLastOpened = formatLastOpened;

  function loadWorkspaceBoards() {
    let boards = null;
    try {
      const stored = localStorage.getItem('brainboard_workspace_boards') || localStorage.getItem('miro_workspace_boards');
      if (stored) {
        boards = JSON.parse(stored);
      }
    } catch (e) {}

    const now = Date.now();
    const defaultBoards = [
      { id: 'ejemplo', title: 'Ejemplo', icon: '✨', thumbnail: null, category: 'General', lastOpenedAt: now, lastOpened: formatLastOpened(now), active: true }
    ];

    if (!Array.isArray(boards) || boards.length === 0) {
      return defaultBoards;
    }

    let nodeFs = null;
    let nodePath = null;
    if (typeof window !== 'undefined' && typeof window.require === 'function') {
      try {
        nodeFs = window.require('fs');
        nodePath = window.require('path');
      } catch (e) {}
    }

    // Normalizar y migrar datos asegurando categoría y fecha de apertura con timestamp
    boards.forEach((b, idx) => {
      if (!b.category) {
        b.category = 'General';
      }

      // Migrar y asegurar timestamp numérico lastOpenedAt
      if (typeof b.lastOpenedAt !== 'number' || isNaN(b.lastOpenedAt) || b.lastOpenedAt <= 0) {
        let timestamp = 0;

        // 1. Intentar obtener timestamp de b.updatedAt
        if (b.updatedAt) {
          const t = new Date(b.updatedAt).getTime();
          if (!isNaN(t) && t > 0) timestamp = t;
        }

        // 2. Si no tiene updatedAt, leer del archivo JSON en disco si estamos en Electron
        if (!timestamp && nodeFs && nodePath) {
          try {
            const fileBase = b.id === 'dev_ai' ? 'DEV_AI' : b.id;
            const candidates = [
              nodePath.resolve(process.cwd(), `boards/${fileBase}.json`),
              nodePath.resolve(process.cwd(), `app_bundle/boards/${fileBase}.json`),
              nodePath.resolve(__dirname, `../boards/${fileBase}.json`),
              nodePath.resolve(__dirname, `boards/${fileBase}.json`)
            ];
            for (const cand of candidates) {
              if (nodeFs.existsSync(cand)) {
                const fData = JSON.parse(nodeFs.readFileSync(cand, 'utf8'));
                if (fData.updatedAt) {
                  const pt = new Date(fData.updatedAt).getTime();
                  if (!isNaN(pt) && pt > 0) {
                    timestamp = pt;
                    break;
                  }
                }
              }
            }
          } catch (e) {}
        }

        // 3. Si b.lastOpened contenía una fecha parseable
        if (!timestamp && b.lastOpened) {
          const matchMonth = String(b.lastOpened).trim().match(/^(\d{1,2})\s+([a-zA-Z]{3,})/i);
          if (matchMonth) {
            const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
            const mIdx = months.indexOf(matchMonth[2].toLowerCase().slice(0, 3));
            if (mIdx !== -1) {
              const d = parseInt(matchMonth[1], 10);
              const currentYear = new Date().getFullYear();
              timestamp = new Date(currentYear, mIdx, d, 12, 0).getTime();
            }
          }
        }

        // 4. Fallback escalonado para mantener orden estable
        if (!timestamp) {
          timestamp = now - (idx * 60000);
        }

        b.lastOpenedAt = timestamp;
      }

      b.lastOpened = formatLastOpened(b.lastOpenedAt);
    });

    // Asegurar que el tablero 'ejemplo' esté disponible
    if (!boards.find(b => b.id === 'ejemplo')) {
      boards.unshift({ id: 'ejemplo', title: 'Ejemplo', icon: '✨', thumbnail: null, category: 'General', lastOpenedAt: now, lastOpened: formatLastOpened(now), active: false });
    }

    try {
      localStorage.setItem('brainboard_workspace_boards', JSON.stringify(boards));
    } catch (e) {}

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
    return ['ejemplo'];
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
      openTabs = [currentActiveBoardId || 'ejemplo'];
      saveOpenTabs();
    }

    if (currentActiveBoardId && !openTabs.includes(currentActiveBoardId)) {
      openTabs.push(currentActiveBoardId);
      saveOpenTabs();
    }

    openTabs.forEach(boardId => {
      const bMeta = workspaceBoards.find(b => b.id === boardId);
      const title = bMeta?.title || (boardId === 'ejemplo' ? 'Ejemplo' : 'Tablero');
      const icon = bMeta?.icon || (boardId === 'ejemplo' ? '✨' : '📋');
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
    if (activeMeta) {
      activeMeta.lastOpenedAt = Date.now();
      activeMeta.lastOpened = formatLastOpened(activeMeta.lastOpenedAt);
      saveWorkspaceBoards();
    }
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
        if ((!saved?.userModified && seedData.seedVersion > savedVer) || ((targetBoardId === 'space' || targetBoardId === 'espacio') && seedData.seedVersion >= 10 && savedVer < 10) || (targetBoardId === 'ejemplo' && seedData.seedVersion >= 10 && savedVer < 10)) {
          isOutdatedCache = true;
        }
      }
    } catch(e) {}

    const hasValidSavedItems = !isOutdatedCache && saved && Array.isArray(saved.items) && saved.items.length > 0;

    if (hasValidSavedItems) {
      sanitizeEmbedResources(saved.items, seedData?.items);
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
    const now = Date.now();
    const newBoard = { id: newBoardId, title: name, icon: '📋', category: targetCat, lastOpenedAt: now, lastOpened: formatLastOpened(now), active: true };

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
    let filtered = workspaceBoards.filter(b => b.title.toLowerCase().includes(filter.toLowerCase()));
    if (currentDrawerCategoryFilter) {
      filtered = filtered.filter(b => (b.category || 'Random') === currentDrawerCategoryFilter);
    }
    filtered.sort((a, b) => {
      const timeA = typeof a.lastOpenedAt === 'number' ? a.lastOpenedAt : (a.updatedAt ? new Date(a.updatedAt).getTime() : 0);
      const timeB = typeof b.lastOpenedAt === 'number' ? b.lastOpenedAt : (b.updatedAt ? new Date(b.updatedAt).getTime() : 0);
      return timeB - timeA;
    });
    filtered.forEach(board => {
      const item = document.createElement('div');
      item.className = 'drawer-board-item' + (board.active ? ' active' : '');
      const canDelete = board.id !== 'dev_ai';
      let thumbHtml = '';
      const thumbSrc = resolveImageSrc(board.thumbnail || DEFAULT_BOARD_THUMBNAILS[board.id]);
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

  function renderDrawerCategories() {
    if (!drawerCategoriesList) return;
    drawerCategoriesList.innerHTML = '';

    // Carpeta "Todos" para ver todos los tableros
    const totalCount = workspaceBoards.length;
    const isAllActive = !currentDrawerCategoryFilter || currentDrawerCategoryFilter === 'all';
    const allItem = document.createElement('div');
    allItem.className = 'drawer-category-item' + (isAllActive ? ' active' : '');
    allItem.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
      <span class="drawer-category-name" style="flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 600;">Todos</span>
      <span class="drawer-category-count" style="font-size: 11px; opacity: 0.65;">${totalCount}</span>
    `;

    allItem.addEventListener('click', (e) => {
      e.stopPropagation();
      currentDrawerCategoryFilter = null;
      renderDrawerCategories();
      renderDrawerBoards(inputDrawerSearch ? inputDrawerSearch.value : '');
    });

    drawerCategoriesList.appendChild(allItem);

    workspaceCategories.forEach(cat => {
      const count = workspaceBoards.filter(b => (b.category || 'Random') === cat).length;
      const item = document.createElement('div');
      item.className = 'drawer-category-item' + (currentDrawerCategoryFilter === cat ? ' active' : '');
      item.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        <span class="drawer-category-name" style="flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${cat}</span>
        <span class="drawer-category-count" style="font-size: 11px; opacity: 0.65;">${count}</span>
      `;

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        if (currentDrawerCategoryFilter === cat) {
          currentDrawerCategoryFilter = null;
        } else {
          currentDrawerCategoryFilter = cat;
        }
        renderDrawerCategories();
        renderDrawerBoards(inputDrawerSearch ? inputDrawerSearch.value : '');
      });

      drawerCategoriesList.appendChild(item);
    });
  }

  renderDrawerBoards();
  renderDrawerCategories();

  // Estado colapsado / expandido de categorías
  try {
    if (localStorage.getItem('brainboard_home_cat_collapsed') === 'true') {
      document.getElementById('home-screen')?.classList.add('home-categories-collapsed');
    }
    if (localStorage.getItem('brainboard_drawer_cat_collapsed') === 'true') {
      boardControllerDrawer?.classList.add('drawer-categories-collapsed');
    }
  } catch (err) {}

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

  btnHomeToggleCategories?.addEventListener('click', (e) => {
    e.stopPropagation();
    const hs = document.getElementById('home-screen');
    const isNowCollapsed = hs?.classList.toggle('home-categories-collapsed');
    try {
      localStorage.setItem('brainboard_home_cat_collapsed', isNowCollapsed ? 'true' : 'false');
    } catch (err) {}
  });

  btnDrawerToggleCategories?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isNowCollapsed = boardControllerDrawer?.classList.toggle('drawer-categories-collapsed');
    try {
      localStorage.setItem('brainboard_drawer_cat_collapsed', isNowCollapsed ? 'true' : 'false');
    } catch (err) {}
  });

  btnDrawerNavHome?.addEventListener('click', () => {
    boardControllerDrawer?.classList.remove('open');
    showHomeScreen();
  });

  btnDrawerAddCategory?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (newCategoryModal) {
      if (inputNewCatName) inputNewCatName.value = '';
      newCategoryModal.style.display = 'flex';
      setTimeout(() => inputNewCatName?.focus(), 50);
    }
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
  menuOptThumbnail?.addEventListener('click', () => {
    boardOptionsMenu?.classList.remove('visible');
    openChangeThumbnailModal(currentActiveBoardId);
  });
  menuOptExportRtb?.addEventListener('click', () => {
    boardOptionsMenu?.classList.remove('visible');
    exportBoardToRTB(currentActiveBoardId);
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
  const btnDevInspectCoords = document.getElementById('btn-dev-inspect-coords');
  const devOptInspectCoords = document.getElementById('dev-opt-inspect-coords');
  const btnDevOptionsTrigger = document.getElementById('btn-dev-options-trigger');
  const devOptionsMenu = document.getElementById('dev-options-menu');
  const devOptExportHires = document.getElementById('dev-opt-export-hires');
  const devOptSelectArrows = document.getElementById('dev-opt-select-arrows');
  const devOptSelectFrames = document.getElementById('dev-opt-select-frames');

  function activateDevCoordsInspector() {
    if (!engine) return;
    const isCurrentlyActive = engine.activeTool === 'dev_coords';
    if (isCurrentlyActive) {
      engine.activeTool = 'select';
      btnDevInspectCoords?.classList.remove('active');
      showDevToast('Selector de coordenadas desactivado');
    } else {
      engine.activeTool = 'dev_coords';
      btnDevInspectCoords?.classList.add('active');
      document.querySelectorAll('#left-toolbar .tool-btn').forEach(b => b.classList.remove('active'));
      showDevToast('Arrastra un recuadro en el tablero para copiar sus coordenadas');
    }
    devOptionsMenu?.classList.remove('visible');
    engine.render();
  }

  btnDevInspectCoords?.addEventListener('click', (e) => {
    e.stopPropagation();
    activateDevCoordsInspector();
  });

  devOptInspectCoords?.addEventListener('click', () => {
    activateDevCoordsInspector();
  });

  // Callback al terminar la selección del área con la herramienta Dev
  if (engine) {
    engine.onDevCoordsSelected = async (coords) => {
      btnDevInspectCoords?.classList.remove('active');
      const activeBoardName = workspaceBoards.find(b => b.id === currentActiveBoardId)?.title || currentActiveBoardId || 'tablero';
      
      const payloadObj = {
        boardId: currentActiveBoardId,
        boardTitle: activeBoardName,
        coords: {
          x: coords.x,
          y: coords.y,
          width: coords.width,
          height: coords.height
        },
        promptHint: `Coloca el contenido en las coordenadas x=${coords.x}, y=${coords.y}, ancho=${coords.width}, alto=${coords.height} del tablero "${activeBoardName}"`
      };

      const jsonStr = JSON.stringify(payloadObj, null, 2);
      const shortStr = `x:${coords.x}, y:${coords.y}, w:${coords.width}, h:${coords.height} (Tablero: ${activeBoardName})`;

      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          await navigator.clipboard.writeText(jsonStr);
        } else {
          const ta = document.createElement('textarea');
          ta.value = jsonStr;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
        }
        showDevToast(`✓ Coordenadas copiadas al portapapeles: [${shortStr}]`);
      } catch (err) {
        console.warn('Error al copiar al portapapeles:', err);
        showDevToast(`Coordenadas: ${shortStr}`);
      }

      // Si el panel de Brain está visible, autocompletar una sugerencia sutil
      if (brainAiInput && brainAiChatPanel && brainAiChatPanel.style.display !== 'none' && !brainAiInput.value.trim()) {
        brainAiInput.value = `Quiero que coloques en estas coordenadas [x:${coords.x}, y:${coords.y}, w:${coords.width}, h:${coords.height}] lo siguiente: `;
        brainAiInput.focus();
      }
    };
  }

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

  devOptExportHires?.addEventListener('click', () => {
    devOptionsMenu?.classList.remove('visible');
    openExportModal();
  });

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
    if (!e.target.closest('#template-tool-wrapper')) {
      if (templateFlyoutMenu) templateFlyoutMenu.style.display = 'none';
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

  // Manejo reactivo de formato (PNG vs JPEG) y transparencia
  document.querySelectorAll('input[name="export-format"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const isJpeg = (radio.value === 'jpeg');
      const transparentLabel = document.getElementById('export-bg-transparent-label');
      const transparentRadio = document.querySelector('input[name="export-bg"][value="transparent"]');
      const boardRadio = document.querySelector('input[name="export-bg"][value="board"]');
      if (transparentLabel && transparentRadio) {
        if (isJpeg) {
          transparentLabel.style.opacity = '0.4';
          transparentLabel.style.pointerEvents = 'none';
          if (transparentRadio.checked && boardRadio) boardRadio.checked = true;
        } else {
          transparentLabel.style.opacity = '1';
          transparentLabel.style.pointerEvents = 'auto';
        }
      }
      if (btnConfirmExport) {
        btnConfirmExport.textContent = `Exportar ${radio.value.toUpperCase()}`;
      }
    });
  });

  btnCloseExportModal?.addEventListener('click', closeExportModal);
  btnCancelExport?.addEventListener('click', closeExportModal);

  btnConfirmExport?.addEventListener('click', async () => {
    const scaleRadio = document.querySelector('input[name="export-scale"]:checked');
    const scale = parseInt(scaleRadio?.value || '2', 10);

    const scopeRadio = document.querySelector('input[name="export-scope"]:checked');
    const scope = scopeRadio?.value || 'all';

    const formatRadio = document.querySelector('input[name="export-format"]:checked');
    const formatType = formatRadio?.value || 'png';
    const isJpeg = (formatType === 'jpeg');
    const mimeFormat = isJpeg ? 'image/jpeg' : 'image/png';
    const ext = isJpeg ? 'jpg' : 'png';

    const bgRadio = document.querySelector('input[name="export-bg"]:checked');
    let bgChoice = bgRadio?.value || 'board';
    let bgColor = 'board';
    if (bgChoice === 'white') bgColor = '#ffffff';
    else if (bgChoice === 'dark') bgColor = '#1e1f22';
    else if (bgChoice === 'transparent') bgColor = 'transparent';

    const titleClean = (boardTitleInput.value || 'tablero').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${titleClean}_${scale}x.${ext}`;

    const originalBtnText = btnConfirmExport.textContent;
    btnConfirmExport.textContent = 'Generando imagen...';
    btnConfirmExport.disabled = true;

    try {
      const res = await engine.exportBoardImage({
        selectionOnly: (scope === 'selection'),
        scale,
        backgroundColor: bgColor,
        format: mimeFormat,
        quality: 0.95
      });

      if (!res || res.error) {
        showDevToast(res?.error || 'Error al exportar imagen');
        return;
      }

      if (window.brainBoard && typeof window.brainBoard.exportImage === 'function') {
        const filters = isJpeg
          ? [{ name: 'Imagen JPEG (*.jpg; *.jpeg)', extensions: ['jpg', 'jpeg'] }, { name: 'Imagen PNG (*.png)', extensions: ['png'] }]
          : [{ name: 'Imagen PNG (*.png)', extensions: ['png'] }, { name: 'Imagen JPEG (*.jpg; *.jpeg)', extensions: ['jpg', 'jpeg'] }];

        const saveRes = await window.brainBoard.exportImage({
          defaultFilename: filename,
          dataUrl: res.dataUrl,
          filters
        });

        if (saveRes.canceled) {
          showDevToast('Exportación cancelada');
          return;
        }
        if (saveRes.error) {
          showDevToast('Error al guardar: ' + saveRes.error);
          return;
        }
        const savedName = saveRes.filePath ? saveRes.filePath.split(/[\\\/]/).pop() : filename;
        showDevToast(`Imagen guardada: ${savedName} (${res.width}×${res.height}px)`);
      } else {
        const a = document.createElement('a');
        a.href = res.dataUrl;
        a.download = filename;
        a.click();
        showDevToast(`Descargando imagen: ${filename} (${res.width}×${res.height}px)`);
      }
    } catch (err) {
      console.error('Error en exportación:', err);
      showDevToast('Error al exportar: ' + (err?.message || String(err)));
    } finally {
      btnConfirmExport.textContent = originalBtnText;
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
  const homeOptExportRtb = document.getElementById('home-opt-export-rtb');
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
        activeB.lastOpenedAt = Date.now();
        activeB.lastOpened = formatLastOpened(activeB.lastOpenedAt);
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
      b.lastOpenedAt = Date.now();
      b.lastOpened = formatLastOpened(b.lastOpenedAt);
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
    renderDrawerCategories();

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

    // Ordenar de más reciente a menos reciente por fecha de última apertura
    filtered.sort((a, b) => {
      const timeA = typeof a.lastOpenedAt === 'number' ? a.lastOpenedAt : (a.updatedAt ? new Date(a.updatedAt).getTime() : 0);
      const timeB = typeof b.lastOpenedAt === 'number' ? b.lastOpenedAt : (b.updatedAt ? new Date(b.updatedAt).getTime() : 0);
      return timeB - timeA;
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
      const isWelcome = board.id === 'ejemplo' || board.id === 'bienvenida' || (board.title && (board.title.toLowerCase().includes('bienvenida') || board.title.toLowerCase() === 'ejemplo'));
      if (board.thumbnail) {
        thumbHtml = `<div class="board-table-thumb"><img src="${resolveImageSrc(board.thumbnail)}" class="board-table-thumb-img" alt="${board.title}" /></div>`;
      } else if (isWelcome) {
        thumbHtml = `<div class="board-table-thumb" style="display:flex;align-items:center;justify-content:center;background:rgba(59,130,246,0.12);padding:4px;">${BRAIN_LOGO_SVG}</div>`;
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
          <span class="board-table-opened">${formatLastOpened(board.lastOpenedAt || board.lastOpened)}</span>
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

    // Carpeta "Todos" para ver todos los tableros
    const totalCount = workspaceBoards.length;
    const isAllActive = currentCategoryFilter === 'all';
    const allItem = document.createElement('div');
    allItem.className = 'home-category-item' + (isAllActive ? ' active' : '');
    allItem.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
      <span class="home-category-name" style="font-weight: 600;">Todos</span>
      <span class="home-nav-count">${totalCount}</span>
    `;
    allItem.addEventListener('click', () => {
      currentCategoryFilter = 'all';
      renderHomeScreen();
    });
    homeCategoriesList.appendChild(allItem);

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

  function openChangeThumbnailModal(boardId) {
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
  }
  window.openChangeThumbnailModal = openChangeThumbnailModal;

  // 2. Cambiar miniatura desde menú de fila de Inicio
  homeOptThumbnail?.addEventListener('click', () => {
    const boardId = activeRowActionBoardId;
    closeHomeRowOptionsMenu();
    openChangeThumbnailModal(boardId);
  });

  function updateThumbModalPreview() {
    if (!thumbModalPreview) return;
    if (tempSelectedThumbnail) {
      thumbModalPreview.innerHTML = `<img src="${resolveImageSrc(tempSelectedThumbnail)}" style="width:100%;height:100%;object-fit:cover;" />`;
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
    const targetBoardId = boardPendingThumbnailEdit;
    const b = workspaceBoards.find(x => x.id === targetBoardId);
    if (b) {
      b.thumbnail = tempSelectedThumbnail;
      b.icon = tempSelectedIcon || '📋';
      saveWorkspaceBoards();
    }
    renderTabs();
    renderDrawerBoards();
    renderHomeScreen();
    if (targetBoardId === currentActiveBoardId) {
      updateBoardThumbnailMini(currentActiveBoardId);
      autoSaveBoardImmediately(currentActiveBoardId);
    } else {
      idbLoadBoard(targetBoardId).then(saved => {
        if (saved) {
          saved.thumbnail = tempSelectedThumbnail;
          saved.icon = tempSelectedIcon || '📋';
          idbSaveBoard(targetBoardId, saved);
          saveBoardToDisk(targetBoardId, saved);
        }
      });
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

  // Exportar RTB (con imágenes)
  homeOptExportRtb?.addEventListener('click', async () => {
    const boardId = activeRowActionBoardId;
    closeHomeRowOptionsMenu();
    if (!boardId) return;
    await exportBoardToRTB(boardId);
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
        ${tempTargetCategory === cat ? '<span class="move-cat-check" style="color:#2563eb;font-weight:700;">✓</span>' : ''}
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
    const hs = document.getElementById('home-screen');
    if (hs?.classList.contains('home-categories-collapsed')) {
      hs.classList.remove('home-categories-collapsed');
      try { localStorage.setItem('brainboard_home_cat_collapsed', 'false'); } catch (e) {}
    }
    if (boardControllerDrawer?.classList.contains('drawer-categories-collapsed')) {
      boardControllerDrawer.classList.remove('drawer-categories-collapsed');
      try { localStorage.setItem('brainboard_drawer_cat_collapsed', 'false'); } catch (e) {}
    }
    currentCategoryFilter = name;
    renderHomeScreen();
    renderDrawerCategories();
    renderDrawerBoards();
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
    triggerImportBoard();
  });

  btnHomeBackup?.addEventListener('click', () => {
    exportAllBoardsBackup();
  });

  // Modal de Novedades de la Versión (What's New)
  const whatsNewModal = document.getElementById('whats-new-modal');
  const btnCloseWhatsNew = document.getElementById('btn-close-whats-new');
  const btnConfirmWhatsNew = document.getElementById('btn-confirm-whats-new');
  const btnHomeWhatsNew = document.getElementById('btn-home-whats-new');
  const badgeVersion = document.getElementById('badge-version');

  function openWhatsNewModal() {
    if (whatsNewModal) whatsNewModal.style.display = 'flex';
  }

  let activeAppVersion = '1.0.4';

  async function syncAppVersion() {
    try {
      if (window.brainBoard && typeof window.brainBoard.getAppVersion === 'function') {
        const v = await window.brainBoard.getAppVersion();
        if (v) activeAppVersion = v;
      }
    } catch (e) {}
    if (badgeVersion) badgeVersion.textContent = `v${activeAppVersion}`;
    const badgeModal = document.getElementById('whats-new-version-badge');
    if (badgeModal) badgeModal.textContent = `Versión ${activeAppVersion}`;
    const btnHomeWnText = btnHomeWhatsNew?.querySelector('span');
    if (btnHomeWnText) btnHomeWnText.textContent = `Novedades v${activeAppVersion}`;
  }

  function closeWhatsNewModal() {
    if (whatsNewModal) whatsNewModal.style.display = 'none';
    try {
      localStorage.setItem('brainboard_seen_version', activeAppVersion);
    } catch (e) {}
  }

  btnCloseWhatsNew?.addEventListener('click', closeWhatsNewModal);
  btnConfirmWhatsNew?.addEventListener('click', closeWhatsNewModal);
  btnHomeWhatsNew?.addEventListener('click', openWhatsNewModal);
  badgeVersion?.addEventListener('click', openWhatsNewModal);

  whatsNewModal?.addEventListener('click', (e) => {
    if (e.target === whatsNewModal) closeWhatsNewModal();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && whatsNewModal?.style.display === 'flex') {
      closeWhatsNewModal();
    }
  });

  // Comprobar versión y mostrar automáticamente el modal de novedades tras actualizar
  syncAppVersion().then(() => {
    try {
      const seenVersion = localStorage.getItem('brainboard_seen_version');
      if (seenVersion !== activeAppVersion) {
        setTimeout(() => {
          openWhatsNewModal();
        }, 350);
      }
    } catch (e) {}
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

  // =========================================================================
  // 1. TOOLTIP HOVER 2 SEGUNDOS & MAPA VISUAL DE FRESCURA / FECHAS
  // =========================================================================
  const hoverDateTooltip = document.getElementById('item-hover-date-tooltip');
  const hoverDateDot = document.getElementById('hover-date-dot');
  const hoverDateRelative = document.getElementById('hover-date-relative');
  const hoverDateTier = document.getElementById('hover-date-tier');
  const hoverDateExact = document.getElementById('hover-date-exact');

  const btnToggleFreshnessMap = document.getElementById('btn-toggle-freshness-map');
  const freshnessMapBar = document.getElementById('freshness-map-bar');
  const btnCloseFreshnessMap = document.getElementById('btn-close-freshness-map');

  engine.onItemHoverDate = (item, screenX, screenY, info) => {
    if (!hoverDateTooltip) return;
    if (!item || !info) {
      hoverDateTooltip.style.display = 'none';
      return;
    }
    if (hoverDateDot) hoverDateDot.style.background = info.color || '#10b981';
    if (hoverDateRelative) hoverDateRelative.textContent = info.relativeText || 'Reciente';
    if (hoverDateTier) {
      hoverDateTier.textContent = info.tierLabel || 'Actual';
      hoverDateTier.style.borderColor = info.color || '#10b981';
    }
    if (hoverDateExact) {
      hoverDateExact.textContent = `Colocado el ${info.formattedDateTime}`;
    }

    hoverDateTooltip.style.display = 'flex';
    const pad = 16;
    let left = screenX + 14;
    let top = screenY + 16;
    const rect = hoverDateTooltip.getBoundingClientRect();
    if (left + (rect.width || 200) > window.innerWidth - pad) {
      left = Math.max(pad, screenX - (rect.width || 200) - 12);
    }
    if (top + (rect.height || 64) > window.innerHeight - pad) {
      top = Math.max(pad, screenY - (rect.height || 64) - 12);
    }
    hoverDateTooltip.style.left = `${Math.round(left)}px`;
    hoverDateTooltip.style.top = `${Math.round(top)}px`;
  };

  function updateFreshnessMapCounters() {
    if (!engine || !Array.isArray(engine.items)) return;
    const counts = { all: 0, recent: 0, current: 0, aging: 0, obsolete: 0 };
    engine.items.forEach(it => {
      if (!it || it.type === 'connector' || it.type === 'pen') return;
      counts.all++;
      const info = engine.getItemFreshnessInfo(it);
      if (info && counts[info.tier] !== undefined) {
        counts[info.tier]++;
      }
    });
    const elAll = document.getElementById('freshness-count-all');
    const elRecent = document.getElementById('freshness-count-recent');
    const elCurrent = document.getElementById('freshness-count-current');
    const elAging = document.getElementById('freshness-count-aging');
    const elObsolete = document.getElementById('freshness-count-obsolete');
    if (elAll) elAll.textContent = String(counts.all);
    if (elRecent) elRecent.textContent = String(counts.recent);
    if (elCurrent) elCurrent.textContent = String(counts.current);
    if (elAging) elAging.textContent = String(counts.aging);
    if (elObsolete) elObsolete.textContent = String(counts.obsolete);
  }

  function toggleFreshnessMap(forceState = null) {
    const nextState = typeof forceState === 'boolean' ? forceState : !engine.freshnessMapMode;
    engine.setFreshnessMapMode(nextState, engine.freshnessFilterTier || 'all');
    if (btnToggleFreshnessMap) {
      btnToggleFreshnessMap.classList.toggle('active', nextState);
    }
    if (freshnessMapBar) {
      freshnessMapBar.style.display = nextState ? 'flex' : 'none';
    }
    if (nextState) {
      updateFreshnessMapCounters();
    }
  }

  btnToggleFreshnessMap?.addEventListener('click', () => {
    toggleFreshnessMap();
  });

  btnCloseFreshnessMap?.addEventListener('click', () => {
    toggleFreshnessMap(false);
  });

  freshnessMapBar?.querySelectorAll('.freshness-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const tier = pill.getAttribute('data-tier') || 'all';
      freshnessMapBar.querySelectorAll('.freshness-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      engine.setFreshnessMapMode(true, tier);
      updateFreshnessMapCounters();
    });
  });

  // =========================================================================
  // 2. CEREBRO IA DE BRAIN BOARD (CLAUDE CLI / GEMINI CLI / API KEYS + COORDENADAS)
  // =========================================================================
  const brainAiDockTrigger = document.getElementById('brain-ai-dock-trigger');
  const brainAiDockProviderTag = document.getElementById('brain-ai-dock-provider-tag');
  const brainAiChatPanel = document.getElementById('brain-ai-chat-panel');
  const brainAiProviderBadge = document.getElementById('brain-ai-provider-badge');
  const brainAiProviderName = document.getElementById('brain-ai-provider-name');
  const brainAiSubtitle = document.getElementById('brain-ai-subtitle');
  const brainAiStatsPill = document.getElementById('brain-ai-stats-pill');
  const brainAiTargetBoardSelect = document.getElementById('brain-ai-target-board');
  const brainAiMessages = document.getElementById('brain-ai-messages');
  const brainAiInput = document.getElementById('brain-ai-input');
  const btnBrainAiSend = document.getElementById('btn-brain-ai-send');
  const btnBrainAiSettings = document.getElementById('btn-brain-ai-settings');
  const btnBrainAiExpand = document.getElementById('btn-brain-ai-expand');
  const btnBrainAiClear = document.getElementById('btn-brain-ai-clear');
  const btnBrainAiClose = document.getElementById('btn-brain-ai-close');

  const brainAiSettingsModal = document.getElementById('brain-ai-settings-modal');
  const btnCloseBrainAiSettings = document.getElementById('btn-close-brain-ai-settings');
  const btnCancelBrainAiSettings = document.getElementById('btn-cancel-brain-ai-settings');
  const btnSaveBrainAiSettings = document.getElementById('btn-save-brain-ai-settings');
  const brainAiProviderSelect = document.getElementById('brain-ai-provider-select');
  const brainAiCliConfigBox = document.getElementById('brain-ai-cli-config-box');
  const brainAiApikeyConfigBox = document.getElementById('brain-ai-apikey-config-box');
  const brainAiCliDetectedBadge = document.getElementById('brain-ai-cli-detected-badge');
  const btnBrainAiTestCli = document.getElementById('btn-brain-ai-test-cli');
  const brainAiCliPathInput = document.getElementById('brain-ai-cli-path-input');
  const brainAiApikeyInput = document.getElementById('brain-ai-apikey-input');
  const brainAiApikeyLabel = document.getElementById('brain-ai-apikey-label');
  const brainAiApikeyStatus = document.getElementById('brain-ai-apikey-status');
  const btnBrainAiTestApikey = document.getElementById('btn-brain-ai-test-apikey');
  const brainAiGeminiFreeBanner = document.getElementById('brain-ai-gemini-free-banner');
  const btnBrainAiGetGeminiKey = document.getElementById('btn-brain-ai-get-gemini-key');
  const brainAiAutodetectStatus = document.getElementById('brain-ai-autodetect-status');
  const btnBrainAiAutodetect = document.getElementById('btn-brain-ai-autodetect');
  const brainAiModelSelect = document.getElementById('brain-ai-model-select');
  const brainAiEffortSelect = document.getElementById('brain-ai-effort-select');
  const brainAiInlineModel = document.getElementById('brain-ai-inline-model');
  const brainAiInlineEffort = document.getElementById('brain-ai-inline-effort');

  const BRAIN_AI_SETTINGS_KEY = 'brainboard_ai_settings_v1';
  const BRAIN_AI_HISTORY_KEY = 'brainboard_ai_chat_history_v1';

  // Catálogo de Modelos y Effort por proveedor (Gemini 2.5 Flash y Claude 5.5 Haiku por defecto)
  const PROVIDER_MODEL_CATALOG = {
    claude_cli: [
      { value: 'haiku', label: 'Claude 5.5 Haiku' },
      { value: 'sonnet', label: 'Claude 5.5 Sonnet' },
      { value: 'opus', label: 'Claude 5.5 Opus' }
    ],
    claude_api: [
      { value: 'claude-5-5-haiku-latest', label: 'Claude 5.5 Haiku' },
      { value: 'claude-5-5-sonnet-latest', label: 'Claude 5.5 Sonnet' },
      { value: 'claude-5-5-opus-latest', label: 'Claude 5.5 Opus' }
    ],
    gemini_cli: [
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
      { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' }
    ],
    gemini_api: [
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
      { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' }
    ],
    openai_api: [
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
      { value: 'gpt-4o', label: 'GPT-4o' },
      { value: 'o3-mini', label: 'o3-mini' }
    ],
    ollama: [
      { value: 'qwen2.5:7b', label: 'Qwen 2.5 7B' },
      { value: 'llama3.1:8b', label: 'Llama 3.1 8B' }
    ]
  };

  const PROVIDER_EFFORT_CATALOG = {
    claude: [
      { value: 'medium', label: 'Medium' },
      { value: 'low', label: 'Low' },
      { value: 'high', label: 'High' },
      { value: 'max', label: 'Max' }
    ],
    gemini: [
      { value: 'medium', label: 'Medium' },
      { value: 'low', label: 'Low' },
      { value: 'high', label: 'High' }
    ],
    other: [
      { value: 'medium', label: 'Medium' },
      { value: 'low', label: 'Low' },
      { value: 'high', label: 'High' }
    ]
  };

  function getCatalogForProvider(provider) {
    const models = PROVIDER_MODEL_CATALOG[provider] || PROVIDER_MODEL_CATALOG.gemini_api;
    const isClaude = provider === 'claude_cli' || provider === 'claude_api';
    const isGemini = provider === 'gemini_cli' || provider === 'gemini_api';
    const efforts = isClaude
      ? PROVIDER_EFFORT_CATALOG.claude
      : (isGemini ? PROVIDER_EFFORT_CATALOG.gemini : PROVIDER_EFFORT_CATALOG.other);
    return { models, efforts };
  }

  function getRecommendedModelForProvider(provider) {
    const { models } = getCatalogForProvider(provider);
    return models[0]?.value || 'gemini-2.5-flash';
  }

  function getRecommendedEffortForProvider() {
    return 'medium';
  }

  function detectDefaultClaudeCliPath() {
    if (typeof window !== 'undefined' && typeof window.require === 'function') {
      try {
        const fs = window.require('fs');
        const path = window.require('path');
        const os = window.require('os');
        const home = os.homedir();
        const candidates = [
          path.join(home, '.local', 'bin', 'claude.exe'),
          'C:\\Users\\Usuario\\.local\\bin\\claude.exe',
          path.join(process.env.APPDATA || '', 'npm', 'claude.cmd'),
          path.join(home, '.local', 'bin', 'claude')
        ];
        for (const c of candidates) {
          if (c && fs.existsSync(c)) return c;
        }
      } catch (e) {}
    }
    return '';
  }

  function detectDefaultGeminiCliPath() {
    if (typeof window !== 'undefined' && typeof window.require === 'function') {
      try {
        const fs = window.require('fs');
        const path = window.require('path');
        const os = window.require('os');
        const home = os.homedir();
        const candidates = [
          path.join(process.env.APPDATA || '', 'npm', 'gemini.cmd'),
          path.join(home, '.local', 'bin', 'gemini.exe'),
          path.join(home, '.local', 'bin', 'gemini')
        ];
        for (const c of candidates) {
          if (c && fs.existsSync(c)) return c;
        }
      } catch (e) {}
    }
    return '';
  }

  // Autodetección inteligente: 1º Claude CLI local, 2º Gemini CLI local, 3º Gemini 2.5 Flash Gratis por defecto
  function autoDetectBestAiProvider() {
    const claudePath = detectDefaultClaudeCliPath();
    if (claudePath) {
      return {
        provider: 'claude_cli',
        cliPath: claudePath,
        model: 'haiku',
        effort: 'medium',
        detectedSummary: `✓ Claude CLI autodetectado (${claudePath})`
      };
    }
    const geminiPath = detectDefaultGeminiCliPath();
    if (geminiPath) {
      return {
        provider: 'gemini_cli',
        cliPath: geminiPath,
        model: 'gemini-2.5-flash',
        effort: 'medium',
        detectedSummary: `✓ Gemini CLI autodetectado (${geminiPath})`
      };
    }
    return {
      provider: 'gemini_api',
      cliPath: '',
      model: 'gemini-2.5-flash',
      effort: 'medium',
      detectedSummary: '✨ Sin CLI local → Gemini 2.5 Flash (Gratis) activado por defecto'
    };
  }

  function loadBrainAiSettings() {
    const autoDetected = autoDetectBestAiProvider();
    const defaults = {
      provider: autoDetected.provider,
      cliPath: autoDetected.cliPath,
      apiKey: '',
      model: autoDetected.model,
      effort: autoDetected.effort
    };
    try {
      const raw = localStorage.getItem(BRAIN_AI_SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Si estaba en claude_cli por defecto pero en este PC no existe claude, cambiar automáticamente a Gemini 2.5 Flash Gratis
        if (parsed.provider === 'claude_cli' && !parsed.cliPath && !detectDefaultClaudeCliPath()) {
          parsed.provider = 'gemini_api';
          parsed.model = 'gemini-2.5-flash';
        } else if (!parsed.cliPath && parsed.provider === 'claude_cli' && autoDetected.cliPath) {
          parsed.cliPath = autoDetected.cliPath;
        }
        const merged = { ...defaults, ...parsed };
        const { models, efforts } = getCatalogForProvider(merged.provider);
        if (!models.some(m => m.value === merged.model)) {
          merged.model = models[0].value;
        }
        if (!efforts.some(ef => ef.value === merged.effort)) {
          merged.effort = efforts[0].value;
        }
        return merged;
      }
    } catch (e) {}
    return defaults;
  }

  let brainAiSettings = loadBrainAiSettings();
  let isBrainAiGenerating = false;

  function saveBrainAiSettingsToStorage() {
    try {
      localStorage.setItem(BRAIN_AI_SETTINGS_KEY, JSON.stringify(brainAiSettings));
    } catch (e) {}
  }

  function populateModelAndEffortSelects(provider, targetModelSelect, targetEffortSelect, selectedModel, selectedEffort) {
    const { models, efforts } = getCatalogForProvider(provider);
    if (targetModelSelect) {
      targetModelSelect.innerHTML = '';
      models.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.value;
        opt.textContent = m.label;
        targetModelSelect.appendChild(opt);
      });
      targetModelSelect.value = models.some(m => m.value === selectedModel) ? selectedModel : models[0].value;
    }
    if (targetEffortSelect) {
      targetEffortSelect.innerHTML = '';
      efforts.forEach(ef => {
        const opt = document.createElement('option');
        opt.value = ef.value;
        opt.textContent = ef.label;
        targetEffortSelect.appendChild(opt);
      });
      targetEffortSelect.value = efforts.some(ef => ef.value === selectedEffort) ? selectedEffort : efforts[0].value;
    }
  }

  function syncInlineModelAndEffortBar() {
    populateModelAndEffortSelects(
      brainAiSettings.provider,
      brainAiInlineModel,
      brainAiInlineEffort,
      brainAiSettings.model,
      brainAiSettings.effort
    );
  }

  brainAiInlineModel?.addEventListener('change', () => {
    brainAiSettings.model = brainAiInlineModel.value;
    try { localStorage.setItem(BRAIN_AI_SETTINGS_KEY, JSON.stringify(brainAiSettings)); } catch (e) {}
    syncBrainAiHeaderBadges();
  });

  brainAiInlineEffort?.addEventListener('change', () => {
    brainAiSettings.effort = brainAiInlineEffort.value;
    try { localStorage.setItem(BRAIN_AI_SETTINGS_KEY, JSON.stringify(brainAiSettings)); } catch (e) {}
    syncBrainAiHeaderBadges();
  });

  function getProviderDisplayName(provider) {
    switch (provider) {
      case 'claude_cli': return 'Claude CLI';
      case 'gemini_cli': return 'Gemini CLI';
      case 'claude_api': return 'Claude API';
      case 'gemini_api': return 'Gemini 2.5';
      case 'openai_api': return 'OpenAI API';
      case 'ollama': return 'Ollama Local';
      default: return 'Claude CLI';
    }
  }

  function getModelShortDisplayName(provider, model) {
    if (provider === 'claude_cli') {
      if (model === 'haiku') return 'Claude 5.5 Haiku';
      if (model === 'sonnet') return 'Claude 5.5 Sonnet';
      if (model === 'opus') return 'Claude 5.5 Opus';
    }
    const { models } = getCatalogForProvider(provider);
    const found = models.find(m => m.value === model);
    if (found) return found.label.replace('★ ', '').replace(/\s*\(.*?\)/, '');
    return (model || 'auto').replace('claude-', '').replace('gemini-', '');
  }

  function syncBrainAiHeaderBadges() {
    const label = getProviderDisplayName(brainAiSettings.provider);
    const shortModel = getModelShortDisplayName(brainAiSettings.provider, brainAiSettings.model);
    const eff = brainAiSettings.effort || 'medium';
    if (brainAiProviderName) brainAiProviderName.textContent = `${label} · ${shortModel} (${eff})`;
    if (brainAiDockProviderTag) brainAiDockProviderTag.textContent = label.replace(' CLI', '').replace(' API', '');
    syncInlineModelAndEffortBar();
  }

  function populateBrainAiTargetBoards() {
    if (!brainAiTargetBoardSelect) return;
    const prevVal = brainAiTargetBoardSelect.value || 'auto';
    brainAiTargetBoardSelect.innerHTML = `<option value="auto">Automático (según tu mensaje o tablero activo)</option>`;
    if (Array.isArray(workspaceBoards)) {
      workspaceBoards.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.textContent = `${b.title || b.id} (${b.category || 'General'})`;
        brainAiTargetBoardSelect.appendChild(opt);
      });
    }
    if (prevVal && Array.from(brainAiTargetBoardSelect.options).some(o => o.value === prevVal)) {
      brainAiTargetBoardSelect.value = prevVal;
    }
  }

  // Cargar datos completos de TODOS los tableros para el índice del Cerebro
  async function loadAllBoardsForBrainIndex() {
    const allBoardsData = [];
    const boardsList = Array.isArray(workspaceBoards) ? workspaceBoards : [];

    for (const meta of boardsList) {
      const bId = meta.id;
      let items = [];
      if (bId === currentActiveBoardId && engine && Array.isArray(engine.items) && engine.items.length > 0) {
        items = engine.getCleanItems ? engine.getCleanItems() : engine.items;
      } else {
        let saved = await idbLoadBoard(bId);
        if (!saved) {
          try {
            const ls = localStorage.getItem(`brainboard_board_${bId}`);
            if (ls) saved = JSON.parse(ls);
          } catch (e) {}
        }
        if (saved && Array.isArray(saved.items) && saved.items.length > 0) {
          items = saved.items;
        } else {
          const seed = await fetchBoardSeedData(bId);
          if (seed && Array.isArray(seed.items)) {
            items = seed.items;
          }
        }
      }
      hydrateBoardItemsDates(items);
      allBoardsData.push({
        id: bId,
        title: meta.title || bId,
        category: meta.category || 'General',
        updatedAt: meta.updatedAt || null,
        items
      });
    }
    return allBoardsData;
  }

  let currentBrainNoteSummaryMode = 'medio';

  // Calcular coordenadas libres de colisión en un tablero o dentro de un marco (siguiendo BoardInstructorAI.md)
  function computeNextSmartPlacement(boardData, preferredFrameTitle = null, summaryMode = 'medio') {
    const items = Array.isArray(boardData?.items) ? boardData.items : [];
    const frames = items.filter(it => it && it.type === 'frame');

    const modeNorm = String(summaryMode || 'medio').toLowerCase();
    const isDesarrollado = modeNorm.includes('desarrollado');
    const isBreve = modeNorm.includes('breve');

    const cardHeight = isDesarrollado ? 360 : (isBreve ? 195 : 260);
    const frameBaseW = isDesarrollado ? 860 : (isBreve ? 800 : 820);
    const frameBaseH = isDesarrollado ? 510 : (isBreve ? 350 : 420);
    const noteCardW = isDesarrollado ? 435 : (isBreve ? 375 : 395);

    // Buscar si existe un marco apropiado o el último marco activo
    let targetFrame = null;
    if (preferredFrameTitle) {
      const q = preferredFrameTitle.toLowerCase();
      targetFrame = frames.find(f => (f.title || '').toLowerCase().includes(q));
    }

    if (targetFrame) {
      const children = items.filter(it => it.id !== targetFrame.id && (it.parentId === targetFrame.id || (
        typeof it.x === 'number' && typeof it.y === 'number' &&
        it.x >= targetFrame.x && it.x <= targetFrame.x + (targetFrame.width || 600) &&
        it.y >= targetFrame.y && it.y <= targetFrame.y + (targetFrame.height || 400)
      )));

      let maxChildBottom = targetFrame.y + 45;
      children.forEach(c => {
        const b = (c.y || 0) + (c.height || 100);
        if (b > maxChildBottom) maxChildBottom = b;
      });

      const newY = Math.round(maxChildBottom + 28);
      const embedX = Math.round(targetFrame.x + 35);
      const noteX = Math.round(targetFrame.x + 385);
      const neededHeight = (newY + cardHeight) - targetFrame.y + 35;

      return {
        mode: 'inside_existing_frame',
        frameId: targetFrame.id,
        frameTitle: targetFrame.title || 'Marco',
        expandFrameHeightTo: Math.max(targetFrame.height || 450, neededHeight),
        embedRect: { x: embedX, y: newY, width: 320, height: cardHeight },
        noteRect: { x: noteX, y: newY, width: Math.max(380, noteCardW), height: cardHeight }
      };
    }

    // Si no hay marco específico, calcular posición limpia a la derecha o debajo de los marcos existentes para un nuevo marco o par de tarjetas
    let maxRight = 0;
    let minTop = 0;
    let hasBounds = false;
    items.forEach(it => {
      if (typeof it.x === 'number' && typeof it.y === 'number') {
        const r = it.x + (it.width || 200);
        if (!hasBounds || r > maxRight) maxRight = r;
        if (!hasBounds || it.y < minTop) minTop = it.y;
        hasBounds = true;
      }
    });

    const newFrameX = hasBounds ? Math.round(maxRight + 120) : 100;
    const newFrameY = hasBounds ? Math.round(minTop) : 100;
    const newFrameW = frameBaseW;
    const newFrameH = frameBaseH;

    return {
      mode: 'new_curated_frame',
      newFrameRect: { x: newFrameX, y: newFrameY, width: newFrameW, height: newFrameH },
      headerRect: { x: newFrameX + 30, y: newFrameY + 24, width: newFrameW - 60, height: 54 },
      embedRect: { x: newFrameX + 30, y: newFrameY + 104, width: 330, height: cardHeight },
      noteRect: { x: newFrameX + 390, y: newFrameY + 104, width: noteCardW, height: cardHeight }
    };
  }

  // Calcular coordenadas limpias para "Añadir recurso" (Tarjeta compacta 310x135 + mini descripción debajo)
  function computeNextResourcePlacement(boardData, preferredFrameTitle = null, manualCoords = null) {
    const cardW = 310;
    const cardH = 135;
    const captionGap = 14;
    const captionH = 34;

    if (manualCoords && typeof manualCoords.x === 'number' && typeof manualCoords.y === 'number') {
      const rx = Math.round(manualCoords.x);
      const ry = Math.round(manualCoords.y);
      return {
        mode: 'standalone_resource',
        frameId: null,
        embedRect: { x: rx, y: ry, width: cardW, height: cardH },
        captionRect: { x: rx, y: ry + cardH + captionGap, width: cardW + 20, height: captionH }
      };
    }

    const items = Array.isArray(boardData?.items) ? boardData.items : [];
    const frames = items.filter(it => it && it.type === 'frame');

    let targetFrame = null;
    if (preferredFrameTitle) {
      const q = String(preferredFrameTitle).toLowerCase().trim();
      if (q) {
        targetFrame = frames.find(f => (f.title || '').toLowerCase().includes(q));
      }
    }

    if (targetFrame) {
      const children = items.filter(it => it.id !== targetFrame.id && (it.parentId === targetFrame.id || (
        typeof it.x === 'number' && typeof it.y === 'number' &&
        it.x >= targetFrame.x && it.x <= targetFrame.x + (targetFrame.width || 600) &&
        it.y >= targetFrame.y && it.y <= targetFrame.y + (targetFrame.height || 400)
      )));

      let maxChildBottom = targetFrame.y + 45;
      children.forEach(c => {
        const b = (c.y || 0) + (c.height || 100);
        if (b > maxChildBottom) maxChildBottom = b;
      });

      const newX = Math.round(targetFrame.x + 35);
      const newY = Math.round(maxChildBottom + 28);
      const neededHeight = (newY + cardH + captionGap + captionH) - targetFrame.y + 35;

      return {
        mode: 'inside_existing_frame',
        frameId: targetFrame.id,
        expandFrameHeightTo: Math.max(targetFrame.height || 450, neededHeight),
        embedRect: { x: newX, y: newY, width: cardW, height: cardH },
        captionRect: { x: newX, y: newY + cardH + captionGap, width: cardW + 20, height: captionH }
      };
    }

    // Buscar posición limpia a la derecha del contenido actual (o apilado en columna si ya hay un recurso compacto reciente en el borde derecho)
    let maxRight = 0;
    let minTop = 0;
    let hasBounds = false;
    items.forEach(it => {
      if (typeof it.x === 'number' && typeof it.y === 'number') {
        const r = it.x + (it.width || 200);
        if (!hasBounds || r > maxRight) maxRight = r;
        if (!hasBounds || it.y < minTop) minTop = it.y;
        hasBounds = true;
      }
    });

    const compactRightResources = items.filter(it =>
      it && it.type === 'embed' && !it.parentId &&
      typeof it.x === 'number' && typeof it.y === 'number' &&
      (it.width || 310) <= 350 &&
      Math.abs((it.x + (it.width || 310)) - maxRight) <= 60
    );

    if (compactRightResources.length > 0 && compactRightResources.length < 4) {
      const lowestRes = compactRightResources.reduce((a, b) => (b.y > a.y ? b : a), compactRightResources[0]);
      const colX = Math.round(lowestRes.x);
      const colY = Math.round(lowestRes.y + (lowestRes.height || cardH) + captionGap + captionH + 38);
      return {
        mode: 'standalone_resource',
        frameId: null,
        embedRect: { x: colX, y: colY, width: cardW, height: cardH },
        captionRect: { x: colX, y: colY + cardH + captionGap, width: cardW + 20, height: captionH }
      };
    }

    const rx = hasBounds ? Math.round(maxRight + 100) : 100;
    const ry = hasBounds ? Math.round(minTop) : 100;

    return {
      mode: 'standalone_resource',
      frameId: null,
      embedRect: { x: rx, y: ry, width: cardW, height: cardH },
      captionRect: { x: rx, y: ry + cardH + captionGap, width: cardW + 20, height: captionH }
    };
  }

  // Extraer texto legible de un elemento del tablero
  function getItemReadableSummary(it, framesById) {
    if (!it) return '';
    const parts = [];
    if (it.title) parts.push(String(it.title).trim());
    if (it.text) parts.push(String(it.text).replace(/\s+/g, ' ').trim());
    if (it.description) parts.push(String(it.description).replace(/\s+/g, ' ').trim());
    if (it.url) parts.push(`URL: ${it.url}`);
    if (it.parentId && framesById && framesById.has(it.parentId)) {
      parts.push(`[En marco: "${framesById.get(it.parentId).title || it.parentId}"]`);
    }
    return parts.filter(Boolean).join(' — ');
  }

  // Obtener información en vivo de una URL (GitHub API, Tweet/X, YouTube o metadatos web) cuando el usuario pega un enlace en el chat
  async function fetchLiveUrlContextForAi(urlStr) {
    if (!urlStr) return null;
    try {
      const u = new URL(urlStr);
      const host = u.hostname.toLowerCase();

      // 1. Si es un repositorio de GitHub, consultar API pública de GitHub + extracto del README
      if (host.includes('github.com')) {
        const parts = u.pathname.split('/').filter(Boolean);
        if (parts.length >= 2) {
          const owner = parts[0];
          const repo = parts[1].replace(/\.git$/i, '');
          const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
          if (repoRes.ok) {
            const repoData = await repoRes.json();
            let readmeSnippet = '';
            try {
              const readmeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
                headers: { Accept: 'application/vnd.github.v3.raw' }
              });
              if (readmeRes.ok) {
                const rawReadme = await readmeRes.text();
                readmeSnippet = rawReadme.replace(/<!--[\s\S]*?-->/g, '').trim().slice(0, 1800);
              }
            } catch (eR) {}
            return {
              url: urlStr,
              type: 'github_repo',
              title: `${repoData.full_name || (owner + '/' + repo)}`,
              description: repoData.description || '',
              topics: Array.isArray(repoData.topics) ? repoData.topics.join(', ') : '',
              stars: repoData.stargazers_count,
              language: repoData.language || '',
              readmeSnippet
            };
          }
        }
      }

      // 2. Si es un Tweet / Post de X (x.com o twitter.com)
      if (host === 'x.com' || host.endsWith('.x.com') || host.includes('twitter.com')) {
        const parts = u.pathname.split('/').filter(Boolean);
        if (parts.length >= 3 && parts[1] === 'status') {
          try {
            const fxRes = await fetch(`https://api.fxtwitter.com/${parts[0]}/status/${parts[2]}`);
            if (fxRes.ok) {
              const fxData = await fxRes.json();
              if (fxData && fxData.tweet) {
                const author = fxData.tweet.author?.screen_name || parts[0];
                const authorName = fxData.tweet.author?.name || author;
                const tweetText = fxData.tweet.text || '';
                return {
                  url: urlStr,
                  type: 'tweet_x',
                  title: `@${author} (${authorName})`,
                  description: tweetText.slice(0, 500)
                };
              }
            }
          } catch (eFx) {}
        }
        try {
          const oembedRes = await fetch(`https://publish.twitter.com/oembed?url=${encodeURIComponent(urlStr)}&omit_script=true`);
          if (oembedRes.ok) {
            const oembedData = await oembedRes.json();
            const plainTweet = String(oembedData.html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            return {
              url: urlStr,
              type: 'tweet_x',
              title: oembedData.author_name ? `@${oembedData.author_name}` : engine.extractTitle(urlStr),
              description: plainTweet.slice(0, 500)
            };
          }
        } catch (eTw) {}
      }

      // 3. Si es YouTube
      if (host.includes('youtube.com') || host.includes('youtu.be')) {
        try {
          const ytRes = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(urlStr)}`);
          if (ytRes.ok) {
            const ytData = await ytRes.json();
            if (ytData && ytData.title) {
              return {
                url: urlStr,
                type: 'youtube_video',
                title: ytData.title,
                description: ytData.author_name ? `Canal: ${ytData.author_name}` : ''
              };
            }
          }
        } catch (eYt) {}
      }

      // 4. Fallback general usando fetchUrlMetadata de Electron si existe
      const fetchApi = window.brainBoard?.fetchUrlMetadata || window.miro?.fetchUrlMetadata;
      if (fetchApi) {
        const meta = await fetchApi(urlStr);
        if (meta) {
          return {
            url: urlStr,
            type: 'web_page',
            title: meta.title || engine.extractTitle(urlStr),
            description: meta.description || '',
            image: meta.image || ''
          };
        }
      }
    } catch (e) {}
    return {
      url: urlStr,
      type: 'url',
      title: engine.extractTitle(urlStr) || urlStr,
      description: ''
    };
  }

  // Construir el contexto estructurado completo del "Cerebro" para enviar a Claude / Gemini
  async function buildBrainCompleteContext(userQuery, preferredBoardId = 'auto') {
    const allBoards = await loadAllBoardsForBrainIndex();
    const allIndexedItems = [];
    const boardsCatalogLines = [];

    allBoards.forEach(b => {
      const framesById = new Map();
      const framesList = [];
      b.items.forEach(it => {
        if (it && it.type === 'frame') {
          framesById.set(it.id, it);
          framesList.push(`"${it.title || 'Sin título'}" (id:${it.id}, x:${Math.round(it.x || 0)}, y:${Math.round(it.y || 0)}, w:${Math.round(it.width || 0)}, h:${Math.round(it.height || 0)})`);
        }
      });

      const placement = computeNextSmartPlacement(b);
      boardsCatalogLines.push(
        `- TABLERO id="${b.id}" | Nombre="${b.title}" | Categoría="${b.category}" | Elementos=${b.items.length}` +
        (framesList.length > 0 ? `\n  Marcos: ${framesList.slice(0, 12).join(' ; ')}` : '') +
        `\n  Coordenadas recomendadas para nueva inserción: ${JSON.stringify(placement)}`
      );

      b.items.forEach(it => {
        if (!it || it.type === 'connector' || it.type === 'pen') return;
        const summary = getItemReadableSummary(it, framesById);
        if (!summary && it.type !== 'image') return;
        const fInfo = engine.getItemFreshnessInfo(it);
        allIndexedItems.push({
          id: it.id,
          boardId: b.id,
          boardTitle: b.title,
          category: b.category,
          type: it.type,
          title: it.title || '',
          text: it.text || '',
          url: it.url || '',
          parentId: it.parentId || null,
          frameTitle: (it.parentId && framesById.get(it.parentId)?.title) || '',
          x: Math.round(it.x || 0),
          y: Math.round(it.y || 0),
          width: Math.round(it.width || 0),
          height: Math.round(it.height || 0),
          createdAt: fInfo.createdAtIso,
          createdMs: fInfo.createdMs,
          formattedDate: fInfo.formattedDateTime,
          relativeText: fInfo.relativeText,
          tier: fInfo.tier,
          tierLabel: fInfo.tierLabel,
          summary
        });
      });
    });

    if (brainAiStatsPill) {
      brainAiStatsPill.textContent = `${allBoards.length} tableros · ${allIndexedItems.length} nodos con fecha`;
    }

    // 1. Últimos elementos colocados en todo el Cerebro (ordenados por fecha descendente)
    const sortedByNewest = [...allIndexedItems].sort((a, b) => b.createdMs - a.createdMs);
    const latestItemsLines = sortedByNewest.slice(0, 45).map(it =>
      `• [${it.formattedDate} | ${it.relativeText}] Tablero "${it.boardTitle}" (boardId:${it.boardId}, itemId:${it.id}, tipo:${it.type}, pos:${it.x},${it.y}): ${it.summary.slice(0, 260)}`
    );

    // 2. Últimos enlaces / repositorios (URLs y embeds) ordenados por fecha descendente
    const allLinksAndRepos = sortedByNewest.filter(it => Boolean(it.url) || it.type === 'embed' || it.type === 'preview' || /https?:\/\/|github\.com/i.test(it.summary));
    const latestReposLines = allLinksAndRepos.slice(0, 45).map(it =>
      `• [${it.formattedDate} | ${it.relativeText}] Tablero "${it.boardTitle}" (boardId:${it.boardId}, itemId:${it.id}): ${it.summary.slice(0, 280)}`
    );

    // 3. Búsqueda semántica/léxica por palabras clave de la consulta del usuario
    const stopWords = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'en', 'con', 'por', 'para', 'que', 'qué', 'cuales', 'cuáles', 'son', 'mis', 'mi', 'me', 'he', 'has', 'como', 'cómo', 'este', 'esta', 'estos', 'estas', 'sobre', 'tablero', 'cerebro', 'cosas', 'puesto', 'pegado', 'hazme', 'dime', 'quiero']);
    const queryTokens = String(userQuery || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}_./:-]+/gu, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 2 && !stopWords.has(w));

    const scoredMatches = [];
    if (queryTokens.length > 0) {
      allIndexedItems.forEach(it => {
        const hay = `${it.boardTitle} ${it.category} ${it.frameTitle} ${it.summary}`.toLowerCase();
        let score = 0;
        queryTokens.forEach(tok => {
          if (hay.includes(tok)) score += (it.url ? 3 : 2);
        });
        if (score > 0) {
          scoredMatches.push({ it, score });
        }
      });
      scoredMatches.sort((a, b) => (b.score !== a.score) ? (b.score - a.score) : (b.it.createdMs - a.it.createdMs));
    }

    const matchedLines = scoredMatches.slice(0, 45).map(({ it }) =>
      `• [${it.formattedDate} | ${it.relativeText}] Tablero "${it.boardTitle}" (boardId:${it.boardId}, itemId:${it.id}, marco:"${it.frameTitle}", pos:${it.x},${it.y}): ${it.summary.slice(0, 300)}`
    );

    // 4. Elementos más antiguos / potencialmente obsoletos (> 6 meses)
    const sortedByOldest = [...allIndexedItems].sort((a, b) => a.createdMs - b.createdMs);
    const oldestLines = sortedByOldest.slice(0, 25).map(it =>
      `• [${it.formattedDate} | ${it.relativeText} - ${it.tierLabel}] Tablero "${it.boardTitle}" (boardId:${it.boardId}, itemId:${it.id}): ${it.summary.slice(0, 240)}`
    );

    // 5. Detectar ventana temporal solicitada para Briefing (Últimas 24 horas, Últimos 3 días, Últimos 7 días)
    const nowMs = Date.now();
    const qLower = String(userQuery || '').toLowerCase();
    let requestedWindowLabel = '';
    let requestedWindowMs = 0;
    if (/24\s*horas|24h|últimas\s*24|ultimas\s*24|hoy/i.test(qLower)) {
      requestedWindowLabel = 'Últimas 24 horas';
      requestedWindowMs = 24 * 60 * 60 * 1000;
    } else if (/3\s*días|3\s*dias|últimos\s*3|ultimos\s*3|72\s*horas/i.test(qLower)) {
      requestedWindowLabel = 'Últimos 3 días';
      requestedWindowMs = 3 * 24 * 60 * 60 * 1000;
    } else if (/7\s*días|7\s*dias|últimos\s*7|ultimos\s*7|última\s*semana|ultima\s*semana/i.test(qLower)) {
      requestedWindowLabel = 'Últimos 7 días';
      requestedWindowMs = 7 * 24 * 60 * 60 * 1000;
    }

    let timeWindowFilteredLines = [];
    if (requestedWindowMs > 0) {
      const filteredInWindow = sortedByNewest.filter(it => (nowMs - it.createdMs) <= requestedWindowMs);
      timeWindowFilteredLines = filteredInWindow.slice(0, 60).map(it =>
        `• [${it.formattedDate} | ${it.relativeText}] Tablero "${it.boardTitle}" (boardId:${it.boardId}, itemId:${it.id}, tipo:${it.type}, marco:"${it.frameTitle}"): ${it.summary.slice(0, 280)}`
      );
    }

    // 6. Detectar si el usuario ha pegado alguna URL en su mensaje y extraer su información en vivo
    const urlsInPrompt = String(userQuery || '').match(/https?:\/\/[^\s<>")]+/gi) || [];
    const liveUrlsInfo = [];
    for (const u of urlsInPrompt.slice(0, 3)) {
      const info = await fetchLiveUrlContextForAi(u);
      if (info) liveUrlsInfo.push(info);
    }

    return {
      allBoards,
      allIndexedItems,
      boardsCatalogLines,
      latestItemsLines,
      latestReposLines,
      matchedLines,
      oldestLines,
      requestedWindowLabel,
      timeWindowFilteredLines,
      liveUrlsInfo,
      activeBoardId: currentActiveBoardId,
      preferredBoardId
    };
  }

  // Construir el System + Context Prompt completo con las reglas de BoardInstructorAI.md y protocolo de acciones
  function buildFullPromptForAi(userMessage, ctx, chatHistory = []) {
    const recentHistoryText = chatHistory.slice(-6).map(m => `${m.role === 'user' ? 'USUARIO' : 'CEREBRO IA'}: ${m.text}`).join('\n\n');
    const targetBoardHint = ctx.preferredBoardId && ctx.preferredBoardId !== 'auto'
      ? `El usuario ha seleccionado explícitamente el tablero destino id="${ctx.preferredBoardId}" en el selector.`
      : `Tablero actualmente abierto en pantalla: id="${ctx.activeBoardId || 'dev_ai'}".`;

    const liveUrlSection = ctx.liveUrlsInfo.length > 0
      ? `\n=== METADATOS EN VIVO DE LA URL / REPOSITORIO PEGADO POR EL USUARIO ===\n${JSON.stringify(ctx.liveUrlsInfo, null, 2)}\n`
      : '';

    const timeWindowSection = ctx.requestedWindowLabel
      ? `\n=== ELEMENTOS COLOCADOS EN EL PERIODO SOLICITADO (${ctx.requestedWindowLabel.toUpperCase()}) ===\n` +
        (ctx.timeWindowFilteredLines.length > 0
          ? `Se han encontrado ${ctx.timeWindowFilteredLines.length} elementos colocados en "${ctx.requestedWindowLabel}":\n${ctx.timeWindowFilteredLines.join('\n')}\n`
          : `No se registraron elementos nuevos estrictamente dentro del rango "${ctx.requestedWindowLabel}". Infórmalo con claridad al usuario y muéstrale como referencia cuáles fueron los últimos elementos colocados anteriormente según la lista general.\n`)
      : '';

    return `Eres "Brain", el Segundo Cerebro de IA integrado nativamente en la aplicación de escritorio Brain Board del usuario.
Tu misión es actuar como su Segundo Cerebro técnico y visual:
1. Conoces todos sus tableros, marcos contenedores, notas, textos, enlaces y repositorios, incluyendo la FECHA EXACTA DE COLOCACIÓN (\`createdAt\`) y las COORDENADAS ESPACIALES (\`x, y, width, height\`) de cada elemento.
2. **BRIEFING POR PERIODO TEMPORAL (Últimos 7 días / Últimos 3 días / Últimas 24 horas)**:
   - Cuando el usuario pida un **Briefing** (ya sea de los **Últimos 7 días**, **Últimos 3 días**, **Últimas 24 horas** o general):
   - Prioriza siempre la sección \`=== ELEMENTOS COLOCADOS EN EL PERIODO SOLICITADO ===\` si está presente.
   - Agrupa y ordena con claridad por fecha de colocación y por tablero.
   - Explica para qué sirve cada repositorio/herramienta/apunte y cómo se conectan en un workflow práctico (por ejemplo: generación de escenas 3D, blockout, iluminación, render, IA, código, etc.).
   - Para que el usuario pueda saltar con un clic desde el chat a cualquier elemento o tablero que menciones, añade referencias interactivas con este formato exacto: \`[[cite:boardId|itemId|Texto del botón]]\` (ejemplo: \`[[cite:dev_ai|3458764668350677074|Ver en DEV / AI]]\`).
3. **HACER APUNTE CON MODO DE RESUMEN (Desarrollado / Medio / Breve resumen) E INSERCIÓN INTELIGENTE**:
   - Cuando el usuario te pida **hacer un apunte** (botón **✍️ Apunte**), anotar una idea/workflow o explicar un tema en un tablero, adapta la extensión y profundidad tanto de tu respuesta en el chat como del campo \`"noteText"\` del bloque \`<brainboard_action>\` según el **Modo de resumen** elegido (por defecto actual: \`${currentBrainNoteSummaryMode}\`):
     * **Modo \`Desarrollado\` (\`"summaryMode": "desarrollado"\`)**: Redacta un apunte técnico extenso, profundo y muy completo (entre 6 y 9 viñetas detalladas en \`"noteText"\`). Incluye: (1) Qué es y arquitectura/fundamento técnico, (2) Workflow paso a paso detallado de principio a fin, (3) Integración práctica en el pipeline con otras herramientas del tablero, y (4) Casos de uso, parámetros clave y ventajas.
     * **Modo \`Medio\` (\`"summaryMode": "medio"\`)**: Redacta un resumen equilibrado y estructurado (entre 3 y 4 viñetas claras en \`"noteText"\`). Incluye: Propósito principal, Flujo de trabajo esencial e Integración práctica.
     * **Modo \`Breve resumen\` (\`"summaryMode": "breve"\`)**: Redacta una síntesis ejecutiva ultra concisa y directa al grano (máximo 2 a 3 viñetas cortas de una línea en \`"noteText"\`, con la idea esencial y aplicación inmediata sin rodeos).
   - Para un apunte usa \`"action": "insert_knowledge"\` en el bloque \`<brainboard_action>\`.
4. **AÑADIR RECURSO CON MINI DESCRIPCIÓN DEBAJO (Botón 🔗 Añadir recurso — \`"action": "insert_resource"\`)**:
   - Cuando el usuario pulse **🔗 Añadir recurso** o pida **añadir un recurso** (ya sea una página web, un tweet / post de X, un repositorio de GitHub, un vídeo, un plugin o cualquier enlace/herramienta):
   - **NO crees un bloque de apunte extenso ni un marco grande.** En su lugar, utiliza \`"action": "insert_resource"\` en \`<brainboard_action>\` para que Brain Board coloque el recurso con su formato visual limpio de dos piezas:
     1. **Tarjeta compacta del recurso (\`type: "embed"\`)**: Muestra el dominio (\`github.com\`, \`x.com\`, \`youtube.com\`, web), el título limpio (\`"embedTitle"\`, ej. \`"scenario-labs/blender-plugin"\`) y dentro de la tarjeta una descripción concisa de 1 a 2 líneas (\`"embedDescription"\`, máx. 160 caracteres, ej. \`"Plugin de Blender 5.0+ para generar imágenes, vídeo, 3D y materiales PBR con Scenario, con servidor MCP local para agentes."\` ).
     2. **Mini descripción inferior (\`"resourceCaption"\`, colocada justo debajo de la tarjeta)**: Una frase muy corta y directa de **3 a 8 palabras** (sin punto final ni adornos) que identifique qué es ese recurso de un vistazo (ejemplos: \`"Repositorio IA integrada en Blender"\`, \`"Tweet sobre workflow de retopología"\`, \`"Web de materiales PBR gratuitos"\`, \`"Vídeo tutorial de iluminación 3D"\`).

FORMATO EXACTO DEL BLOQUE DE ACCIÓN PARA "AÑADIR RECURSO" (\`"action": "insert_resource"\`):
<brainboard_action>
{
  "action": "insert_resource",
  "boardId": "ID_DEL_TABLERO_DESTINO",
  "frameTitle": "",
  "url": "https://...",
  "embedTitle": "autor/repositorio o Título limpio del recurso",
  "embedDescription": "Descripción concisa de 1-2 líneas dentro de la tarjeta explicando qué hace o aporta el recurso.",
  "resourceCaption": "Mini descripción de 3 a 8 palabras debajo de la tarjeta (ej: Repositorio IA integrada en Blender)"
}
</brainboard_action>

FORMATO EXACTO DEL BLOQUE DE ACCIÓN PARA "APUNTE" (\`"action": "insert_knowledge"\`):
<brainboard_action>
{
  "action": "insert_knowledge",
  "summaryMode": "desarrollado | medio | breve",
  "boardId": "ID_DEL_TABLERO_DESTINO",
  "createNewBoardIfMissing": false,
  "newBoardTitle": "",
  "frameTitle": "Título descriptivo del Marco o Sección",
  "url": "https://... (o vacío si es solo apunte de texto)",
  "embedTitle": "Título corto del recurso o apunte",
  "embedDescription": "Descripción concisa",
  "noteTitle": "TÍTULO DEL APUNTE / WORKFLOW",
  "noteText": "• Puntos del apunte adaptados al Modo de resumen (Desarrollado, Medio o Breve)..."
}
</brainboard_action>

=== ESTADO ACTUAL DEL ESPACIO DE TRABAJO ===
Fecha y hora actual: ${new Date().toISOString()}
Modo de resumen activo por defecto para apuntes: ${currentBrainNoteSummaryMode}
${targetBoardHint}

=== CATÁLOGO DE TABLEROS Y COORDENADAS RECOMENDADAS ===
${ctx.boardsCatalogLines.join('\n')}
${liveUrlSection}${timeWindowSection}
=== ÚLTIMOS ELEMENTOS COLOCADOS EN EL CEREBRO (ORDENADOS POR FECHA MÁS RECIENTE) ===
${ctx.latestItemsLines.join('\n') || '(Sin elementos)'}

=== ENLACES Y REPOSITORIOS REGISTRADOS EN EL CEREBRO ===
${ctx.latestReposLines.join('\n') || '(Sin enlaces)'}

=== COINCIDENCIAS RELEVANTES EN LOS APUNTES PARA ESTA CONSULTA ===
${ctx.matchedLines.join('\n') || '(Usa los listados anteriores)'}

=== ELEMENTOS MÁS ANTIGUOS / CANDIDATOS A REVISIÓN POR OBSOLESCENCIA ===
${ctx.oldestLines.join('\n') || '(Sin elementos antiguos)'}

${recentHistoryText ? `=== HISTORIAL RECIENTE DE LA CONVERSACIÓN ===\n${recentHistoryText}\n` : ''}
=== MENSAJE DEL USUARIO ===
${userMessage}

Responde en español, con formato Markdown claro, directo, estructurado y útil.`;
  }

  // Ejecutar acción de inserción espacial devuelta por la IA en el tablero destino (Apunte o Añadir Recurso)
  async function executeBrainAiAction(actionObj, userPromptText = '') {
    if (!actionObj || typeof actionObj !== 'object') return null;
    let targetBoardId = actionObj.boardId || (brainAiTargetBoardSelect?.value !== 'auto' ? brainAiTargetBoardSelect?.value : currentActiveBoardId) || 'dev_ai';

    // Buscar tablero por ID o por coincidencia de título
    let boardMeta = workspaceBoards.find(b => b.id.toLowerCase() === String(targetBoardId).toLowerCase()) ||
                    workspaceBoards.find(b => (b.title || '').toLowerCase() === String(targetBoardId).toLowerCase()) ||
                    workspaceBoards.find(b => (b.title || '').toLowerCase().includes(String(targetBoardId).toLowerCase()));

    if (!boardMeta && actionObj.createNewBoardIfMissing && actionObj.newBoardTitle) {
      boardMeta = await createNewBoard(actionObj.newBoardTitle);
    }
    if (!boardMeta) {
      boardMeta = workspaceBoards.find(b => b.id === (currentActiveBoardId || 'dev_ai')) || workspaceBoards[0];
    }
    targetBoardId = boardMeta.id;

    // Cargar datos actuales del tablero destino
    const allBoards = await loadAllBoardsForBrainIndex();
    const targetBoardData = allBoards.find(b => b.id === targetBoardId) || {
      id: targetBoardId,
      title: boardMeta.title || targetBoardId,
      category: boardMeta.category || 'General',
      items: []
    };

    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const currentMaxZ = targetBoardData.items.reduce((max, it) => Math.max(max, typeof it.zIndex === 'number' ? it.zIndex : 10), 10);

    const isResourceAction =
      String(actionObj.action || '').toLowerCase() === 'insert_resource' ||
      String(actionObj.summaryMode || '').toLowerCase() === 'recurso' ||
      Boolean(actionObj.resourceCaption && !actionObj.noteText) ||
      /añade este recurso|añadir recurso|guardar recurso/i.test(String(userPromptText || ''));

    const createdItems = [];
    let primaryItemId = null;
    let placement = null;

    if (isResourceAction) {
      placement = computeNextResourcePlacement(targetBoardData, actionObj.frameTitle, actionObj.coords);

      if (placement.mode === 'inside_existing_frame' && placement.frameId) {
        const frameInBoard = targetBoardData.items.find(it => it.id === placement.frameId);
        if (frameInBoard && placement.expandFrameHeightTo > (frameInBoard.height || 0)) {
          frameInBoard.height = placement.expandFrameHeightTo;
          frameInBoard.updatedAt = nowIso;
        }
      }

      const cleanUrl = String(actionObj.url || '').trim();
      const embedId = `embed_${now}_${Math.random().toString(36).substr(2, 4)}`;
      primaryItemId = embedId;

      createdItems.push({
        id: embedId,
        type: 'embed',
        parentId: placement.frameId || null,
        createdAt: nowIso,
        updatedAt: nowIso,
        x: placement.embedRect.x,
        y: placement.embedRect.y,
        width: placement.embedRect.width,
        height: placement.embedRect.height,
        title: actionObj.embedTitle || (cleanUrl ? engine.extractTitle(cleanUrl) : 'Recurso'),
        domain: cleanUrl ? engine.extractDomain(cleanUrl) : 'RECURSO',
        url: cleanUrl,
        src: '',
        description: actionObj.embedDescription || actionObj.noteText || '',
        zIndex: currentMaxZ + 2
      });

      const rawCaption = actionObj.resourceCaption || actionObj.noteTitle || actionObj.embedTitle || 'Recurso';
      const cleanCaption = String(rawCaption)
        .replace(/^[•\-*]\s*/, '')
        .split('\n')[0]
        .trim();

      const captionId = `text_${now + 1}_${Math.random().toString(36).substr(2, 4)}`;
      createdItems.push({
        id: captionId,
        type: 'text',
        parentId: placement.frameId || null,
        createdAt: nowIso,
        updatedAt: nowIso,
        x: placement.captionRect.x,
        y: placement.captionRect.y,
        width: placement.captionRect.width,
        height: placement.captionRect.height,
        text: cleanCaption,
        fontSize: 20,
        isBold: false,
        fillColor: null,
        color: '#1a1a1a',
        textAlign: 'left',
        zIndex: currentMaxZ + 3
      });
    } else {
      const effectiveSummaryMode = String(actionObj.summaryMode || currentBrainNoteSummaryMode || 'medio').toLowerCase();
      placement = computeNextSmartPlacement(targetBoardData, actionObj.frameTitle, effectiveSummaryMode);

      // Ajustar dinámicamente la altura si el texto del apunte es muy extenso (especialmente en modo Desarrollado)
      if (actionObj.noteText) {
        const rawNoteStr = String(actionObj.noteText);
        const estimatedLines = rawNoteStr.split('\n').reduce((acc, line) => acc + Math.max(1, Math.ceil(line.length / 44)), 0) + 3;
        const estimatedNoteH = Math.max(placement.noteRect.height, Math.min(620, estimatedLines * 24 + 44));
        if (estimatedNoteH > placement.noteRect.height) {
          const extraH = estimatedNoteH - placement.noteRect.height;
          placement.noteRect.height = estimatedNoteH;
          if (placement.newFrameRect) {
            placement.newFrameRect.height += extraH;
          }
          if (placement.expandFrameHeightTo) {
            placement.expandFrameHeightTo += extraH;
          }
        }
      }

      // Si el usuario especificó coordenadas manuales explícitas (ej: copiadas con la herramienta Dev Inspector)
      if (actionObj.coords && typeof actionObj.coords.x === 'number' && typeof actionObj.coords.y === 'number') {
        const customW = Math.max(300, actionObj.coords.width || 720);
        const customH = Math.max(200, actionObj.coords.height || 420);
        placement = {
          mode: 'new_frame',
          newFrameRect: {
            x: actionObj.coords.x,
            y: actionObj.coords.y,
            width: customW,
            height: customH
          },
          headerRect: {
            x: actionObj.coords.x + 28,
            y: actionObj.coords.y + 24,
            width: customW - 56,
            height: 38
          },
          embedRect: {
            x: actionObj.coords.x + 28,
            y: actionObj.coords.y + 78,
            width: actionObj.url ? Math.min(340, Math.round(customW * 0.46)) : customW - 56,
            height: Math.max(160, customH - 106)
          },
          noteRect: {
            x: actionObj.coords.x + (actionObj.url ? Math.min(340, Math.round(customW * 0.46)) + 52 : 28),
            y: actionObj.coords.y + 78,
            width: actionObj.url ? (customW - Math.min(340, Math.round(customW * 0.46)) - 80) : customW - 56,
            height: Math.max(160, customH - 106)
          }
        };
      }

      if (placement.mode === 'inside_existing_frame') {
        const frameInBoard = targetBoardData.items.find(it => it.id === placement.frameId);
        if (frameInBoard && placement.expandFrameHeightTo > (frameInBoard.height || 0)) {
          frameInBoard.height = placement.expandFrameHeightTo;
          frameInBoard.updatedAt = nowIso;
        }

        if (actionObj.url) {
          const cleanUrl = actionObj.url.trim();
          const embedId = `embed_${now}_${Math.random().toString(36).substr(2, 4)}`;
          primaryItemId = embedId;
          createdItems.push({
            id: embedId,
            type: 'embed',
            parentId: placement.frameId,
            createdAt: nowIso,
            updatedAt: nowIso,
            x: placement.embedRect.x,
            y: placement.embedRect.y,
            width: placement.embedRect.width,
            height: placement.embedRect.height,
            title: actionObj.embedTitle || engine.extractTitle(cleanUrl),
            domain: engine.extractDomain(cleanUrl),
            url: cleanUrl,
            src: '',
            description: actionObj.embedDescription || '',
            zIndex: currentMaxZ + 2
          });
        }

        if (actionObj.noteText || actionObj.noteTitle) {
          const noteId = `text_${now + 1}_${Math.random().toString(36).substr(2, 4)}`;
          if (!primaryItemId) primaryItemId = noteId;
          const fullNoteText = actionObj.noteTitle
            ? `${actionObj.noteTitle.toUpperCase()}\n\n${actionObj.noteText || ''}`
            : (actionObj.noteText || '');
          createdItems.push({
            id: noteId,
            type: 'text',
            parentId: placement.frameId,
            createdAt: nowIso,
            updatedAt: nowIso,
            x: actionObj.url ? placement.noteRect.x : placement.embedRect.x,
            y: placement.noteRect.y,
            width: actionObj.url ? placement.noteRect.width : 680,
            height: placement.noteRect.height,
            text: fullNoteText.trim(),
            fontSize: 16,
            color: '#f1f5f9',
            textColor: '#f1f5f9',
            fillColor: '#161b26',
            zIndex: currentMaxZ + 3
          });
        }
      } else {
        // Crear un nuevo marco curado siguiendo BoardInstructorAI.md
        const frameId = `frame_${now}_${Math.random().toString(36).substr(2, 4)}`;
        primaryItemId = frameId;
        const frameItem = {
          id: frameId,
          type: 'frame',
          createdAt: nowIso,
          updatedAt: nowIso,
          x: placement.newFrameRect.x,
          y: placement.newFrameRect.y,
          width: placement.newFrameRect.width,
          height: placement.newFrameRect.height,
          title: actionObj.frameTitle || actionObj.embedTitle || 'Apunte Cerebro IA',
          fillColor: '#0f141d',
          zIndex: currentMaxZ + 1
        };
        createdItems.push(frameItem);

        const headerId = `text_${now + 1}_${Math.random().toString(36).substr(2, 4)}`;
        createdItems.push({
          id: headerId,
          type: 'text',
          parentId: frameId,
          createdAt: nowIso,
          updatedAt: nowIso,
          x: placement.headerRect.x,
          y: placement.headerRect.y,
          width: placement.headerRect.width,
          height: placement.headerRect.height,
          text: (actionObj.noteTitle || actionObj.embedTitle || actionObj.frameTitle || 'NUEVO RECURSO REGISTRADO').toUpperCase(),
          fontSize: 22,
          isBold: true,
          color: '#f1f5f9',
          textColor: '#f1f5f9',
          fillColor: '#161b26',
          zIndex: currentMaxZ + 2
        });

        if (actionObj.url) {
          const cleanUrl = actionObj.url.trim();
          const embedId = `embed_${now + 2}_${Math.random().toString(36).substr(2, 4)}`;
          primaryItemId = embedId;
          createdItems.push({
            id: embedId,
            type: 'embed',
            parentId: frameId,
            createdAt: nowIso,
            updatedAt: nowIso,
            x: placement.embedRect.x,
            y: placement.embedRect.y,
            width: placement.embedRect.width,
            height: placement.embedRect.height,
            title: actionObj.embedTitle || engine.extractTitle(cleanUrl),
            domain: engine.extractDomain(cleanUrl),
            url: cleanUrl,
            src: '',
            description: actionObj.embedDescription || '',
            zIndex: currentMaxZ + 3
          });
        }

        if (actionObj.noteText) {
          const noteId = `text_${now + 3}_${Math.random().toString(36).substr(2, 4)}`;
          createdItems.push({
            id: noteId,
            type: 'text',
            parentId: frameId,
            createdAt: nowIso,
            updatedAt: nowIso,
            x: actionObj.url ? placement.noteRect.x : placement.embedRect.x,
            y: placement.noteRect.y,
            width: actionObj.url ? placement.noteRect.width : (placement.newFrameRect.width - 60),
            height: placement.noteRect.height,
            text: String(actionObj.noteText).trim(),
            fontSize: 16,
            color: '#e2e8f0',
            textColor: '#e2e8f0',
            fillColor: '#161b26',
            zIndex: currentMaxZ + 4
          });
        }
      }
    }

    if (createdItems.length === 0) return null;

    // Si el tablero destino es el que está abierto actualmente en el lienzo
    if (targetBoardId === currentActiveBoardId) {
      engine.saveSnapshot();
      engine.items.push(...createdItems);
      engine.selectedItemIds.clear();
      createdItems.forEach(it => engine.selectedItemIds.add(it.id));
      engine.render();
      updateMinimap();
      await autoSaveBoardImmediately(targetBoardId);
    } else {
      // Guardar directamente en el tablero destino (IndexedDB + LocalStorage + Disco JSON)
      targetBoardData.items.push(...createdItems);
      const savePayload = {
        id: targetBoardId,
        name: boardMeta.title || targetBoardData.title || targetBoardId,
        category: boardMeta.category || 'General',
        updatedAt: nowIso,
        userModified: true,
        seedVersion: 4,
        items: targetBoardData.items
      };
      await idbSaveBoard(targetBoardId, savePayload);
      try {
        localStorage.setItem(`brainboard_board_${targetBoardId}`, JSON.stringify(savePayload));
      } catch (e) {}
      saveBoardToDisk(targetBoardId, savePayload);
    }

    return {
      boardId: targetBoardId,
      boardTitle: boardMeta.title || targetBoardId,
      primaryItemId,
      createdCount: createdItems.length,
      coords: placement.embedRect || placement.newFrameRect
    };
  }

  // Fallback gratuito instantáneo sin configuración (0 MB adicionales en el instalador)
  async function callFreeIntegratedGeminiFallback(fullPrompt) {
    const res = await fetch('https://text.pollinations.ai/openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gemini',
        messages: [{ role: 'user', content: fullPrompt }],
        private: true
      })
    });
    if (!res.ok) {
      throw new Error('Introduce tu API Key gratuita de Google Gemini 2.5 Flash en Configurar Brain (⚙️).');
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || '';
    if (!content.trim()) {
      throw new Error('Introduce tu API Key gratuita de Google Gemini 2.5 Flash en Configurar Brain (⚙️).');
    }
    return content.trim();
  }

  // Invocar al proveedor de IA configurado (Claude CLI, Gemini CLI, Gemini 2.5 Flash Gratis, API Keys u Ollama)
  async function callConfiguredAiProvider(fullPrompt) {
    const provider = brainAiSettings.provider || 'claude_cli';
    const selectedModel = (brainAiSettings.model || '').trim();
    const selectedEffort = (brainAiSettings.effort || 'medium').trim();

    // 1. CLAUDE CODE CLI LOCAL O GEMINI CLI LOCAL
    if (provider === 'claude_cli' || provider === 'gemini_cli') {
      if (typeof window !== 'undefined' && typeof window.require === 'function') {
        const { spawn } = window.require('child_process');
        const isClaude = provider === 'claude_cli';
        const defaultCmd = isClaude
          ? (detectDefaultClaudeCliPath() || 'claude')
          : (detectDefaultGeminiCliPath() || 'gemini');
        const cmd = (brainAiSettings.cliPath && brainAiSettings.cliPath.trim()) || defaultCmd;
        const args = isClaude
          ? [
              '-p',
              '--model', selectedModel || 'haiku',
              '--effort', selectedEffort || 'medium',
              '--tools', ''
            ]
          : [
              '-p', '',
              '-m', selectedModel || 'gemini-2.5-flash'
            ];

        try {
          return await new Promise((resolve, reject) => {
            let stdout = '';
            let stderr = '';
            let finished = false;

            const child = spawn(cmd, args, {
              cwd: process.cwd(),
              env: { ...process.env, FORCE_COLOR: '0' },
              windowsHide: true,
              shell: cmd.endsWith('.cmd') || cmd.endsWith('.bat') || (!cmd.includes('\\') && !cmd.includes('/'))
            });

            const timeoutId = setTimeout(() => {
              if (!finished) {
                finished = true;
                try { child.kill(); } catch (e) {}
                reject(new Error('Tiempo de espera agotado esperando al CLI local (90s).'));
              }
            }, 90000);

            child.stdout.on('data', (chunk) => {
              stdout += chunk.toString('utf8');
            });
            child.stderr.on('data', (chunk) => {
              stderr += chunk.toString('utf8');
            });
            child.on('error', (err) => {
              if (finished) return;
              finished = true;
              clearTimeout(timeoutId);
              reject(err);
            });
            child.on('close', (code) => {
              if (finished) return;
              finished = true;
              clearTimeout(timeoutId);
              if (code === 0 && stdout.trim()) {
                resolve(stdout.trim());
              } else if (stdout.trim()) {
                resolve(stdout.trim());
              } else {
                reject(new Error(stderr.trim() || `El CLI finalizó con código ${code}`));
              }
            });

            try {
              child.stdin.write(fullPrompt, 'utf8');
              child.stdin.end();
            } catch (eWrite) {
              clearTimeout(timeoutId);
              reject(eWrite);
            }
          });
        } catch (cliErr) {
          // Si el usuario no tiene el ejecutable instalado en este PC, hacer fallback transparente a IA gratuita en la nube
          const errMsg = String(cliErr?.message || cliErr || '');
          if (errMsg.includes('ENOENT') || errMsg.includes('no se reconoce') || errMsg.includes('not recognized') || errMsg.includes('código 1')) {
            if ((brainAiSettings.apiKey || '').trim()) {
              brainAiSettings.provider = 'gemini_api';
              brainAiSettings.model = 'gemini-2.5-flash';
              syncBrainAiHeaderBadges();
            } else {
              return await callFreeIntegratedGeminiFallback(fullPrompt);
            }
          } else {
            throw cliErr;
          }
        }
      }
    }

    // 2. ANTHROPIC CLAUDE API KEY
    if (provider === 'claude_api') {
      const apiKey = (brainAiSettings.apiKey || '').trim();
      if (!apiKey) throw new Error('Introduce tu API Key de Anthropic Claude en Configurar Brain (⚙️).');
      const model = selectedModel || 'claude-sonnet-4-20250514';
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model,
          max_tokens: 2500,
          messages: [{ role: 'user', content: fullPrompt }]
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || `Error HTTP ${res.status} en Claude API`);
      return data?.content?.[0]?.text || '';
    }

    // 3. GOOGLE GEMINI 2.5 FLASH (GRATIS / API KEY OFICIAL + MODO ZERO-CONFIG)
    if (provider === 'gemini_api') {
      const apiKey = (brainAiSettings.apiKey || '').trim();
      // Si el usuario recién descargó Brain Board y aún no ha pegado su API Key de AI Studio, usar modo gratuito integrado
      if (!apiKey) {
        return await callFreeIntegratedGeminiFallback(fullPrompt);
      }
      const model = selectedModel || 'gemini-2.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const generationConfig = {
        temperature: 0.35,
        maxOutputTokens: 4096
      };
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || `Error HTTP ${res.status} en Google Gemini API`);
      const parts = data?.candidates?.[0]?.content?.parts || [];
      return parts.filter(p => !p.thought).map(p => p.text || '').join('\n') || '';
    }

    // 4. OPENAI API KEY
    if (provider === 'openai_api') {
      const apiKey = (brainAiSettings.apiKey || '').trim();
      if (!apiKey) throw new Error('Introduce tu API Key de OpenAI en Configurar Brain (⚙️).');
      const model = selectedModel || 'gpt-4o';
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: fullPrompt }]
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || `Error HTTP ${res.status} en OpenAI API`);
      return data?.choices?.[0]?.message?.content || '';
    }

    // 5. OLLAMA LOCAL
    if (provider === 'ollama') {
      const endpoint = (brainAiSettings.apiKey || 'http://localhost:11434').replace(/\/$/, '');
      const model = selectedModel || 'llama3.1';
      const res = await fetch(`${endpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt: fullPrompt, stream: false })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Error conectando a Ollama en ${endpoint}`);
      return data?.response || '';
    }

    throw new Error('Proveedor de IA no reconocido.');
  }

  // Navegar y hacer zoom a un tablero y elemento específico al pulsar una cita interactiva en el chat
  async function jumpToBoardAndItemFromAi(boardId, itemId = null) {
    if (!boardId) return;
    if (currentActiveBoardId !== boardId || document.getElementById('home-screen')?.style.display !== 'none') {
      await openBoardTab(boardId);
    }
    if (itemId && engine && Array.isArray(engine.items)) {
      const target = engine.items.find(it => String(it.id) === String(itemId));
      if (target) {
        engine.selectedItemIds.clear();
        engine.selectedItemIds.add(target.id);
        engine.zoomToItem(target, 0.85);
        if (engine.onSelectionChange) engine.onSelectionChange([target.id]);
      }
    }
  }
  window.jumpToBoardAndItemFromAi = jumpToBoardAndItemFromAi;

  // Renderizar Markdown ligero + botones interactivos [[cite:boardId|itemId|Label]]
  function formatAiMarkdownToHtml(rawText) {
    if (!rawText) return '';
    // Extraer bloques <brainboard_action> para no mostrarlos crudos
    const cleanText = String(rawText).replace(/<brainboard_action>[\s\S]*?<\/brainboard_action>/gi, '').trim();

    const escapeHtml = (s) => s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const lines = cleanText.split('\n');
    let html = '';
    let inList = false;

    const formatInline = (str) => {
      let out = escapeHtml(str);
      // Citas interactivas [[cite:boardId|itemId|Label]]
      out = out.replace(/\[\[cite:([^|\]]+)\|([^|\]]*)\|([^\]]+)\]\]/g, (_, bId, iId, label) => {
        const safeB = bId.trim().replace(/'/g, '');
        const safeI = iId.trim().replace(/'/g, '');
        return `<button class="brain-ai-inline-cite" data-board="${safeB}" data-item="${safeI}" title="Ir al elemento en el tablero">📍 ${label.trim()} ↗</button>`;
      });
      // Negrita y código inline
      out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
      return out;
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        if (inList) { html += '</ul>'; inList = false; }
        continue;
      }
      if (line.startsWith('### ')) {
        if (inList) { html += '</ul>'; inList = false; }
        html += `<h4>${formatInline(line.slice(4))}</h4>`;
      } else if (line.startsWith('## ') || line.startsWith('# ')) {
        if (inList) { html += '</ul>'; inList = false; }
        html += `<h3>${formatInline(line.replace(/^#+\s*/, ''))}</h3>`;
      } else if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
        if (!inList) { html += '<ul>'; inList = true; }
        html += `<li>${formatInline(line.slice(2))}</li>`;
      } else {
        if (inList) { html += '</ul>'; inList = false; }
        html += `<p>${formatInline(line)}</p>`;
      }
    }
    if (inList) html += '</ul>';
    return html;
  }

  let brainAiChatHistory = [];
  try {
    const savedHist = localStorage.getItem(BRAIN_AI_HISTORY_KEY);
    if (savedHist) brainAiChatHistory = JSON.parse(savedHist) || [];
  } catch (e) {}

  function saveBrainAiChatHistory() {
    try {
      localStorage.setItem(BRAIN_AI_HISTORY_KEY, JSON.stringify(brainAiChatHistory.slice(-30)));
    } catch (e) {}
  }

  function renderBrainAiWelcomeMessage() {
    if (!brainAiMessages) return;
    brainAiMessages.innerHTML = `
      <div class="brain-ai-msg assistant">
        <div class="brain-ai-bubble">
          <h4>🧠 Brain está activo</h4>
          <p>Cada elemento de tus tableros registra su <strong>fecha exacta de colocación</strong> (mantén el cursor <strong>2 segundos</strong> sobre cualquier objeto o activa el <strong>Mapa de Frescura 🕒</strong> en la barra superior).</p>
          <p>Puedo ayudarte a:</p>
          <ul>
            <li><strong>✍️ Apunte (Modo de resumen):</strong> despliega para elegir entre <strong>Desarrollado</strong>, <strong>Medio</strong> o <strong>Breve resumen</strong> y colocar tu nota o workflow en el tablero sin colisiones.</li>
            <li><strong>🔗 Añadir recurso:</strong> coloca cualquier página web, tweet, repositorio o vídeo como tarjeta compacta con una mini descripción justo debajo.</li>
            <li><strong>📋 Briefing (7 días / 3 días / 24 horas):</strong> despliega el periodo que quieras consultar para resumir tus últimos repositorios, enlaces y workflows por fecha.</li>
            <li><strong>🕒 Detectar obsoletos:</strong> revisar apuntes antiguos para actualizar o archivar.</li>
          </ul>
        </div>
      </div>
    `;
  }

  function appendBrainAiMessage(role, text, actionResult = null) {
    if (!brainAiMessages) return;
    const wrap = document.createElement('div');
    wrap.className = `brain-ai-msg ${role}`;
    const bubble = document.createElement('div');
    bubble.className = 'brain-ai-bubble';

    if (role === 'user') {
      bubble.textContent = text;
    } else {
      bubble.innerHTML = formatAiMarkdownToHtml(text);
      if (actionResult) {
        const card = document.createElement('div');
        card.className = 'brain-ai-action-card';
        card.innerHTML = `
          <div class="brain-ai-action-card-header">
            <span>✓ Colocado automáticamente en "${actionResult.boardTitle}"</span>
            <span>X:${actionResult.coords?.x || 0}, Y:${actionResult.coords?.y || 0}</span>
          </div>
          <button class="brain-ai-jump-btn" data-board="${actionResult.boardId}" data-item="${actionResult.primaryItemId || ''}">
            Abrir en "${actionResult.boardTitle}" y hacer zoom →
          </button>
        `;
        bubble.appendChild(card);
      }
    }

    wrap.appendChild(bubble);
    brainAiMessages.appendChild(wrap);
    brainAiMessages.scrollTop = brainAiMessages.scrollHeight;
  }

  // Delegación de clics para saltar a tableros/elementos desde el chat
  brainAiMessages?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-board]');
    if (!btn) return;
    const bId = btn.getAttribute('data-board');
    const iId = btn.getAttribute('data-item');
    if (bId) {
      jumpToBoardAndItemFromAi(bId, iId || null);
    }
  });

  async function handleSendBrainAiMessage(customPrompt = null) {
    if (isBrainAiGenerating) return;
    const text = (customPrompt !== null ? customPrompt : (brainAiInput?.value || '')).trim();
    if (!text) return;

    if (customPrompt === null && brainAiInput) {
      brainAiInput.value = '';
    }

    appendBrainAiMessage('user', text);
    brainAiChatHistory.push({ role: 'user', text });
    saveBrainAiChatHistory();

    isBrainAiGenerating = true;
    if (btnBrainAiSend) btnBrainAiSend.disabled = true;

    const loadingWrap = document.createElement('div');
    loadingWrap.className = 'brain-ai-msg assistant';
    loadingWrap.innerHTML = `
      <div class="brain-ai-bubble">
        <span>🔄 Consultando a <strong>${getProviderDisplayName(brainAiSettings.provider)}</strong> (${getModelShortDisplayName(brainAiSettings.provider, brainAiSettings.model)} · effort ${brainAiSettings.effort || 'medium'})...</span>
      </div>
    `;
    brainAiMessages?.appendChild(loadingWrap);
    if (brainAiMessages) brainAiMessages.scrollTop = brainAiMessages.scrollHeight;

    try {
      const preferredBoard = brainAiTargetBoardSelect?.value || 'auto';
      const ctx = await buildBrainCompleteContext(text, preferredBoard);
      const fullPrompt = buildFullPromptForAi(text, ctx, brainAiChatHistory);
      const aiResponse = await callConfiguredAiProvider(fullPrompt);

      loadingWrap.remove();

      // Comprobar si la IA devolvió un bloque <brainboard_action>
      let actionResult = null;
      const actionMatch = String(aiResponse).match(/<brainboard_action>([\s\S]*?)<\/brainboard_action>/i);
      if (actionMatch && actionMatch[1]) {
        try {
          const actionJson = JSON.parse(actionMatch[1].trim());
          actionResult = await executeBrainAiAction(actionJson, text);
        } catch (eAct) {
          console.warn('No se pudo parsear brainboard_action:', eAct);
        }
      }

      appendBrainAiMessage('assistant', aiResponse, actionResult);
      brainAiChatHistory.push({ role: 'assistant', text: aiResponse });
      saveBrainAiChatHistory();
    } catch (err) {
      loadingWrap.remove();
      appendBrainAiMessage(
        'assistant',
        `⚠️ **No se pudo completar la consulta con ${getProviderDisplayName(brainAiSettings.provider)}:** ${err.message || String(err)}\n\nPuedes pulsar el icono **⚙️ Configurar Brain** en la esquina superior derecha del chat para revisar la ruta de tu CLI local (\`claude\` / \`gemini\`) o configurar una API Key.`
      );
    } finally {
      isBrainAiGenerating = false;
      if (btnBrainAiSend) btnBrainAiSend.disabled = false;
    }
  }

  function toggleBrainAiChatPanel(forceOpen = null) {
    if (!brainAiChatPanel) return;
    const isCurrentlyOpen = brainAiChatPanel.style.display !== 'none';
    const nextOpen = typeof forceOpen === 'boolean' ? forceOpen : !isCurrentlyOpen;
    brainAiChatPanel.style.display = nextOpen ? 'flex' : 'none';
    brainAiDockTrigger?.classList.toggle('active', nextOpen);
    if (nextOpen) {
      populateBrainAiTargetBoards();
      syncBrainAiHeaderBadges();
      if (brainAiMessages && brainAiMessages.children.length === 0) {
        if (brainAiChatHistory.length > 0) {
          brainAiChatHistory.forEach(m => appendBrainAiMessage(m.role, m.text));
        } else {
          renderBrainAiWelcomeMessage();
        }
      }
      buildBrainCompleteContext('', 'auto').catch(() => {});
      setTimeout(() => brainAiInput?.focus(), 60);
    }
  }

  brainAiDockTrigger?.addEventListener('click', () => {
    toggleBrainAiChatPanel();
  });

  btnBrainAiClose?.addEventListener('click', () => {
    toggleBrainAiChatPanel(false);
  });

  btnBrainAiExpand?.addEventListener('click', () => {
    brainAiChatPanel?.classList.toggle('expanded');
  });

  btnBrainAiClear?.addEventListener('click', () => {
    brainAiChatHistory = [];
    saveBrainAiChatHistory();
    renderBrainAiWelcomeMessage();
  });

  btnBrainAiSend?.addEventListener('click', () => {
    handleSendBrainAiMessage();
  });

  brainAiInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendBrainAiMessage();
    }
  });

  // Desplegables de Apunte (Modo de resumen), Botón Añadir recurso y Briefing (7 días, 3 días, 24 horas) + Chips de acción rápida
  const btnBrainAiMakeNote = document.getElementById('btn-brain-ai-make-note');
  const brainAiNoteMenu = document.getElementById('brain-ai-note-menu');
  const btnBrainAiAddResource = document.getElementById('btn-brain-ai-add-resource');
  const btnBrainAiBriefing = document.getElementById('btn-brain-ai-briefing');
  const brainAiBriefingMenu = document.getElementById('brain-ai-briefing-menu');

  function closeAllBrainAiDropdowns() {
    if (brainAiNoteMenu) brainAiNoteMenu.style.display = 'none';
    if (brainAiBriefingMenu) brainAiBriefingMenu.style.display = 'none';
    btnBrainAiMakeNote?.classList.remove('menu-open');
    btnBrainAiBriefing?.classList.remove('menu-open');
  }

  function stripBrainAiActionPrefix(val) {
    return String(val || '')
      .replace(/^Haz un apunte(?:\s*\[Modo de resumen:[^\]]*\])?\s+en\s+.*?\s+con lo siguiente:\s*/i, '')
      .replace(/^Añade este recurso\s+en\s+.*?\s+con su mini descripción:\s*/i, '');
  }

  btnBrainAiMakeNote?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = brainAiNoteMenu && brainAiNoteMenu.style.display !== 'none';
    closeAllBrainAiDropdowns();
    if (!isOpen && brainAiNoteMenu) {
      brainAiNoteMenu.style.display = 'flex';
      btnBrainAiMakeNote.classList.add('menu-open');
    }
  });

  // Botón directo: Añadir recurso (Tarjeta compacta + mini descripción debajo)
  btnBrainAiAddResource?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeAllBrainAiDropdowns();
    if (brainAiInput) {
      const boardTitle = (brainAiTargetBoardSelect && brainAiTargetBoardSelect.value !== 'auto')
        ? (brainAiTargetBoardSelect.options[brainAiTargetBoardSelect.selectedIndex]?.text || '').replace(/\s*\(.*?\)\s*$/, '')
        : (workspaceBoards.find(b => b.id === currentActiveBoardId)?.title || 'el tablero');

      const cleanedTail = stripBrainAiActionPrefix(brainAiInput.value || '');
      brainAiInput.value = `Añade este recurso en ${boardTitle} con su mini descripción: ${cleanedTail}`;
      brainAiInput.focus();
      brainAiInput.setSelectionRange(brainAiInput.value.length, brainAiInput.value.length);
    }
  });

  btnBrainAiBriefing?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = brainAiBriefingMenu && brainAiBriefingMenu.style.display !== 'none';
    closeAllBrainAiDropdowns();
    if (!isOpen && brainAiBriefingMenu) {
      brainAiBriefingMenu.style.display = 'flex';
      btnBrainAiBriefing.classList.add('menu-open');
    }
  });

  // Selección de opción en "Modo de resumen" de Apunte
  document.querySelectorAll('#brain-ai-note-menu .brain-ai-dropdown-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const mode = item.getAttribute('data-note-mode') || 'medio';
      const modeLabel = item.getAttribute('data-mode-label') || 'Medio';
      currentBrainNoteSummaryMode = mode;

      document.querySelectorAll('#brain-ai-note-menu .brain-ai-dropdown-item').forEach(el => {
        el.classList.toggle('active', el === item);
      });

      closeAllBrainAiDropdowns();

      if (brainAiInput) {
        const boardTitle = (brainAiTargetBoardSelect && brainAiTargetBoardSelect.value !== 'auto')
          ? (brainAiTargetBoardSelect.options[brainAiTargetBoardSelect.selectedIndex]?.text || '').replace(/\s*\(.*?\)\s*$/, '')
          : (workspaceBoards.find(b => b.id === currentActiveBoardId)?.title || 'el tablero');

        const cleanedTail = stripBrainAiActionPrefix(brainAiInput.value || '');
        brainAiInput.value = `Haz un apunte [Modo de resumen: ${modeLabel}] en ${boardTitle} con lo siguiente: ${cleanedTail}`;
        brainAiInput.focus();
        brainAiInput.setSelectionRange(brainAiInput.value.length, brainAiInput.value.length);
      }
    });
  });

  // Selección de periodo en "Briefing" (Últimos 7 días, Últimos 3 días, Últimas 24 horas)
  document.querySelectorAll('#brain-ai-briefing-menu .brain-ai-dropdown-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const range = item.getAttribute('data-briefing-range') || '7d';
      const rangeLabel = item.getAttribute('data-range-label') || 'Últimos 7 días';
      closeAllBrainAiDropdowns();

      let promptForBriefing = '';
      if (range === '24h') {
        promptForBriefing = 'Hazme un briefing detallado de las últimas 24 horas con las cosas, enlaces, repositorios y apuntes que he colocado hoy en mi cerebro ordenados por fecha y hora, indicando a qué tablero pertenece cada uno y resumiendo sus workflows.';
      } else if (range === '3d') {
        promptForBriefing = 'Hazme un briefing detallado de los últimos 3 días con las cosas, enlaces, repositorios y apuntes que he colocado en mi cerebro ordenados por fecha, indicando a qué tablero pertenece cada uno y resumiendo sus workflows.';
      } else {
        promptForBriefing = `Hazme un briefing detallado de los ${rangeLabel.toLowerCase()} con las cosas, enlaces, repositorios y apuntes que he colocado en mi cerebro ordenados por fecha, indicando a qué tablero pertenece cada uno y resumiendo sus workflows.`;
      }
      handleSendBrainAiMessage(promptForBriefing);
    });
  });

  // Cerrar desplegables al hacer clic fuera
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.brain-ai-chip-dropdown')) {
      closeAllBrainAiDropdowns();
    }
  });

  // Chips de acción rápida directa (ej. Revisar apuntes obsoletos)
  document.querySelectorAll('#brain-ai-quick-actions > .brain-ai-chip[data-prompt]').forEach(chip => {
    chip.addEventListener('click', () => {
      closeAllBrainAiDropdowns();
      const promptText = chip.getAttribute('data-prompt');
      if (promptText) {
        handleSendBrainAiMessage(promptText);
      }
    });
  });

  // Modal de Configuración de Proveedor IA
  function syncSettingsModalVisibilityByProvider() {
    const prov = brainAiProviderSelect?.value || 'claude_cli';
    const isCli = (prov === 'claude_cli' || prov === 'gemini_cli');
    if (brainAiCliConfigBox) brainAiCliConfigBox.style.display = isCli ? 'block' : 'none';
    if (brainAiApikeyConfigBox) brainAiApikeyConfigBox.style.display = isCli ? 'none' : 'block';
    if (brainAiGeminiFreeBanner) {
      brainAiGeminiFreeBanner.style.display = (prov === 'gemini_api') ? 'flex' : 'none';
    }
    if (brainAiApikeyLabel) {
      if (prov === 'gemini_api') {
        brainAiApikeyLabel.textContent = 'Google AI Studio API Key (Gratis · o déjalo vacío para modo integrado)';
        if (brainAiApikeyInput) brainAiApikeyInput.placeholder = 'AIzaSy... (opcional si usas el modo gratuito integrado)';
      } else if (prov === 'ollama') {
        brainAiApikeyLabel.textContent = 'Endpoint de Ollama Local';
        if (brainAiApikeyInput) brainAiApikeyInput.placeholder = 'http://localhost:11434';
      } else if (prov === 'claude_api') {
        brainAiApikeyLabel.textContent = 'Anthropic Claude API Key';
        if (brainAiApikeyInput) brainAiApikeyInput.placeholder = 'sk-ant-api03-...';
      } else {
        brainAiApikeyLabel.textContent = 'OpenAI API Key';
        if (brainAiApikeyInput) brainAiApikeyInput.placeholder = 'sk-proj-...';
      }
    }
    if (brainAiApikeyStatus) {
      brainAiApikeyStatus.style.display = 'none';
      brainAiApikeyStatus.className = 'brain-ai-apikey-status';
    }

    populateModelAndEffortSelects(
      prov,
      brainAiModelSelect,
      brainAiEffortSelect,
      brainAiSettings.provider === prov ? brainAiSettings.model : null,
      brainAiSettings.provider === prov ? brainAiSettings.effort : null
    );

    if (isCli && brainAiCliDetectedBadge) {
      const detectedPath = prov === 'claude_cli' ? detectDefaultClaudeCliPath() : detectDefaultGeminiCliPath();
      if (detectedPath) {
        brainAiCliDetectedBadge.textContent = `✓ Detectado en tu PC: ${detectedPath}`;
        brainAiCliDetectedBadge.classList.remove('missing');
        if (brainAiCliPathInput && !brainAiCliPathInput.value) {
          brainAiCliPathInput.value = detectedPath;
        }
      } else {
        brainAiCliDetectedBadge.textContent = `⚠️ No se encontró "${prov === 'claude_cli' ? 'claude' : 'gemini'}" en este PC (se usará Gemini 2.5 Flash Gratis si falla)`;
        brainAiCliDetectedBadge.classList.add('missing');
      }
    }
  }

  function updateAutodetectStatusBanner() {
    if (!brainAiAutodetectStatus) return;
    const auto = autoDetectBestAiProvider();
    brainAiAutodetectStatus.textContent = auto.detectedSummary;
  }

  function openBrainAiSettingsModal() {
    if (!brainAiSettingsModal) return;
    if (brainAiProviderSelect) brainAiProviderSelect.value = brainAiSettings.provider || 'claude_cli';
    if (brainAiCliPathInput) brainAiCliPathInput.value = brainAiSettings.cliPath || '';
    if (brainAiApikeyInput) brainAiApikeyInput.value = brainAiSettings.apiKey || '';
    updateAutodetectStatusBanner();
    syncSettingsModalVisibilityByProvider();
    brainAiSettingsModal.style.display = 'flex';
  }

  function closeBrainAiSettingsModal() {
    if (brainAiSettingsModal) brainAiSettingsModal.style.display = 'none';
  }

  brainAiProviderSelect?.addEventListener('change', syncSettingsModalVisibilityByProvider);
  btnBrainAiSettings?.addEventListener('click', openBrainAiSettingsModal);
  brainAiProviderBadge?.addEventListener('click', openBrainAiSettingsModal);
  btnCloseBrainAiSettings?.addEventListener('click', closeBrainAiSettingsModal);
  btnCancelBrainAiSettings?.addEventListener('click', closeBrainAiSettingsModal);

  // Botón de Autodetección Inteligente de IA
  btnBrainAiAutodetect?.addEventListener('click', () => {
    const auto = autoDetectBestAiProvider();
    if (brainAiProviderSelect) brainAiProviderSelect.value = auto.provider;
    if (brainAiCliPathInput) brainAiCliPathInput.value = auto.cliPath || '';
    syncSettingsModalVisibilityByProvider();
    if (brainAiModelSelect) brainAiModelSelect.value = auto.model;
    if (brainAiEffortSelect) brainAiEffortSelect.value = auto.effort;
    if (brainAiAutodetectStatus) {
      brainAiAutodetectStatus.textContent = auto.detectedSummary;
    }
    showDevToast(auto.detectedSummary);
  });

  // Botón para conseguir API Key gratuita de Google Gemini 2.5 Flash en 1 clic
  btnBrainAiGetGeminiKey?.addEventListener('click', () => {
    const targetUrl = 'https://aistudio.google.com/app/apikey';
    try {
      if (typeof window !== 'undefined' && typeof window.require === 'function') {
        const { shell } = window.require('electron');
        if (shell && typeof shell.openExternal === 'function') {
          shell.openExternal(targetUrl);
          return;
        }
      }
    } catch (e) {}
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  });

  // Botón para probar la API Key (especialmente Gemini 2.5 Flash) o el modo gratuito integrado
  btnBrainAiTestApikey?.addEventListener('click', async () => {
    if (!brainAiApikeyStatus) return;
    const prov = brainAiProviderSelect?.value || 'gemini_api';
    const keyVal = (brainAiApikeyInput?.value || '').trim();
    const modelVal = brainAiModelSelect?.value || getRecommendedModelForProvider(prov);

    brainAiApikeyStatus.style.display = 'block';
    brainAiApikeyStatus.className = 'brain-ai-apikey-status';
    brainAiApikeyStatus.textContent = 'Probando conexión con IA...';

    try {
      if (prov === 'gemini_api') {
        if (!keyVal) {
          const testReply = await callFreeIntegratedGeminiFallback('Responde únicamente con la palabra: OK');
          brainAiApikeyStatus.className = 'brain-ai-apikey-status ok';
          brainAiApikeyStatus.textContent = `✓ Modo gratuito integrado listo (${testReply.slice(0, 24)}). Puedes pegar tu clave de AI Studio cuando quieras para mayor cuota.`;
          return;
        }
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelVal)}:generateContent?key=${encodeURIComponent(keyVal)}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Responde solo OK' }] }],
            generationConfig: { maxOutputTokens: 16 }
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
        brainAiApikeyStatus.className = 'brain-ai-apikey-status ok';
        brainAiApikeyStatus.textContent = `✓ Conectado a Google ${modelVal} correctamente.`;
      } else {
        brainAiApikeyStatus.className = 'brain-ai-apikey-status ok';
        brainAiApikeyStatus.textContent = keyVal
          ? `✓ Clave configurada para ${getProviderDisplayName(prov)} (${modelVal}).`
          : `⚠️ Introduce una clave válida para ${getProviderDisplayName(prov)}.`;
      }
    } catch (err) {
      brainAiApikeyStatus.className = 'brain-ai-apikey-status err';
      brainAiApikeyStatus.textContent = `⚠️ Error al verificar: ${err.message || err}`;
    }
  });

  btnBrainAiTestCli?.addEventListener('click', async () => {
    if (!brainAiCliDetectedBadge) return;
    brainAiCliDetectedBadge.textContent = 'Verificando ejecutable CLI...';
    const prov = brainAiProviderSelect?.value || 'claude_cli';
    const customCmd = brainAiCliPathInput?.value?.trim() || (prov === 'claude_cli' ? (detectDefaultClaudeCliPath() || 'claude') : (detectDefaultGeminiCliPath() || 'gemini'));
    try {
      const { execFileSync } = window.require('child_process');
      const out = execFileSync(customCmd, ['--version'], { encoding: 'utf8', timeout: 5000, windowsHide: true }).trim();
      brainAiCliDetectedBadge.textContent = `✓ Conectado: ${out}`;
      brainAiCliDetectedBadge.classList.remove('missing');
    } catch (e) {
      brainAiCliDetectedBadge.textContent = `⚠️ No se pudo ejecutar "${customCmd}"`;
      brainAiCliDetectedBadge.classList.add('missing');
    }
  });

  btnSaveBrainAiSettings?.addEventListener('click', () => {
    const prov = brainAiProviderSelect?.value || 'claude_cli';
    brainAiSettings = {
      provider: prov,
      cliPath: brainAiCliPathInput?.value?.trim() || '',
      apiKey: brainAiApikeyInput?.value?.trim() || '',
      model: brainAiModelSelect?.value || getRecommendedModelForProvider(prov),
      effort: brainAiEffortSelect?.value || getRecommendedEffortForProvider(prov)
    };
    saveBrainAiSettingsToStorage();
    syncBrainAiHeaderBadges();
    closeBrainAiSettingsModal();
    showDevToast(`Brain conectado: ${getProviderDisplayName(brainAiSettings.provider)}`);
  });

  // Atajo global Ctrl+K para abrir/cerrar el Cerebro IA desde cualquier pantalla
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      toggleBrainAiChatPanel();
    }
  });

  syncBrainAiHeaderBadges();

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
