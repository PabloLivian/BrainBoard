// Motor de Lienzo Infinito 2D estilo Miro
class CanvasEngine {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');

    // Estado de la camara
    this.camera = { x: 0, y: 0, zoom: 1 };
    this.minZoom = 0.1;
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
    this.canvas.width = this.width * window.devicePixelRatio;
    this.canvas.height = this.height * window.devicePixelRatio;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
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
      minX = Math.min(minX, it.x);
      minY = Math.min(minY, it.y);
      maxX = Math.max(maxX, it.x + (it.width || 50));
      maxY = Math.max(maxY, it.y + (it.height || 50));
    });

    const padding = 100;
    const boxW = Math.max(100, maxX - minX + padding * 2);
    const boxH = Math.max(100, maxY - minY + padding * 2);
    const zoomX = this.width / boxW;
    const zoomY = this.height / boxH;
    this.camera.zoom = Math.min(1.5, Math.max(0.2, Math.min(zoomX, zoomY)));

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
    this.ctx.save();
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Fondo y cuadricula de puntos infinita
    this.drawDotGrid();

    // Aplicar transformacion de camara
    this.ctx.translate(this.width / 2, this.height / 2);
    this.ctx.scale(this.camera.zoom, this.camera.zoom);
    this.ctx.translate(this.camera.x, this.camera.y);

    // 1. Dibujar marcos (fondo)
    this.items.filter(it => it.type === 'frame').forEach(it => this.drawFrame(it));

    // 2. Dibujar conectores
    this.items.filter(it => it.type === 'connector').forEach(it => this.drawConnector(it));

    // 3. Dibujar formas e imagenes
    this.items.filter(it => it.type === 'shape').forEach(it => this.drawShape(it));
    this.items.filter(it => it.type === 'image').forEach(it => this.drawImage(it));

    // 4. Dibujar notas adhesivas
    this.items.filter(it => it.type === 'sticky_note').forEach(it => this.drawStickyNote(it));

    // 5. Dibujar textos y dibujos
    this.items.filter(it => it.type === 'text').forEach(it => this.drawText(it));
    this.items.filter(it => it.type === 'pen').forEach(it => this.drawPen(it));

    // 6. Dibujar seleccion y recuadro marquee
    this.drawSelectionOutline();
    this.drawMarquee();

    this.ctx.restore();
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
      this.ctx.fillStyle = it.strokeColor || '#1a1a1a';
      this.ctx.font = '14px -apple-system, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.wrapText(this.ctx, it.text, it.x + it.width / 2, it.y + it.height / 2, it.width - 16, 18);
    }

    this.ctx.restore();
  }

  drawText(it) {
    this.ctx.save();
    this.ctx.fillStyle = it.color || '#1a1a1a';
    this.ctx.font = `${it.fontSize || 20}px -apple-system, sans-serif`;
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';
    this.ctx.fillText(it.text || '', it.x, it.y);
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
    // Borde discontinuo elegante
    this.ctx.strokeStyle = '#a3a3a3';
    this.ctx.lineWidth = 1.5;
    this.ctx.setLineDash([6, 6]);
    this.ctx.strokeRect(it.x, it.y, it.width, it.height);
    this.ctx.setLineDash([]);

    // Etiqueta del marco arriba
    this.ctx.fillStyle = '#737373';
    this.ctx.font = '13px -apple-system, sans-serif';
    this.ctx.fillText(it.title || 'Marco', it.x, it.y - 8);
    this.ctx.restore();
  }

  drawImage(it) {
    if (!it.imgElement) {
      it.imgElement = new Image();
      it.imgElement.src = it.src;
      it.imgElement.onload = () => this.render();
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

  wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let lines = [];
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

    const startY = y - ((lines.length - 1) * lineHeight) / 2;
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
}
