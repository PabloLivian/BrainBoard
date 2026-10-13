// Motor de Lienzo Infinito 2D estilo Miro
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
    this.activeColor = '#fff9b0'; // Amarillo por defecto Miro

    // Estados de interaccion
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };
    this.isDraggingItem = false;
    this.dragStart = { x: 0, y: 0 };
    this.isResizing = false;
    this.activeResizeHandle = null;
    this.resizeTargetItem = null;
    this.resizeInitialBounds = null;
    this.resizeStartWorld = null;
    this.isSelectingMarquee = false;
    this.marqueeBox = null;
    this.currentDrawing = null;
    this.activeConnector = null;
    this.isConnectingFromPort = false;
    this.connectorStartItem = null;
    this.connectorStartPort = null;
    this.hoveredSnapPort = null;
    this.hoveredConnectorPort = null;

    // Smart Guides magnéticas (Alineación estilo Miro)
    this.smartGuidesEnabled = true;
    this.activeGuides = [];

    // Minimap bounds
    this.minimapBounds = null;

    // Callbacks
    this.onSelectionChange = null;
    this.onZoomChange = null;
    this.onCameraChange = null;
    this.onBoardModified = null;
    this.onCommentClick = null;
    this.onCommentCreated = null;
    this.onEditingFinish = null;

    // ID del elemento que se esta editando in-situ (para no duplicar texto)
    this.editingItemId = null;
    this.isSpacePressed = false;

    this.initCanvasSize();
    this.bindEvents();
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

  getItemAt(wx, wy, excludeFrames = false) {
    // Para respetar la jerarquía visual idéntica a render(), buscamos de la capa superior a la inferior:
    // Capa 7: Comentarios (pins burbuja en el nivel superior)
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      if (it.type === 'comment') {
        const d = Math.hypot(it.x - wx, it.y - wy);
        if (d <= 20) return it;
      }
    }

    // Capa 6: Trazos de pluma (pen)
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      if (it.type === 'pen' && it.points) {
        for (const pt of it.points) {
          const d = Math.hypot(pt.x - wx, pt.y - wy);
          if (d < (it.strokeWidth || 4) + 6) return it;
        }
      }
    }

    // Capa 5: Textos (los textos van sobre formas e imágenes)
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      if (it.type === 'text') {
        if (wx >= it.x && wx <= it.x + (it.width || 100) && wy >= it.y && wy <= it.y + (it.height || 40)) {
          return it;
        }
      }
    }

    // Capa 4: Notas adhesivas
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      if (it.type === 'sticky_note') {
        if (wx >= it.x && wx <= it.x + (it.width || 100) && wy >= it.y && wy <= it.y + (it.height || 100)) {
          return it;
        }
      }
    }

    // Capa 3: Bloques de código, embeds, cartas, imágenes
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      if (it.type === 'image' || it.type === 'code' || it.type === 'embed' || it.type === 'preview') {
        if (wx >= it.x && wx <= it.x + (it.width || 100) && wy >= it.y && wy <= it.y + (it.height || 100)) {
          return it;
        }
      }
    }

    // Capa 2: Formas (shapes)
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      if (it.type === 'shape') {
        if (wx >= it.x && wx <= it.x + (it.width || 100) && wy >= it.y && wy <= it.y + (it.height || 100)) {
          return it;
        }
      }
    }

    // Capa 1: Conectores
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      if (it.type === 'connector') {
        if (!it.start || !it.end || typeof it.start.x !== 'number' || typeof it.end.x !== 'number') continue;
        const d = this.distToSegment({ x: wx, y: wy }, it.start, it.end);
        if (d < 10) return it;
      }
    }

    // Capa 0: Marcos contenedores (frames de fondo)
    if (!excludeFrames) {
      for (let i = this.items.length - 1; i >= 0; i--) {
        const it = this.items[i];
        if (it.type === 'frame') {
          if (wx >= it.x && wx <= it.x + (it.width || 200) && wy >= it.y && wy <= it.y + (it.height || 200)) {
            return it;
          }
        }
      }
    }

    return null;
  }

  // Comprueba si un punto (wx, wy) cae sobre la pestaña del título o el borde perimetral del frame
  isPointOnFrameHeaderOrBorder(frame, wx, wy) {
    if (!frame) return false;
    const tabHeight = 30;
    const tabWidth = Math.max(80, (frame.title ? frame.title.length * 10 : 70) + 30);
    // Pestaña superior del marco
    if (wx >= frame.x && wx <= frame.x + tabWidth && wy >= frame.y - tabHeight && wy <= frame.y + 8) {
      return true;
    }
    // Borde perimetral del marco (franja de 10px)
    const margin = 8;
    const isInsideOuter = wx >= frame.x - margin && wx <= frame.x + frame.width + margin &&
                          wy >= frame.y - margin && wy <= frame.y + frame.height + margin;
    const isInsideInner = wx >= frame.x + margin && wx <= frame.x + frame.width - margin &&
                          wy >= frame.y + margin && wy <= frame.y + frame.height - margin;
    return isInsideOuter && !isInsideInner;
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

  // Obtener los 8 puntos de anclaje de redimensionamiento estilo Miro
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

  // Obtener los 4 puertos de conexión en los puntos medios de los lados estilo Miro
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
    try {
      if (window.require) {
        const { shell } = window.require('electron');
        shell.openExternal(url);
        return;
      }
    } catch (e) {}
    window.open(url, '_blank');
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
    mctx.fillStyle = '#f8f9fa';
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
        mctx.fillStyle = it.fillColor || '#cbd5e1';
        mctx.fillRect(ix, iy, iw, ih);
        mctx.strokeStyle = '#94a3b8';
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

  // =========================================================
  // 3. EXPORTACIÓN EN ALTA RESOLUCIÓN (4K / ULTRA-HD)
  // =========================================================
  async exportHiRes({ bounds = null, scale = 2, filename = 'tablero_4k.png' } = {}) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    if (bounds) {
      minX = bounds.x;
      minY = bounds.y;
      maxX = bounds.x + bounds.width;
      maxY = bounds.y + bounds.height;
    } else {
      this.items.forEach(it => {
        const x = it.x || 0;
        const y = it.y || 0;
        const w = it.width || 50;
        const h = it.height || 50;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + w);
        maxY = Math.max(maxY, y + h);
      });
      const pad = 60;
      minX -= pad; minY -= pad; maxX += pad; maxY += pad;
    }

    if (!isFinite(minX)) return false;

    const expW = Math.max(200, Math.round(maxX - minX));
    const expH = Math.max(200, Math.round(maxY - minY));

    const offCanvas = document.createElement('canvas');
    offCanvas.width = Math.round(expW * scale);
    offCanvas.height = Math.round(expH * scale);
    const octx = offCanvas.getContext('2d');

    // Fondo limpio
    octx.scale(scale, scale);
    octx.translate(-minX, -minY);
    octx.fillStyle = '#f8f9fa';
    octx.fillRect(minX, minY, expW, expH);

    const origCtx = this.ctx;
    const origZoom = this.camera.zoom;
    this.ctx = octx;
    this.camera.zoom = 1;

    try {
      this.items.filter(it => it.type === 'frame').forEach(it => this.drawFrame(it));
      this.items.filter(it => it.type === 'connector').forEach(it => this.drawConnector(it));
      this.items.filter(it => it.type === 'shape').forEach(it => this.drawShape(it));
      this.items.filter(it => it.type === 'code').forEach(it => this.drawCodeBlock(it));
      this.items.filter(it => it.type === 'embed' || it.type === 'preview').forEach(it => this.drawEmbed(it));
      this.items.filter(it => it.type === 'image').forEach(it => this.drawImage(it));
      this.items.filter(it => it.type === 'sticky_note').forEach(it => this.drawStickyNote(it));
      this.items.filter(it => it.type === 'text').forEach(it => this.drawText(it));
      this.items.filter(it => it.type === 'pen').forEach(it => this.drawPen(it));
      this.items.filter(it => it.type === 'comment').forEach(it => this.drawComment(it));
    } finally {
      this.ctx = origCtx;
      this.camera.zoom = origZoom;
    }

    const dataUrl = offCanvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.click();
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
      // Zoom directo con rueda centrado en el cursor (estilo Miro)
      const factor = e.deltaY < 0 ? 1.12 : 0.88;
      this.zoomAt(e.clientX, e.clientY, factor);
    }, { passive: false });

    // Soporte para desplazar (pan) manteniendo la barra espaciadora pulsada
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        this.isSpacePressed = true;
        if (!this.isPanning) this.canvas.style.cursor = 'grab';
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.isSpacePressed = false;
        if (!this.isPanning) this.canvas.style.cursor = this.activeTool === 'hand' ? 'grab' : 'default';
      }
    });

    this.canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    window.addEventListener('pointermove', (e) => this.onPointerMove(e));
    window.addEventListener('pointerup', (e) => this.onPointerUp(e));
  }

  onPointerDown(e) {
    if (this.onEditingFinish) {
      this.onEditingFinish();
    }

    // Clic central, derecho, herramienta mano o barra espaciadora = Pan
    if (e.button === 1 || e.button === 2 || this.activeTool === 'hand' || this.isSpacePressed) {
      this.isPanning = true;
      this.panStart = { x: e.clientX, y: e.clientY };
      this.canvas.style.cursor = 'grabbing';
      return;
    }

    const world = this.screenToWorld(e.clientX, e.clientY);

    if (this.activeTool === 'select') {
      // 1. Comprobar primero si se ha pulsado en un controlador circular de conexión (Miro Connector Port)
      const portHit = this.getConnectorPortAt(world.x, world.y);
      if (portHit) {
        this.saveSnapshot();
        this.isConnectingFromPort = true;
        this.connectorStartItem = portHit.item;
        this.connectorStartPort = portHit.port;
        this.activeConnector = {
          id: Date.now().toString(),
          type: 'connector',
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

        if (!e.shiftKey) {
          if (!this.selectedItemIds.has(clickedItem.id)) {
            this.selectedItemIds.clear();
            this.selectedItemIds.add(clickedItem.id);
          }
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
        const onHeaderOrBorder = this.isPointOnFrameHeaderOrBorder(frameUnder, world.x, world.y);

        if (isFrameSelected || onHeaderOrBorder) {
          // El usuario clickeó deliberadamente la cabecera, borde o un marco ya seleccionado
          if (!e.shiftKey) {
            if (!isFrameSelected) {
              this.selectedItemIds.clear();
              this.selectedItemIds.add(frameUnder.id);
            }
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
      const newNote = {
        id: 'note_' + Date.now(),
        type: 'sticky_note',
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
      const newShape = {
        id: 'shape_' + Date.now(),
        type: 'shape',
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
      const newText = {
        id: 'text_' + Date.now(),
        type: 'text',
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
      this.currentDrawing = {
        id: 'pen_' + Date.now(),
        type: 'pen',
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
      this.activeConnector = {
        id: 'conn_' + Date.now(),
        type: 'connector',
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
      const newFrame = {
        id: 'frame_' + Date.now(),
        type: 'frame',
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
      const newComment = {
        id: 'comment_' + Date.now(),
        type: 'comment',
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

    // 0. Arrastre de conector/flecha desde un puerto circular (Miro Connector Drag)
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
        this.saveSnapshot();
        this.hasMovedItem = true;
      }
      const dx = world.x - this.dragStart.x;
      const dy = world.y - this.dragStart.y;

      let moveDx = dx;
      let moveDy = dy;

      // Smart Guides magnéticas si se arrastra un único elemento
      if (this.selectedItemIds.size === 1) {
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
      } else {
        const itemUnder = this.getItemAt(world.x, world.y, true);
        if (itemUnder) {
          this.canvas.style.cursor = 'move';
        } else {
          const frameUnder = this.getItemAt(world.x, world.y, false);
          if (frameUnder && frameUnder.type === 'frame' && (this.selectedItemIds.has(frameUnder.id) || this.isPointOnFrameHeaderOrBorder(frameUnder, world.x, world.y))) {
            this.canvas.style.cursor = 'move';
          } else {
            this.canvas.style.cursor = 'default';
          }
        }
      }
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
          newSelection.add(it.id);
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
    if (this.hasMovedItem) {
      this.hasMovedItem = false;
      if (this.onBoardModified) this.onBoardModified();
    }
    this.isDraggingItem = false;
    this.dragStartScreen = null;
    this.activeGuides = [];

    if (this.isSelectingMarquee) {
      if (this.potentialFrameClick) {
        // Clic simple en el interior de un frame sin arrastrar (< 4px de movimiento)
        if (!e.shiftKey) {
          this.selectedItemIds.clear();
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
    this.ctx.fillStyle = '#f8f9fa';
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

      // 1. Marcos (fondo)
      this.items.filter(it => it.type === 'frame' && isVisible(it)).forEach(it => {
        try { this.drawFrame(it); } catch (e) { console.error('Error al dibujar marco:', e); }
      });

      // 2. Conectores
      this.items.filter(it => it.type === 'connector').forEach(it => {
        try { this.drawConnector(it); } catch (e) { console.error('Error al dibujar conector:', e); }
      });

      // 3. Formas, embeds, codigo
      this.items.filter(it => it.type === 'shape' && isVisible(it)).forEach(it => {
        try { this.drawShape(it); } catch (e) { console.error('Error al dibujar forma:', e); }
      });
      this.items.filter(it => it.type === 'code' && isVisible(it)).forEach(it => {
        try { this.drawCodeBlock(it); } catch (e) { console.error('Error al dibujar codigo:', e); }
      });
      this.items.filter(it => (it.type === 'embed' || it.type === 'preview') && isVisible(it)).forEach(it => {
        try { this.drawEmbed(it); } catch (e) { console.error('Error al dibujar embed:', e); }
      });

      // 4. Imagenes
      this.items.filter(it => it.type === 'image' && isVisible(it)).forEach(it => {
        try { this.drawImage(it); } catch (e) { console.error('Error al dibujar imagen:', e); }
      });

      // 5. Notas adhesivas
      this.items.filter(it => it.type === 'sticky_note' && isVisible(it)).forEach(it => {
        try { this.drawStickyNote(it); } catch (e) { console.error('Error al dibujar nota adhesiva:', e); }
      });

      // 6. Textos y dibujo a mano alzada
      this.items.filter(it => it.type === 'text' && it.fillColor && it.fillColor !== 'transparent' && isVisible(it)).forEach(it => {
        try { this.drawText(it); } catch (e) { console.error('Error al dibujar texto con fondo:', e); }
      });
      this.items.filter(it => it.type === 'text' && (!it.fillColor || it.fillColor === 'transparent') && isVisible(it)).forEach(it => {
        try { this.drawText(it); } catch (e) { console.error('Error al dibujar texto libre:', e); }
      });
      this.items.filter(it => it.type === 'pen').forEach(it => {
        try { this.drawPen(it); } catch (e) { console.error('Error al dibujar trazo:', e); }
      });

      // 7. Comentarios estilo Miro (Pin burbuja)
      this.items.filter(it => it.type === 'comment' && isVisible(it)).forEach(it => {
        try { this.drawComment(it); } catch (e) { console.error('Error al dibujar comentario:', e); }
      });

      // 8. Smart Guides magnéticas
      this.drawSmartGuides();

      // 9. Seleccion y recuadro marquee
      this.drawSelectionOutline();
      this.drawMarquee();
    } finally {
      this.ctx.restore();
    }
  }

  drawDotGrid() {
    const spacing = 32 * this.camera.zoom;
    if (spacing < 12) return; // Muy alejado, no dibujar para rendimiento

    const offsetX = (this.width / 2 + this.camera.x * this.camera.zoom) % spacing;
    const offsetY = (this.height / 2 + this.camera.y * this.camera.zoom) % spacing;

    this.ctx.fillStyle = '#d0d0d6';
    const dotSize = Math.max(1, Math.min(2, 1.5 * this.camera.zoom));

    for (let x = offsetX; x < this.width; x += spacing) {
      for (let y = offsetY; y < this.height; y += spacing) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, dotSize, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
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

    // Doblez de esquina inferior derecha estilo Miro
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
      const fontStyle = it.isItalic ? 'italic ' : '';
      this.ctx.fillStyle = it.textColor || '#1a1a1a';
      this.ctx.font = `${fontStyle}${isBold}${fontSize}px ${fontFamily}`;
      this.ctx.textAlign = it.textAlign || 'center';
      this.ctx.textBaseline = 'middle';
      this.wrapText(this.ctx, it.text, it.x + it.width / 2, it.y + it.height / 2, it.width - 24, fontSize + 5, it.textAlign || 'center');
    }

    this.ctx.restore();
  }

  drawShape(it) {
    this.ctx.save();
    this.ctx.fillStyle = it.fillColor || '#ffffff';
    this.ctx.strokeStyle = it.strokeColor || '#1a1a1a';
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
      if (it.fillColor && it.fillColor.startsWith('#')) {
        const hex = it.fillColor.replace('#', '');
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
      this.ctx.fillStyle = it.textColor || (isDarkBg ? '#ffffff' : (it.strokeColor || '#1a1a1a'));
      this.ctx.font = `${fontStyle}${isBold ? '700 ' : '400 '}${fontSize}px ${fontFamily}`;
      this.ctx.textAlign = it.textAlign || 'center';
      this.ctx.textBaseline = 'middle';
      this.wrapText(this.ctx, it.text, it.x + it.width / 2, it.y + it.height / 2, it.width - 16, fontSize + 6, it.textAlign || 'center');
    }

    this.ctx.restore();
  }

  drawText(it) {
    this.ctx.save();
    const hasFill = Boolean(it.fillColor && it.fillColor !== 'transparent');

    // Si tiene relleno, dibujar la caja / banner / tarjeta
    if (hasFill) {
      this.ctx.fillStyle = it.fillColor;
      const radius = Math.min(8, it.height / 4);
      this.ctx.beginPath();
      this.roundRect(this.ctx, it.x, it.y, it.width, it.height, radius);
      this.ctx.fill();

      if (it.fillColor === '#bbcbd2') {
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

    let textColor = it.textColor || it.color || '#1a1a1a';
    if (hasFill) {
      if (it.fillColor === '#2d2d2d' || it.fillColor === '#40414c' || it.fillColor === '#1a1a1a') {
        textColor = it.textColor || it.color || '#ffffff';
      } else if (it.fillColor === '#bbcbd2') {
        textColor = it.textColor || it.color || '#1a1a1a';
      }
    }
    this.ctx.fillStyle = textColor;

    const align = it.textAlign || (hasFill ? 'center' : 'left');
    this.ctx.textAlign = align;

    if (align === 'center') {
      this.ctx.textBaseline = 'middle';
      const textX = it.x + it.width / 2;
      const textY = it.y + it.height / 2;
      const maxWidth = Math.max(20, it.width - 24);
      const lineHeight = Math.round(fontSize * 1.3);
      this.wrapText(this.ctx, it.text || '', textX, textY, maxWidth, lineHeight, 'center');
    } else if (align === 'right') {
      this.ctx.textBaseline = 'top';
      const padX = hasFill ? 14 : 0;
      const padY = hasFill ? 10 : 0;
      const textX = it.x + (it.width || 400) - padX;
      const textY = it.y + padY;
      const maxWidth = Math.max(20, (it.width || 400) - padX * 2);
      const lineHeight = Math.round(fontSize * 1.35);
      this.wrapText(this.ctx, it.text || '', textX, textY, maxWidth, lineHeight, 'right');
    } else {
      this.ctx.textBaseline = 'top';
      const padX = hasFill ? 14 : 0;
      const padY = hasFill ? 10 : 0;
      const textX = it.x + padX;
      const textY = it.y + padY;
      const maxWidth = Math.max(20, (it.width || 400) - padX * 2);
      const lineHeight = Math.round(fontSize * 1.35);
      this.wrapText(this.ctx, it.text || '', textX, textY, maxWidth, lineHeight, 'top');
    }

    this.ctx.restore();
  }

  drawCodeBlock(it) {
    this.ctx.save();
    const r = 8;
    const headerH = 30;

    // Caja oscura del bloque de código estilo Miro
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
    this.ctx.save();
    const r = 10;
    const isCompact = !it.src || it.height <= 300;
    const thumbH = isCompact ? 0 : Math.max(60, Math.round(it.height * 0.52));

    // 1. Sombra suave de la tarjeta widget
    this.ctx.save();
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
    this.ctx.shadowBlur = 8 / this.camera.zoom;
    this.ctx.shadowOffsetY = 3 / this.camera.zoom;
    this.ctx.fillStyle = '#ffffff';
    this.ctx.beginPath();
    this.roundRect(this.ctx, it.x, it.y, it.width, it.height, r);
    this.ctx.fill();
    this.ctx.restore();

    // Borde exterior sutil
    this.ctx.strokeStyle = '#e2e8f0';
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
          it.imgElement.src = it.src;
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
      this.ctx.strokeStyle = '#f1f5f9';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(it.x, it.y + thumbH);
      this.ctx.lineTo(it.x + it.width, it.y + thumbH);
      this.ctx.stroke();
    }

    // 3. Insignia flotante / Favicon de la plataforma (estilo Miro exacto)
    const badgeX = it.x + 12;
    const badgeY = it.y + 12;
    const badgeSize = isCompact ? 24 : 26;
    this.ctx.save();
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
    this.ctx.shadowBlur = 4;
    this.ctx.shadowOffsetY = 1;
    this.ctx.fillStyle = '#ffffff';
    this.ctx.beginPath();
    this.roundRect(this.ctx, badgeX, badgeY, badgeSize, badgeSize, 5);
    this.ctx.fill();
    this.ctx.strokeStyle = '#e2e8f0';
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
      this.ctx.fillStyle = '#181717';
      this.ctx.font = '700 12px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('⚡', badgeX + badgeSize / 2, badgeY + badgeSize / 2);
    } else {
      this.ctx.fillStyle = '#3b82f6';
      this.ctx.font = '13px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('🌐', badgeX + badgeSize / 2, badgeY + badgeSize / 2);
    }

    // Para tarjetas compactas, mostrar el dominio al lado del badge en la cabecera
    if (isCompact) {
      this.ctx.fillStyle = '#64748b';
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
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
    this.ctx.shadowBlur = 3;
    this.ctx.beginPath();
    this.ctx.arc(btnX + btnSize / 2, btnY + btnSize / 2, btnSize / 2, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.strokeStyle = '#e2e8f0';
    this.ctx.lineWidth = 1;
    this.ctx.stroke();
    this.ctx.fillStyle = '#475569';
    this.ctx.font = '700 11px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('↗', btnX + btnSize / 2, btnY + btnSize / 2);
    this.ctx.restore();

    // 5. Sección de textos (Dominio, Título y Descripción)
    const contentStartY = isCompact ? it.y + 46 : it.y + thumbH + 12;
    let curTextY = contentStartY;

    if (!isCompact) {
      this.ctx.fillStyle = '#64748b';
      this.ctx.font = '600 10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'top';
      this.ctx.fillText(it.domain ? it.domain.toLowerCase() : domain.toLowerCase(), it.x + 14, curTextY);
      curTextY += 16;
    }

    const title = it.title || this.extractTitle(it.url) || domain;
    this.ctx.fillStyle = '#0f172a';
    this.ctx.font = '700 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';
    const linesUsed = this.wrapText(this.ctx, title, it.x + 14, curTextY, it.width - 28, 16, 'top', 2);
    curTextY += (linesUsed || 1) * 16 + 4;

    if (it.description && curTextY < it.y + it.height - 20) {
      this.ctx.fillStyle = '#64748b';
      this.ctx.font = '400 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'top';
      const availableH = (it.y + it.height - 18) - curTextY;
      const maxDescLines = Math.max(1, Math.floor(availableH / 14));
      this.wrapText(this.ctx, it.description, it.x + 14, curTextY, it.width - 28, 14, 'top', maxDescLines);
    } else if (isCompact && !it.description && it.url) {
      this.ctx.fillStyle = '#94a3b8';
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
    this.ctx.strokeStyle = it.color || '#1a1a1a';
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
    this.ctx.strokeStyle = it.color || '#333333';
    this.ctx.lineWidth = it.strokeWidth || 2;
    this.ctx.beginPath();
    this.ctx.moveTo(it.start.x, it.start.y);
    this.ctx.lineTo(it.end.x, it.end.y);
    this.ctx.stroke();

    // Flecha en el final
    const angle = Math.atan2(it.end.y - it.start.y, it.end.x - it.start.x);
    const arrowLen = 12;
    this.ctx.fillStyle = it.color || '#333333';
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

    // Relleno sólido/suave del marco: en Miro las columnas usan #bbcbd2
    const fillColor = it.fillColor || '#bbcbd2';
    this.ctx.fillStyle = fillColor;
    this.ctx.fillRect(it.x, it.y, it.width, it.height);

    // Borde limpio y elegante
    this.ctx.strokeStyle = '#94a3b8';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(it.x, it.y, it.width, it.height);

    // Etiqueta del marco arriba si tiene título
    if (it.title) {
      const titleFont = '600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      this.ctx.font = titleFont;
      const textWidth = this.ctx.measureText(it.title).width;
      const tabWidth = Math.max(70, textWidth + 24);
      const tabHeight = 26;

      this.ctx.fillStyle = '#475569';
      this.ctx.beginPath();
      this.roundRect(this.ctx, it.x, it.y - tabHeight, tabWidth, tabHeight, 4);
      this.ctx.fill();

      this.ctx.fillStyle = '#ffffff';
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(it.title, it.x + 12, it.y - tabHeight / 2);
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
      it.imgElement.src = it.src;
      return;
    }
    if (it.imgElement && it.imgElement.complete && it.imgElement.naturalWidth > 0) {
      this.ctx.drawImage(it.imgElement, it.x, it.y, it.width, it.height);
    }
  }

  drawComment(it) {
    this.ctx.save();
    const x = it.x;
    const y = it.y;
    const r = 16;
    const isResolved = it.resolved;
    const isSelected = this.selectedItemIds.has(it.id);
    const bg = isResolved ? '#10b981' : '#f59e0b'; // Verde o Naranja Miro

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
    this.ctx.strokeStyle = '#ff007a'; // Magenta guía Miro
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

      // Rectángulo delimitador exterior con color azul Miro
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

        // 3. Controladores circulares de conexión en el medio de los 4 lados para tirar flechas (Miro Connector Ports)
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
    this.ctx.fillStyle = 'rgba(66, 98, 255, 0.08)';
    this.ctx.strokeStyle = '#4262ff';
    this.ctx.lineWidth = 1 / this.camera.zoom;
    this.ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
    this.ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
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
    if (align === 'center') {
      startY = y - ((renderLines.length - 1) * lineHeight) / 2;
    }

    renderLines.forEach((line, idx) => {
      ctx.fillText(line, x, startY + idx * lineHeight);
    });

    return renderLines.length;
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
    this.items.forEach(it => {
      if (this.selectedItemIds.has(it.id)) {
        const copy = JSON.parse(JSON.stringify(it));
        copy.id = it.type + '_' + Date.now() + Math.random().toString(36).substr(2, 4);
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
        const m = u.pathname.match(/@([^\/\?]+)/);
        if (m) return '@' + m[1];
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
}
