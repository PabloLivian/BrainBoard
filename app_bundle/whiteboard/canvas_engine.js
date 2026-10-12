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
    this.resizeHandle = null;
    this.isSelectingMarquee = false;
    this.marqueeBox = null;
    this.currentDrawing = null;
    this.activeConnector = null;

    // Callbacks
    this.onSelectionChange = null;
    this.onZoomChange = null;
    this.onBoardModified = null;

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

  saveSnapshot() {
    this.undoStack.push(JSON.stringify(this.items));
    if (this.undoStack.length > 50) this.undoStack.shift();
    this.redoStack = [];
    if (this.onBoardModified) this.onBoardModified();
  }

  undo() {
    if (this.undoStack.length === 0) return;
    this.redoStack.push(JSON.stringify(this.items));
    const prev = this.undoStack.pop();
    this.items = JSON.parse(prev);
    this.selectedItemIds.clear();
    this.render();
    if (this.onBoardModified) this.onBoardModified();
  }

  redo() {
    if (this.redoStack.length === 0) return;
    this.undoStack.push(JSON.stringify(this.items));
    const next = this.redoStack.pop();
    this.items = JSON.parse(next);
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
    this.render();
  }

  fitView() {
    if (this.items.length === 0) {
      this.camera = { x: 0, y: 0, zoom: 1 };
      this.render();
      if (this.onZoomChange) this.onZoomChange(1);
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
  }

  getItemAt(wx, wy) {
    // Buscar en orden inverso (elementos mas al frente primero)
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      if (it.type === 'pen') {
        // Distancia a trazo
        for (const pt of it.points) {
          const d = Math.hypot(pt.x - wx, pt.y - wy);
          if (d < (it.strokeWidth || 4) + 6) return it;
        }
      } else if (it.type === 'connector') {
        if (!it.start || !it.end || typeof it.start.x !== 'number' || typeof it.end.x !== 'number') continue;
        const d = this.distToSegment({ x: wx, y: wy }, it.start, it.end);
        if (d < 10) return it;
      } else {
        if (wx >= it.x && wx <= it.x + it.width && wy >= it.y && wy <= it.y + it.height) {
          return it;
        }
      }
    }
    return null;
  }

  distToSegment(p, v, w) {
    const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
  }

  bindEvents() {
    window.addEventListener('resize', () => {
      this.initCanvasSize();
      this.render();
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        // Zoom con rueda
        const factor = e.deltaY < 0 ? 1.15 : 0.85;
        this.zoomAt(e.clientX, e.clientY, factor);
      } else {
        // Desplazamiento (Pan) con rueda
        this.camera.x -= e.deltaX / this.camera.zoom;
        this.camera.y -= e.deltaY / this.camera.zoom;
        this.render();
      }
    }, { passive: false });

    this.canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    window.addEventListener('pointermove', (e) => this.onPointerMove(e));
    window.addEventListener('pointerup', (e) => this.onPointerUp(e));
  }

  onPointerDown(e) {
    // Clic central, derecho o barra espaciadora = Pan
    if (e.button === 1 || e.button === 2 || this.activeTool === 'hand' || e.spaceKey) {
      this.isPanning = true;
      this.panStart = { x: e.clientX, y: e.clientY };
      this.canvas.style.cursor = 'grabbing';
      return;
    }

    const world = this.screenToWorld(e.clientX, e.clientY);

    if (this.activeTool === 'select') {
      const clicked = this.getItemAt(world.x, world.y);
      if (clicked) {
        if (!e.shiftKey) {
          if (!this.selectedItemIds.has(clicked.id)) {
            this.selectedItemIds.clear();
            this.selectedItemIds.add(clicked.id);
          }
        } else {
          if (this.selectedItemIds.has(clicked.id)) {
            this.selectedItemIds.delete(clicked.id);
          } else {
            this.selectedItemIds.add(clicked.id);
          }
        }
        this.isDraggingItem = true;
        this.dragStart = { x: world.x, y: world.y };
        this.saveSnapshot();
      } else {
        // Iniciar seleccion por recuadro (Marquee)
        if (!e.shiftKey) this.selectedItemIds.clear();
        this.isSelectingMarquee = true;
        this.marqueeBox = { startX: world.x, startY: world.y, currentX: world.x, currentY: world.y };
      }
      if (this.onSelectionChange) this.onSelectionChange(Array.from(this.selectedItemIds));
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
      return;
    }

    const world = this.screenToWorld(e.clientX, e.clientY);

    if (this.isDraggingItem) {
      const dx = world.x - this.dragStart.x;
      const dy = world.y - this.dragStart.y;
      this.items.forEach(it => {
        if (this.selectedItemIds.has(it.id)) {
          if (it.type === 'pen') {
            it.points.forEach(p => { p.x += dx; p.y += dy; });
          } else if (it.type === 'connector') {
            it.start.x += dx; it.start.y += dy;
            it.end.x += dx; it.end.y += dy;
          } else {
            it.x += dx;
            it.y += dy;
          }
        }
      });
      this.dragStart = { x: world.x, y: world.y };
      this.render();
      return;
    }

    if (this.isSelectingMarquee && this.marqueeBox) {
      this.marqueeBox.currentX = world.x;
      this.marqueeBox.currentY = world.y;

      const minX = Math.min(this.marqueeBox.startX, this.marqueeBox.currentX);
      const maxX = Math.max(this.marqueeBox.startX, this.marqueeBox.currentX);
      const minY = Math.min(this.marqueeBox.startY, this.marqueeBox.currentY);
      const maxY = Math.max(this.marqueeBox.startY, this.marqueeBox.currentY);

      this.selectedItemIds.clear();
      this.items.forEach(it => {
        if (it.x >= minX && it.x + (it.width || 0) <= maxX &&
            it.y >= minY && it.y + (it.height || 0) <= maxY) {
          this.selectedItemIds.add(it.id);
        }
      });
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
    if (this.isPanning) {
      this.isPanning = false;
      this.canvas.style.cursor = this.activeTool === 'hand' ? 'grab' : 'default';
    }
    this.isDraggingItem = false;
    this.isSelectingMarquee = false;
    this.marqueeBox = null;
    this.currentDrawing = null;
    if (this.activeConnector) {
      this.activeConnector = null;
      this.activeTool = 'select';
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
      this.items.filter(it => it.type === 'frame' && isVisible(it)).forEach(it => this.drawFrame(it));

      // 2. Conectores
      this.items.filter(it => it.type === 'connector').forEach(it => this.drawConnector(it));

      // 3. Formas, embeds, codigo
      this.items.filter(it => it.type === 'shape' && isVisible(it)).forEach(it => this.drawShape(it));
      this.items.filter(it => it.type === 'code' && isVisible(it)).forEach(it => this.drawCodeBlock(it));
      this.items.filter(it => (it.type === 'embed' || it.type === 'preview') && isVisible(it)).forEach(it => this.drawEmbed(it));

      // 4. Imagenes
      this.items.filter(it => it.type === 'image' && isVisible(it)).forEach(it => this.drawImage(it));

      // 5. Notas adhesivas
      this.items.filter(it => it.type === 'sticky_note' && isVisible(it)).forEach(it => this.drawStickyNote(it));

      // 6. Textos y dibujo a mano alzada
      this.items.filter(it => it.type === 'text' && it.fillColor && it.fillColor !== 'transparent' && isVisible(it)).forEach(it => this.drawText(it));
      this.items.filter(it => it.type === 'text' && (!it.fillColor || it.fillColor === 'transparent') && isVisible(it)).forEach(it => this.drawText(it));
      this.items.filter(it => it.type === 'pen').forEach(it => this.drawPen(it));

      // 7. Seleccion y recuadro marquee
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
    if (it.text) {
      this.ctx.fillStyle = '#1a1a1a';
      this.ctx.font = '15px -apple-system, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.wrapText(this.ctx, it.text, it.x + it.width / 2, it.y + it.height / 2, it.width - 24, 20);
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

    if (it.text) {
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
      const fontSize = isHeader ? 22 : 14;
      this.ctx.fillStyle = it.textColor || (isDarkBg ? '#ffffff' : (it.strokeColor || '#1a1a1a'));
      this.ctx.font = `700 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.wrapText(this.ctx, it.text, it.x + it.width / 2, it.y + it.height / 2, it.width - 16, fontSize + 6);
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

    const fontSize = it.fontSize || 15;
    const isBold = hasFill || fontSize >= 24;
    this.ctx.font = `${isBold ? '700 ' : '400 '}${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

    let textColor = it.color || '#1a1a1a';
    if (hasFill) {
      if (it.fillColor === '#2d2d2d' || it.fillColor === '#40414c' || it.fillColor === '#1a1a1a') {
        textColor = it.color || '#ffffff';
      } else if (it.fillColor === '#bbcbd2') {
        textColor = it.color || '#1a1a1a';
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
    this.ctx.fillStyle = '#1e1e1e';
    this.ctx.strokeStyle = '#374151';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.roundRect(this.ctx, it.x, it.y, it.width, it.height, 8);
    this.ctx.fill();
    this.ctx.stroke();

    // Barra superior estilo terminal
    this.ctx.fillStyle = '#262626';
    this.ctx.beginPath();
    this.roundRect(this.ctx, it.x, it.y, it.width, Math.min(26, it.height), 8);
    this.ctx.fill();

    // Puntos de ventana (rojo, amarillo, verde)
    const dotY = it.y + 13;
    const colors = ['#ef4444', '#f59e0b', '#10b981'];
    colors.forEach((col, idx) => {
      this.ctx.fillStyle = col;
      this.ctx.beginPath();
      this.ctx.arc(it.x + 14 + idx * 14, dotY, 4, 0, Math.PI * 2);
      this.ctx.fill();
    });

    if (it.title) {
      this.ctx.fillStyle = '#9ca3af';
      this.ctx.font = '600 11px monospace';
      this.ctx.textAlign = 'right';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(it.title, it.x + it.width - 12, dotY);
    }

    if (it.text) {
      this.ctx.fillStyle = '#e2e8f0';
      this.ctx.font = '13px "Fira Code", Consolas, Menlo, monospace';
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'top';
      this.wrapText(this.ctx, it.text, it.x + 12, it.y + 34, it.width - 24, 18, 'top');
    }
    this.ctx.restore();
  }

  drawEmbed(it) {
    this.ctx.save();
    const r = 8;
    const thumbH = Math.max(60, Math.round(it.height * 0.60));

    // 1. Sombra suave y fondo blanco de la tarjeta widget
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
      if (!it.imgElement || it.imgElement.getAttribute('data-src') !== it.src) {
        it.imgElement = new Image();
        it.imgElement.setAttribute('data-src', it.src);
        it.imgElement.onload = () => this.render();
        it.imgElement.onerror = () => { it.imgFailed = true; };
        it.imgElement.src = it.src;
      }
      if (it.imgElement.complete && it.imgElement.naturalWidth > 0) {
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
        this.ctx.fillStyle = '#f8fafc';
        this.ctx.fillRect(it.x, it.y, it.width, thumbH);
      }
    } else {
      this.ctx.fillStyle = '#f1f5f9';
      this.ctx.fillRect(it.x, it.y, it.width, thumbH);
      this.ctx.fillStyle = '#94a3b8';
      this.ctx.font = '24px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('🔗', it.x + it.width / 2, it.y + thumbH / 2);
    }
    this.ctx.restore();

    // Línea divisoria entre miniatura y metadatos
    this.ctx.strokeStyle = '#f1f5f9';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(it.x, it.y + thumbH);
    this.ctx.lineTo(it.x + it.width, it.y + thumbH);
    this.ctx.stroke();

    // 3. Sección inferior: Metadatos del widget (Dominio y Título)
    const domain = (it.domain || this.extractDomain(it.url)).toUpperCase();
    this.ctx.fillStyle = '#64748b';
    this.ctx.font = '700 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';
    this.ctx.fillText(domain, it.x + 14, it.y + thumbH + 14);

    const title = it.title || this.extractTitle(it.url) || domain;
    this.ctx.fillStyle = '#0f172a';
    this.ctx.font = '600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';
    this.wrapText(this.ctx, title, it.x + 14, it.y + thumbH + 32, it.width - 28, 18, 'top');

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
    if (typeof it.start.x !== 'number' || typeof it.start.y !== 'number') return;
    if (typeof it.end.x !== 'number' || typeof it.end.y !== 'number') return;
    if (isNaN(it.start.x) || isNaN(it.start.y) || isNaN(it.end.x) || isNaN(it.end.y)) return;

    this.ctx.save();
    this.ctx.strokeStyle = it.color || '#1a1a1a';
    this.ctx.lineWidth = it.strokeWidth || 2;
    this.ctx.beginPath();
    this.ctx.moveTo(it.start.x, it.start.y);
    this.ctx.lineTo(it.end.x, it.end.y);
    this.ctx.stroke();

    // Flecha en el final
    const angle = Math.atan2(it.end.y - it.start.y, it.end.x - it.start.x);
    const arrowLen = 12;
    this.ctx.fillStyle = it.color || '#1a1a1a';
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
    if (!it.imgElement || it.imgElement.getAttribute('data-src') !== it.src) {
      it.imgElement = new Image();
      it.imgElement.setAttribute('data-src', it.src);
      it.imgElement.onload = () => this.render();
      it.imgElement.onerror = () => console.warn('No se pudo cargar la imagen local:', it.src);
      it.imgElement.src = it.src;
      return;
    }
    if (it.imgElement.complete && it.imgElement.naturalWidth > 0) {
      this.ctx.drawImage(it.imgElement, it.x, it.y, it.width, it.height);
    }
  }

  drawSelectionOutline() {
    if (this.selectedItemIds.size === 0) return;

    this.items.filter(it => this.selectedItemIds.has(it.id)).forEach(it => {
      if (it.type === 'pen' || it.type === 'connector') return;
      this.ctx.save();
      this.ctx.strokeStyle = '#4262ff';
      this.ctx.lineWidth = 2 / this.camera.zoom;
      this.ctx.strokeRect(it.x - 4, it.y - 4, it.width + 8, it.height + 8);

      // Puntos de ancla (resize handles)
      const handleSize = 8 / this.camera.zoom;
      this.ctx.fillStyle = '#ffffff';
      const corners = [
        [it.x - 4, it.y - 4],
        [it.x + it.width + 4, it.y - 4],
        [it.x - 4, it.y + it.height + 4],
        [it.x + it.width + 4, it.y + it.height + 4]
      ];
      corners.forEach(([cx, cy]) => {
        this.ctx.fillRect(cx - handleSize / 2, cy - handleSize / 2, handleSize, handleSize);
        this.ctx.strokeRect(cx - handleSize / 2, cy - handleSize / 2, handleSize, handleSize);
      });
      this.ctx.restore();
    });
  }

  drawMarquee() {
    if (!this.isSelectingMarquee || !this.marqueeBox) return;
    const minX = Math.min(this.marqueeBox.startX, this.marqueeBox.currentX);
    const maxX = Math.max(this.marqueeBox.startX, this.marqueeBox.currentX);
    const minY = Math.min(this.marqueeBox.startY, this.marqueeBox.currentY);
    const maxY = Math.max(this.marqueeBox.startY, this.marqueeBox.currentY);

    this.ctx.save();
    this.ctx.fillStyle = 'rgba(66, 98, 255, 0.1)';
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

  wrapText(ctx, text, x, y, maxWidth, lineHeight, align = 'center') {
    if (!text) return;
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

    let startY = y;
    if (align === 'center') {
      startY = y - ((lines.length - 1) * lineHeight) / 2;
    }

    lines.forEach((line, idx) => {
      ctx.fillText(line, x, startY + idx * lineHeight);
    });
  }

  // Eliminar seleccionados
  deleteSelected() {
    if (this.selectedItemIds.size === 0) return;
    this.saveSnapshot();
    this.items = this.items.filter(it => !this.selectedItemIds.has(it.id));
    this.selectedItemIds.clear();
    if (this.onSelectionChange) this.onSelectionChange([]);
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
