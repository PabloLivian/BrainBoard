// Motor de Lienzo Infinito 2D de Brain Board
class CanvasEngine {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');

    // Estado de la camara
    this.camera = { x: 0, y: 0, zoom: 1 };
    this.minZoom = 0.01;
    this.maxZoom = 5.0;

    // Coleccion de elementos en el tablero
    this.items = [];
    this.selectedItemIds = new Set();

    // Historial para Deshacer/Rehacer
    this.undoStack = [];
    this.redoStack = [];

    // Herramienta activa: 'select', 'hand', 'sticky_note', 'shape', 'text', 'pen', 'connector', 'frame'
    this.activeTool = 'select';
    this.selectedShapeType = 'rectangle';
    this.selectedTemplateType = 'apuntes';
    this.activeColor = '#fff9b0'; // Amarillo por defecto

    // Estados de interaccion
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };
    this.isDraggingItem = false;
    this.isMiddleDragDuplicate = false;
    this.isAltDragDuplicate = false;
    this.dragStart = { x: 0, y: 0 };
    this.isResizing = false;
    this.activeResizeHandle = null;
    this.resizeTargetItem = null;
    this.resizeInitialBounds = null;
    this.resizeStartWorld = null;
    this.isSelectingMarquee = false;
    this.isMarqueeDeselect = false;
    this.marqueeBox = null;
    this.currentDrawing = null;
    this.activeConnector = null;
    this.isConnectingFromPort = false;
    this.connectorStartItem = null;
    this.connectorStartPort = null;
    this.hoveredSnapPort = null;
    this.hoveredConnectorPort = null;

    // Herramienta Dev: Selector de Coordenadas de Área para IA ('dev_coords')
    this.isSelectingDevCoords = false;
    this.devCoordsBox = null;
    this.onDevCoordsSelected = null;

    // Smart Guides magnéticas (Alineación inteligente)
    this.smartGuidesEnabled = true;
    this.activeGuides = [];

    // Minimap bounds
    this.minimapBounds = null;

    // Modo Oscuro / Claro
    this.isDarkMode = false;

    // Callbacks
    this.onSelectionChange = null;
    this.onZoomChange = null;
    this.onCameraChange = null;
    this.onBoardModified = null;
    this.onCommentClick = null;
    this.onCommentCreated = null;
    this.onEditingFinish = null;
    this.onFrameHeaderClick = null;
    this.potentialFrameHeaderClick = null;

    // ID del elemento que se esta editando in-situ (para no duplicar texto)
    this.editingItemId = null;
    this.isSpacePressed = false;

    // Coordenadas del puntero del ratón en el mundo
    this.lastPointerWorld = null;
    this.lastPointerScreen = null;

    // Seguimiento de Fecha de Colocación, Hover 2s y Mapa Visual de Frescura
    this.freshnessMapMode = false;
    this.freshnessFilterTier = 'all'; // 'all' | 'recent' | 'current' | 'aging' | 'obsolete'
    this.hoverDateTimer = null;
    this.hoverDateTargetId = null;
    this.onItemHoverDate = null;

    this.initCanvasSize();
    this.bindEvents();
    this.render();
  }

  clearHoverDateTooltip() {
    if (this.hoverDateTimer) {
      clearTimeout(this.hoverDateTimer);
      this.hoverDateTimer = null;
    }
    if (this.hoverDateTargetId !== null) {
      this.hoverDateTargetId = null;
      if (this.onItemHoverDate) {
        this.onItemHoverDate(null, 0, 0, null);
      }
    }
  }

  scheduleHoverDateTooltip(item, screenX, screenY) {
    if (!item || !item.id) {
      this.clearHoverDateTooltip();
      return;
    }
    this.hoverDateLastScreen = { x: screenX, y: screenY };
    if (this.hoverDateTargetId === item.id) {
      return;
    }
    if (this.hoverDateTimer) {
      clearTimeout(this.hoverDateTimer);
      this.hoverDateTimer = null;
    }
    if (this.onItemHoverDate) {
      this.onItemHoverDate(null, 0, 0, null);
    }
    this.hoverDateTargetId = item.id;
    this.hoverDateTimer = setTimeout(() => {
      this.hoverDateTimer = null;
      if (this.hoverDateTargetId === item.id && !this.isDraggingItem && !this.isPanning && !this.isSelectingMarquee) {
        const currentItem = this.items.find(i => i.id === item.id) || item;
        const info = this.getItemFreshnessInfo(currentItem);
        const pos = this.hoverDateLastScreen || { x: screenX, y: screenY };
        if (this.onItemHoverDate) {
          this.onItemHoverDate(currentItem, pos.x, pos.y, info);
        }
      }
    }, 2000);
  }

  getItemCreatedAtMs(it) {
    if (!it) return null;
    if (it.createdAt) {
      const parsed = Date.parse(it.createdAt);
      if (!isNaN(parsed)) return parsed;
    }
    if (it.updatedAt) {
      const parsed = Date.parse(it.updatedAt);
      if (!isNaN(parsed)) return parsed;
    }
    const idStr = String(it.id || '');
    const m = idStr.match(/(?:^|_)(\d{13})(?:_|$)/);
    if (m) {
      const ms = Number(m[1]);
      if (ms > 1577836800000 && ms <= Date.now() + 86400000) return ms;
    }
    return null;
  }

  // Fecha de la última revisión del contenido (edición o "Marcar como revisado")
  getItemReviewedAtMs(it) {
    if (!it || !it.reviewedAt) return null;
    const parsed = Date.parse(it.reviewedAt);
    return isNaN(parsed) ? null : parsed;
  }

  formatRelativeAge(ms, nowMs = Date.now()) {
    const diffMs = Math.max(0, nowMs - ms);
    const ageDays = diffMs / 86400000;
    const ageHours = diffMs / 3600000;
    const ageMinutes = diffMs / 60000;
    if (ageMinutes < 2) return 'Justo ahora';
    if (ageMinutes < 60) return `Hace ${Math.floor(ageMinutes)} min`;
    if (ageHours < 24) {
      const h = Math.floor(ageHours);
      return `Hace ${h} ${h === 1 ? 'hora' : 'horas'}`;
    }
    if (ageDays < 2) return 'Ayer';
    if (ageDays < 30) return `Hace ${Math.floor(ageDays)} días`;
    if (ageDays < 365) {
      const months = Math.max(1, Math.floor(ageDays / 30.4));
      return `Hace ${months} ${months === 1 ? 'mes' : 'meses'}`;
    }
    const years = (ageDays / 365.25).toFixed(1).replace(/\.0$/, '');
    return `Hace ${years} ${years === '1' ? 'año' : 'años'}`;
  }

  formatDateParts(ms) {
    const d = new Date(ms);
    const monthsShort = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const formattedDate = `${d.getDate()} ${monthsShort[d.getMonth()]} ${d.getFullYear()}`;
    return { formattedDate, formattedDateTime: `${formattedDate}, ${hh}:${mm}` };
  }

  getItemFreshnessInfo(it) {
    const createdMs = this.getItemCreatedAtMs(it);
    const nowMs = Date.now();
    const validMs = createdMs || nowMs;

    // La frescura cuenta desde la última revisión si es posterior a la colocación
    const reviewedMs = this.getItemReviewedAtMs(it);
    const isReviewed = Boolean(reviewedMs && reviewedMs > validMs);
    const freshnessMs = isReviewed ? reviewedMs : validMs;
    const ageDays = Math.max(0, nowMs - freshnessMs) / 86400000;

    const relativeText = createdMs ? this.formatRelativeAge(validMs, nowMs) : 'Fecha registrada';
    const { formattedDate, formattedDateTime } = this.formatDateParts(validMs);

    let tier = 'recent';
    let tierLabel = 'Reciente';
    let color = '#10b981'; // Esmeralda
    if (ageDays <= 7) {
      tier = 'recent';
      tierLabel = 'Reciente (≤7d)';
      color = '#10b981';
    } else if (ageDays <= 30) {
      tier = 'current';
      tierLabel = 'Actual (≤30d)';
      color = '#3b82f6';
    } else if (ageDays <= 180) {
      tier = 'aging';
      tierLabel = 'Intermedio (≤6m)';
      color = '#f59e0b';
    } else {
      tier = 'obsolete';
      tierLabel = 'Antiguo (>6m)';
      color = '#ef4444';
    }

    return {
      createdMs: validMs,
      createdAtIso: new Date(validMs).toISOString(),
      ageDays,
      tier,
      tierLabel,
      color,
      relativeText,
      formattedDate,
      formattedDateTime,
      isReviewed,
      freshnessMs,
      reviewedMs: isReviewed ? reviewedMs : null,
      reviewRelativeText: isReviewed ? this.formatRelativeAge(reviewedMs, nowMs) : '',
      reviewedFormattedDateTime: isReviewed ? this.formatDateParts(reviewedMs).formattedDateTime : ''
    };
  }

  matchesFreshnessFilter(it) {
    if (!this.freshnessMapMode || !this.freshnessFilterTier || this.freshnessFilterTier === 'all') {
      return true;
    }
    const info = this.getItemFreshnessInfo(it);
    return info.tier === this.freshnessFilterTier;
  }

  setFreshnessMapMode(enabled, filterTier = 'all') {
    this.freshnessMapMode = Boolean(enabled);
    this.freshnessFilterTier = filterTier || 'all';
    this.render();
  }

  initCanvasSize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
  }

  // Conversion de coordenadas
  screenToWorld(sx, sy) {
    return {
      x: (sx - this.width / 2) / this.camera.zoom - this.camera.x,
      y: (sy - this.height / 2) / this.camera.zoom - this.camera.y
    };
  }

  worldToScreen(wx, wy) {
    return {
      x: (wx + this.camera.x) * this.camera.zoom + this.width / 2,
      y: (wy + this.camera.y) * this.camera.zoom + this.height / 2
    };
  }

  getCleanItems() {
    return this.items.map(it => {
      if (it.imgElement) {
        const copy = { ...it };
        delete copy.imgElement;
        return copy;
      }
      return it;
    });
  }

  saveSnapshot() {
    const snapshot = JSON.stringify(this.getCleanItems());
    // Evitar registrar snapshots duplicados consecutivos
    if (this.undoStack.length > 0 && this.undoStack[this.undoStack.length - 1] === snapshot) {
      return;
    }
    this.undoStack.push(snapshot);
    if (this.undoStack.length > 50) this.undoStack.shift();
    this.redoStack = [];
  }

  clearHistory() {
    this.undoStack = [];
    this.redoStack = [];
  }

  undo() {
    if (this.undoStack.length === 0) return;
    this.redoStack.push(JSON.stringify(this.getCleanItems()));
    const prev = this.undoStack.pop();
    try {
      this.items = JSON.parse(prev);
      // Eliminar referencias imgElement corruptas ({}) procedentes de JSON.parse
      this.items.forEach(it => {
        if (it.imgElement && typeof it.imgElement.getAttribute !== 'function') {
          delete it.imgElement;
        }
      });
    } catch (e) {
      console.error('Error al restaurar historial en undo:', e);
    }
    this.selectedItemIds.clear();
    this.render();
    if (this.onBoardModified) this.onBoardModified();
  }

  redo() {
    if (this.redoStack.length === 0) return;
    this.undoStack.push(JSON.stringify(this.getCleanItems()));
    const next = this.redoStack.pop();
    try {
      this.items = JSON.parse(next);
      this.items.forEach(it => {
        if (it.imgElement && typeof it.imgElement.getAttribute !== 'function') {
          delete it.imgElement;
        }
      });
    } catch (e) {
      console.error('Error al restaurar historial en redo:', e);
    }
    this.selectedItemIds.clear();
    this.render();
    if (this.onBoardModified) this.onBoardModified();
  }

  zoomAt(sx, sy, deltaFactor) {
    const oldZoom = this.camera.zoom;
    let newZoom = oldZoom * deltaFactor;
    newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, newZoom));

    // Ajustar camara para que el punto bajo el cursor no se mueva
    const worldBefore = this.screenToWorld(sx, sy);
    this.camera.zoom = newZoom;
    const worldAfter = this.screenToWorld(sx, sy);

    this.camera.x += (worldAfter.x - worldBefore.x);
    this.camera.y += (worldAfter.y - worldBefore.y);

    if (this.onZoomChange) this.onZoomChange(this.camera.zoom);
    if (this.onCameraChange) this.onCameraChange();
    this.render();
  }

  fitView() {
    if (this.items.length === 0) {
      this.camera = { x: 0, y: 0, zoom: 1 };
      this.render();
      if (this.onZoomChange) this.onZoomChange(1);
      if (this.onCameraChange) this.onCameraChange();
      return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    this.items.forEach(it => {
      if (it.type === 'connector') {
        if (it.start && typeof it.start.x === 'number' && typeof it.start.y === 'number') {
          minX = Math.min(minX, it.start.x);
          maxX = Math.max(maxX, it.start.x);
          minY = Math.min(minY, it.start.y);
          maxY = Math.max(maxY, it.start.y);
        }
        if (it.end && typeof it.end.x === 'number' && typeof it.end.y === 'number') {
          minX = Math.min(minX, it.end.x);
          maxX = Math.max(maxX, it.end.x);
          minY = Math.min(minY, it.end.y);
          maxY = Math.max(maxY, it.end.y);
        }
        return;
      }
      const x = it.x;
      const y = it.y;
      const w = it.width || 50;
      const h = it.height || 50;
      if (typeof x === 'number' && !isNaN(x) && typeof y === 'number' && !isNaN(y)) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + (typeof w === 'number' && !isNaN(w) ? w : 50));
        maxY = Math.max(maxY, y + (typeof h === 'number' && !isNaN(h) ? h : 50));
      }
    });

    if (!isFinite(minX) || !isFinite(maxX) || !isFinite(minY) || !isFinite(maxY)) {
      this.camera = { x: 0, y: 0, zoom: 0.1 };
      this.render();
      if (this.onZoomChange) this.onZoomChange(this.camera.zoom);
      if (this.onCameraChange) this.onCameraChange();
      return;
    }

    const padding = 150;
    const boxW = Math.max(200, maxX - minX + padding * 2);
    const boxH = Math.max(200, maxY - minY + padding * 2);
    const zoomX = this.width / boxW;
    const zoomY = this.height / boxH;
    this.camera.zoom = Math.min(1.5, Math.max(0.015, Math.min(zoomX, zoomY)));

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    this.camera.x = -centerX;
    this.camera.y = -centerY;

    this.render();
    if (this.onZoomChange) this.onZoomChange(this.camera.zoom);
    if (this.onCameraChange) this.onCameraChange();
  }

  // Encuadrar un rectángulo del mundo dejando margen alrededor (sin pasar de maxZoom)
  zoomToBounds(minX, minY, maxX, maxY, { padding = 80, maxZoom = 1 } = {}) {
    const w = Math.max(1, maxX - minX);
    const h = Math.max(1, maxY - minY);
    const zoomX = (this.width - padding * 2) / w;
    const zoomY = (this.height - padding * 2) / h;
    this.camera.zoom = Math.max(0.02, Math.min(maxZoom, zoomX, zoomY));
    this.camera.x = -(minX + w / 2);
    this.camera.y = -(minY + h / 2);
    this.render();
    if (this.onZoomChange) this.onZoomChange(this.camera.zoom);
    if (this.onCameraChange) this.onCameraChange();
  }

  focusOnItem(it, maxZoom = 1) {
    if (!it) return;
    const x = it.x || 0;
    const y = it.y || 0;
    this.zoomToBounds(x, y, x + (it.width || 100), y + (it.height || 100), { padding: 120, maxZoom });
  }

  zoomToItem(it, targetZoom = 1.0) {
    if (!it) return;
    const cx = (it.x || 0) + (it.width || 100) / 2;
    const cy = (it.y || 0) + (it.height || 100) / 2;
    this.camera.zoom = targetZoom;
    this.camera.x = -cx;
    this.camera.y = -cy;
    this.render();
    if (this.onZoomChange) this.onZoomChange(this.camera.zoom);
    if (this.onCameraChange) this.onCameraChange();
  }

  getDefaultZIndex(it) {
    if (!it) return 20;
    if (typeof it.zIndex === 'number') return it.zIndex;
    switch (it.type) {
      case 'frame': return 0;
      case 'connector': return 10;
      case 'shape': return 20;
      case 'code': return 22;
      case 'embed':
      case 'preview': return 24;
      case 'image': return 26;
      case 'sticky_note': return 30;
      case 'text': return 40;
      case 'pen': return 42;
      case 'comment': return 100;
      default: return 20;
    }
  }

  getSortedItemsForRender(reverse = false) {
    const mapped = this.items.map((it, idx) => ({
      it,
      idx,
      z: this.getDefaultZIndex(it)
    }));
    mapped.sort((a, b) => {
      if (a.z !== b.z) return reverse ? (b.z - a.z) : (a.z - b.z);
      return reverse ? (b.idx - a.idx) : (a.idx - b.idx);
    });
    return mapped.map(m => m.it);
  }

  normalizeZIndices() {
    const sorted = this.getSortedItemsForRender(false);
    sorted.forEach((it, idx) => {
      it.zIndex = (idx + 1) * 10;
    });
  }

  bringForward(itemIds = null) {
    const ids = itemIds ? new Set(itemIds) : this.selectedItemIds;
    if (ids.size === 0) return;
    this.normalizeZIndices();
    const sorted = this.getSortedItemsForRender(false);
    let changed = false;
    for (let i = sorted.length - 2; i >= 0; i--) {
      const current = sorted[i];
      const next = sorted[i + 1];
      if (ids.has(current.id) && !ids.has(next.id)) {
        current.zIndex = next.zIndex + 5;
        changed = true;
      }
    }
    if (changed) {
      this.normalizeZIndices();
      this.saveSnapshot();
      if (this.onBoardModified) this.onBoardModified();
      this.render();
    }
  }

  sendBackward(itemIds = null) {
    const ids = itemIds ? new Set(itemIds) : this.selectedItemIds;
    if (ids.size === 0) return;
    this.normalizeZIndices();
    const sorted = this.getSortedItemsForRender(false);
    let changed = false;
    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i];
      const prev = sorted[i - 1];
      if (ids.has(current.id) && !ids.has(prev.id)) {
        current.zIndex = prev.zIndex - 5;
        changed = true;
      }
    }
    if (changed) {
      this.normalizeZIndices();
      this.saveSnapshot();
      if (this.onBoardModified) this.onBoardModified();
      this.render();
    }
  }

  bringToFront(itemIds = null) {
    const ids = itemIds ? new Set(itemIds) : this.selectedItemIds;
    if (ids.size === 0) return;
    this.normalizeZIndices();
    const sorted = this.getSortedItemsForRender(false);
    let maxZ = sorted.length > 0 ? sorted[sorted.length - 1].zIndex : 10;
    let changed = false;
    sorted.forEach(it => {
      if (ids.has(it.id)) {
        maxZ += 10;
        it.zIndex = maxZ;
        changed = true;
      }
    });
    if (changed) {
      this.normalizeZIndices();
      this.saveSnapshot();
      if (this.onBoardModified) this.onBoardModified();
      this.render();
    }
  }

  sendToBack(itemIds = null) {
    const ids = itemIds ? new Set(itemIds) : this.selectedItemIds;
    if (ids.size === 0) return;
    this.normalizeZIndices();
    const sorted = this.getSortedItemsForRender(false);
    let minZ = sorted.length > 0 ? sorted[0].zIndex : 10;
    let changed = false;
    const selected = sorted.filter(it => ids.has(it.id));
    selected.reverse().forEach(it => {
      minZ -= 10;
      it.zIndex = minZ;
      changed = true;
    });
    if (changed) {
      this.normalizeZIndices();
      this.saveSnapshot();
      if (this.onBoardModified) this.onBoardModified();
      this.render();
    }
  }

  getItemAt(wx, wy, excludeFrames = false) {
    const sorted = this.getSortedItemsForRender(true);
    for (const it of sorted) {
      if (excludeFrames && it.type === 'frame') continue;
      if (this.isPointInsideItem(wx, wy, it)) {
        return it;
      }
    }
    return null;
  }

  // Comprueba si un punto cae sobre la pestaña/etiqueta superior del marco
  isPointOnFrameHeader(frame, wx, wy) {
    if (!frame || frame.type !== 'frame') return false;
    const tabHeight = 28;
    const tabWidth = Math.max(80, (frame.title ? frame.title.length * 9 : 0) + 26);
    return wx >= frame.x && wx <= frame.x + tabWidth && wy >= frame.y - tabHeight && wy <= frame.y + 4;
  }

  // Comprueba si un punto (wx, wy) cae sobre la pestaña del título o el borde perimetral del frame
  isPointOnFrameHeaderOrBorder(frame, wx, wy) {
    if (!frame) return false;
    if (this.isPointOnFrameHeader(frame, wx, wy)) return true;
    const margin = 8;
    const isInsideOuter = wx >= frame.x - margin && wx <= frame.x + frame.width + margin &&
                          wy >= frame.y - margin && wy <= frame.y + frame.height + margin;
    const isInsideInner = wx >= frame.x + margin && wx <= frame.x + frame.width - margin &&
                          wy >= frame.y + margin && wy <= frame.y + frame.height - margin;
    return isInsideOuter && !isInsideInner;
  }

  // Comprueba si las coordenadas (wx, wy) se encuentran sobre alguno de los elementos actualmente seleccionados
  isPointerOverSelection(wx, wy) {
    if (this.selectedItemIds.size === 0) return false;

    // 1. Elemento regular seleccionado (notas, formas, textos, embeds, imágenes, conectores)
    const hitItem = this.getItemAt(wx, wy, true);
    if (hitItem) {
      if (this.selectedItemIds.has(hitItem.id)) return true;
      if (hitItem.parentId && this.selectedItemIds.has(hitItem.parentId)) return true;
    }

    // 2. Marco contenedor seleccionado
    const hitFrame = this.getItemAt(wx, wy, false);
    if (hitFrame && hitFrame.type === 'frame' && this.selectedItemIds.has(hitFrame.id)) {
      return true;
    }

    return false;
  }

  // Comprueba si un elemento intersecta o está contenido dentro del recuadro de selección Marquee
  itemIntersectsBox(it, minX, minY, maxX, maxY) {
    if (!it) return false;

    // Los marcos (frames) solo se seleccionan por recuadro si el recuadro los encierra por completo
    if (it.type === 'frame') {
      const itW = it.width || 0;
      const itH = it.height || 0;
      return it.x >= minX && it.x + itW <= maxX && it.y >= minY && it.y + itH <= maxY;
    }

    // Comentarios (pin circular con radio de 16px)
    if (it.type === 'comment') {
      return it.x + 16 >= minX && it.x - 16 <= maxX && it.y + 16 >= minY && it.y - 16 <= maxY;
    }

    // Conectores (línea o curva entre start y end)
    if (it.type === 'connector') {
      if (!it.start || !it.end || typeof it.start.x !== 'number' || typeof it.end.x !== 'number') return false;
      const cStart = it.start;
      const cEnd = it.end;
      if (cStart.x >= minX && cStart.x <= maxX && cStart.y >= minY && cStart.y <= maxY) return true;
      if (cEnd.x >= minX && cEnd.x <= maxX && cEnd.y >= minY && cEnd.y <= maxY) return true;
      const cMinX = Math.min(cStart.x, cEnd.x);
      const cMaxX = Math.max(cStart.x, cEnd.x);
      const cMinY = Math.min(cStart.y, cEnd.y);
      const cMaxY = Math.max(cStart.y, cEnd.y);
      return cMinX <= maxX && cMaxX >= minX && cMinY <= maxY && cMaxY >= minY;
    }

    // Trazos a mano alzada (pen)
    if (it.type === 'pen') {
      if (!it.points || !it.points.length) return false;
      let pMinX = Infinity, pMaxX = -Infinity, pMinY = Infinity, pMaxY = -Infinity;
      for (const pt of it.points) {
        if (pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY) return true;
        if (pt.x < pMinX) pMinX = pt.x;
        if (pt.x > pMaxX) pMaxX = pt.x;
        if (pt.y < pMinY) pMinY = pt.y;
        if (pt.y > pMaxY) pMaxY = pt.y;
      }
      return pMinX <= maxX && pMaxX >= minX && pMinY <= maxY && pMaxY >= minY;
    }

    // Para todos los demás elementos (notas adhesivas, formas, textos, embeds, previews, imágenes, etc.):
    // Intersección de cajas AABB estándar (Axis-Aligned Bounding Box)
    const itW = it.width || 0;
    const itH = it.height || 0;
    const itRight = it.x + itW;
    const itBottom = it.y + itH;

    return it.x <= maxX && itRight >= minX && it.y <= maxY && itBottom >= minY;
  }

  distToSegment(p, v, w) {
    const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
  }

  // Obtener los 8 puntos de anclaje de redimensionamiento
  getResizeHandles(it) {
    if (!it || it.type === 'pen' || it.type === 'connector') return [];
    const x = it.x;
    const y = it.y;
    const w = it.width || 50;
    const h = it.height || 50;
    const mx = x + w / 2;
    const my = y + h / 2;

    return [
      { name: 'nw', x: x, y: y, cursor: 'nwse-resize' },
      { name: 'n',  x: mx, y: y, cursor: 'ns-resize' },
      { name: 'ne', x: x + w, y: y, cursor: 'nesw-resize' },
      { name: 'e',  x: x + w, y: my, cursor: 'ew-resize' },
      { name: 'se', x: x + w, y: y + h, cursor: 'nwse-resize' },
      { name: 's',  x: mx, y: y + h, cursor: 'ns-resize' },
      { name: 'sw', x: x, y: y + h, cursor: 'nesw-resize' },
      { name: 'w',  x: x, y: my, cursor: 'ew-resize' }
    ];
  }

  // Obtener los 4 puertos de conexión en los puntos medios de los lados
  getConnectorPorts(it) {
    if (!it || it.type === 'pen' || it.type === 'connector') return [];
    const x = it.x;
    const y = it.y;
    const w = it.width || 50;
    const h = it.height || 50;

    return [
      { name: 'top',    x: x + w / 2, y: y,         position: { x: 0.5, y: 0.0 } },
      { name: 'right',  x: x + w,     y: y + h / 2, position: { x: 1.0, y: 0.5 } },
      { name: 'bottom', x: x + w / 2, y: y + h,     position: { x: 0.5, y: 1.0 } },
      { name: 'left',   x: x,         y: y + h / 2, position: { x: 0.0, y: 0.5 } }
    ];
  }

  // Detectar si el clic ocurre en alguno de los 4 puertos circulares de conexión
  getConnectorPortAt(wx, wy) {
    if (this.selectedItemIds.size !== 1) return null;
    const hitRadiusWorld = Math.max(9, 14 / this.camera.zoom);

    for (const it of this.items) {
      if (this.selectedItemIds.has(it.id)) {
        const ports = this.getConnectorPorts(it);
        for (const p of ports) {
          const dist = Math.hypot(wx - p.x, wy - p.y);
          if (dist <= hitRadiusWorld) {
            return { item: it, port: p };
          }
        }
      }
    }
    return null;
  }

  // Encontrar el puerto objetivo magnético más cercano en otra caja durante el arrastre de una flecha
  findTargetSnapPort(wx, wy, excludeItemId) {
    const tolerance = Math.max(16, 24 / this.camera.zoom);
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      if (it.id === excludeItemId || it.type === 'pen' || it.type === 'connector' || it.type === 'frame') continue;
      const w = it.width || 50;
      const h = it.height || 50;
      if (wx >= it.x - tolerance && wx <= it.x + w + tolerance &&
          wy >= it.y - tolerance && wy <= it.y + h + tolerance) {
        const ports = this.getConnectorPorts(it);
        let closest = null;
        let minDist = Infinity;
        ports.forEach(p => {
          const d = Math.hypot(wx - p.x, wy - p.y);
          if (d < minDist) {
            minDist = d;
            closest = p;
          }
        });
        if (closest) {
          return { item: it, port: closest };
        }
      }
    }
    return null;
  }

  isPointInsideItem(wx, wy, it) {
    if (!it) return false;
    if (it.type === 'comment') {
      return Math.hypot(it.x - wx, it.y - wy) <= 20;
    }
    if (it.type === 'pen' && it.points) {
      const radius = (it.strokeWidth || 4) + 6;
      for (const pt of it.points) {
        if (Math.hypot(pt.x - wx, pt.y - wy) < radius) return true;
      }
      return false;
    }
    if (it.type === 'connector') {
      if (!it.start || !it.end || typeof it.start.x !== 'number' || typeof it.end.x !== 'number') return false;
      return this.distToSegment({ x: wx, y: wy }, it.start, it.end) < 10;
    }
    if (it.type === 'frame') {
      if (this.isPointOnFrameHeader(it, wx, wy)) return true;
      const w = it.width || 200;
      const h = it.height || 200;
      return wx >= it.x && wx <= it.x + w && wy >= it.y && wy <= it.y + h;
    }
    const w = it.width || 100;
    const h = it.height || 40;
    return wx >= it.x && wx <= it.x + w && wy >= it.y && wy <= it.y + h;
  }

  // Detectar controladores de redimensionamiento: 4 esquinas prioritarias y 4 ejes/bordes
  getResizeHandleAt(wx, wy) {
    if (this.selectedItemIds.size !== 1) return null;
    const cornerHitRadius = Math.max(8, 12 / this.camera.zoom);
    const edgeHitRadius = Math.max(6, 9 / this.camera.zoom);

    for (const it of this.items) {
      if (this.selectedItemIds.has(it.id)) {
        if (it.type === 'pen' || it.type === 'connector') continue;
        const x = it.x;
        const y = it.y;
        const w = it.width || 50;
        const h = it.height || 50;

        // 1. Prioridad: Comprobar las 4 esquinas primero para agrandar / empequeñecer
        const corners = [
          { name: 'nw', x: x, y: y, cursor: 'nwse-resize' },
          { name: 'ne', x: x + w, y: y, cursor: 'nesw-resize' },
          { name: 'se', x: x + w, y: y + h, cursor: 'nwse-resize' },
          { name: 'sw', x: x, y: y + h, cursor: 'nesw-resize' }
        ];
        for (const c of corners) {
          if (Math.hypot(wx - c.x, wy - c.y) <= cornerHitRadius) {
            return { item: it, handle: c.name, cursor: c.cursor };
          }
        }

        // 2. Comprobar los 4 ejes / bordes del recuadro para agrandar y empequeñecer tirando de ellos
        // Borde superior (Norte)
        if (Math.abs(wy - y) <= edgeHitRadius && wx >= x - edgeHitRadius && wx <= x + w + edgeHitRadius) {
          return { item: it, handle: 'n', cursor: 'ns-resize' };
        }
        // Borde inferior (Sur)
        if (Math.abs(wy - (y + h)) <= edgeHitRadius && wx >= x - edgeHitRadius && wx <= x + w + edgeHitRadius) {
          return { item: it, handle: 's', cursor: 'ns-resize' };
        }
        // Borde izquierdo (Oeste)
        if (Math.abs(wx - x) <= edgeHitRadius && wy >= y - edgeHitRadius && wy <= y + h + edgeHitRadius) {
          return { item: it, handle: 'w', cursor: 'ew-resize' };
        }
        // Borde derecho (Este)
        if (Math.abs(wx - (x + w)) <= edgeHitRadius && wy >= y - edgeHitRadius && wy <= y + h + edgeHitRadius) {
          return { item: it, handle: 'e', cursor: 'ew-resize' };
        }
      }
    }
    return null;
  }

  // Actualizar automáticamente los extremos de las flechas/conectores unidos a un elemento que se mueve o redimensiona
  updateConnectedLinesForItem(movedItem) {
    if (!movedItem) return;
    this.items.forEach(it => {
      if (it.type === 'connector') {
        if (it.start?.item === movedItem.id) {
          const posX = it.start.position?.x ?? 0.5;
          const posY = it.start.position?.y ?? 0.5;
          it.start.x = movedItem.x + (movedItem.width || 0) * posX;
          it.start.y = movedItem.y + (movedItem.height || 0) * posY;
        }
        if (it.end?.item === movedItem.id) {
          const posX = it.end.position?.x ?? 0.5;
          const posY = it.end.position?.y ?? 0.5;
          it.end.x = movedItem.x + (movedItem.width || 0) * posX;
          it.end.y = movedItem.y + (movedItem.height || 0) * posY;
        }
      }
    });
  }

  isItemInsideFrame(child, frame) {
    if (child.type === 'connector') {
      return (
        child.start && child.end &&
        child.start.x >= frame.x && child.start.x <= frame.x + frame.width &&
        child.start.y >= frame.y && child.start.y <= frame.y + frame.height
      );
    }
    const cx = (child.x || 0) + (child.width || 0) / 2;
    const cy = (child.y || 0) + (child.height || 0) / 2;
    return (
      cx >= frame.x && cx <= frame.x + frame.width &&
      cy >= frame.y && cy <= frame.y + frame.height
    );
  }

  openExternalUrl(url) {
    if (!url) return;
    let targetUrl = (typeof url === 'string') ? url.trim() : '';
    if (!targetUrl) return;
    if (!/^https?:\/\//i.test(targetUrl)) targetUrl = 'https://' + targetUrl;
    try {
      if (window.brainBoard && typeof window.brainBoard.openExternal === 'function') {
        window.brainBoard.openExternal(targetUrl);
        return;
      }
      if (window.miro && typeof window.miro.openExternal === 'function') {
        window.miro.openExternal(targetUrl);
        return;
      }
      const req = window.require || (typeof require !== 'undefined' ? require : null);
      if (req) {
        const { shell } = req('electron');
        if (shell && shell.openExternal) {
          shell.openExternal(targetUrl);
          return;
        }
      }
    } catch (e) {}
    window.open(targetUrl, '_blank');
  }

  setDarkMode(isDark) {
    this.isDarkMode = Boolean(isDark);
    this.render();
  }

  isDarkColor(color) {
    if (!color || typeof color !== 'string') return true;
    const c = color.trim().toLowerCase();
    if (c === '#1a1a1a' || c === '#151518' || c === '#2d2d2d' || c === '#000000' || c === '#333333' || c === '#0f172a' || c === 'black') return true;
    if (c.startsWith('#')) {
      const hex = c.replace('#', '');
      let r = 0, g = 0, b = 0;
      if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16) || 0;
        g = parseInt(hex[1] + hex[1], 16) || 0;
        b = parseInt(hex[2] + hex[2], 16) || 0;
      } else if (hex.length === 6) {
        r = parseInt(hex.substring(0, 2), 16) || 0;
        g = parseInt(hex.substring(2, 4), 16) || 0;
        b = parseInt(hex.substring(4, 6), 16) || 0;
      }
      const lum = (0.299 * r + 0.587 * g + 0.114 * b);
      return lum < 95;
    }
    return false;
  }

  isLightColor(color) {
    if (!color || typeof color !== 'string') return false;
    const c = color.trim().toLowerCase();
    if (c === '#ffffff' || c === '#bbcbd2' || c === '#f8f9fa' || c === '#f1f5f9' || c === '#eef2f5' || c === '#d9ddff' || c === '#a4c0dd' || c === '#aebfbe' || c === '#fefae0' || c === 'white') return true;
    if (c.startsWith('#')) {
      const hex = c.replace('#', '');
      let r = 0, g = 0, b = 0;
      if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16) || 0;
        g = parseInt(hex[1] + hex[1], 16) || 0;
        b = parseInt(hex[2] + hex[2], 16) || 0;
      } else if (hex.length === 6) {
        r = parseInt(hex.substring(0, 2), 16) || 0;
        g = parseInt(hex.substring(2, 4), 16) || 0;
        b = parseInt(hex.substring(4, 6), 16) || 0;
      }
      const lum = (0.299 * r + 0.587 * g + 0.114 * b);
      return lum > 175;
    }
    return false;
  }

  // =========================================================
  // 1. SMART GUIDES MAGNÉTICAS (ALINEACIÓN INTELIGENTE)
  // =========================================================
  calculateSmartGuides(movingItem, tentativeDx, tentativeDy) {
    if (!this.smartGuidesEnabled || movingItem.type === 'pen' || movingItem.type === 'connector') {
      return { dx: tentativeDx, dy: tentativeDy, guides: [] };
    }

    const curX = movingItem.x + tentativeDx;
    const curY = movingItem.y + tentativeDy;
    const curW = movingItem.width || 100;
    const curH = movingItem.height || 100;
    const curMidX = curX + curW / 2;
    const curMidY = curY + curH / 2;

    const snapDist = Math.max(5, 7 / this.camera.zoom);
    let bestSnapX = null;
    let bestDistX = Infinity;
    let guideX = null;

    let bestSnapY = null;
    let bestDistY = Infinity;
    let guideY = null;

    // Comparar contra otros elementos cercanos
    for (const other of this.items) {
      if (this.selectedItemIds.has(other.id) || other.type === 'pen' || other.type === 'connector' || other.type === 'frame') continue;
      const ox = other.x;
      const oy = other.y;
      const ow = other.width || 100;
      const oh = other.height || 100;
      const oMidX = ox + ow / 2;
      const oMidY = oy + oh / 2;

      // Alineación vertical (eje X)
      const xChecks = [
        { cur: curX, target: ox, offset: 0 },
        { cur: curX, target: ox + ow, offset: 0 },
        { cur: curMidX, target: oMidX, offset: curW / 2 },
        { cur: curX + curW, target: ox, offset: curW },
        { cur: curX + curW, target: ox + ow, offset: curW }
      ];

      for (const chk of xChecks) {
        const d = Math.abs(chk.cur - chk.target);
        if (d < snapDist && d < bestDistX) {
          bestDistX = d;
          bestSnapX = chk.target - chk.offset - movingItem.x;
          guideX = {
            type: 'v',
            x: chk.target,
            y1: Math.min(curY, oy) - 20,
            y2: Math.max(curY + curH, oy + oh) + 20
          };
        }
      }

      // Alineación horizontal (eje Y)
      const yChecks = [
        { cur: curY, target: oy, offset: 0 },
        { cur: curY, target: oy + oh, offset: 0 },
        { cur: curMidY, target: oMidY, offset: curH / 2 },
        { cur: curY + curH, target: oy, offset: curH },
        { cur: curY + curH, target: oy + oh, offset: curH }
      ];

      for (const chk of yChecks) {
        const d = Math.abs(chk.cur - chk.target);
        if (d < snapDist && d < bestDistY) {
          bestDistY = d;
          bestSnapY = chk.target - chk.offset - movingItem.y;
          guideY = {
            type: 'h',
            y: chk.target,
            x1: Math.min(curX, ox) - 20,
            x2: Math.max(curX + curW, ox + ow) + 20
          };
        }
      }
    }

    const finalDx = bestSnapX !== null ? bestSnapX : tentativeDx;
    const finalDy = bestSnapY !== null ? bestSnapY : tentativeDy;
    const guides = [];
    if (guideX) guides.push(guideX);
    if (guideY) guides.push(guideY);

    return { dx: finalDx, dy: finalDy, guides };
  }

  // =========================================================
  // 2. MINI-MAPA INTERACTIVO (RADAR DE NAVEGACIÓN)
  // =========================================================
  renderMinimap(miniCanvas) {
    if (!miniCanvas) return;
    const mctx = miniCanvas.getContext('2d');
    const mw = miniCanvas.width;
    const mh = miniCanvas.height;

    mctx.clearRect(0, 0, mw, mh);
    mctx.fillStyle = this.isDarkMode ? '#181b20' : '#f8f9fa';
    mctx.fillRect(0, 0, mw, mh);

    if (this.items.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    this.items.forEach(it => {
      const x = it.x || 0;
      const y = it.y || 0;
      const w = it.width || 40;
      const h = it.height || 40;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    });

    const pad = 350;
    minX -= pad; minY -= pad; maxX += pad; maxY += pad;
    const totalW = Math.max(500, maxX - minX);
    const totalH = Math.max(500, maxY - minY);

    const scale = Math.min(mw / totalW, mh / totalH);
    const offsetX = (mw - totalW * scale) / 2;
    const offsetY = (mh - totalH * scale) / 2;

    this.minimapBounds = { minX, minY, totalW, totalH, scale, offsetX, offsetY };

    // Dibujar elementos en miniatura
    this.items.forEach(it => {
      const ix = offsetX + ((it.x || 0) - minX) * scale;
      const iy = offsetY + ((it.y || 0) - minY) * scale;
      const iw = Math.max(1.5, (it.width || 20) * scale);
      const ih = Math.max(1.5, (it.height || 20) * scale);

      if (it.type === 'frame') {
        mctx.fillStyle = this.isDarkMode ? '#23262d' : (it.fillColor || '#cbd5e1');
        mctx.fillRect(ix, iy, iw, ih);
        mctx.strokeStyle = this.isDarkMode ? '#333842' : '#94a3b8';
        mctx.lineWidth = 0.5;
        mctx.strokeRect(ix, iy, iw, ih);
      } else if (it.type === 'code') {
        mctx.fillStyle = '#334155';
        mctx.fillRect(ix, iy, iw, ih);
      } else if (it.type === 'embed' || it.type === 'image') {
        mctx.fillStyle = '#60a5fa';
        mctx.fillRect(ix, iy, iw, ih);
      } else if (it.type === 'comment') {
        mctx.fillStyle = it.resolved ? '#10b981' : '#f59e0b';
        mctx.beginPath();
        mctx.arc(ix, iy, 2.5, 0, Math.PI * 2);
        mctx.fill();
      } else {
        mctx.fillStyle = it.fillColor && it.fillColor !== 'transparent' ? it.fillColor : (it.color || '#94a3b8');
        mctx.fillRect(ix, iy, iw, ih);
      }
    });

    // Rectángulo del visor actual de la cámara
    const viewTopLeft = this.screenToWorld(0, 0);
    const viewBottomRight = this.screenToWorld(this.width, this.height);

    const vx = offsetX + (viewTopLeft.x - minX) * scale;
    const vy = offsetY + (viewTopLeft.y - minY) * scale;
    const vw = Math.max(8, (viewBottomRight.x - viewTopLeft.x) * scale);
    const vh = Math.max(8, (viewBottomRight.y - viewTopLeft.y) * scale);

    mctx.fillStyle = 'rgba(66, 98, 255, 0.12)';
    mctx.strokeStyle = '#4262ff';
    mctx.lineWidth = 1.5;
    mctx.fillRect(vx, vy, vw, vh);
    mctx.strokeRect(vx, vy, vw, vh);
  }

  panFromMinimap(miniX, miniY) {
    if (!this.minimapBounds) return;
    const { minX, minY, scale, offsetX, offsetY } = this.minimapBounds;
    const targetWx = minX + (miniX - offsetX) / scale;
    const targetWy = minY + (miniY - offsetY) / scale;

    this.camera.x = -targetWx;
    this.camera.y = -targetWy;
    this.render();
    if (this.onCameraChange) this.onCameraChange();
  }

  resolveImageSrc(src) {
    if (!src) return src;
    if (typeof window !== 'undefined' && typeof window.resolveImageSrc === 'function') {
      return window.resolveImageSrc(src);
    }
    return src;
  }

  // =========================================================
  // 3. EXPORTACIÓN EN ALTA RESOLUCIÓN (PNG / JPEG)
  // =========================================================
  async preloadImages(items) {
    const promises = [];
    items.forEach(it => {
      const src = it.src || (it.imgElement && it.imgElement.src);
      if ((it.type === 'image' || it.type === 'embed' || it.type === 'preview') && src) {
        if (!it.imgElement || typeof it.imgElement.getAttribute !== 'function' || !it.imgElement.complete || it.imgElement.naturalWidth === 0) {
          promises.push(new Promise((resolve) => {
            if (!it.imgElement || typeof it.imgElement.getAttribute !== 'function') {
              it.imgElement = new Image();
              it.imgElement.setAttribute('data-src', src);
              it.imgElement.src = this.resolveImageSrc(src);
            }
            if (it.imgElement.complete && it.imgElement.naturalWidth > 0) {
              resolve();
            } else {
              const timer = setTimeout(resolve, 1500);
              it.imgElement.onload = () => { clearTimeout(timer); resolve(); };
              it.imgElement.onerror = () => { clearTimeout(timer); resolve(); };
            }
          }));
        }
      }
    });
    if (promises.length > 0) {
      await Promise.all(promises);
    }
  }

  async exportBoardImage({
    bounds = null,
    selectionOnly = false,
    scale = 2,
    backgroundColor = null,
    format = 'image/png',
    quality = 0.95
  } = {}) {
    let targets = [];
    if (selectionOnly) {
      targets = this.items.filter(it => this.selectedItemIds.has(it.id));
      if (targets.length === 0) {
        return { error: 'No hay elementos seleccionados para exportar' };
      }
    } else {
      targets = this.items;
      if (targets.length === 0) {
        return { error: 'El tablero no contiene elementos para exportar' };
      }
    }

    // Pre-cargar imágenes pendientes
    try {
      await this.preloadImages(targets);
    } catch (e) {
      console.warn('Error al precargar imágenes:', e);
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    if (bounds) {
      minX = bounds.x;
      minY = bounds.y;
      maxX = bounds.x + bounds.width;
      maxY = bounds.y + bounds.height;
    } else {
      targets.forEach(it => {
        if (it.type === 'connector') {
          if (it.start && typeof it.start.x === 'number' && typeof it.start.y === 'number') {
            minX = Math.min(minX, it.start.x); maxX = Math.max(maxX, it.start.x);
            minY = Math.min(minY, it.start.y); maxY = Math.max(maxY, it.start.y);
          }
          if (it.end && typeof it.end.x === 'number' && typeof it.end.y === 'number') {
            minX = Math.min(minX, it.end.x); maxX = Math.max(maxX, it.end.x);
            minY = Math.min(minY, it.end.y); maxY = Math.max(maxY, it.end.y);
          }
          return;
        }
        if (it.type === 'pen' && it.points && it.points.length > 0) {
          for (const pt of it.points) {
            minX = Math.min(minX, pt.x); maxX = Math.max(maxX, pt.x);
            minY = Math.min(minY, pt.y); maxY = Math.max(maxY, pt.y);
          }
          return;
        }
        if (it.type === 'frame') {
          const fx = it.x || 0;
          const fy = it.y || 0;
          const fw = it.width || 200;
          const fh = it.height || 200;
          minX = Math.min(minX, fx);
          maxX = Math.max(maxX, fx + fw);
          minY = Math.min(minY, fy - 32); // pestaña de cabecera
          maxY = Math.max(maxY, fy + fh);
          return;
        }
        const x = it.x;
        const y = it.y;
        const w = it.width || 50;
        const h = it.height || 50;
        if (typeof x === 'number' && !isNaN(x) && typeof y === 'number' && !isNaN(y)) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x + w);
          maxY = Math.max(maxY, y + h);
        }
      });
      const pad = 50;
      minX -= pad; minY -= pad; maxX += pad; maxY += pad;
    }

    if (!isFinite(minX) || !isFinite(maxX) || !isFinite(minY) || !isFinite(maxY)) {
      return { error: 'No se pudieron calcular las dimensiones del área a exportar' };
    }

    const worldW = Math.max(100, Math.round(maxX - minX));
    const worldH = Math.max(100, Math.round(maxY - minY));

    // Límite de seguridad para evitar superar el máximo del canvas en GPU (8192px)
    const maxDimension = 8192;
    let safeScale = scale;
    if (worldW * safeScale > maxDimension || worldH * safeScale > maxDimension) {
      safeScale = Math.min(maxDimension / worldW, maxDimension / worldH);
    }
    safeScale = Math.max(0.1, safeScale);

    const canvasW = Math.round(worldW * safeScale);
    const canvasH = Math.round(worldH * safeScale);

    const offCanvas = document.createElement('canvas');
    offCanvas.width = canvasW;
    offCanvas.height = canvasH;
    const offCtx = offCanvas.getContext('2d');

    // Fondo según opción seleccionada
    const isJpeg = (format === 'image/jpeg');
    if (isJpeg) {
      if (backgroundColor && backgroundColor !== 'transparent' && backgroundColor !== 'board') {
        offCtx.fillStyle = backgroundColor;
      } else {
        offCtx.fillStyle = this.isDarkMode ? '#0f1316' : '#ffffff';
      }
      offCtx.fillRect(0, 0, canvasW, canvasH);
    } else if (backgroundColor === 'transparent') {
      // Transparente para PNG: no rellenar fondo
    } else if (backgroundColor && backgroundColor !== 'board') {
      offCtx.fillStyle = backgroundColor;
      offCtx.fillRect(0, 0, canvasW, canvasH);
    } else {
      // Fondo nativo del tablero
      offCtx.fillStyle = this.isDarkMode ? '#0f1316' : '#f8f9fa';
      offCtx.fillRect(0, 0, canvasW, canvasH);
    }

    // Configurar matriz de transformación
    offCtx.setTransform(safeScale, 0, 0, safeScale, -minX * safeScale, -minY * safeScale);

    const origCtx = this.ctx;
    const origZoom = this.camera.zoom;
    this.ctx = offCtx;
    this.camera.zoom = 1;

    const targetSet = new Set(targets.map(t => t.id));
    const isTarget = (it) => targetSet.has(it.id);

    try {
      this.items.filter(it => it.type === 'frame' && isTarget(it)).forEach(it => {
        try { this.drawFrame(it); } catch (e) { console.error(e); }
      });
      this.items.filter(it => it.type === 'connector' && isTarget(it)).forEach(it => {
        try { this.drawConnector(it); } catch (e) { console.error(e); }
      });
      this.items.filter(it => it.type === 'shape' && isTarget(it)).forEach(it => {
        try { this.drawShape(it); } catch (e) { console.error(e); }
      });
      this.items.filter(it => it.type === 'code' && isTarget(it)).forEach(it => {
        try { this.drawCodeBlock(it); } catch (e) { console.error(e); }
      });
      this.items.filter(it => (it.type === 'embed' || it.type === 'preview') && isTarget(it)).forEach(it => {
        try { this.drawEmbed(it); } catch (e) { console.error(e); }
      });
      this.items.filter(it => it.type === 'image' && isTarget(it)).forEach(it => {
        try { this.drawImage(it); } catch (e) { console.error(e); }
      });
      this.items.filter(it => it.type === 'sticky_note' && isTarget(it)).forEach(it => {
        try { this.drawStickyNote(it); } catch (e) { console.error(e); }
      });
      this.items.filter(it => it.type === 'text' && it.fillColor && it.fillColor !== 'transparent' && isTarget(it)).forEach(it => {
        try { this.drawText(it); } catch (e) { console.error(e); }
      });
      this.items.filter(it => it.type === 'text' && (!it.fillColor || it.fillColor === 'transparent') && isTarget(it)).forEach(it => {
        try { this.drawText(it); } catch (e) { console.error(e); }
      });
      this.items.filter(it => it.type === 'pen' && isTarget(it)).forEach(it => {
        try { this.drawPen(it); } catch (e) { console.error(e); }
      });
      this.items.filter(it => it.type === 'comment' && isTarget(it)).forEach(it => {
        try { this.drawComment(it); } catch (e) { console.error(e); }
      });
    } finally {
      this.ctx = origCtx;
      this.camera.zoom = origZoom;
    }

    try {
      const mime = isJpeg ? 'image/jpeg' : 'image/png';
      const dataUrl = offCanvas.toDataURL(mime, quality);
      return {
        success: true,
        dataUrl,
        width: canvasW,
        height: canvasH,
        scale: safeScale,
        format: isJpeg ? 'jpeg' : 'png'
      };
    } catch (err) {
      console.error('Error al generar DataURL del canvas:', err);
      return { error: 'Error de lienzo al generar la imagen: ' + (err?.message || String(err)) };
    }
  }

  async exportHiRes({ bounds = null, scale = 2, filename = 'tablero_4k.png' } = {}) {
    const res = await this.exportBoardImage({ bounds, scale, filename, format: 'image/png' });
    if (res.error) {
      console.error(res.error);
      return false;
    }
    if (window.brainBoard && typeof window.brainBoard.exportImage === 'function') {
      await window.brainBoard.exportImage({
        defaultFilename: filename,
        dataUrl: res.dataUrl
      });
    } else {
      const a = document.createElement('a');
      a.href = res.dataUrl;
      a.download = filename;
      a.click();
    }
    return true;
  }

  bindEvents() {
    window.addEventListener('resize', () => {
      this.initCanvasSize();
      this.render();
      if (this.onCameraChange) this.onCameraChange();
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.clearHoverDateTooltip();
      // Zoom directo con rueda centrado en el cursor
      const factor = e.deltaY < 0 ? 1.12 : 0.88;
      this.zoomAt(e.clientX, e.clientY, factor);
    }, { passive: false });

    this.canvas.addEventListener('pointerleave', () => {
      this.clearHoverDateTooltip();
    });

    // Soporte para desplazar (pan) manteniendo la barra espaciadora pulsada
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        this.isSpacePressed = true;
        if (!this.isPanning) this.canvas.style.cursor = 'grab';
      }
      if (e.key === 'Control' || e.key === 'Meta') {
        if (this.isDraggingItem && this.activeGuides.length > 0) {
          this.activeGuides = [];
          this.render();
        }
      }
      if ((e.key === 'Control' || e.key === 'Meta') && !e.shiftKey && this.activeTool === 'select' && !this.isDraggingItem && !this.isPanning && !this.isSelectingMarquee) {
        if (this.hoveredConnectorPort) {
          this.hoveredConnectorPort = null;
          this.render();
        }
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.isSpacePressed = false;
        if (!this.isPanning) this.canvas.style.cursor = this.activeTool === 'hand' ? 'grab' : 'default';
      }
    });

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener('auxclick', (e) => e.preventDefault());
    this.canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    window.addEventListener('pointermove', (e) => this.onPointerMove(e));
    window.addEventListener('pointerup', (e) => this.onPointerUp(e));
  }

  onPointerDown(e) {
    this.clearHoverDateTooltip();
    if (this.onEditingFinish) {
      this.onEditingFinish();
    }

    const world = this.screenToWorld(e.clientX, e.clientY);
    this.lastPointerWorld = world;
    this.lastPointerScreen = { x: e.clientX, y: e.clientY };

    // =========================================================
    // CLIC CENTRAL (Rueda del ratón, e.button === 1):
    // Siempre hace Pan (desplazarse por el lienzo), nunca duplica elementos.
    // =========================================================
    if (e.button === 1) {
      e.preventDefault();
      this.isPanning = true;
      this.panStart = { x: e.clientX, y: e.clientY };
      this.canvas.style.cursor = 'grabbing';
      return;
    }

    // Clic derecho, herramienta mano o barra espaciadora = Pan
    if (e.button === 2 || this.activeTool === 'hand' || this.isSpacePressed) {
      this.isPanning = true;
      this.panStart = { x: e.clientX, y: e.clientY };
      this.canvas.style.cursor = 'grabbing';
      return;
    }

    // Herramienta Dev: Selección cuadrada de coordenadas para la IA
    if (this.activeTool === 'dev_coords') {
      this.isSelectingDevCoords = true;
      this.devCoordsBox = { startX: world.x, startY: world.y, currentX: world.x, currentY: world.y };
      this.canvas.style.cursor = 'crosshair';
      this.render();
      return;
    }

    if (this.activeTool === 'select') {
      const isCtrl = (e.ctrlKey || e.metaKey) && !e.shiftKey;

      if (isCtrl) {
        // Modo Deselección (Estilo Autodesk Maya: Ctrl + Clic deselecciona, Ctrl + Área deselecciona elementos en recuadro)
        const clickedItem = this.getItemAt(world.x, world.y, true);
        let targetItem = clickedItem;
        if (!targetItem) {
          const frameUnder = this.getItemAt(world.x, world.y, false);
          if (frameUnder && frameUnder.type === 'frame') {
            const isFrameSelected = this.selectedItemIds.has(frameUnder.id);
            const onHeaderOrBorder = this.isPointOnFrameHeaderOrBorder(frameUnder, world.x, world.y);
            if (isFrameSelected || onHeaderOrBorder) {
              targetItem = frameUnder;
            }
          }
        }

        // Si se hizo clic sobre un elemento o marco seleccionado, deseleccionarlo de inmediato
        if (targetItem && this.selectedItemIds.has(targetItem.id)) {
          this.selectedItemIds.delete(targetItem.id);
          if (this.onSelectionChange) this.onSelectionChange(Array.from(this.selectedItemIds));
        }

        // Iniciar recuadro de deselección por área (Marquee Deselect)
        this.isSelectingMarquee = true;
        this.isMarqueeDeselect = true;
        this.marqueeBox = { startX: world.x, startY: world.y, currentX: world.x, currentY: world.y };
        this.marqueeInitialSelection = new Set(this.selectedItemIds);
        this.dragStartScreen = { x: e.clientX, y: e.clientY };
        this.potentialFrameClick = null;
        this.render();
        return;
      }

      // 1. Comprobar primero si se ha pulsado en un controlador circular de conexión (Connector Port)
      const portHit = this.getConnectorPortAt(world.x, world.y);
      if (portHit) {
        this.saveSnapshot();
        this.isConnectingFromPort = true;
        this.connectorStartItem = portHit.item;
        this.connectorStartPort = portHit.port;
        const nowIso = new Date().toISOString();
        this.activeConnector = {
          id: Date.now().toString(),
          type: 'connector',
          createdAt: nowIso,
          updatedAt: nowIso,
          start: {
            x: portHit.port.x,
            y: portHit.port.y,
            item: portHit.item.id,
            snapTo: portHit.port.name,
            position: portHit.port.position
          },
          end: {
            x: world.x,
            y: world.y
          },
          color: '#333333',
          strokeWidth: 2
        };
        this.items.push(this.activeConnector);
        this.render();
        return;
      }

      // 2. Comprobar si se ha pulsado en un controlador de redimensionamiento (esquinas o ejes)
      const handleHit = this.getResizeHandleAt(world.x, world.y);
      if (handleHit) {
        this.saveSnapshot();
        this.isResizing = true;
        this.activeResizeHandle = handleHit.handle;
        this.resizeTargetItem = handleHit.item;
        this.resizeInitialBounds = {
          x: handleHit.item.x,
          y: handleHit.item.y,
          width: handleHit.item.width || 100,
          height: handleHit.item.height || 100,
          aspectRatio: (handleHit.item.width || 100) / (handleHit.item.height || 100)
        };
        this.resizeStartWorld = { x: world.x, y: world.y };
        return;
      }

      // Soporte Alt + Clic izquierdo: Duplicar elemento(s) al instante y permitir arrastre
      if (e.altKey && !e.ctrlKey) {
        let target = this.getItemAt(world.x, world.y, true);
        if (!target) {
          target = this.getItemAt(world.x, world.y, false);
        }
        if (target) {
          if (!this.selectedItemIds.has(target.id)) {
            this.selectedItemIds.clear();
            this.selectedItemIds.add(target.id);
          }
        }
        if (this.selectedItemIds.size > 0) {
          const itemsToDuplicateIds = new Set(this.selectedItemIds);
          this.items.forEach(it => {
            if (this.selectedItemIds.has(it.id) && it.type === 'frame') {
              const frame = it;
              this.items.forEach(child => {
                if (child.id !== frame.id && (child.parentId === frame.id || this.isItemInsideFrame(child, frame))) {
                  itemsToDuplicateIds.add(child.id);
                }
              });
            }
          });

          const idMap = new Map();
          const newItems = [];
          const nowIso = new Date().toISOString();
          this.items.forEach(it => {
            if (itemsToDuplicateIds.has(it.id)) {
              const copy = JSON.parse(JSON.stringify(it));
              copy.id = it.type + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
              copy.createdAt = nowIso;
              copy.updatedAt = nowIso;
              if (typeof it.zIndex === 'number') copy.zIndex = it.zIndex + 1;
              idMap.set(it.id, copy.id);
              newItems.push(copy);
            }
          });

          newItems.forEach(copy => {
            if (copy.parentId && idMap.has(copy.parentId)) {
              copy.parentId = idMap.get(copy.parentId);
            }
            if (copy.type === 'connector') {
              if (copy.start?.item && idMap.has(copy.start.item)) copy.start.item = idMap.get(copy.start.item);
              if (copy.end?.item && idMap.has(copy.end.item)) copy.end.item = idMap.get(copy.end.item);
            }
          });

          this.saveSnapshot();
          this.items.push(...newItems);
          this.selectedItemIds.clear();
          newItems.forEach(copy => this.selectedItemIds.add(copy.id));

          if (this.onSelectionChange) this.onSelectionChange(Array.from(this.selectedItemIds));

          this.isDraggingItem = true;
          this.isAltDragDuplicate = true;
          this.dragStart = { x: world.x, y: world.y };
          this.dragStartScreen = { x: e.clientX, y: e.clientY };
          this.hasMovedItem = false;
          this.canvas.style.cursor = 'move';
          this.render();
          return;
        }
      }

      // 1. Buscar elementos regulares interactivos (excluyendo frames contenedores)
      const clickedItem = this.getItemAt(world.x, world.y, true);

      if (clickedItem) {
        // Si el elemento es un comentario, abrir popover de comentario
        if (clickedItem.type === 'comment') {
          if (this.onCommentClick) {
            this.onCommentClick(clickedItem, e.clientX, e.clientY);
          }
          this.selectedItemIds.clear();
          this.selectedItemIds.add(clickedItem.id);
          this.render();
          return;
        }

        // Si el elemento es una carta de enlace (embed/preview) y se pulsa el botón ↗ de abrir exterior
        if ((clickedItem.type === 'embed' || clickedItem.type === 'preview') && clickedItem.url) {
          const btnX = clickedItem.x + clickedItem.width - 36;
          const btnY = clickedItem.y + 12;
          const dBtn = Math.hypot(world.x - (btnX + 12), world.y - (btnY + 12));
          if (dBtn <= 16) {
            this.openExternalUrl(clickedItem.url);
            return;
          }
        }

        // Si se pulsa con Ctrl / Cmd (sin Shift) sobre cualquier elemento que posea URL, abrir enlace directamente
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
          const itemUrl = this.extractUrlFromItem(clickedItem);
          if (itemUrl) {
            this.openExternalUrl(itemUrl);
            return;
          }
        }

        if (!e.shiftKey) {
          if (!this.selectedItemIds.has(clickedItem.id)) {
            this.selectedItemIds.clear();
            this.selectedItemIds.add(clickedItem.id);
          }
        } else if (e.ctrlKey || e.metaKey) {
          // Estilo Maya: Ctrl + Shift añade directamente a la selección
          this.selectedItemIds.add(clickedItem.id);
        } else {
          if (this.selectedItemIds.has(clickedItem.id)) {
            this.selectedItemIds.delete(clickedItem.id);
          } else {
            this.selectedItemIds.add(clickedItem.id);
          }
        }
        this.isDraggingItem = true;
        this.dragStart = { x: world.x, y: world.y };
        this.dragStartScreen = { x: e.clientX, y: e.clientY };
        this.hasMovedItem = false;
        if (this.onSelectionChange) this.onSelectionChange(Array.from(this.selectedItemIds));
        this.render();
        return;
      }

      // 2. Si no se pulsó ningún elemento regular, comprobar si hay un frame (marco contenedor)
      const frameUnder = this.getItemAt(world.x, world.y, false);
      if (frameUnder && frameUnder.type === 'frame') {
        const isFrameSelected = this.selectedItemIds.has(frameUnder.id);
        const onHeader = this.isPointOnFrameHeader(frameUnder, world.x, world.y);
        const onHeaderOrBorder = this.isPointOnFrameHeaderOrBorder(frameUnder, world.x, world.y);

        if (onHeader) {
          this.potentialFrameHeaderClick = frameUnder;
        } else {
          this.potentialFrameHeaderClick = null;
        }

        if (isFrameSelected || onHeaderOrBorder) {
          // El usuario clickeó deliberadamente la cabecera, borde o un marco ya seleccionado
          if (!e.shiftKey) {
            if (!isFrameSelected) {
              this.selectedItemIds.clear();
              this.selectedItemIds.add(frameUnder.id);
            }
          } else if (e.ctrlKey || e.metaKey) {
            // Estilo Maya: Ctrl + Shift añade directamente a la selección
            this.selectedItemIds.add(frameUnder.id);
          } else {
            if (isFrameSelected) {
              this.selectedItemIds.delete(frameUnder.id);
            } else {
              this.selectedItemIds.add(frameUnder.id);
            }
          }
          this.isDraggingItem = true;
          this.dragStart = { x: world.x, y: world.y };
          this.dragStartScreen = { x: e.clientX, y: e.clientY };
          this.hasMovedItem = false;
          if (this.onSelectionChange) this.onSelectionChange(Array.from(this.selectedItemIds));
          this.render();
          return;
        }

        // Clic en el área vacía interior de un marco NO seleccionado:
        // Inicia selección por recuadro (Marquee) para seleccionar lo que haya dentro.
        // Si no se arrastra (clic simple < 4px), se seleccionará el marco al soltar el puntero.
        this.potentialFrameClick = frameUnder;
      } else {
        this.potentialFrameClick = null;
      }

      // 3. Iniciar selección por recuadro (Marquee)
      this.isSelectingMarquee = true;
      this.marqueeBox = { startX: world.x, startY: world.y, currentX: world.x, currentY: world.y };
      this.marqueeInitialSelection = e.shiftKey ? new Set(this.selectedItemIds) : new Set();
      if (!e.shiftKey) {
        this.selectedItemIds.clear();
        if (this.onSelectionChange) this.onSelectionChange([]);
      }
      this.render();
      return;
    }

    if (this.activeTool === 'sticky_note') {
      this.saveSnapshot();
      const nowIso = new Date().toISOString();
      const newNote = {
        id: 'note_' + Date.now(),
        type: 'sticky_note',
        createdAt: nowIso,
        updatedAt: nowIso,
        x: world.x - 90,
        y: world.y - 90,
        width: 180,
        height: 180,
        text: 'Nota adhesiva',
        color: this.activeColor
      };
      this.items.push(newNote);
      this.selectedItemIds.clear();
      this.selectedItemIds.add(newNote.id);
      this.activeTool = 'select';
      if (this.onSelectionChange) this.onSelectionChange([newNote.id]);
      if (this.onBoardModified) this.onBoardModified();
      this.render();
      return;
    }

    if (this.activeTool === 'shape') {
      this.saveSnapshot();
      const nowIso = new Date().toISOString();
      const newShape = {
        id: 'shape_' + Date.now(),
        type: 'shape',
        createdAt: nowIso,
        updatedAt: nowIso,
        shape: this.selectedShapeType,
        x: world.x - 80,
        y: world.y - 50,
        width: 160,
        height: 100,
        text: '',
        fillColor: '#ffffff',
        strokeColor: '#1a1a1a',
        strokeWidth: 2
      };
      this.items.push(newShape);
      this.selectedItemIds.clear();
      this.selectedItemIds.add(newShape.id);
      this.activeTool = 'select';
      if (this.onSelectionChange) this.onSelectionChange([newShape.id]);
      if (this.onBoardModified) this.onBoardModified();
      this.render();
      return;
    }

    if (this.activeTool === 'text') {
      this.saveSnapshot();
      const nowIso = new Date().toISOString();
      const newText = {
        id: 'text_' + Date.now(),
        type: 'text',
        createdAt: nowIso,
        updatedAt: nowIso,
        x: world.x,
        y: world.y,
        width: 160,
        height: 40,
        text: 'Escribe algo...',
        fontSize: 22,
        color: '#1a1a1a'
      };
      this.items.push(newText);
      this.selectedItemIds.clear();
      this.selectedItemIds.add(newText.id);
      this.activeTool = 'select';
      if (this.onSelectionChange) this.onSelectionChange([newText.id]);
      if (this.onBoardModified) this.onBoardModified();
      this.render();
      return;
    }

    if (this.activeTool === 'pen') {
      this.saveSnapshot();
      const nowIso = new Date().toISOString();
      this.currentDrawing = {
        id: 'pen_' + Date.now(),
        type: 'pen',
        createdAt: nowIso,
        updatedAt: nowIso,
        points: [{ x: world.x, y: world.y }],
        color: this.activeColor === '#fff9b0' ? '#1a1a1a' : this.activeColor,
        strokeWidth: 3
      };
      this.items.push(this.currentDrawing);
      this.render();
      return;
    }

    if (this.activeTool === 'connector') {
      this.saveSnapshot();
      const nowIso = new Date().toISOString();
      this.activeConnector = {
        id: 'conn_' + Date.now(),
        type: 'connector',
        createdAt: nowIso,
        updatedAt: nowIso,
        start: { x: world.x, y: world.y },
        end: { x: world.x, y: world.y },
        color: '#1a1a1a',
        strokeWidth: 2
      };
      this.items.push(this.activeConnector);
      this.render();
      return;
    }

    if (this.activeTool === 'frame') {
      this.saveSnapshot();
      const nowIso = new Date().toISOString();
      const newFrame = {
        id: 'frame_' + Date.now(),
        type: 'frame',
        createdAt: nowIso,
        updatedAt: nowIso,
        x: world.x - 200,
        y: world.y - 150,
        width: 400,
        height: 300,
        title: 'Marco 1'
      };
      this.items.unshift(newFrame); // Los marcos van al fondo
      this.selectedItemIds.clear();
      this.selectedItemIds.add(newFrame.id);
      this.activeTool = 'select';
      if (this.onSelectionChange) this.onSelectionChange([newFrame.id]);
      if (this.onBoardModified) this.onBoardModified();
      this.render();
      return;
    }

    if (this.activeTool === 'comment') {
      this.saveSnapshot();
      const nowIso = new Date().toISOString();
      const newComment = {
        id: 'comment_' + Date.now(),
        type: 'comment',
        createdAt: nowIso,
        updatedAt: nowIso,
        x: world.x,
        y: world.y,
        text: '',
        author: 'Usuario',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        resolved: false
      };
      this.items.push(newComment);
      this.selectedItemIds.clear();
      this.selectedItemIds.add(newComment.id);
      this.activeTool = 'select';
      if (this.onCommentCreated) {
        this.onCommentCreated(newComment, e.clientX, e.clientY);
      }
      if (this.onBoardModified) this.onBoardModified();
      this.render();
      return;
    }

    if (this.activeTool === 'template') {
      this.saveSnapshot();
      const templateType = this.selectedTemplateType || 'apuntes';
      const createdIds = this.insertTemplateAt(world.x, world.y, templateType);
      this.activeTool = 'select';
      if (this.onSelectionChange) this.onSelectionChange(createdIds);
      if (this.onBoardModified) this.onBoardModified();
      this.render();
      return;
    }
  }

  insertTemplateAt(targetCenterX, targetCenterY, templateType = 'apuntes') {
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const currentMaxZ = this.items.reduce((max, it) => Math.max(max, typeof it.zIndex === 'number' ? it.zIndex : 10), 10);
    const createdItems = [];

    if (templateType === 'apuntes') {
      const frameW = 744;
      const frameH = 454;
      const frameX = Math.round(targetCenterX - frameW / 2);
      const frameY = Math.round(targetCenterY - frameH / 2);
      const frameId = 'frame_' + now + '_' + Math.random().toString(36).substr(2, 5);

      const frame = {
        id: frameId,
        type: 'frame',
        createdAt: nowIso,
        updatedAt: nowIso,
        x: frameX,
        y: frameY,
        width: frameW,
        height: frameH,
        title: 'Plantilla',
        zIndex: currentMaxZ + 1
      };

      const title = {
        id: 'text_' + now + '_' + Math.random().toString(36).substr(2, 5),
        type: 'text',
        createdAt: nowIso,
        updatedAt: nowIso,
        parentId: frameId,
        x: Math.round(frameX + 23),
        y: Math.round(frameY + 17),
        width: 694,
        height: 64,
        text: 'TITULO DEL APUNTE',
        fontSize: 48,
        color: '#eff3f7',
        textColor: '#eff3f7',
        fillColor: '#1a1a1a',
        isBold: true,
        zIndex: currentMaxZ + 2
      };

      const notes = {
        id: 'text_' + (now + 1) + '_' + Math.random().toString(36).substr(2, 5),
        type: 'text',
        createdAt: nowIso,
        updatedAt: nowIso,
        parentId: frameId,
        x: Math.round(frameX + 23),
        y: Math.round(frameY + 126),
        width: 365,
        height: 215,
        text: 'Texto de apuntes',
        fontSize: 24,
        color: this.isDarkMode ? '#eff3f7' : '#1a1a1a',
        textColor: this.isDarkMode ? '#eff3f7' : '#1a1a1a',
        isBold: false,
        zIndex: currentMaxZ + 3
      };

      createdItems.push(frame, title, notes);
    } else {
      createdItems.push(...this.buildCuratedTemplate(templateType, targetCenterX, targetCenterY, now, currentMaxZ));
    }

    // Insertar elementos creados en el motor
    this.items.push(...createdItems);
    this.selectedItemIds.clear();
    createdItems.forEach(it => this.selectedItemIds.add(it.id));
    return createdItems.map(it => it.id);
  }

  // Plantillas con el estilo curado de BoardInstructorAI.md (marco oscuro, cabecera y bloques de texto)
  buildCuratedTemplate(templateType, centerX, centerY, now, baseZ) {
    const nowIso = new Date(now).toISOString();
    const uid = (prefix, n) => `${prefix}_${now + n}_${Math.random().toString(36).substr(2, 5)}`;
    const items = [];
    let z = baseZ;

    const sizes = {
      recurso_apunte: { w: 820, h: 420, title: 'Recurso + apunte', header: 'NOMBRE DEL RECURSO' },
      galeria: { w: 1050, h: 600, title: 'Referencias', header: 'REFERENCIAS VISUALES' },
      comparativa: { w: 1110, h: 560, title: 'Comparativa', header: 'COMPARATIVA' }
    };
    const spec = sizes[templateType] || sizes.recurso_apunte;
    const fx = Math.round(centerX - spec.w / 2);
    const fy = Math.round(centerY - spec.h / 2);
    const frameId = uid('frame', 0);

    items.push({
      id: frameId, type: 'frame', createdAt: nowIso, updatedAt: nowIso,
      x: fx, y: fy, width: spec.w, height: spec.h,
      title: spec.title, fillColor: '#0f141d', zIndex: ++z
    });
    items.push({
      id: uid('text', 1), type: 'text', parentId: frameId, createdAt: nowIso, updatedAt: nowIso,
      x: fx + 30, y: fy + 24, width: spec.w - 60, height: 54,
      text: spec.header, fontSize: 22, isBold: true,
      color: '#f1f5f9', textColor: '#f1f5f9', fillColor: '#161b26', zIndex: ++z
    });

    if (templateType === 'galeria') {
      // 3 × 2 huecos: al pegar o arrastrar una imagen sobre un hueco, la imagen ocupa su lugar
      const cols = 3;
      const slotW = 310;
      const slotH = 210;
      const gapX = (spec.w - 60 - cols * slotW) / (cols - 1);
      for (let i = 0; i < 6; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        items.push({
          id: uid('shape', 2 + i), type: 'shape', shape: 'rectangle', parentId: frameId,
          createdAt: nowIso, updatedAt: nowIso,
          x: Math.round(fx + 30 + col * (slotW + gapX)), y: fy + 104 + row * (slotH + 24),
          width: slotW, height: slotH,
          text: 'Pega o arrastra una imagen aquí', fontSize: 14, isBold: false,
          fillColor: '#161b26', strokeColor: '#334155', strokeWidth: 1.5,
          color: '#94a3b8', textColor: '#94a3b8',
          isImagePlaceholder: true, zIndex: ++z
        });
      }
    } else if (templateType === 'comparativa') {
      const cols = 3;
      const colW = Math.round((spec.w - 60 - (cols - 1) * 24) / cols);
      ['OPCIÓN A', 'OPCIÓN B', 'OPCIÓN C'].forEach((label, i) => {
        const cx = fx + 30 + i * (colW + 24);
        items.push({
          id: uid('text', 2 + i * 2), type: 'text', parentId: frameId, createdAt: nowIso, updatedAt: nowIso,
          x: cx, y: fy + 104, width: colW, height: 46,
          text: label, fontSize: 18, isBold: true, textAlign: 'center',
          color: '#f1f5f9', textColor: '#f1f5f9', fillColor: '#1e2533', zIndex: ++z
        });
        items.push({
          id: uid('text', 3 + i * 2), type: 'text', parentId: frameId, createdAt: nowIso, updatedAt: nowIso,
          x: cx, y: fy + 164, width: colW, height: spec.h - 194,
          text: '• Ventajas:\n\n• Inconvenientes:\n\n• Precio / licencia:\n\n• Ideal para:',
          fontSize: 16, textAlign: 'left',
          color: '#e2e8f0', textColor: '#e2e8f0', fillColor: '#161b26', zIndex: ++z
        });
      });
    } else {
      // Recurso + apunte: tarjeta de enlace a la izquierda y nota técnica a la derecha
      items.push({
        id: uid('embed', 2), type: 'embed', parentId: frameId, createdAt: nowIso, updatedAt: nowIso,
        x: fx + 30, y: fy + 104, width: 330, height: 260,
        url: '', domain: 'ENLACE', title: 'Pega aquí el enlace', src: '',
        description: 'Selecciona la tarjeta y pulsa el botón de enlace (🔗) de la barra para añadir la URL',
        zIndex: ++z
      });
      items.push({
        id: uid('text', 3), type: 'text', parentId: frameId, createdAt: nowIso, updatedAt: nowIso,
        x: fx + 390, y: fy + 104, width: 395, height: 260,
        text: '• Qué es:\n\n• Workflow:\n\n• Integración en el pipeline:',
        fontSize: 16, textAlign: 'left',
        color: '#e2e8f0', textColor: '#e2e8f0', fillColor: '#161b26', zIndex: ++z
      });
    }
    return items;
  }

  onPointerMove(e) {
    if (this.isPanning) {
      const dx = e.clientX - this.panStart.x;
      const dy = e.clientY - this.panStart.y;
      this.camera.x += dx / this.camera.zoom;
      this.camera.y += dy / this.camera.zoom;
      this.panStart = { x: e.clientX, y: e.clientY };
      this.render();
      if (this.onCameraChange) this.onCameraChange();
      return;
    }

    const world = this.screenToWorld(e.clientX, e.clientY);
    this.lastPointerWorld = world;
    this.lastPointerScreen = { x: e.clientX, y: e.clientY };

    // 0. Arrastre de conector/flecha desde un puerto circular (Connector Drag)
    if (this.isConnectingFromPort && this.activeConnector) {
      this.canvas.style.cursor = 'crosshair';
      const snapTarget = this.findTargetSnapPort(world.x, world.y, this.connectorStartItem?.id);
      if (snapTarget) {
        this.activeConnector.end.x = snapTarget.port.x;
        this.activeConnector.end.y = snapTarget.port.y;
        this.hoveredSnapPort = snapTarget;
      } else {
        this.activeConnector.end.x = world.x;
        this.activeConnector.end.y = world.y;
        this.hoveredSnapPort = null;
      }
      this.render();
      return;
    }

    // 1. Redimensionamiento interactivo de elementos (esquinas o ejes)
    if (this.isResizing && this.resizeTargetItem) {
      const it = this.resizeTargetItem;
      const init = this.resizeInitialBounds;
      const dx = world.x - this.resizeStartWorld.x;
      const dy = world.y - this.resizeStartWorld.y;
      const handle = this.activeResizeHandle;
      const keepRatio = e.shiftKey || it.type === 'image';
      const minW = 24;
      const minH = 20;

      let newX = init.x;
      let newY = init.y;
      let newW = init.width;
      let newH = init.height;

      if (handle === 'se') {
        newW = Math.max(minW, init.width + dx);
        newH = keepRatio ? Math.max(minH, newW / init.aspectRatio) : Math.max(minH, init.height + dy);
      } else if (handle === 'sw') {
        newW = Math.max(minW, init.width - dx);
        newX = init.x + (init.width - newW);
        newH = keepRatio ? Math.max(minH, newW / init.aspectRatio) : Math.max(minH, init.height + dy);
      } else if (handle === 'ne') {
        newW = Math.max(minW, init.width + dx);
        newH = keepRatio ? Math.max(minH, newW / init.aspectRatio) : Math.max(minH, init.height - dy);
        newY = init.y + (init.height - newH);
      } else if (handle === 'nw') {
        newW = Math.max(minW, init.width - dx);
        newX = init.x + (init.width - newW);
        newH = keepRatio ? Math.max(minH, newW / init.aspectRatio) : Math.max(minH, init.height - dy);
        newY = init.y + (init.height - newH);
      } else if (handle === 'e') {
        newW = Math.max(minW, init.width + dx);
      } else if (handle === 'w') {
        newW = Math.max(minW, init.width - dx);
        newX = init.x + (init.width - newW);
      } else if (handle === 's') {
        newH = Math.max(minH, init.height + dy);
      } else if (handle === 'n') {
        newH = Math.max(minH, init.height - dy);
        newY = init.y + (init.height - newH);
      }

      it.x = newX;
      it.y = newY;
      it.width = Math.round(newW);
      it.height = Math.round(newH);

      // Actualizar extremos de flechas vinculadas al elemento redimensionado
      this.updateConnectedLinesForItem(it);

      this.render();
      if (this.onCameraChange) this.onCameraChange();
      return;
    }

    // 2. Arrastre de elementos (con soporte de arrastrar marcos y sus hijos)
    if (this.isDraggingItem) {
      if (!this.hasMovedItem) {
        const screenDist = Math.hypot(e.clientX - (this.dragStartScreen?.x ?? e.clientX), e.clientY - (this.dragStartScreen?.y ?? e.clientY));
        if (screenDist < 4) {
          return;
        }
        if (!this.isMiddleDragDuplicate && !this.isAltDragDuplicate) {
          this.saveSnapshot();
        }
        this.hasMovedItem = true;
      }
      const dx = world.x - this.dragStart.x;
      const dy = world.y - this.dragStart.y;

      let moveDx = dx;
      let moveDy = dy;

      // Smart Guides magnéticas si se arrastra un único elemento (desactivadas si se pulsa Ctrl)
      if (this.selectedItemIds.size === 1 && !e.ctrlKey) {
        const singleId = Array.from(this.selectedItemIds)[0];
        const singleItem = this.items.find(i => i.id === singleId);
        if (singleItem && singleItem.type !== 'pen' && singleItem.type !== 'connector') {
          const snap = this.calculateSmartGuides(singleItem, dx, dy);
          moveDx = snap.dx;
          moveDy = snap.dy;
          this.activeGuides = snap.guides;
        } else {
          this.activeGuides = [];
        }
      } else {
        this.activeGuides = [];
      }

      const moveItemIds = new Set(this.selectedItemIds);
      this.items.forEach(it => {
        if (this.selectedItemIds.has(it.id) && it.type === 'frame') {
          const frame = it;
          this.items.forEach(child => {
            if (child.id !== frame.id && (child.parentId === frame.id || this.isItemInsideFrame(child, frame))) {
              moveItemIds.add(child.id);
            }
          });
        }
      });

      this.items.forEach(it => {
        if (moveItemIds.has(it.id)) {
          if (it.type === 'pen') {
            it.points.forEach(p => { p.x += moveDx; p.y += moveDy; });
          } else if (it.type === 'connector') {
            it.start.x += moveDx; it.start.y += moveDy;
            it.end.x += moveDx; it.end.y += moveDy;
          } else {
            it.x += moveDx;
            it.y += moveDy;
            // Actualizar flechas conectadas
            this.updateConnectedLinesForItem(it);
          }
        }
      });
      this.dragStart = { x: this.dragStart.x + moveDx, y: this.dragStart.y + moveDy };
      this.render();
      if (this.onCameraChange) this.onCameraChange();
      return;
    }

    // 3. Hover sobre puertos de conexión y handles de redimensionamiento cuando se usa la herramienta select
    if (!this.isDraggingItem && !this.isPanning && !this.isSelectingMarquee && !this.isConnectingFromPort && this.activeTool === 'select') {
      const isCtrl = (e.ctrlKey || e.metaKey) && !e.shiftKey;
      if (isCtrl) {
        if (this.hoveredConnectorPort) {
          this.hoveredConnectorPort = null;
          this.render();
        }
        const itemUnder = this.getItemAt(world.x, world.y, true) || this.getItemAt(world.x, world.y, false);
        if (itemUnder && this.selectedItemIds.has(itemUnder.id)) {
          this.canvas.style.cursor = 'pointer';
        } else {
          this.canvas.style.cursor = 'crosshair';
        }
        return;
      }

      const portHit = this.getConnectorPortAt(world.x, world.y);
      if (portHit) {
        this.canvas.style.cursor = 'crosshair';
        this.hoveredConnectorPort = portHit;
        this.render();
        return;
      }
      if (this.hoveredConnectorPort) {
        this.hoveredConnectorPort = null;
        this.render();
      }

      const handleHit = this.getResizeHandleAt(world.x, world.y);
      if (handleHit) {
        this.canvas.style.cursor = handleHit.cursor;
        this.clearHoverDateTooltip();
      } else {
        const itemUnder = this.getItemAt(world.x, world.y, true);
        if (itemUnder) {
          this.canvas.style.cursor = 'move';
          this.scheduleHoverDateTooltip(itemUnder, e.clientX, e.clientY);
        } else {
          const frameUnder = this.getItemAt(world.x, world.y, false);
          if (frameUnder && frameUnder.type === 'frame' && (this.selectedItemIds.has(frameUnder.id) || this.isPointOnFrameHeaderOrBorder(frameUnder, world.x, world.y))) {
            this.canvas.style.cursor = 'move';
            this.scheduleHoverDateTooltip(frameUnder, e.clientX, e.clientY);
          } else {
            this.canvas.style.cursor = 'default';
            this.clearHoverDateTooltip();
          }
        }
      }
    } else {
      this.clearHoverDateTooltip();
    }

    if (this.activeTool === 'dev_coords') {
      this.canvas.style.cursor = 'crosshair';
    }

    if (this.isSelectingDevCoords && this.devCoordsBox) {
      this.devCoordsBox.currentX = world.x;
      this.devCoordsBox.currentY = world.y;
      this.render();
      return;
    }

    if (this.isSelectingMarquee && this.marqueeBox) {
      this.marqueeBox.currentX = world.x;
      this.marqueeBox.currentY = world.y;

      const dist = Math.hypot(world.x - this.marqueeBox.startX, world.y - this.marqueeBox.startY);
      if (dist > 4) {
        this.potentialFrameClick = null;
      }

      const minX = Math.min(this.marqueeBox.startX, this.marqueeBox.currentX);
      const maxX = Math.max(this.marqueeBox.startX, this.marqueeBox.currentX);
      const minY = Math.min(this.marqueeBox.startY, this.marqueeBox.currentY);
      const maxY = Math.max(this.marqueeBox.startY, this.marqueeBox.currentY);

      const newSelection = new Set(this.marqueeInitialSelection || []);
      this.items.forEach(it => {
        if (this.itemIntersectsBox(it, minX, minY, maxX, maxY)) {
          if (this.isMarqueeDeselect) {
            newSelection.delete(it.id);
          } else {
            newSelection.add(it.id);
          }
        }
      });
      this.selectedItemIds = newSelection;
      if (this.onSelectionChange) this.onSelectionChange(Array.from(this.selectedItemIds));
      this.render();
      return;
    }

    if (this.currentDrawing) {
      this.currentDrawing.points.push({ x: world.x, y: world.y });
      this.render();
      return;
    }

    if (this.activeConnector) {
      this.activeConnector.end = { x: world.x, y: world.y };
      this.render();
      return;
    }
  }

  onPointerUp(e) {
    if (this.isConnectingFromPort && this.activeConnector) {
      if (this.hoveredSnapPort) {
        this.activeConnector.end = {
          x: this.hoveredSnapPort.port.x,
          y: this.hoveredSnapPort.port.y,
          item: this.hoveredSnapPort.item.id,
          snapTo: this.hoveredSnapPort.port.name,
          position: this.hoveredSnapPort.port.position
        };
      }
      this.isConnectingFromPort = false;
      this.activeConnector = null;
      this.hoveredSnapPort = null;
      this.connectorStartItem = null;
      this.connectorStartPort = null;
      if (this.onBoardModified) this.onBoardModified();
      this.render();
      return;
    }

    if (this.isMiddleDragDuplicate || this.isAltDragDuplicate) {
      if (!this.hasMovedItem) {
        // Clic rápido sin arrastrar: desplazar +25, +25 para que no quede solapado exactamente encima
        this.items.forEach(it => {
          if (this.selectedItemIds.has(it.id)) {
            if (it.type === 'connector') {
              it.start.x += 25; it.start.y += 25;
              it.end.x += 25; it.end.y += 25;
            } else if (it.type === 'pen') {
              it.points.forEach(p => { p.x += 25; p.y += 25; });
            } else {
              it.x += 25;
              it.y += 25;
            }
          }
        });
      }
      this.isMiddleDragDuplicate = false;
      this.isAltDragDuplicate = false;
      this.isDraggingItem = false;
      this.hasMovedItem = false;
      this.dragStartScreen = null;
      this.activeGuides = [];
      this.canvas.style.cursor = this.activeTool === 'hand' ? 'grab' : 'default';
      if (this.onBoardModified) this.onBoardModified();
      this.render();
      return;
    }

    if (this.isPanning) {
      this.isPanning = false;
      this.canvas.style.cursor = this.activeTool === 'hand' ? 'grab' : 'default';
    }
    if (this.isResizing) {
      this.isResizing = false;
      this.activeResizeHandle = null;
      this.resizeTargetItem = null;
      if (this.onBoardModified) this.onBoardModified();
    }
    const wasMoved = this.hasMovedItem;
    if (this.hasMovedItem) {
      this.hasMovedItem = false;
      if (this.onBoardModified) this.onBoardModified();
    }
    this.isDraggingItem = false;
    this.dragStartScreen = null;
    this.activeGuides = [];

    this.potentialFrameHeaderClick = null;

    if (this.isSelectingDevCoords && this.devCoordsBox) {
      const minX = Math.round(Math.min(this.devCoordsBox.startX, this.devCoordsBox.currentX));
      const maxX = Math.round(Math.max(this.devCoordsBox.startX, this.devCoordsBox.currentX));
      const minY = Math.round(Math.min(this.devCoordsBox.startY, this.devCoordsBox.currentY));
      const maxY = Math.round(Math.max(this.devCoordsBox.startY, this.devCoordsBox.currentY));
      let width = maxX - minX;
      let height = maxY - minY;

      // Si fue solo un clic sin arrastrar, asignar tamaño por defecto 400x300 centrado en el clic
      if (width < 6 && height < 6) {
        width = 400;
        height = 300;
      }

      const coordsResult = {
        x: width === 400 && maxX - minX < 6 ? Math.round(minX - width / 2) : minX,
        y: height === 300 && maxY - minY < 6 ? Math.round(minY - height / 2) : minY,
        width,
        height
      };

      this.isSelectingDevCoords = false;
      this.devCoordsBox = null;
      this.activeTool = 'select';
      this.canvas.style.cursor = 'default';

      if (typeof this.onDevCoordsSelected === 'function') {
        this.onDevCoordsSelected(coordsResult);
      }
      this.render();
      return;
    }

    if (this.isSelectingMarquee) {
      if (this.potentialFrameClick) {
        // Clic simple en el interior de un frame sin arrastrar (< 4px de movimiento)
        if (!e.shiftKey) {
          this.selectedItemIds.clear();
          this.selectedItemIds.add(this.potentialFrameClick.id);
        } else if (e.ctrlKey || e.metaKey) {
          this.selectedItemIds.add(this.potentialFrameClick.id);
        } else {
          if (this.selectedItemIds.has(this.potentialFrameClick.id)) {
            this.selectedItemIds.delete(this.potentialFrameClick.id);
          } else {
            this.selectedItemIds.add(this.potentialFrameClick.id);
          }
        }
        this.potentialFrameClick = null;
      }
      this.isSelectingMarquee = false;
      this.isMarqueeDeselect = false;
      this.marqueeBox = null;
      if (this.onSelectionChange) this.onSelectionChange(Array.from(this.selectedItemIds));
    }

    if (this.currentDrawing) {
      this.currentDrawing = null;
      if (this.onBoardModified) this.onBoardModified();
    }
    if (this.activeConnector) {
      this.activeConnector = null;
      this.activeTool = 'select';
      if (this.onBoardModified) this.onBoardModified();
    }
    this.render();
  }

  // Renderizado del lienzo
  render() {
    const dpr = window.devicePixelRatio || 1;
    // 1. Limpieza absoluta a nivel de pixel fisico (elimina cualquier rastro o estela)
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Fondo solido limpio del lienzo
    this.ctx.fillStyle = this.isDarkMode ? '#0f1316' : '#f8f9fa';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // 2. Escala de resolucion de pantalla (HiDPI)
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 3. Cuadricula infinita
    this.drawDotGrid();

    // 4. Transformacion de camara protegida
    this.ctx.save();
    try {
      this.ctx.translate(this.width / 2, this.height / 2);
      this.ctx.scale(this.camera.zoom, this.camera.zoom);
      this.ctx.translate(this.camera.x, this.camera.y);

      // Culling / optimizacion visual: no procesar elementos muy lejos de la pantalla
      const vpMinX = -this.width / 2 / this.camera.zoom - this.camera.x - 300;
      const vpMaxX = this.width / 2 / this.camera.zoom - this.camera.x + 300;
      const vpMinY = -this.height / 2 / this.camera.zoom - this.camera.y - 300;
      const vpMaxY = this.height / 2 / this.camera.zoom - this.camera.y + 300;

      const isVisible = (it) => {
        if (it.type === 'connector') return true;
        const ix = it.x || 0;
        const iy = it.y || 0;
        const iw = it.width || 100;
        const ih = it.height || 100;
        return (ix + iw >= vpMinX && ix <= vpMaxX && iy + ih >= vpMinY && iy <= vpMaxY);
      };

      // Renderizado dinámico respetando la jerarquía de capas (zIndex)
      const sortedItems = this.getSortedItemsForRender(false);
      sortedItems.forEach(it => {
        if (!isVisible(it)) return;
        const matchesFilter = this.matchesFreshnessFilter(it);
        this.ctx.save();
        if (this.freshnessMapMode && !matchesFilter) {
          this.ctx.globalAlpha = 0.16;
        }
        try {
          switch (it.type) {
            case 'frame': this.drawFrame(it); break;
            case 'connector': this.drawConnector(it); break;
            case 'shape': this.drawShape(it); break;
            case 'code': this.drawCodeBlock(it); break;
            case 'embed':
            case 'preview': this.drawEmbed(it); break;
            case 'image': this.drawImage(it); break;
            case 'sticky_note': this.drawStickyNote(it); break;
            case 'text': this.drawText(it); break;
            case 'pen': this.drawPen(it); break;
            case 'comment': this.drawComment(it); break;
          }
          if (this.freshnessMapMode && matchesFilter && it.type !== 'connector' && it.type !== 'pen') {
            this.drawFreshnessOverlay(it);
          }
        } catch (e) {
          console.error('Error al dibujar elemento:', it.id, e);
        } finally {
          this.ctx.restore();
        }
      });

      // 8. Smart Guides magnéticas
      this.drawSmartGuides();

      // 9. Seleccion y recuadro marquee
      this.drawSelectionOutline();
      this.drawMarquee();
      this.drawDevCoordsMarquee();
    } finally {
      this.ctx.restore();
    }
  }

  drawDotGrid() {
    const zoom = this.camera.zoom;
    if (!zoom || isNaN(zoom) || zoom <= 0) return;

    // Cuadrícula infinita adaptativa multinivel (estilo Miro):
    // Mantiene la cuadrícula de puntos visible de forma nítida y elegante a cualquier escala,
    // garantizando que tanto de cerca como alejado (vista general) se vea siempre con el espaciado cómodo base.
    const p = Math.floor(-Math.log2(zoom));
    const worldMajor = 32 * Math.pow(2, p + 1);
    const screenMajor = worldMajor * zoom; // Rango acotado: [32px, 64px]
    const screenMinor = screenMajor / 2;   // Rango acotado: [16px, 32px]

    // Transición suave (fade) de puntos secundarios para evitar saltos bruscos durante el zoom
    const minorAlpha = Math.max(0, Math.min(1, (screenMinor - 18) / 10));

    const originX = this.width / 2 + this.camera.x * zoom;
    const originY = this.height / 2 + this.camera.y * zoom;

    // Colores fieles según tema (claro / oscuro)
    const baseRgb = this.isDarkMode ? [35, 40, 50] : [208, 208, 214]; // #232832 / #d0d0d6
    const majorColor = `rgb(${baseRgb[0]}, ${baseRgb[1]}, ${baseRgb[2]})`;
    const dotRadius = 1.35; // Radio nítido y consistente en píxeles de pantalla

    let offsetMajorX = originX % screenMajor;
    if (offsetMajorX < 0) offsetMajorX += screenMajor;
    let offsetMajorY = originY % screenMajor;
    if (offsetMajorY < 0) offsetMajorY += screenMajor;

    let offsetMinorX = originX % screenMinor;
    if (offsetMinorX < 0) offsetMinorX += screenMinor;
    let offsetMinorY = originY % screenMinor;
    if (offsetMinorY < 0) offsetMinorY += screenMinor;

    if (minorAlpha < 0.05) {
      // Zoom alejado en este tramo: dibujamos la cuadrícula principal
      this.ctx.fillStyle = majorColor;
      this.ctx.beginPath();
      for (let x = offsetMajorX; x < this.width; x += screenMajor) {
        for (let y = offsetMajorY; y < this.height; y += screenMajor) {
          this.ctx.moveTo(x + dotRadius, y);
          this.ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
        }
      }
      this.ctx.fill();
    } else if (minorAlpha >= 0.95) {
      // Tramo donde todos los puntos menores están al 100%
      this.ctx.fillStyle = majorColor;
      this.ctx.beginPath();
      for (let x = offsetMinorX; x < this.width; x += screenMinor) {
        for (let y = offsetMinorY; y < this.height; y += screenMinor) {
          this.ctx.moveTo(x + dotRadius, y);
          this.ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
        }
      }
      this.ctx.fill();
    } else {
      // Transición progresiva: puntos mayores al 100% y puntos menores con opacidad proporcional
      const majorColPhase = Math.abs(offsetMajorX - offsetMinorX) < 0.01 ? 0 : 1;
      const majorRowPhase = Math.abs(offsetMajorY - offsetMinorY) < 0.01 ? 0 : 1;

      const pathMajor = new Path2D();
      const pathMinor = new Path2D();

      for (let x = offsetMinorX, col = 0; x < this.width; x += screenMinor, col++) {
        const isMajorCol = (col % 2 === majorColPhase);
        for (let y = offsetMinorY, row = 0; y < this.height; y += screenMinor, row++) {
          const isMajorRow = (row % 2 === majorRowPhase);
          const targetPath = (isMajorCol && isMajorRow) ? pathMajor : pathMinor;
          targetPath.moveTo(x + dotRadius, y);
          targetPath.arc(x, y, dotRadius, 0, Math.PI * 2);
        }
      }

      this.ctx.fillStyle = majorColor;
      this.ctx.fill(pathMajor);

      this.ctx.fillStyle = `rgba(${baseRgb[0]}, ${baseRgb[1]}, ${baseRgb[2]}, ${minorAlpha.toFixed(3)})`;
      this.ctx.fill(pathMinor);
    }
  }

  extractUrlFromItem(it) {
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

  drawStickyNote(it) {
    const isSelected = this.selectedItemIds.has(it.id);
    this.ctx.save();

    // Sombra suave
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
    this.ctx.shadowBlur = isSelected ? 12 : 6;
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = isSelected ? 6 : 3;

    // Cuerpo de la nota
    this.ctx.fillStyle = it.color || '#fff9b0';
    this.ctx.beginPath();
    this.roundRect(this.ctx, it.x, it.y, it.width, it.height, 6);
    this.ctx.fill();

    this.ctx.shadowColor = 'transparent';

    // Doblez de esquina inferior derecha
    const fold = 16;
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    this.ctx.beginPath();
    this.ctx.moveTo(it.x + it.width - fold, it.y + it.height);
    this.ctx.lineTo(it.x + it.width, it.y + it.height - fold);
    this.ctx.lineTo(it.x + it.width - fold, it.y + it.height - fold);
    this.ctx.closePath();
    this.ctx.fill();

    // Texto
    if (it.text && this.editingItemId !== it.id) {
      const fontSize = it.fontSize || 15;
      const fontFamily = it.fontFamily || 'OpenSans, -apple-system, sans-serif';
      const isBold = it.isBold ? '700 ' : '400 ';
      const hasUrl = Boolean(this.extractUrlFromItem(it));
      this.ctx.fillStyle = hasUrl ? '#1d4ed8' : (it.textColor || '#1a1a1a');
      const align = it.textAlign || 'center';
      this.ctx.textAlign = align;
      this.ctx.textBaseline = 'middle';
      const padX = 14;
      let textX = it.x + it.width / 2;
      if (align === 'left') textX = it.x + padX;
      else if (align === 'right') textX = it.x + it.width - padX;
      this.wrapText(this.ctx, it.text, textX, it.y + it.height / 2, it.width - 24, fontSize + 5, 'center');
    }

    this.ctx.restore();
  }

  drawShape(it) {
    this.ctx.save();
    let fillColor = it.fillColor || '#ffffff';
    let strokeColor = it.strokeColor || '#1a1a1a';

    if (this.isDarkMode) {
      if (this.isLightColor(fillColor)) {
        fillColor = '#23262d';
      }
      if (this.isDarkColor(strokeColor)) {
        strokeColor = '#333842';
      }
    }

    this.ctx.fillStyle = fillColor;
    this.ctx.strokeStyle = strokeColor;
    this.ctx.lineWidth = it.strokeWidth || 2;

    this.ctx.beginPath();
    if (it.shape === 'circle') {
      this.ctx.ellipse(it.x + it.width / 2, it.y + it.height / 2, it.width / 2, it.height / 2, 0, 0, Math.PI * 2);
    } else if (it.shape === 'rounded') {
      this.roundRect(this.ctx, it.x, it.y, it.width, it.height, 12);
    } else if (it.shape === 'diamond') {
      this.ctx.moveTo(it.x + it.width / 2, it.y);
      this.ctx.lineTo(it.x + it.width, it.y + it.height / 2);
      this.ctx.lineTo(it.x + it.width / 2, it.y + it.height);
      this.ctx.lineTo(it.x, it.y + it.height / 2);
      this.ctx.closePath();
    } else if (it.shape === 'triangle') {
      this.ctx.moveTo(it.x + it.width / 2, it.y);
      this.ctx.lineTo(it.x + it.width, it.y + it.height);
      this.ctx.lineTo(it.x, it.y + it.height);
      this.ctx.closePath();
    } else {
      // Rectangulo normal
      this.ctx.rect(it.x, it.y, it.width, it.height);
    }
    this.ctx.fill();
    this.ctx.stroke();

    if (it.text && this.editingItemId !== it.id) {
      let isDarkBg = false;
      if (this.isDarkMode) {
        isDarkBg = true;
      } else if (fillColor && fillColor.startsWith('#')) {
        const hex = fillColor.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16) || 0;
        const g = parseInt(hex.substring(2, 4), 16) || 0;
        const b = parseInt(hex.substring(4, 6), 16) || 0;
        const lum = (0.299 * r + 0.587 * g + 0.114 * b);
        isDarkBg = lum < 140;
      }
      const isHeader = (it.height >= 50 && it.text && it.text.length <= 10);
      const fontSize = it.fontSize || (isHeader ? 22 : 14);
      const fontFamily = it.fontFamily || 'OpenSans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      const isBold = it.isBold !== undefined ? it.isBold : true;
      const fontStyle = it.isItalic ? 'italic ' : '';

      let textColor = it.textColor;
      if (!textColor) {
        textColor = isDarkBg ? '#ffffff' : (strokeColor || '#1a1a1a');
      } else if (this.isDarkMode && this.isDarkColor(textColor)) {
        textColor = '#f1f5f9';
      }

      const align = it.textAlign || 'center';
      this.ctx.fillStyle = textColor;
      this.ctx.font = `${fontStyle}${isBold ? '700 ' : '400 '}${fontSize}px ${fontFamily}`;
      this.ctx.textAlign = align;
      this.ctx.textBaseline = 'middle';
      const padX = 14;
      let textX = it.x + it.width / 2;
      if (align === 'left') textX = it.x + padX;
      else if (align === 'right') textX = it.x + it.width - padX;
      this.wrapText(this.ctx, it.text, textX, it.y + it.height / 2, it.width - 16, fontSize + 6, 'center');
    }

    this.ctx.restore();
  }

  drawText(it) {
    this.ctx.save();
    const hasFill = Boolean(it.fillColor && it.fillColor !== 'transparent');

    let textFillColor = it.fillColor;
    if (this.isDarkMode && hasFill) {
      if (it.fillColor === '#2d2d2d' || it.fillColor === '#1a1a1a' || it.fillColor === '#40414c') {
        // En modo oscuro (como en la imagen del usuario), los banners destacados oscuros se convierten en banners plateados claros #EEF2F5 con texto oscuro
        textFillColor = '#eef2f5';
      } else if (this.isLightColor(it.fillColor)) {
        textFillColor = '#23262d';
      }
    }

    // Si tiene relleno, dibujar la caja / banner / tarjeta
    if (hasFill && textFillColor) {
      this.ctx.fillStyle = textFillColor;
      const radius = Math.min(8, it.height / 4);
      this.ctx.beginPath();
      this.roundRect(this.ctx, it.x, it.y, it.width, it.height, radius);
      this.ctx.fill();

      if (this.isDarkMode) {
        if (textFillColor === '#23262d') {
          this.ctx.strokeStyle = '#333842';
          this.ctx.lineWidth = 1;
          this.ctx.stroke();
        }
      } else if (it.fillColor === '#bbcbd2') {
        this.ctx.strokeStyle = '#94a3b8';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
      }
    }

    // Si esta siendo editado in-situ, no pintar el texto en el canvas para evitar doble texto
    if (this.editingItemId === it.id) {
      this.ctx.restore();
      return;
    }

    const fontSize = it.fontSize || 15;
    const fontFamily = it.fontFamily || 'OpenSans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const isBold = it.isBold !== undefined ? it.isBold : (hasFill || fontSize >= 24);
    const fontStyle = it.isItalic ? 'italic ' : '';
    this.ctx.font = `${fontStyle}${isBold ? '700 ' : '400 '}${fontSize}px ${fontFamily}`;

    const hasUrl = Boolean(this.extractUrlFromItem(it));

    let textColor = it.textColor || it.color || '#1a1a1a';
    if (this.isDarkMode) {
      if (hasUrl) {
        textColor = (hasFill && textFillColor === '#eef2f5') ? '#1d4ed8' : '#60a5fa';
      } else if (hasFill && textFillColor === '#eef2f5') {
        textColor = '#0f172a';
      } else if (this.isDarkColor(textColor)) {
        textColor = '#f1f5f9';
      }
    } else {
      if (hasUrl) {
        textColor = (hasFill && (it.fillColor === '#2d2d2d' || it.fillColor === '#40414c' || it.fillColor === '#1a1a1a')) ? '#60a5fa' : '#1d4ed8';
      } else if (hasFill) {
        if (it.fillColor === '#2d2d2d' || it.fillColor === '#40414c' || it.fillColor === '#1a1a1a') {
          textColor = it.textColor || it.color || '#ffffff';
        } else if (it.fillColor === '#bbcbd2') {
          textColor = it.textColor || it.color || '#1a1a1a';
        }
      }
    }
    this.ctx.fillStyle = textColor;

    const align = it.textAlign || (hasFill && (!it.text || !it.text.includes('\n')) ? 'center' : 'left');
    this.ctx.textAlign = align;

    const padX = hasFill ? 14 : 0;
    const padY = hasFill ? 10 : 0;
    const maxWidth = Math.max(20, (it.width || 400) - padX * 2);
    const lineHeight = Math.round(fontSize * 1.35);

    if (it.textAlignVertical === 'middle') {
      this.ctx.textBaseline = 'middle';
      const textY = it.y + (it.height || 40) / 2;
      let textX = it.x + padX;
      if (align === 'center') {
        textX = it.x + (it.width || 400) / 2;
      } else if (align === 'right') {
        textX = it.x + (it.width || 400) - padX;
      }
      this.wrapText(this.ctx, it.text || '', textX, textY, maxWidth, lineHeight, 'center');
    } else {
      this.ctx.textBaseline = 'top';
      const textY = it.y + padY;
      let textX = it.x + padX;
      if (align === 'center') {
        textX = it.x + (it.width || 400) / 2;
      } else if (align === 'right') {
        textX = it.x + (it.width || 400) - padX;
      }
      this.wrapText(this.ctx, it.text || '', textX, textY, maxWidth, lineHeight, 'top');
    }

    this.ctx.restore();
  }

  drawCodeBlock(it) {
    this.ctx.save();
    const r = 8;
    const headerH = 30;

    // Caja oscura del bloque de código
    this.ctx.fillStyle = '#1e1e24';
    this.ctx.strokeStyle = '#32323a';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.roundRect(this.ctx, it.x, it.y, it.width, it.height, r);
    this.ctx.fill();
    this.ctx.stroke();

    // Barra de cabecera estilo macOS
    this.ctx.fillStyle = '#26262d';
    this.ctx.beginPath();
    this.ctx.moveTo(it.x + r, it.y);
    this.ctx.lineTo(it.x + it.width - r, it.y);
    this.ctx.quadraticCurveTo(it.x + it.width, it.y, it.x + it.width, it.y + r);
    this.ctx.lineTo(it.x + it.width, it.y + headerH);
    this.ctx.lineTo(it.x, it.y + headerH);
    this.ctx.lineTo(it.x, it.y + r);
    this.ctx.quadraticCurveTo(it.x, it.y, it.x + r, it.y);
    this.ctx.closePath();
    this.ctx.fill();

    // Línea divisoria cabecera
    this.ctx.strokeStyle = '#32323a';
    this.ctx.beginPath();
    this.ctx.moveTo(it.x, it.y + headerH);
    this.ctx.lineTo(it.x + it.width, it.y + headerH);
    this.ctx.stroke();

    // Puntos de ventana estilo macOS (rojo, amarillo, verde)
    const dotY = it.y + 15;
    const colors = ['#ef4444', '#f59e0b', '#10b981'];
    colors.forEach((col, idx) => {
      this.ctx.fillStyle = col;
      this.ctx.beginPath();
      this.ctx.arc(it.x + 16 + idx * 14, dotY, 4, 0, Math.PI * 2);
      this.ctx.fill();
    });

    // Píldora de lenguaje a la derecha
    const lang = (it.language || it.title || 'Code').toUpperCase();
    this.ctx.font = '600 10.5px monospace';
    const textW = this.ctx.measureText(lang).width;
    const langBadgeW = Math.max(50, textW + 16);
    const langBadgeX = it.x + it.width - langBadgeW - 12;

    this.ctx.fillStyle = '#3a3a44';
    this.ctx.beginPath();
    this.roundRect(this.ctx, langBadgeX, it.y + 7, langBadgeW, 16, 4);
    this.ctx.fill();

    this.ctx.fillStyle = '#9ca3af';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(lang, langBadgeX + langBadgeW / 2, it.y + 15);

    // Si está siendo editado in-situ, no pintar el contenido en canvas para evitar solapamiento
    if (this.editingItemId === it.id) {
      this.ctx.restore();
      return;
    }

    // Columna de numeración de líneas (Gutter)
    const gutterW = 38;
    this.ctx.fillStyle = '#18181c';
    this.ctx.beginPath();
    this.roundRect(this.ctx, it.x, it.y + headerH, gutterW, it.height - headerH, 0);
    this.ctx.fill();

    this.ctx.strokeStyle = '#2b2b34';
    this.ctx.beginPath();
    this.ctx.moveTo(it.x + gutterW, it.y + headerH);
    this.ctx.lineTo(it.x + gutterW, it.y + it.height);
    this.ctx.stroke();

    // Obtener texto del código o fallback informativo estructurado
    let codeText = it.text;
    if (!codeText || codeText.trim() === '') {
      codeText = it.defaultCode || '// Haz doble clic para editar código\nfunction ejecutar() {\n  return "DEV / AI";\n}';
    }

    const lines = String(codeText).split('\n');
    const startY = it.y + headerH + 12;
    const lineHeight = 19;
    const maxVisibleLines = Math.floor((it.height - headerH - 16) / lineHeight);

    for (let i = 0; i < Math.min(lines.length, maxVisibleLines); i++) {
      const line = lines[i];
      const curY = startY + i * lineHeight;

      // 1. Número de línea
      this.ctx.fillStyle = '#5c6370';
      this.ctx.font = '11.5px monospace';
      this.ctx.textAlign = 'right';
      this.ctx.textBaseline = 'top';
      this.ctx.fillText(String(i + 1), it.x + gutterW - 8, curY);

      // 2. Línea de código con resaltado sintáctico de tokens
      this.drawCodeLine(line, it.x + gutterW + 10, curY, it.width - gutterW - 16);
    }

    this.ctx.restore();
  }

  drawCodeLine(line, startX, lineY, maxWidth) {
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';

    if (!line) return;

    // Resaltado de comentarios completos
    const trimmed = line.trimStart();
    if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      this.ctx.fillStyle = '#6a737d';
      this.ctx.font = 'italic 12.5px "Fira Code", Consolas, monospace';
      this.ctx.fillText(line, startX, lineY);
      return;
    }

    // Tokenizar por palabras clave, strings, números y símbolos
    const tokenRegex = /(\b(?:const|let|var|function|return|if|else|for|while|import|from|export|def|class|SELECT|FROM|WHERE|JOIN|ORDER|BY|GROUP|TABLE|INSERT|UPDATE|DELETE|async|await)\b)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+\b)|([{}()[\],;=<>+\-*\/%&|!:]+)|(\b[a-zA-Z_$][a-zA-Z0-9_$]*\b)|(\s+)/g;
    let match;
    let curX = startX;

    while ((match = tokenRegex.exec(line)) !== null) {
      if (curX > startX + maxWidth) break;
      const [full, keyword, str, num, punct, ident, space] = match;

      if (keyword) {
        this.ctx.fillStyle = '#c678dd'; // Púrpura / magenta
      } else if (str) {
        this.ctx.fillStyle = '#98c379'; // Verde
      } else if (num) {
        this.ctx.fillStyle = '#d19a66'; // Naranja
      } else if (punct) {
        this.ctx.fillStyle = '#56b6c2'; // Cian
      } else if (ident) {
        this.ctx.fillStyle = '#abb2bf'; // Gris claro
      } else {
        this.ctx.fillStyle = '#abb2bf';
      }

      this.ctx.font = '12.5px "Fira Code", Consolas, monospace';
      this.ctx.fillText(full, curX, lineY);
      curX += this.ctx.measureText(full).width;
    }
  }

  drawEmbed(it) {
    if (!it.src && it.url && (it.height || 0) > 150) {
      const ytId = this.extractYouTubeVideoId(it.url);
      if (ytId) {
        it.src = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
      }
    }
    this.ctx.save();
    const r = 10;
    const isCompact = !it.src || it.height <= 145;
    const thumbH = isCompact ? 0 : Math.max(60, Math.round(it.height * 0.52));

    // 1. Sombra suave de la tarjeta widget
    this.ctx.save();
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
    this.ctx.shadowBlur = 8 / this.camera.zoom;
    this.ctx.shadowOffsetY = 3 / this.camera.zoom;
    this.ctx.fillStyle = this.isDarkMode ? '#1E222B' : '#ffffff';
    this.ctx.beginPath();
    this.roundRect(this.ctx, it.x, it.y, it.width, it.height, r);
    this.ctx.fill();
    this.ctx.restore();

    // Borde exterior sutil
    this.ctx.strokeStyle = this.isDarkMode ? '#333842' : '#e2e8f0';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.roundRect(this.ctx, it.x, it.y, it.width, it.height, r);
    this.ctx.stroke();

    if (!isCompact && thumbH > 0) {
      // 2. Sección superior: Miniatura recortada en esquinas superiores
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.moveTo(it.x + r, it.y);
      this.ctx.lineTo(it.x + it.width - r, it.y);
      this.ctx.quadraticCurveTo(it.x + it.width, it.y, it.x + it.width, it.y + r);
      this.ctx.lineTo(it.x + it.width, it.y + thumbH);
      this.ctx.lineTo(it.x, it.y + thumbH);
      this.ctx.lineTo(it.x, it.y + r);
      this.ctx.quadraticCurveTo(it.x, it.y, it.x + r, it.y);
      this.ctx.closePath();
      this.ctx.clip();

      if (it.src) {
        if (!it.imgElement || typeof it.imgElement.getAttribute !== 'function' || it.imgElement.getAttribute('data-src') !== it.src) {
          it.imgElement = new Image();
          it.imgElement.setAttribute('data-src', it.src);
          it.imgElement.onload = () => this.render();
          it.imgElement.onerror = () => { it.imgFailed = true; };
          it.imgElement.src = this.resolveImageSrc(it.src);
        }
        if (it.imgElement && it.imgElement.complete && it.imgElement.naturalWidth > 0) {
          const img = it.imgElement;
          const imgRatio = img.naturalWidth / img.naturalHeight;
          const targetRatio = it.width / thumbH;
          let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
          if (imgRatio > targetRatio) {
            sh = img.naturalHeight;
            sw = sh * targetRatio;
            sx = (img.naturalWidth - sw) / 2;
          } else {
            sw = img.naturalWidth;
            sh = sw / targetRatio;
            sy = (img.naturalHeight - sh) / 2;
          }
          this.ctx.drawImage(img, sx, sy, sw, sh, it.x, it.y, it.width, thumbH);
        } else {
          this.ctx.fillStyle = '#0f172a';
          this.ctx.fillRect(it.x, it.y, it.width, thumbH);
        }
      } else {
        const grad = this.ctx.createLinearGradient(it.x, it.y, it.x + it.width, it.y + thumbH);
        grad.addColorStop(0, '#1e293b');
        grad.addColorStop(1, '#0f172a');
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(it.x, it.y, it.width, thumbH);
      }
      this.ctx.restore();

      // Línea divisoria bajo la miniatura
      this.ctx.strokeStyle = this.isDarkMode ? '#2D323B' : '#f1f5f9';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(it.x, it.y + thumbH);
      this.ctx.lineTo(it.x + it.width, it.y + thumbH);
      this.ctx.stroke();
    }

    // 3. Insignia flotante / Favicon de la plataforma
    const badgeX = it.x + 12;
    const badgeY = it.y + 12;
    const badgeSize = isCompact ? 24 : 26;
    this.ctx.save();
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
    this.ctx.shadowBlur = 4;
    this.ctx.shadowOffsetY = 1;
    this.ctx.fillStyle = this.isDarkMode ? '#262A34' : '#ffffff';
    this.ctx.beginPath();
    this.roundRect(this.ctx, badgeX, badgeY, badgeSize, badgeSize, 5);
    this.ctx.fill();
    this.ctx.strokeStyle = this.isDarkMode ? '#3A404F' : '#e2e8f0';
    this.ctx.lineWidth = 1;
    this.ctx.stroke();
    this.ctx.restore();

    // Icono dentro de la insignia flotante
    const domain = (it.domain || this.extractDomain(it.url)).toUpperCase();
    if (domain.includes('YOUTUBE')) {
      this.ctx.fillStyle = '#ff0000';
      this.ctx.beginPath();
      this.roundRect(this.ctx, badgeX + 4, badgeY + 6, 16, 12, 3);
      this.ctx.fill();
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.moveTo(badgeX + 9, badgeY + 9);
      this.ctx.lineTo(badgeX + 16, badgeY + 12);
      this.ctx.lineTo(badgeX + 9, badgeY + 15);
      this.ctx.closePath();
      this.ctx.fill();
    } else if (domain.includes('GITHUB')) {
      this.ctx.fillStyle = this.isDarkMode ? '#F1F5F9' : '#181717';
      this.ctx.font = '700 12px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('⚡', badgeX + badgeSize / 2, badgeY + badgeSize / 2);
    } else if (domain === 'X.COM' || domain.includes('TWITTER') || domain.endsWith('.X.COM')) {
      this.ctx.fillStyle = this.isDarkMode ? '#F1F5F9' : '#0f172a';
      this.ctx.font = '700 13px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('𝕏', badgeX + badgeSize / 2, badgeY + badgeSize / 2);
    } else {
      this.ctx.fillStyle = '#3b82f6';
      this.ctx.font = '13px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('🌐', badgeX + badgeSize / 2, badgeY + badgeSize / 2);
    }

    // Para tarjetas compactas, mostrar el dominio al lado del badge en la cabecera
    if (isCompact) {
      this.ctx.fillStyle = this.isDarkMode ? '#94A3B8' : '#64748b';
      this.ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(it.domain ? it.domain.toLowerCase() : this.extractDomain(it.url).toLowerCase(), badgeX + badgeSize + 8, badgeY + badgeSize / 2);
    }

    // 4. Botón de enlace exterior ↗ en la esquina superior derecha
    const btnX = it.x + it.width - 32;
    const btnY = it.y + 10;
    const btnSize = 22;
    this.ctx.save();
    this.ctx.fillStyle = this.isDarkMode ? '#262A34' : 'rgba(255, 255, 255, 0.95)';
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
    this.ctx.shadowBlur = 3;
    this.ctx.beginPath();
    this.ctx.arc(btnX + btnSize / 2, btnY + btnSize / 2, btnSize / 2, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.strokeStyle = this.isDarkMode ? '#3A404F' : '#e2e8f0';
    this.ctx.lineWidth = 1;
    this.ctx.stroke();
    this.ctx.fillStyle = this.isDarkMode ? '#E2E8F0' : '#475569';
    this.ctx.font = '700 11px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('↗', btnX + btnSize / 2, btnY + btnSize / 2);
    this.ctx.restore();

    // 5. Sección de textos (Dominio, Título y Descripción)
    const contentStartY = isCompact ? it.y + 46 : it.y + thumbH + 12;
    let curTextY = contentStartY;

    if (!isCompact) {
      this.ctx.fillStyle = this.isDarkMode ? '#94A3B8' : '#64748b';
      this.ctx.font = '600 10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'top';
      this.ctx.fillText(it.domain ? it.domain.toLowerCase() : domain.toLowerCase(), it.x + 14, curTextY);
      curTextY += 16;
    }

    let title = it.title || this.extractTitle(it.url) || domain;
    if (title.toLowerCase().includes('antes de ir a youtube') || title.toLowerCase().includes('before you continue to youtube')) {
      title = this.extractTitle(it.url) || 'YouTube';
    }
    this.ctx.fillStyle = this.isDarkMode ? '#F1F5F9' : '#0f172a';
    this.ctx.font = '700 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';
    const linesUsed = this.wrapText(this.ctx, title, it.x + 14, curTextY, it.width - 28, 16, 'top', 2);
    curTextY += (linesUsed || 1) * 16 + 4;

    if (it.description && curTextY < it.y + it.height - 20) {
      this.ctx.fillStyle = this.isDarkMode ? '#94A3B8' : '#64748b';
      this.ctx.font = '400 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'top';
      const availableH = (it.y + it.height - 18) - curTextY;
      const maxDescLines = Math.max(1, Math.floor(availableH / 14));
      this.wrapText(this.ctx, it.description, it.x + 14, curTextY, it.width - 28, 14, 'top', maxDescLines);
    } else if (isCompact && !it.description && it.url) {
      this.ctx.fillStyle = this.isDarkMode ? '#60A5FA' : '#94a3b8';
      this.ctx.font = '400 10.5px -apple-system, BlinkMacSystemFont, sans-serif';
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'top';
      const cleanUrl = it.url.replace(/^https?:\/\//i, '');
      const maxTextW = it.width - 28;
      let displayUrl = cleanUrl;
      while (this.ctx.measureText(displayUrl).width > maxTextW && displayUrl.length > 10) {
        displayUrl = displayUrl.slice(0, -4) + '...';
      }
      this.ctx.fillText(displayUrl, it.x + 14, it.y + it.height - 18);
    }

    this.ctx.restore();
  }

  drawPen(it) {
    if (!it.points || it.points.length < 2) return;
    this.ctx.save();
    let strokeColor = it.color || '#1a1a1a';
    if (this.isDarkMode && this.isDarkColor(strokeColor)) {
      strokeColor = '#F1F5F9';
    }
    this.ctx.strokeStyle = strokeColor;
    this.ctx.lineWidth = it.strokeWidth || 3;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    this.ctx.beginPath();
    this.ctx.moveTo(it.points[0].x, it.points[0].y);
    for (let i = 1; i < it.points.length; i++) {
      this.ctx.lineTo(it.points[i].x, it.points[i].y);
    }
    this.ctx.stroke();
    this.ctx.restore();
  }

  drawConnector(it) {
    if (!it.start || !it.end) return;

    // Alinear dinámicamente con los elementos conectados si existen
    if (it.start?.item) {
      const startItem = this.items.find(x => x.id === it.start.item);
      if (startItem) {
        const posX = it.start.position?.x ?? 0.5;
        const posY = it.start.position?.y ?? 0.5;
        it.start.x = startItem.x + (startItem.width || 0) * posX;
        it.start.y = startItem.y + (startItem.height || 0) * posY;
      }
    }
    if (it.end?.item) {
      const endItem = this.items.find(x => x.id === it.end.item);
      if (endItem) {
        const posX = it.end.position?.x ?? 0.5;
        const posY = it.end.position?.y ?? 0.5;
        it.end.x = endItem.x + (endItem.width || 0) * posX;
        it.end.y = endItem.y + (endItem.height || 0) * posY;
      }
    }

    if (typeof it.start.x !== 'number' || typeof it.start.y !== 'number') return;
    if (typeof it.end.x !== 'number' || typeof it.end.y !== 'number') return;
    if (isNaN(it.start.x) || isNaN(it.start.y) || isNaN(it.end.x) || isNaN(it.end.y)) return;

    this.ctx.save();
    let connectorColor = it.color || '#333333';
    if (this.isDarkMode && this.isDarkColor(connectorColor)) {
      connectorColor = '#94A3B8';
    }
    this.ctx.strokeStyle = connectorColor;
    this.ctx.lineWidth = it.strokeWidth || 2;
    this.ctx.beginPath();
    this.ctx.moveTo(it.start.x, it.start.y);
    this.ctx.lineTo(it.end.x, it.end.y);
    this.ctx.stroke();

    // Flecha en el final
    const angle = Math.atan2(it.end.y - it.start.y, it.end.x - it.start.x);
    const arrowLen = 12;
    this.ctx.fillStyle = connectorColor;
    this.ctx.beginPath();
    this.ctx.moveTo(it.end.x, it.end.y);
    this.ctx.lineTo(it.end.x - arrowLen * Math.cos(angle - Math.PI / 6), it.end.y - arrowLen * Math.sin(angle - Math.PI / 6));
    this.ctx.lineTo(it.end.x - arrowLen * Math.cos(angle + Math.PI / 6), it.end.y - arrowLen * Math.sin(angle + Math.PI / 6));
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.restore();
  }

  drawFrame(it) {
    this.ctx.save();

    let fillColor = it.fillColor || '#bbcbd2';
    let borderColor = '#94a3b8';
    let tabColor = '#475569';
    let tabTextColor = '#ffffff';

    if (this.isDarkMode) {
      if (this.isLightColor(fillColor) || fillColor.toLowerCase() === '#bbcbd2') {
        fillColor = '#23262D';
      }
      borderColor = '#333842';
      tabColor = '#2D323E';
      tabTextColor = '#E2E8F0';
    }

    // Relleno sólido/suave del marco
    this.ctx.fillStyle = fillColor;
    this.ctx.fillRect(it.x, it.y, it.width, it.height);

    // Borde limpio y elegante
    this.ctx.strokeStyle = borderColor;
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(it.x, it.y, it.width, it.height);

    // Etiqueta del marco arriba si tiene título o ligero contorno sutil si está vacía
    const tabHeight = 26;
    if (it.title) {
      const titleFont = '600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      this.ctx.font = titleFont;
      const textWidth = this.ctx.measureText(it.title).width;
      const tabWidth = Math.max(70, textWidth + 24);

      this.ctx.fillStyle = tabColor;
      this.ctx.beginPath();
      this.roundRect(this.ctx, it.x, it.y - tabHeight, tabWidth, tabHeight, 4);
      this.ctx.fill();

      if (this.isDarkMode) {
        this.ctx.strokeStyle = borderColor;
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
      }

      this.ctx.fillStyle = tabTextColor;
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(it.title, it.x + 12, it.y - tabHeight / 2);
    } else {
      // Si en la etiqueta no hay nada, habrá un ligero contorno casi inapreciable
      const tabWidth = 80;
      this.ctx.save();
      this.ctx.strokeStyle = this.isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.14)';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.roundRect(this.ctx, it.x, it.y - tabHeight, tabWidth, tabHeight, 4);
      this.ctx.stroke();
      this.ctx.restore();
    }
    this.ctx.restore();
  }

  drawImage(it) {
    if (!it.src) return;
    if (!it.imgElement || typeof it.imgElement.getAttribute !== 'function' || it.imgElement.getAttribute('data-src') !== it.src) {
      it.imgElement = new Image();
      it.imgElement.setAttribute('data-src', it.src);
      it.imgElement.onload = () => this.render();
      it.imgElement.onerror = () => console.warn('No se pudo cargar la imagen local:', it.src);
      it.imgElement.src = this.resolveImageSrc(it.src);
      return;
    }
    if (it.imgElement && it.imgElement.complete && it.imgElement.naturalWidth > 0) {
      this.ctx.drawImage(it.imgElement, it.x, it.y, it.width, it.height);
      if (it.url) {
        this.ctx.save();
        const badgeSize = Math.max(16, Math.min(24, 20 / this.camera.zoom));
        const pad = 6 / this.camera.zoom;
        const bx = it.x + it.width - badgeSize - pad;
        const by = it.y + pad;
        if (this.isDarkMode) {
          this.ctx.fillStyle = 'rgba(24, 27, 32, 0.9)';
          this.ctx.strokeStyle = '#3b82f6';
          this.ctx.lineWidth = 1.5 / this.camera.zoom;
          this.ctx.beginPath();
          this.roundRect(this.ctx, bx, by, badgeSize, badgeSize, 4 / this.camera.zoom);
          this.ctx.fill();
          this.ctx.stroke();

          this.ctx.fillStyle = '#60a5fa';
          this.ctx.font = `bold ${Math.round(badgeSize * 0.6)}px sans-serif`;
          this.ctx.textAlign = 'center';
          this.ctx.textBaseline = 'middle';
          this.ctx.fillText('↗', bx + badgeSize / 2, by + badgeSize / 2);
        } else {
          this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
          this.ctx.strokeStyle = '#93c5fd';
          this.ctx.lineWidth = 1.5 / this.camera.zoom;
          this.ctx.beginPath();
          this.roundRect(this.ctx, bx, by, badgeSize, badgeSize, 4 / this.camera.zoom);
          this.ctx.fill();
          this.ctx.stroke();

          this.ctx.fillStyle = '#2563eb';
          this.ctx.font = `bold ${Math.round(badgeSize * 0.6)}px sans-serif`;
          this.ctx.textAlign = 'center';
          this.ctx.textBaseline = 'middle';
          this.ctx.fillText('↗', bx + badgeSize / 2, by + badgeSize / 2);
        }
        this.ctx.restore();
      }
    }
  }

  drawComment(it) {
    this.ctx.save();
    const x = it.x;
    const y = it.y;
    const r = 16;
    const isResolved = it.resolved;
    const isSelected = this.selectedItemIds.has(it.id);
    const bg = isResolved ? '#10b981' : '#f59e0b'; // Verde o Naranja

    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
    this.ctx.shadowBlur = 6;
    this.ctx.shadowOffsetY = 2;

    // Pin circular con cola estilo burbuja de conversación
    this.ctx.fillStyle = bg;
    this.ctx.beginPath();
    this.ctx.arc(x, y, r, 0, Math.PI * 2);
    this.ctx.fill();

    // Pequeño pico inferior de la burbuja
    this.ctx.beginPath();
    this.ctx.moveTo(x - 5, y + 13);
    this.ctx.lineTo(x - 13, y + 22);
    this.ctx.lineTo(x + 3, y + 15);
    this.ctx.closePath();
    this.ctx.fill();

    // Borde blanco nítido (o azul si está seleccionado)
    this.ctx.shadowColor = 'transparent';
    this.ctx.strokeStyle = isSelected ? '#4262ff' : '#ffffff';
    this.ctx.lineWidth = isSelected ? 2.5 : 2;
    this.ctx.beginPath();
    this.ctx.arc(x, y, r, 0, Math.PI * 2);
    this.ctx.stroke();

    // Icono interior
    this.ctx.fillStyle = '#ffffff';
    if (isResolved) {
      this.ctx.font = 'bold 13px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('✓', x, y);
    } else {
      this.ctx.font = 'bold 12px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('💬', x, y);
    }

    this.ctx.restore();
  }

  drawSmartGuides() {
    if (!this.activeGuides || this.activeGuides.length === 0) return;
    this.ctx.save();
    this.ctx.strokeStyle = '#ff007a'; // Magenta guía
    this.ctx.lineWidth = 1.2 / this.camera.zoom;
    this.ctx.setLineDash([5 / this.camera.zoom, 4 / this.camera.zoom]);

    this.activeGuides.forEach(g => {
      this.ctx.beginPath();
      if (g.type === 'v') {
        this.ctx.moveTo(g.x, g.y1);
        this.ctx.lineTo(g.x, g.y2);
      } else if (g.type === 'h') {
        this.ctx.moveTo(g.x1, g.y);
        this.ctx.lineTo(g.x2, g.y);
      }
      this.ctx.stroke();
    });

    this.ctx.restore();
  }

  drawSelectionOutline() {
    if (this.selectedItemIds.size === 0) return;

    this.items.filter(it => this.selectedItemIds.has(it.id)).forEach(it => {
      if (it.type === 'pen' || it.type === 'connector' || it.type === 'comment') return;
      this.ctx.save();
      const z = this.camera.zoom;

      // Rectángulo delimitador exterior con color azul
      this.ctx.strokeStyle = '#4262ff';
      this.ctx.lineWidth = 1.5 / z;
      const pad = 3 / z;
      this.ctx.strokeRect(it.x - pad, it.y - pad, it.width + pad * 2, it.height + pad * 2);

      // Renderizado de los controladores (solo si hay un único elemento seleccionado)
      if (this.selectedItemIds.size === 1) {
        const x = it.x;
        const y = it.y;
        const w = it.width;
        const h = it.height;
        const cornerRadius = 5 / z;
        const pillHalfW = 6 / z;
        const pillHalfH = 2.5 / z;

        // 1. Controladores de las 4 esquinas para agrandar y empequeñecer (círculos blancos con borde azul)
        const corners = [
          { x: x, y: y },
          { x: x + w, y: y },
          { x: x + w, y: y + h },
          { x: x, y: y + h }
        ];
        this.ctx.fillStyle = '#ffffff';
        this.ctx.strokeStyle = '#4262ff';
        this.ctx.lineWidth = 1.5 / z;
        corners.forEach(c => {
          this.ctx.beginPath();
          this.ctx.arc(c.x, c.y, cornerRadius, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.stroke();
        });

        // 2. Pastillas en los ejes de los 4 lados para redimensionar tirando de los bordes
        // Ejes Norte y Sur (pastillas horizontales)
        this.ctx.beginPath();
        this.roundRect(this.ctx, x + w / 2 - pillHalfW, y - pillHalfH, pillHalfW * 2, pillHalfH * 2, 2 / z);
        this.roundRect(this.ctx, x + w / 2 - pillHalfW, y + h - pillHalfH, pillHalfW * 2, pillHalfH * 2, 2 / z);
        this.ctx.fill();
        this.ctx.stroke();

        // Ejes Este y Oeste (pastillas verticales)
        this.ctx.beginPath();
        this.roundRect(this.ctx, x - pillHalfH, y + h / 2 - pillHalfW, pillHalfH * 2, pillHalfW * 2, 2 / z);
        this.roundRect(this.ctx, x + w - pillHalfH, y + h / 2 - pillHalfW, pillHalfH * 2, pillHalfW * 2, 2 / z);
        this.ctx.fill();
        this.ctx.stroke();

        // 3. Controladores circulares de conexión en el medio de los 4 lados para tirar flechas (Connector Ports)
        const ports = this.getConnectorPorts(it);
        const portRadius = 5.5 / z;
        ports.forEach(p => {
          const isHovered = this.hoveredConnectorPort && this.hoveredConnectorPort.port.name === p.name;
          const r = isHovered ? 7.5 / z : portRadius;

          // Halo brillante en hover
          if (isHovered) {
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, r + 3.5 / z, 0, Math.PI * 2);
            this.ctx.fillStyle = 'rgba(66, 98, 255, 0.25)';
            this.ctx.fill();
          }

          // Círculo azul exterior
          this.ctx.beginPath();
          this.ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          this.ctx.fillStyle = '#4262ff';
          this.ctx.fill();
          this.ctx.strokeStyle = '#ffffff';
          this.ctx.lineWidth = 1.5 / z;
          this.ctx.stroke();

          // Punto blanco central
          this.ctx.beginPath();
          this.ctx.arc(p.x, p.y, 2.2 / z, 0, Math.PI * 2);
          this.ctx.fillStyle = '#ffffff';
          this.ctx.fill();
        });
      }

      // 4. Realce visual en el puerto objetivo cuando se está arrastrando una flecha
      if (this.isConnectingFromPort && this.hoveredSnapPort) {
        const sp = this.hoveredSnapPort.port;
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.arc(sp.x, sp.y, 10 / z, 0, Math.PI * 2);
        this.ctx.fillStyle = 'rgba(66, 98, 255, 0.35)';
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.arc(sp.x, sp.y, 6.5 / z, 0, Math.PI * 2);
        this.ctx.fillStyle = '#4262ff';
        this.ctx.fill();
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2 / z;
        this.ctx.stroke();
        this.ctx.restore();
      }
      this.ctx.restore();
    });
  }

  drawMarquee() {
    if (!this.isSelectingMarquee || !this.marqueeBox) return;
    const minX = Math.min(this.marqueeBox.startX, this.marqueeBox.currentX);
    const maxX = Math.max(this.marqueeBox.startX, this.marqueeBox.currentX);
    const minY = Math.min(this.marqueeBox.startY, this.marqueeBox.currentY);
    const maxY = Math.max(this.marqueeBox.startY, this.marqueeBox.currentY);
    if (maxX - minX < 2 && maxY - minY < 2) return;

    this.ctx.save();
    if (this.isMarqueeDeselect) {
      this.ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
      this.ctx.strokeStyle = '#ef4444';
      this.ctx.lineWidth = 1.5 / this.camera.zoom;
      this.ctx.setLineDash([5 / this.camera.zoom, 4 / this.camera.zoom]);
    } else {
      this.ctx.fillStyle = 'rgba(66, 98, 255, 0.08)';
      this.ctx.strokeStyle = '#4262ff';
      this.ctx.lineWidth = 1 / this.camera.zoom;
    }
    this.ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
    this.ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
    this.ctx.restore();
  }

  drawDevCoordsMarquee() {
    if (!this.isSelectingDevCoords || !this.devCoordsBox) return;
    const minX = Math.min(this.devCoordsBox.startX, this.devCoordsBox.currentX);
    const maxX = Math.max(this.devCoordsBox.startX, this.devCoordsBox.currentX);
    const minY = Math.min(this.devCoordsBox.startY, this.devCoordsBox.currentY);
    const maxY = Math.max(this.devCoordsBox.startY, this.devCoordsBox.currentY);
    const w = Math.round(maxX - minX);
    const h = Math.round(maxY - minY);
    if (w < 2 && h < 2) return;

    this.ctx.save();
    const z = this.camera.zoom;

    // Relleno cian/azul translúcido
    this.ctx.fillStyle = 'rgba(2, 132, 199, 0.14)';
    this.ctx.fillRect(minX, minY, w, h);

    // Borde brillante con guiones tipo selección
    this.ctx.strokeStyle = '#0284c7';
    this.ctx.lineWidth = Math.max(1.5, 2 / z);
    this.ctx.setLineDash([6 / z, 4 / z]);
    this.ctx.strokeRect(minX, minY, w, h);

    // Esquinas resaltadas
    this.ctx.setLineDash([]);
    this.ctx.fillStyle = '#38bdf8';
    const cSize = Math.max(4, 5 / z);
    this.ctx.fillRect(minX - cSize / 2, minY - cSize / 2, cSize, cSize);
    this.ctx.fillRect(maxX - cSize / 2, minY - cSize / 2, cSize, cSize);
    this.ctx.fillRect(minX - cSize / 2, maxY - cSize / 2, cSize, cSize);
    this.ctx.fillRect(maxX - cSize / 2, maxY - cSize / 2, cSize, cSize);

    // Etiqueta flotante con coordenadas y dimensiones en tiempo real
    const fontSize = Math.max(11, Math.min(18, Math.round(12 / Math.sqrt(z))));
    this.ctx.font = `600 ${fontSize}px "Fira Code", monospace`;
    const labelText = `X: ${Math.round(minX)}  Y: ${Math.round(minY)}  [${w} × ${h}px]`;
    const padX = 8 / z;
    const padY = 5 / z;
    const textW = this.ctx.measureText(labelText).width;
    const badgeW = textW + padX * 2;
    const badgeH = fontSize + padY * 2;
    const badgeX = minX;
    const badgeY = minY - badgeH - (4 / z);

    this.ctx.fillStyle = this.isDarkMode ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)';
    this.ctx.strokeStyle = '#0284c7';
    this.ctx.lineWidth = 1.2 / z;
    this.ctx.beginPath();
    this.roundRect(this.ctx, badgeX, badgeY, badgeW, badgeH, 4 / z);
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.fillStyle = this.isDarkMode ? '#38bdf8' : '#0369a1';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(labelText, badgeX + padX, badgeY + badgeH / 2);

    this.ctx.restore();
  }

  roundRect(ctx, x, y, width, height, radius) {
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
  }

  // Altura que necesita un texto o nota para mostrar todo su contenido (mismo ajuste de líneas que drawText)
  measureTextItemHeight(it) {
    if (!it) return 0;
    const ctx = this.ctx;
    ctx.save();
    const hasFill = Boolean(it.fillColor && it.fillColor !== 'transparent') || it.type === 'sticky_note';
    const fontSize = it.fontSize || 15;
    const fontFamily = it.fontFamily || 'OpenSans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const isBold = it.isBold !== undefined ? it.isBold : (hasFill || fontSize >= 24);
    ctx.font = `${it.isItalic ? 'italic ' : ''}${isBold ? '700 ' : '400 '}${fontSize}px ${fontFamily}`;
    const padX = hasFill ? 14 : 0;
    const padY = hasFill ? 10 : 0;
    const maxWidth = Math.max(20, (it.width || 400) - padX * 2);
    let lineCount = 0;
    String(it.text || '').split('\n').forEach(para => {
      if (!para.trim()) {
        lineCount++;
        return;
      }
      const words = para.split(' ');
      let current = words[0] || '';
      for (let i = 1; i < words.length; i++) {
        if (ctx.measureText(current + ' ' + words[i]).width < maxWidth) {
          current += ' ' + words[i];
        } else {
          lineCount++;
          current = words[i];
        }
      }
      lineCount++;
    });
    ctx.restore();
    return Math.ceil(lineCount * Math.round(fontSize * 1.35) + padY * 2 + 8);
  }

  wrapText(ctx, text, x, y, maxWidth, lineHeight, align = 'center', maxLines = 0) {
    if (!text) return 0;
    const paragraphs = String(text).split('\n');
    const lines = [];

    for (const para of paragraphs) {
      if (!para.trim()) {
        lines.push('');
        continue;
      }
      const words = para.split(' ');
      let currentLine = words[0] || '';
      for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = ctx.measureText(currentLine + ' ' + word).width;
        if (width < maxWidth) {
          currentLine += ' ' + word;
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      }
      lines.push(currentLine);
    }

    let renderLines = lines;
    if (maxLines > 0 && lines.length > maxLines) {
      renderLines = lines.slice(0, maxLines);
      let lastLine = renderLines[maxLines - 1];
      while (ctx.measureText(lastLine + '...').width > maxWidth && lastLine.length > 3) {
        lastLine = lastLine.slice(0, -1);
      }
      renderLines[maxLines - 1] = lastLine + '...';
    }

    let startY = y;
    if (align === 'center' || align === 'middle') {
      startY = y - ((renderLines.length - 1) * lineHeight) / 2;
    }

    renderLines.forEach((line, idx) => {
      ctx.fillText(line, x, startY + idx * lineHeight);
    });

    return renderLines.length;
  }

  drawFreshnessOverlay(it) {
    if (!it || typeof it.x !== 'number' || typeof it.y !== 'number') return;
    const info = this.getItemFreshnessInfo(it);
    const x = it.x;
    const y = it.y;
    const w = it.width || 100;
    const h = it.height || 40;

    this.ctx.save();
    // Contorno coloreado según antigüedad
    const lineWidth = Math.max(2, 2.5 / Math.max(0.25, Math.min(2, this.camera.zoom)));
    this.ctx.strokeStyle = info.color;
    this.ctx.lineWidth = lineWidth;
    // Trazo nuevo: sin beginPath se volvían a pintar los puntos de la cuadrícula y los contornos anteriores
    this.ctx.beginPath();
    this.roundRect(this.ctx, x - 2, y - 2, w + 4, h + 4, 8);
    this.ctx.stroke();

    // Si el zoom permite leer etiquetas o el objeto es suficientemente grande, dibujar píldora de fecha arriba a la derecha
    if (this.camera.zoom >= 0.18) {
      const badgeScale = Math.max(0.65, Math.min(1.4, 1 / Math.sqrt(this.camera.zoom)));
      const fontSize = Math.round(11 * badgeScale);
      this.ctx.font = `600 ${fontSize}px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      const labelText = info.isReviewed
        ? `Revisado ${info.reviewRelativeText.toLowerCase()} · ${info.formattedDate}`
        : `${info.relativeText} · ${info.formattedDate}`;
      const textWidth = this.ctx.measureText(labelText).width;
      const padX = 8 * badgeScale;
      const dotR = 3.5 * badgeScale;
      const badgeW = textWidth + padX * 2 + dotR * 2 + 5 * badgeScale;
      const badgeH = 20 * badgeScale;
      const bx = x + w - badgeW;
      const by = y - badgeH - 4 * badgeScale;

      this.ctx.fillStyle = this.isDarkMode ? 'rgba(15, 23, 42, 0.94)' : 'rgba(255, 255, 255, 0.96)';
      this.ctx.strokeStyle = info.color;
      this.ctx.lineWidth = Math.max(1, 1.2 * badgeScale);
      this.ctx.beginPath();
      this.roundRect(this.ctx, bx, by, badgeW, badgeH, 6 * badgeScale);
      this.ctx.fill();
      this.ctx.stroke();

      // Punto de color de frescura
      this.ctx.beginPath();
      this.ctx.fillStyle = info.color;
      this.ctx.arc(bx + padX + dotR, by + badgeH / 2, dotR, 0, Math.PI * 2);
      this.ctx.fill();

      // Texto de fecha
      this.ctx.fillStyle = this.isDarkMode ? '#f1f5f9' : '#1e293b';
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(labelText, bx + padX + dotR * 2 + 5 * badgeScale, by + badgeH / 2 + 0.5);
    }
    this.ctx.restore();
  }

  // Eliminar seleccionados
  deleteSelected() {
    if (this.selectedItemIds.size === 0) return;
    this.saveSnapshot();
    this.items = this.items.filter(it => !this.selectedItemIds.has(it.id));
    this.selectedItemIds.clear();
    if (this.onSelectionChange) this.onSelectionChange([]);
    if (this.onBoardModified) this.onBoardModified();
    this.render();
  }

  // Duplicar seleccionados
  duplicateSelected() {
    if (this.selectedItemIds.size === 0) return;
    this.saveSnapshot();
    const newItems = [];
    const nowIso = new Date().toISOString();
    this.items.forEach(it => {
      if (this.selectedItemIds.has(it.id)) {
        const copy = JSON.parse(JSON.stringify(it));
        copy.id = it.type + '_' + Date.now() + Math.random().toString(36).substr(2, 4);
        copy.createdAt = nowIso;
        copy.updatedAt = nowIso;
        copy.x += 30;
        copy.y += 30;
        newItems.push(copy);
      }
    });
    this.items.push(...newItems);
    this.selectedItemIds.clear();
    newItems.forEach(copy => this.selectedItemIds.add(copy.id));
    if (this.onSelectionChange) this.onSelectionChange(Array.from(this.selectedItemIds));
    if (this.onBoardModified) this.onBoardModified();
    this.render();
  }

  extractYouTubeVideoId(url) {
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

  extractDomain(url) {
    if (!url) return 'ENLACE';
    try {
      return new URL(url).hostname.replace(/^www\./, '').toUpperCase();
    } catch (e) {
      return 'ENLACE';
    }
  }

  extractTitle(url) {
    if (!url) return '';
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, '').toUpperCase();
      if (host.includes('YOUTUBE')) {
        const m = u.pathname.match(/@([^\/\?]+)/) || u.pathname.match(/\/(?:c|user|channel)\/([^\/\?]+)/);
        if (m) return m[1].startsWith('@') ? m[1] : '@' + m[1];
        const v = u.searchParams.get('v');
        if (v) return 'Video: ' + v;
        return 'YouTube';
      }
      if (host.includes('GITHUB')) {
        const parts = u.pathname.split('/').filter(Boolean);
        return parts.length > 0 ? parts.join('/') : 'GitHub';
      }
      const pathClean = decodeURIComponent(u.pathname.replace(/^\/|\/$/g, ''));
      if (pathClean) {
        const parts = pathClean.split('/');
        let name = parts[parts.length - 1].replace(/[-_]/g, ' ');
        return name.charAt(0).toUpperCase() + name.slice(1);
      }
      const parts = host.split('.');
      return parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
    } catch (e) {
      return url;
    }
  }

  // Mover elementos seleccionados (simple o múltiple) con soporte para marcos, hijos, trazos y conectores
  moveSelected(dx, dy, saveHistory = true) {
    if (this.selectedItemIds.size === 0 || (dx === 0 && dy === 0)) return;
    if (saveHistory) {
      this.saveSnapshot();
    }
    const moveItemIds = new Set(this.selectedItemIds);
    this.items.forEach(it => {
      if (this.selectedItemIds.has(it.id) && it.type === 'frame') {
        const frame = it;
        this.items.forEach(child => {
          if (child.id !== frame.id && (child.parentId === frame.id || this.isItemInsideFrame(child, frame))) {
            moveItemIds.add(child.id);
          }
        });
      }
    });

    this.items.forEach(it => {
      if (moveItemIds.has(it.id)) {
        if (it.type === 'pen') {
          it.points.forEach(p => { p.x += dx; p.y += dy; });
        } else if (it.type === 'connector') {
          it.start.x += dx; it.start.y += dy;
          it.end.x += dx; it.end.y += dy;
        } else {
          it.x += dx;
          it.y += dy;
          this.updateConnectedLinesForItem(it);
        }
      }
    });

    this.render();
    if (this.onCameraChange) this.onCameraChange();
    if (this.onBoardModified) this.onBoardModified();
  }

  selectAll() {
    this.selectedItemIds.clear();
    this.items.forEach(it => this.selectedItemIds.add(it.id));
    if (this.onSelectionChange) this.onSelectionChange(Array.from(this.selectedItemIds));
    this.render();
  }
}
